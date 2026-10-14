import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { SentenceChunker } from '../tts/chunker';
import { SpeechQueue, speakTestLines } from '../tts/engine';
import { warmupSherpa } from '../tts/sherpa';
import { ensureStt, warmupStt } from '../stt/whisper';
import { startListening } from '../audio/recorder';
import { runAgent } from '../llm/agent';
import { warmProvider } from '../llm/stream';
import type { ChatMessage } from '../llm/prompt';
import { appendTurn, type TurnMetric } from '../metrics/store';
import { listLocalModels, type LocalModel } from '../models/downloader';
import {
  loadApiKey,
  loadSettings,
  providerConfig,
  saveSettings,
  type LangMode,
  type Settings,
} from '../settings/store';

export type Phase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

export type Bubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  metric?: TurnMetric;
};

type Stopper = { stop: () => Promise<string> };

type Vaani = {
  ready: boolean;
  settings: Settings;
  setSettings: (next: Settings) => void;
  models: Record<string, LocalModel>;
  refreshModels: () => Promise<void>;
  phase: Phase;
  level: number;
  bubbles: Bubble[];
  error: string;
  toggleMic: () => Promise<void>;
  sayTestLines: () => Promise<void>;
  setLang: (lang: LangMode) => void;
};

const Ctx = createContext<Vaani | null>(null);

export function useVaani(): Vaani {
  const value = useContext(Ctx);
  if (!value) throw new Error('useVaani outside provider');
  return value;
}

export function VaaniProvider(props: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [models, setModels] = useState<Record<string, LocalModel>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [error, setError] = useState('');
  const history = useRef<ChatMessage[]>([]);
  const listenRef = useRef<Stopper | null>(null);
  const queueRef = useRef<SpeechQueue | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const turnRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  settingsRef.current = settings;

  const refreshModels = async () => setModels(await listLocalModels());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadSettings();
      const local = await listLocalModels();
      if (cancelled) return;
      setSettingsState(loaded);
      setModels(local);
      setReady(true);
      const key = await loadApiKey(loaded.provider);
      warmProvider(providerConfig(loaded, key)).catch(() => undefined);
      if (local[loaded.sttModelId] && local['silero-vad']) {
        ensureStt(local, loaded.sttModelId)
          .then(() => warmupStt())
          .catch(() => undefined);
      }
      warmupSherpa(local).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSettings = (next: Settings) => {
    setSettingsState(next);
    void saveSettings(next);
  };

  const setLang = (lang: LangMode) => {
    if (!settings) return;
    setSettings({ ...settings, lang });
  };

  const stopSpeaking = () => {
    queueRef.current?.stop();
    queueRef.current = null;
  };

  const cancelTurn = () => {
    turnRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
  };

  const isAbort = (err: unknown) => err instanceof Error && err.name === 'AbortError';

  const speakReply = (text: string, onFirstAudio: () => void) => {
    if (!settings) return Promise.resolve();
    stopSpeaking();
    const queue = new SpeechQueue(models, settings.kokoroSid, settings.ttsEngine === 'system');
    queue.onFirstAudio = onFirstAudio;
    queueRef.current = queue;
    queue.enqueue(text);
    return queue.drain();
  };

  const sayTestLines = async () => {
    if (!settings) return;
    cancelTurn();
    setError('');
    setPhase('speaking');
    const queue = new SpeechQueue(models, settings.kokoroSid, settings.ttsEngine === 'system');
    queueRef.current = queue;
    try {
      await speakTestLines(queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test speech failed');
    } finally {
      if (queueRef.current === queue) setPhase('idle');
    }
  };

  const handleUtterance = async (transcript: string, speechEnd: number, sttDone: number) => {
    const current = settingsRef.current;
    if (!current) return;
    cancelTurn();
    const turnId = turnRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const stale = () => turnId !== turnRef.current || controller.signal.aborted;
    const userId = `${Date.now()}-u`;
    const assistantId = `${Date.now()}-a`;
    setBubbles((prev) => [
      ...prev,
      { id: userId, role: 'user', text: transcript },
      { id: assistantId, role: 'assistant', text: '' },
    ]);
    setPhase('thinking');
    const key = await loadApiKey(current.provider);
    if (!key) {
      if (turnId === turnRef.current) {
        setError('Add an API key in Settings. Speech-to-text still works without it.');
        setPhase('idle');
      }
      return;
    }
    if (stale()) return;
    const chunker = new SentenceChunker();
    const queue = new SpeechQueue(models, current.kokoroSid, current.ttsEngine === 'system');
    queueRef.current = queue;
    let firstTokenAt: number | null = null;
    let firstAudioAt: number | null = null;
    queue.onFirstAudio = () => {
      if (firstAudioAt == null) firstAudioAt = performance.now();
    };
    try {
      const result = await runAgent({
        provider: providerConfig(current, key),
        history: history.current,
        userText: transcript,
        hinglishScript: current.hinglishScript,
        signal: controller.signal,
        onText: (delta) => {
          if (stale()) return;
          if (firstTokenAt == null) {
            firstTokenAt = performance.now();
            setPhase('speaking');
          }
          setBubbles((prev) =>
            prev.map((bubble) => (bubble.id === assistantId ? { ...bubble, text: bubble.text + delta } : bubble)),
          );
          for (const sentence of chunker.push(delta)) queue.enqueue(sentence);
        },
      });
      if (stale()) return;
      const tail = chunker.flush();
      if (tail) queue.enqueue(tail);
      if (!result.text && !tail) queue.enqueue('I did not catch a reply.');
      await queue.drain();
      if (stale()) return;
      const audioAt = firstAudioAt ?? performance.now();
      const tokenAt = result.firstTokenAt ?? firstTokenAt ?? audioAt;
      const metric: TurnMetric = {
        at: new Date().toISOString(),
        lang: current.lang,
        sttModelId: current.sttModelId,
        llmModel: providerConfig(current, key).model,
        transcript,
        reply: result.text,
        vadToSttMs: Math.max(0, sttDone - speechEnd),
        sttToFirstTokenMs: Math.max(0, tokenAt - sttDone),
        firstTokenToAudioMs: Math.max(0, audioAt - tokenAt),
        totalMs: Math.max(0, audioAt - speechEnd),
        toolMs: result.toolMs,
      };
      const userMessage: ChatMessage = { role: 'user', content: transcript };
      const assistantMessage: ChatMessage = { role: 'assistant', content: result.text };
      history.current = [...history.current, userMessage, assistantMessage].slice(-12);
      setBubbles((prev) => prev.map((bubble) => (bubble.id === assistantId ? { ...bubble, metric } : bubble)));
      await appendTurn(metric);
      if (stale()) return;
      if (current.handsFree) void beginListen();
      else setPhase('idle');
    } catch (err) {
      if (isAbort(err) || stale()) {
        if (turnId === turnRef.current) setPhase('idle');
        return;
      }
      setError(err instanceof Error ? err.message : 'The assistant failed');
      setPhase('idle');
    }
  };

  const beginListen = async () => {
    const current = settingsRef.current;
    if (!current) return;
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setError('Microphone permission is required.');
        return;
      }
    }
    setError('');
    cancelTurn();
    await ensureStt(models, current.sttModelId);
    let speechEnd = performance.now();
    setPhase('listening');
    const session = await startListening({
      lang: current.lang,
      sttModelId: current.sttModelId,
      vadSilenceMs: current.vadSilenceMs,
      handlers: {
        onLevel: setLevel,
        onSpeechEnd: () => {
          speechEnd = performance.now();
          setPhase('transcribing');
        },
        onTranscript: (text) => {
          const sttDone = performance.now();
          listenRef.current = null;
          setTimeout(() => {
            void session.stop().finally(() => {
              void handleUtterance(text, speechEnd, sttDone);
            });
          }, 0);
        },
        onError: setError,
      },
    });
    listenRef.current = session;
  };

  const toggleMic = async () => {
    if (listenRef.current) {
      const session = listenRef.current;
      listenRef.current = null;
      setPhase('transcribing');
      const speechEnd = performance.now();
      const text = await session.stop();
      if (text) await handleUtterance(text, speechEnd, performance.now());
      else setPhase('idle');
      return;
    }
    if (phase === 'speaking' || phase === 'thinking') {
      cancelTurn();
      setPhase('idle');
      return;
    }
    try {
      await beginListen();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the microphone');
      setPhase('idle');
    }
  };

  const value = useMemo<Vaani | null>(() => {
    if (!settings) return null;
    return {
      ready,
      settings,
      setSettings,
      models,
      refreshModels,
      phase,
      level,
      bubbles,
      error,
      toggleMic,
      sayTestLines,
      setLang,
    };
  }, [ready, settings, models, phase, level, bubbles, error]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}
