import { createStreamingTTS, type StreamingTtsEngine } from 'react-native-sherpa-onnx/tts';
import { KOKORO_EN_SID, KOKORO_HI_SID } from '../models/registry';
import type { LocalModel } from '../models/downloader';
import { toNativePath } from '../models/downloader';
import { hasDevanagari } from './chunker';

type Loaded = {
  engine: StreamingTtsEngine;
  sampleRate: number;
  /**
   * startPcmPlayer() resolves to void, and the Android helper stops the current
   * AudioTrack before creating a new one, which drops samples already queued.
   * Start once per engine and reuse it until stop or release.
   */
  playerStarted: boolean;
  playerReady: Promise<void>;
  /** writePcmChunk() also returns a promise (AudioTrack WRITE_BLOCKING). */
  writeChain: Promise<void>;
  /** Bumped on stop so a write already queued cannot restart the player. */
  playGen: number;
};

const loaded = new Map<string, Loaded>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function load(id: string, modelDir: string): Promise<Loaded> {
  const existing = loaded.get(id);
  if (existing) return existing;
  const engine = await createStreamingTTS({
    modelPath: { type: 'file', path: toNativePath(modelDir) },
    modelType: 'auto',
    numThreads: 2,
  });
  const sampleRate = await engine.getSampleRate();
  const entry: Loaded = {
    engine,
    sampleRate,
    playerStarted: false,
    playerReady: Promise.resolve(),
    writeChain: Promise.resolve(),
    playGen: 0,
  };
  loaded.set(id, entry);
  return entry;
}

function ensurePlayer(entry: Loaded): Promise<void> {
  if (!entry.playerStarted) {
    entry.playerStarted = true;
    entry.playerReady = entry.engine.startPcmPlayer(entry.sampleRate, 1).catch((error: unknown) => {
      entry.playerStarted = false;
      entry.playerReady = Promise.resolve();
      throw error;
    });
  }
  return entry.playerReady;
}

function resetPlayer(entry: Loaded): void {
  entry.playGen += 1;
  entry.playerStarted = false;
  entry.playerReady = Promise.resolve();
}

export async function warmupSherpa(models: Record<string, LocalModel>): Promise<void> {
  const preferred = models['kokoro-int8'] ?? models['piper-en-lessac'] ?? models['piper-hi-priyamvada'];
  if (!preferred?.modelDir) return;
  const entry = await load(preferred.id, preferred.modelDir);
  const controller = await entry.engine.generateSpeechStream('ok', { sid: 0 }, {
    onChunk: () => undefined,
  });
  await controller.cancel();
}

export async function releaseSherpa(): Promise<void> {
  for (const entry of loaded.values()) {
    resetPlayer(entry);
    await entry.engine.stopPcmPlayer().catch(() => undefined);
    await entry.engine.destroy().catch(() => undefined);
  }
  loaded.clear();
}

export function pickSherpaVoice(
  text: string,
  models: Record<string, LocalModel>,
  kokoroSid: number,
): { id: string; sid: number; modelDir: string } | null {
  if (hasDevanagari(text) && models['piper-hi-priyamvada']?.modelDir) {
    return { id: 'piper-hi-priyamvada', sid: 0, modelDir: models['piper-hi-priyamvada'].modelDir };
  }
  if (!hasDevanagari(text) && models['kokoro-int8']?.modelDir) {
    return { id: 'kokoro-int8', sid: kokoroSid || KOKORO_EN_SID, modelDir: models['kokoro-int8'].modelDir };
  }
  if (!hasDevanagari(text) && models['piper-en-lessac']?.modelDir) {
    return { id: 'piper-en-lessac', sid: 0, modelDir: models['piper-en-lessac'].modelDir };
  }
  if (hasDevanagari(text) && models['kokoro-int8']?.modelDir) {
    return { id: 'kokoro-int8', sid: KOKORO_HI_SID, modelDir: models['kokoro-int8'].modelDir };
  }
  const any = models['kokoro-int8'] ?? models['piper-en-lessac'] ?? models['piper-hi-priyamvada'];
  if (!any?.modelDir) return null;
  return { id: any.id, sid: 0, modelDir: any.modelDir };
}

export async function speakSherpa(options: {
  text: string;
  voice: { id: string; sid: number; modelDir: string };
  onFirstAudio: () => void;
  cancelled: () => boolean;
}): Promise<{ synthMs: number; audioMs: number }> {
  const started = performance.now();
  const entry = await load(options.voice.id, options.voice.modelDir);
  const gen = entry.playGen;
  let audioSamples = 0;
  let firstChunkAt = 0;
  await new Promise<void>((resolve, reject) => {
    entry.engine
      .generateSpeechStream(options.text, { sid: options.voice.sid }, {
        onChunk: (chunk) => {
          if (options.cancelled() || entry.playGen !== gen || chunk.samples.length === 0) return;
          audioSamples += chunk.samples.length;
          if (firstChunkAt === 0) {
            firstChunkAt = performance.now();
            options.onFirstAudio();
          }
          const samples = chunk.samples;
          entry.writeChain = entry.writeChain
            .then(async () => {
              if (options.cancelled() || entry.playGen !== gen) return;
              await ensurePlayer(entry);
              if (options.cancelled() || entry.playGen !== gen) return;
              await entry.engine.writePcmChunk(samples);
            })
            .catch(() => undefined);
        },
        onEnd: () => resolve(),
        onError: (event) => reject(new Error(event.message)),
      })
      .catch(reject);
  });
  await entry.writeChain.catch(() => undefined);
  const synthMs = performance.now() - started;
  const rate = entry.sampleRate || 22050;
  const audioMs = (audioSamples / rate) * 1000;
  if (!options.cancelled() && entry.playGen === gen && firstChunkAt > 0 && audioMs > 0) {
    const remaining = audioMs - (performance.now() - firstChunkAt);
    await sleep(Math.max(0, remaining) + 80);
  }
  return { synthMs, audioMs };
}

export async function stopSherpaPlayback(): Promise<void> {
  for (const entry of loaded.values()) {
    resetPlayer(entry);
    await entry.engine.cancelSpeechStream().catch(() => undefined);
    await entry.engine.stopPcmPlayer().catch(() => undefined);
  }
}
