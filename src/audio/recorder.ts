import { RealtimeTranscriber } from 'whisper.rn/realtime-transcription';
import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter';
import { getVad, getWhisper, whisperLanguage } from '../stt/whisper';
import type { LangMode } from '../settings/store';

export type ListenHandlers = {
  onLevel: (level: number) => void;
  onSpeechEnd: () => void;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
};

/**
 * Mic capture comes from whisper.rn's AudioPcmStreamAdapter, which records
 * 16 kHz mono PCM. Silero VAD ends the utterance after the configured silence.
 */
export async function startListening(options: {
  lang: LangMode;
  sttModelId: string;
  vadSilenceMs: number;
  handlers: ListenHandlers;
}): Promise<{ stop: () => Promise<string> }> {
  const whisper = getWhisper();
  const vad = getVad();
  if (!whisper || !vad) throw new Error('Speech models are not loaded.');

  const audioStream = new AudioPcmStreamAdapter();
  let speechEnded = false;
  let transcript = '';
  let resolveStop: (text: string) => void = () => undefined;
  const stopped = new Promise<string>((resolve) => {
    resolveStop = resolve;
  });

  const transcriber = new RealtimeTranscriber(
    { whisperContext: whisper, vadContext: vad, audioStream },
    {
      audioSliceSec: 20,
      audioMinSec: 0.4,
      maxSlicesInMemory: 2,
      autoSliceOnSpeechEnd: true,
      vadPreset: 'default',
      vadOptions: { minSilenceDurationMs: options.vadSilenceMs, threshold: 0.5 },
      transcribeOptions: {
        language: whisperLanguage(options.sttModelId, options.lang),
        maxThreads: 4,
        beamSize: 1,
        bestOf: 1,
        tokenTimestamps: false,
        temperature: 0,
      },
    },
    {
      onVad: (event) => {
        if (event.analysis?.averageAmplitude != null) {
          options.handlers.onLevel(Math.min(1, event.analysis.averageAmplitude * 8));
        }
        if (event.type === 'speech_end' && !speechEnded) {
          speechEnded = true;
          options.handlers.onSpeechEnd();
        }
      },
      onTranscribe: (event) => {
        const text = event.data?.result?.trim() ?? '';
        if (!text) return;
        transcript = text;
        if (speechEnded) {
          options.handlers.onTranscript(text);
          resolveStop(text);
        }
      },
      onError: (error) => options.handlers.onError(error),
    },
  );

  await transcriber.start();
  return {
    stop: async () => {
      await transcriber.stop();
      await transcriber.release();
      await audioStream.release();
      const text = transcript || (await Promise.race([
        stopped,
        new Promise<string>((resolve) => setTimeout(() => resolve(transcript), 50)),
      ]));
      resolveStop(text);
      return text.trim();
    },
  };
}
