import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type TurnMetric = {
  at: string;
  lang: string;
  sttModelId: string;
  llmModel: string;
  transcript: string;
  reply: string;
  vadToSttMs: number;
  sttToFirstTokenMs: number;
  firstTokenToAudioMs: number;
  totalMs: number;
  toolMs: number;
};

export type BenchRow = {
  at: string;
  sttModelId: string;
  lang: 'en' | 'hinglish';
  reference: string;
  hypothesis: string;
  wer: number;
  cer: number;
  sttMs: number;
};

const TURNS_KEY = 'vaani.turns.v1';
const BENCH_KEY = 'vaani.bench.v1';

export async function loadTurns(): Promise<TurnMetric[]> {
  return readList<TurnMetric>(TURNS_KEY);
}

export async function appendTurn(turn: TurnMetric): Promise<void> {
  const turns = await loadTurns();
  turns.push(turn);
  await AsyncStorage.setItem(TURNS_KEY, JSON.stringify(turns.slice(-200)));
}

export async function loadBench(): Promise<BenchRow[]> {
  return readList<BenchRow>(BENCH_KEY);
}

export async function appendBench(row: BenchRow): Promise<void> {
  const rows = await loadBench();
  rows.push(row);
  await AsyncStorage.setItem(BENCH_KEY, JSON.stringify(rows));
}

async function readList<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export async function shareText(filename: string, contents: string): Promise<void> {
  if (!cacheDirectory) throw new Error('Cache directory is unavailable.');
  const uri = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(uri, contents);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri);
}
