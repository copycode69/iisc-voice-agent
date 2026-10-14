import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type ProviderId = 'groq' | 'gemini';
export type LangMode = 'auto' | 'en' | 'hinglish';
export type TtsEngineId = 'sherpa' | 'system';
export type HinglishScript = 'devanagari' | 'mixed';

export type Settings = {
  provider: ProviderId;
  groqModel: string;
  geminiModel: string;
  sttModelId: string;
  ttsEngine: TtsEngineId;
  kokoroSid: number;
  vadSilenceMs: number;
  handsFree: boolean;
  lang: LangMode;
  hinglishScript: HinglishScript;
};

export const GROQ_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b'];
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

export const DEFAULT_SETTINGS: Settings = {
  provider: 'groq',
  groqModel: 'openai/gpt-oss-20b',
  geminiModel: 'gemini-2.5-flash',
  sttModelId: 'whisper-small-q5',
  ttsEngine: 'sherpa',
  kokoroSid: 3,
  vadSilenceMs: 600,
  handsFree: false,
  lang: 'auto',
  hinglishScript: 'devanagari',
};

const SETTINGS_KEY = 'vaani.settings.v1';

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function keyName(provider: ProviderId): string {
  return provider === 'groq' ? 'vaani.groq.key' : 'vaani.gemini.key';
}

export async function loadApiKey(provider: ProviderId): Promise<string> {
  return (await SecureStore.getItemAsync(keyName(provider))) ?? '';
}

export async function saveApiKey(provider: ProviderId, key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    await SecureStore.deleteItemAsync(keyName(provider));
    return;
  }
  await SecureStore.setItemAsync(keyName(provider), trimmed);
}

export function providerConfig(settings: Settings, apiKey: string): { id: ProviderId; baseUrl: string; model: string; apiKey: string } {
  if (settings.provider === 'gemini') {
    return {
      id: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: settings.geminiModel,
      apiKey,
    };
  }
  return {
    id: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: settings.groqModel,
    apiKey,
  };
}
