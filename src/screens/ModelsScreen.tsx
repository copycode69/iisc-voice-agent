import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { deleteModel, downloadModel, type DownloadProgress } from '../models/downloader';
import { MODELS } from '../models/registry';
import { useVaani } from '../state/VaaniProvider';
import { ScreenHeader } from '../ui/Screen';
import { theme } from '../ui/theme';

function formatMb(bytes?: number): string {
  if (!bytes) return 'size checked after download';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModelsScreen(props: { onBack: () => void }) {
  const { models, refreshModels } = useVaani();
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const start = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      await downloadModel(id, (update) => setProgress((prev) => ({ ...prev, [id]: update })));
      await refreshModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader title="Models" onBack={props.onBack} />
      <Text style={styles.intro}>Models stay in this app’s documents folder. They are not inside the APK.</Text>
      {MODELS.map((model) => {
        const local = models[model.id];
        const update = progress[model.id];
        const ratio = update && update.expected > 0 ? Math.min(1, update.written / update.expected) : 0;
        return (
          <View key={model.id} style={styles.card}>
            <Text style={styles.title}>{model.title}</Text>
            <Text style={styles.detail}>{model.detail}</Text>
            <Text style={styles.detail}>{local ? `On phone · ${formatMb(local.bytes)}` : formatMb(model.expectedBytes)}</Text>
            {update && update.phase !== 'done' ? (
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
            ) : null}
            <View style={styles.row}>
              <Pressable disabled={busy !== null} onPress={() => void start(model.id)} style={styles.btn}>
                <Text style={styles.btnText}>{busy === model.id ? update?.phase ?? 'Working' : local ? 'Downloaded' : 'Download'}</Text>
              </Pressable>
              {local ? (
                <Pressable
                  onPress={() => {
                    void deleteModel(model.id).then(refreshModels);
                  }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingBottom: 40 },
  intro: { color: theme.muted, fontFamily: theme.font, marginBottom: 12, lineHeight: 20 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 12 },
  title: { color: theme.text, fontFamily: theme.fontBold, fontSize: 16 },
  detail: { color: theme.muted, fontFamily: theme.font, marginTop: 4, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { backgroundColor: theme.accentDim, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  btnText: { color: theme.text, fontFamily: theme.fontBold },
  track: { height: 6, backgroundColor: theme.bg, borderRadius: 99, marginTop: 10, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: theme.accent },
  error: { color: theme.danger, fontFamily: theme.font },
});
