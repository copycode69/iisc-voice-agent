import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useVaani } from '../state/VaaniProvider';
import { ScreenHeader } from '../ui/Screen';
import { theme } from '../ui/theme';
import { GEMINI_MODELS, GROQ_MODELS, loadApiKey, saveApiKey, type HinglishScript, type ProviderId, type TtsEngineId } from '../settings/store';

export function SettingsScreen(props: { onBack: () => void }) {
  const { settings, setSettings } = useVaani();
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadApiKey(settings.provider).then(setKey).catch(() => setKey(''));
  }, [settings.provider]);

  const saveKey = () => {
    void saveApiKey(settings.provider, key).then(() => setSaved(true));
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader title="Settings" onBack={props.onBack} />
      <Text style={styles.label}>Provider</Text>
      <View style={styles.row}>
        {(['groq', 'gemini'] as ProviderId[]).map((provider) => (
          <Pressable key={provider} onPress={() => setSettings({ ...settings, provider })} style={[styles.chip, settings.provider === provider && styles.chipOn]}>
            <Text style={styles.chipText}>{provider}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>API key, stored on this phone</Text>
      <TextInput
        value={key}
        onChangeText={(value) => {
          setSaved(false);
          setKey(value);
        }}
        onEndEditing={saveKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Paste the Groq key"
        placeholderTextColor={theme.muted}
        style={styles.input}
      />
      <Pressable onPress={saveKey} style={[styles.chip, saved && styles.chipOn]}>
        <Text style={styles.chipText}>{saved ? 'Key saved on this phone' : 'Save key'}</Text>
      </Pressable>
      <Text style={styles.label}>Model</Text>
      <View style={styles.row}>
        {(settings.provider === 'groq' ? GROQ_MODELS : GEMINI_MODELS).map((model) => {
          const selected = settings.provider === 'groq' ? settings.groqModel === model : settings.geminiModel === model;
          return (
            <Pressable
              key={model}
              onPress={() =>
                setSettings(settings.provider === 'groq' ? { ...settings, groqModel: model } : { ...settings, geminiModel: model })
              }
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={styles.chipText}>{model}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Groq shut down llama-3.3-70b-versatile and llama-3.1-8b-instant on 16 Aug 2026 for free and developer use. gpt-oss-20b is the fast default.</Text>
      <Text style={styles.label}>Hinglish replies</Text>
      <View style={styles.row}>
        {(['devanagari', 'mixed'] as HinglishScript[]).map((script) => (
          <Pressable
            key={script}
            onPress={() => setSettings({ ...settings, hinglishScript: script })}
            style={[styles.chip, settings.hinglishScript === script && styles.chipOn]}
          >
            <Text style={styles.chipText}>{script === 'devanagari' ? 'Full Devanagari' : 'Mixed script'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Full Devanagari keeps one Hindi voice and pronounces the whole reply. Mixed script is the older style, for comparison.</Text>
      <Text style={styles.label}>TTS engine</Text>
      <View style={styles.row}>
        {(['sherpa', 'system'] as TtsEngineId[]).map((engine) => (
          <Pressable key={engine} onPress={() => setSettings({ ...settings, ttsEngine: engine })} style={[styles.chip, settings.ttsEngine === engine && styles.chipOn]}>
            <Text style={styles.chipText}>{engine === 'sherpa' ? 'Sherpa neural' : 'System voice'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>VAD silence {settings.vadSilenceMs} ms</Text>
      <View style={styles.row}>
        {[400, 600, 800].map((ms) => (
          <Pressable key={ms} onPress={() => setSettings({ ...settings, vadSilenceMs: ms })} style={[styles.chip, settings.vadSilenceMs === ms && styles.chipOn]}>
            <Text style={styles.chipText}>{ms}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setSettings({ ...settings, handsFree: !settings.handsFree })} style={styles.chip}>
        <Text style={styles.chipText}>Hands-free {settings.handsFree ? 'on' : 'off'}</Text>
      </Pressable>
      <Text style={styles.label}>Speech model</Text>
      <View style={styles.row}>
        {['whisper-small-q5', 'whisper-base-q5', 'whisper-apex-q5'].map((id) => (
          <Pressable key={id} onPress={() => setSettings({ ...settings, sttModelId: id })} style={[styles.chip, settings.sttModelId === id && styles.chipOn]}>
            <Text style={styles.chipText}>{id}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingBottom: 40 },
  label: { color: theme.muted, fontFamily: theme.fontBold, marginTop: 18, marginBottom: 8 },
  hint: { color: theme.muted, fontFamily: theme.font, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  chipOn: { backgroundColor: theme.accentDim },
  chipText: { color: theme.text, fontFamily: theme.font },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    borderRadius: 12,
    padding: 14,
    fontFamily: theme.font,
    fontSize: 16,
  },
});
