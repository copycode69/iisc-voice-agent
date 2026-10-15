import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter';
import { transcribePcm, whisperLanguage } from '../stt/whisper';
import type { LangMode } from '../settings/store';

export type ListenHandlers = {
  onLevel: (level: number) => void;
  onSpeechEnd: () => void;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
};

/** Keep the loud part, at most 8 seconds, so on-device Whisper can finish. */
function trimSpeech(pcm: Uint8Array): Uint8Array {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const samples = Math.floor(pcm.byteLength / 2);
  const frame = 320;
  let first = -1;
  let last = -1;
  for (let i = 0; i + frame <= samples; i += frame) {
    let sum = 0;
    let n = 0;
    for (let j = 0; j < frame; j += 8) {
      const value = view.getInt16((i + j) * 2, true);
      sum += value * value;
      n += 1;
    }
    if (Math.sqrt(sum / Math.max(1, n)) > 400) {
      if (first < 0) first = i;
      last = i + frame;
    }
  }
  if (first < 0 || last <= first) return new Uint8Array(0);
  const pad = 1600;
  let start = Math.max(0, first - pad);
  let end = Math.min(samples, last + pad);
  const maxSamples = 8 * 16000;
  if (end - start > maxSamples) start = end - maxSamples;
  return pcm.subarray(start * 2, end * 2);
}

function levelOf(chunk: Uint8Array): number {
  if (chunk.byteLength < 2) return 0;
  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  const samples = Math.floor(chunk.byteLength / 2);
  let sum = 0;
  const step = Math.max(1, Math.floor(samples / 80));
  let count = 0;
  for (let i = 0; i < samples; i += step) {
    const value = view.getInt16(i * 2, true) / 32768;
    sum += value * value;
    count += 1;
  }
  return Math.min(1, Math.sqrt(sum / Math.max(1, count)) * 8);
}

/**
 * Records 16 kHz mono PCM until stop() (the Pause button), then transcribes
 * that buffer once. The live whisper transcriber crashes this phone.
 */
export async function startListening(options: {
  lang: LangMode;
  sttModelId: string;
  vadSilenceMs: number;
  handlers: ListenHandlers;
}): Promise<{ stop: () => Promise<string> }> {
  const audio = new AudioPcmStreamAdapter();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  audio.onData((frame) => {
    const owned = new Uint8Array(frame.data.byteLength);
    owned.set(frame.data);
    chunks.push(owned);
    bytes += owned.byteLength;
    options.handlers.onLevel(levelOf(owned));
  });
  audio.onError((message) => options.handlers.onError(message));
  await audio.initialize({
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    audioSource: 1,
    bufferSize: 16 * 1024,
  });
  await audio.start();

  return {
    stop: async () => {
      await audio.stop();
      const waitStarted = Date.now();
      let last = -1;
      while (Date.now() - waitStarted < 600) {
        if (bytes > 0 && bytes === last) break;
        last = bytes;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      await audio.release();
      options.handlers.onSpeechEnd();
      const cap = 20 * 16000 * 2;
      const merged = new Uint8Array(Math.min(bytes, cap));
      let skip = Math.max(0, bytes - cap);
      let offset = 0;
      for (const chunk of chunks) {
        if (skip >= chunk.byteLength) {
          skip -= chunk.byteLength;
          continue;
        }
        const slice = chunk.subarray(skip);
        skip = 0;
        merged.set(slice, offset);
        offset += slice.byteLength;
      }
      if (offset < 8000) return '';
      const speech = trimSpeech(merged.subarray(0, offset));
      if (speech.byteLength < 8000) return '';
      return transcribePcm(speech, whisperLanguage(options.sttModelId, options.lang));
    },
  };
}
