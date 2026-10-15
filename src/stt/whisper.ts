import { initWhisper, initWhisperVad, type WhisperContext, type WhisperVadContext } from 'whisper.rn';
import type { LangMode } from '../settings/store';
import type { LocalModel } from '../models/downloader';
import { toNativePath } from '../models/downloader';
import { modelById } from '../models/registry';

let whisper: WhisperContext | null = null;
let whisperId = '';
let vad: WhisperVadContext | null = null;

export function getWhisper(): WhisperContext | null {
  return whisper;
}

export function getVad(): WhisperVadContext | null {
  return vad;
}

export async function ensureStt(models: Record<string, LocalModel>, sttModelId: string): Promise<void> {
  return oneAtATime(async () => {
    const stt = models[sttModelId];
    const vadModel = models['silero-vad'];
    if (!stt) throw new Error('Download a speech model first.');
    if (!vadModel) throw new Error('Download the Silero VAD model first.');
    if (!vad) {
      vad = await initWhisperVad({ filePath: toNativePath(vadModel.path), nThreads: 2, useGpu: false });
    }
    if (!whisper || whisperId !== sttModelId) {
      if (whisper) await whisper.release();
      whisper = await initWhisper({ filePath: toNativePath(stt.path), useGpu: false });
      whisperId = sttModelId;
    }
  });
}

export function whisperLanguage(sttModelId: string, lang: LangMode): string {
  const spec = modelById(sttModelId);
  return spec?.languages?.[lang] ?? 'auto';
}

let job: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const run = job.then(work, work);
  job = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function transcribePcm(bytes: Uint8Array, language: string): Promise<string> {
  if (!whisper) throw new Error('Speech model is not loaded.');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return oneAtATime(async () => {
    const task = whisper!.transcribeData(copy.buffer, {
      language,
      maxThreads: 4,
      tokenTimestamps: false,
      temperature: 0,
      temperatureInc: 0,
    });
    const result = await task.promise;
    return result.result.replace(/\[(?:silence|BLANK_AUDIO)\]/gi, '').trim();
  });
}

export async function transcribeFile(path: string, language: string): Promise<{ text: string; ms: number }> {
  if (!whisper) throw new Error('Speech model is not loaded.');
  const started = performance.now();
  const task = whisper.transcribe(toNativePath(path), {
    language,
    maxThreads: 4,
    tokenTimestamps: false,
    temperature: 0,
    temperatureInc: 0,
  });
  const result = await task.promise;
  return { text: result.result.trim(), ms: performance.now() - started };
}
