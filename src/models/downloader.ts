import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
  readDirectoryAsync,
  createDownloadResumable,
  type DownloadPauseState,
} from 'expo-file-system/legacy';
import { extractArchive } from 'react-native-sherpa-onnx/extraction';
import { modelById, MODELS, type ModelSpec } from './registry';

const RESUME_KEY = 'vaani.downloadResume.v1';

export type LocalModel = {
  id: string;
  bytes: number;
  path: string;
  /** Directory sherpa should load. Set for TTS archives. */
  modelDir?: string;
};

export type DownloadProgress = {
  id: string;
  written: number;
  expected: number;
  phase: 'downloading' | 'extracting' | 'done' | 'error';
  message?: string;
};

function modelsRoot(): string {
  if (!documentDirectory) throw new Error('Document directory is unavailable.');
  return `${documentDirectory}models/`;
}

export function toNativePath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

async function ensureDir(uri: string): Promise<void> {
  const info = await getInfoAsync(uri);
  if (!info.exists) {
    await makeDirectoryAsync(uri, { intermediates: true });
  }
}

async function readResumeMap(): Promise<Record<string, DownloadPauseState>> {
  const raw = await AsyncStorage.getItem(RESUME_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DownloadPauseState>;
  } catch {
    return {};
  }
}

async function writeResumeMap(map: Record<string, DownloadPauseState>): Promise<void> {
  await AsyncStorage.setItem(RESUME_KEY, JSON.stringify(map));
}

export async function listLocalModels(): Promise<Record<string, LocalModel>> {
  const root = modelsRoot();
  await ensureDir(root);
  const out: Record<string, LocalModel> = {};
  for (const spec of MODELS) {
    const fileUri = `${root}${spec.filename}`;
    const info = await getInfoAsync(fileUri);
    if (!info.exists || !info.size) continue;
    const local: LocalModel = { id: spec.id, bytes: info.size, path: fileUri };
    if (spec.archive) {
      const dir = await findExtractedDir(spec);
      if (!dir) continue;
      local.modelDir = dir;
    }
    if (spec.expectedBytes && info.size !== spec.expectedBytes) continue;
    out[spec.id] = local;
  }
  return out;
}

async function findExtractedDir(spec: ModelSpec): Promise<string | null> {
  const dir = `${modelsRoot()}extracted/${spec.id}/`;
  const info = await getInfoAsync(dir);
  if (!info.exists) return null;
  const names = await readDirectoryAsync(dir);
  if (names.some((name) => name.endsWith('.onnx') || name === 'tokens.txt')) {
    return dir;
  }
  for (const name of names) {
    const child = `${dir}${name}/`;
    const childInfo = await getInfoAsync(child);
    if (!childInfo.exists || childInfo.isDirectory === false) continue;
    const inner = await readDirectoryAsync(child);
    if (inner.some((entry) => entry.endsWith('.onnx') || entry === 'tokens.txt')) {
      return child;
    }
  }
  return null;
}

export async function deleteModel(id: string): Promise<void> {
  const spec = modelById(id);
  if (!spec) return;
  const root = modelsRoot();
  await deleteAsync(`${root}${spec.filename}`, { idempotent: true });
  await deleteAsync(`${root}extracted/${id}`, { idempotent: true });
  const map = await readResumeMap();
  delete map[id];
  await writeResumeMap(map);
}

export async function downloadModel(
  id: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<LocalModel> {
  const spec = modelById(id);
  if (!spec) throw new Error(`Unknown model ${id}`);
  const root = modelsRoot();
  await ensureDir(root);
  const dest = `${root}${spec.filename}`;
  const existing = await getInfoAsync(dest);
  if (existing.exists && existing.size && (!spec.expectedBytes || existing.size === spec.expectedBytes)) {
    if (!spec.archive || (await findExtractedDir(spec))) {
      const local = (await listLocalModels())[id];
      if (local) return local;
    }
  }

  const map = await readResumeMap();
  const saved = map[id];
  const task = saved
    ? createDownloadResumable(
        saved.url,
        saved.fileUri,
        saved.options,
        (event) => {
          onProgress({
            id,
            written: event.totalBytesWritten,
            expected: event.totalBytesExpectedToWrite,
            phase: 'downloading',
          });
        },
        saved.resumeData,
      )
    : createDownloadResumable(spec.url, dest, {}, (event) => {
        onProgress({
          id,
          written: event.totalBytesWritten,
          expected: event.totalBytesExpectedToWrite,
          phase: 'downloading',
        });
      });

  let result: Awaited<ReturnType<typeof task.downloadAsync>>;
  try {
    result = saved?.resumeData ? await task.resumeAsync() : await task.downloadAsync();
  } catch (error) {
    const paused = task.savable();
    map[id] = paused;
    await writeResumeMap(map);
    onProgress({
      id,
      written: 0,
      expected: 0,
      phase: 'error',
      message: error instanceof Error ? error.message : 'Download failed',
    });
    throw error;
  }

  delete map[id];
  await writeResumeMap(map);
  const info = await getInfoAsync(result?.uri ?? dest);
  const expected = spec.expectedBytes;
  if (!info.exists || !info.size) throw new Error(`${spec.title} downloaded empty.`);
  if (expected && info.size !== expected) {
    await deleteAsync(dest, { idempotent: true });
    throw new Error(`${spec.title} size ${info.size} did not match ${expected}.`);
  }

  let modelDir: string | undefined;
  if (spec.archive) {
    onProgress({ id, written: info.size, expected: info.size, phase: 'extracting' });
    const target = `${root}extracted/${spec.id}/`;
    await ensureDir(target);
    await extractArchive(
      {
        modelId: spec.id,
        archivePath: toNativePath(dest),
        format: 'tar.bz2',
        fileSize: info.size,
      },
      toNativePath(target),
      { force: true },
    );
    modelDir = (await findExtractedDir(spec)) ?? undefined;
    if (!modelDir) throw new Error(`${spec.title} extracted, but no ONNX model was found.`);
  }

  onProgress({ id, written: info.size, expected: info.size, phase: 'done' });
  return { id, bytes: info.size, path: dest, modelDir };
}
