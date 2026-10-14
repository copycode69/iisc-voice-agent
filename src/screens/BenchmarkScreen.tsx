import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BENCH_SENTENCES } from '../benchmark/sentences';
import { bestError } from '../metrics/wer';
import { appendBench, loadBench, shareText, type BenchRow } from '../metrics/store';
import { startListening } from '../audio/recorder';
import { ensureStt } from '../stt/whisper';
import { useVaani } from '../state/VaaniProvider';
import { ScreenHeader } from '../ui/Screen';
import { theme } from '../ui/theme';

export function BenchmarkScreen(props: { onBack: () => void }) {
  const vaani = useVaani();
  const [index, setIndex] = useState(0);
  const [heard, setHeard] = useState('');
  const [status, setStatus] = useState('Read the line, then tap Record.');
  const sentence = BENCH_SENTENCES[index];

  const record = async () => {
    setStatus('Listening…');
    setHeard('');
    await ensureStt(vaani.models, vaani.settings.sttModelId);
    const started = performance.now();
    let finalText = '';
    const session = await startListening({
      lang: sentence.lang === 'en' ? 'en' : 'hinglish',
      sttModelId: vaani.settings.sttModelId,
      vadSilenceMs: vaani.settings.vadSilenceMs,
      handlers: {
        onLevel: () => undefined,
        onSpeechEnd: () => setStatus('Transcribing…'),
        onTranscript: (text) => {
          finalText = text;
        },
        onError: setStatus,
      },
    });
    const text = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        void session.stop().then((stopped) => resolve(stopped || finalText));
      }, 12000);
      const check = setInterval(() => {
        if (!finalText) return;
        clearInterval(check);
        clearTimeout(timer);
        void session.stop().then((stopped) => resolve(stopped || finalText));
      }, 250);
    });
    const hypothesis = text;
    const score = bestError(hypothesis, [sentence.text, sentence.alt].filter((item): item is string => Boolean(item)));
    const row: BenchRow = {
      at: new Date().toISOString(),
      sttModelId: vaani.settings.sttModelId,
      lang: sentence.lang,
      reference: sentence.text,
      hypothesis,
      wer: score.wer,
      cer: score.cer,
      sttMs: performance.now() - started,
    };
    await appendBench(row);
    setHeard(hypothesis);
    setStatus(`WER ${(score.wer * 100).toFixed(1)}% · CER ${(score.cer * 100).toFixed(1)}%`);
  };

  const exportCsv = async () => {
    const rows = await loadBench();
    const header = 'at,model,lang,wer,cer,stt_ms,reference,hypothesis';
    const body = rows
      .map((row) =>
        [row.at, row.sttModelId, row.lang, row.wer.toFixed(4), row.cer.toFixed(4), Math.round(row.sttMs), JSON.stringify(row.reference), JSON.stringify(row.hypothesis)].join(','),
      )
      .join('\n');
    await shareText('vaani-benchmark.csv', `${header}\n${body}`);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader title="Benchmark" onBack={props.onBack} />
      <Text style={styles.count}>
        {index + 1} / {BENCH_SENTENCES.length} · {sentence.lang} · {vaani.settings.sttModelId}
      </Text>
      <Text style={styles.line}>{sentence.text}</Text>
      <Text style={styles.status}>{status}</Text>
      {heard ? <Text style={styles.heard}>Heard: {heard}</Text> : null}
      <Pressable onPress={() => void record()} style={styles.btn}>
        <Text style={styles.btnText}>Record this line</Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable onPress={() => setIndex((value) => Math.max(0, value - 1))} style={styles.btn}>
          <Text style={styles.btnText}>Previous</Text>
        </Pressable>
        <Pressable onPress={() => setIndex((value) => Math.min(BENCH_SENTENCES.length - 1, value + 1))} style={styles.btn}>
          <Text style={styles.btnText}>Next</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => void exportCsv()} style={styles.btn}>
        <Text style={styles.btnText}>Export CSV</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20 },
  count: { color: theme.muted, fontFamily: theme.font },
  line: { color: theme.text, fontFamily: theme.fontBold, fontSize: 22, lineHeight: 30, marginVertical: 16 },
  status: { color: theme.accent, fontFamily: theme.font, marginBottom: 8 },
  heard: { color: theme.text, fontFamily: theme.font, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: theme.card, borderRadius: 12, padding: 14, marginTop: 10, alignItems: 'center' },
  btnText: { color: theme.text, fontFamily: theme.fontBold },
});
