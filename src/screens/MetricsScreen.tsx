import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { loadTurns, percentile, shareText, type TurnMetric } from '../metrics/store';
import { ScreenHeader } from '../ui/Screen';
import { theme } from '../ui/theme';

function line(label: string, values: number[]): string {
  const med = percentile(values, 50);
  const p90 = percentile(values, 90);
  if (med == null || p90 == null) return `${label}: no turns yet`;
  return `${label}: median ${Math.round(med)} ms · p90 ${Math.round(p90)} ms`;
}

export function MetricsScreen(props: { onBack: () => void }) {
  const [turns, setTurns] = useState<TurnMetric[]>([]);
  useEffect(() => {
    loadTurns().then(setTurns).catch(() => setTurns([]));
  }, []);

  const exportJson = () => shareText('vaani-metrics.json', JSON.stringify(turns, null, 2));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader title="Metrics" onBack={props.onBack} />
      <Text style={styles.count}>{turns.length} real turns stored on this phone</Text>
      <Text style={styles.stat}>{line('Speech end to transcript', turns.map((turn) => turn.vadToSttMs))}</Text>
      <Text style={styles.stat}>{line('Transcript to first token', turns.map((turn) => turn.sttToFirstTokenMs))}</Text>
      <Text style={styles.stat}>{line('First token to audio', turns.map((turn) => turn.firstTokenToAudioMs))}</Text>
      <Text style={styles.stat}>{line('Speech end to first audio', turns.map((turn) => turn.totalMs))}</Text>
      <Pressable onPress={() => void exportJson()} style={styles.btn}>
        <Text style={styles.btnText}>Export JSON</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20 },
  count: { color: theme.text, fontFamily: theme.fontBold, fontSize: 18, marginBottom: 12 },
  stat: { color: theme.muted, fontFamily: theme.font, fontSize: 15, lineHeight: 24, marginBottom: 8 },
  btn: { backgroundColor: theme.card, borderRadius: 12, padding: 14, marginTop: 16, alignItems: 'center' },
  btnText: { color: theme.text, fontFamily: theme.fontBold },
});
