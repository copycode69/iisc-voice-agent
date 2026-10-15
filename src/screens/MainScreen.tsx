import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVaani, type Phase } from '../state/VaaniProvider';
import { theme } from '../ui/theme';
import type { LangMode } from '../settings/store';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Tap to talk',
  listening: 'Send',
  transcribing: 'Working on your words…',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

export function MainScreen(props: { open: (screen: string) => void }) {
  const vaani = useVaani();
  const [waitSec, setWaitSec] = useState(0);
  useEffect(() => {
    if (vaani.phase !== 'transcribing') {
      setWaitSec(0);
      return;
    }
    const id = setInterval(() => setWaitSec((seconds) => seconds + 1), 1000);
    return () => clearInterval(id);
  }, [vaani.phase]);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View>
          <Text style={styles.brand}>Vaani</Text>
          <Text style={styles.sub}>On-device voice agent</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>STT / TTS on device</Text>
        </View>
      </View>
      <View style={styles.langs}>
        {(['auto', 'en', 'hinglish'] as LangMode[]).map((lang) => (
          <Pressable key={lang} onPress={() => vaani.setLang(lang)} style={[styles.lang, vaani.settings.lang === lang && styles.langOn]}>
            <Text style={styles.langText}>{lang === 'hinglish' ? 'Hinglish' : lang === 'en' ? 'EN' : 'Auto'}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {vaani.bubbles.length === 0 ? (
          <Text style={styles.empty}>Ask about the weather, an alarm, a reminder, or today’s schedule. English and Hinglish both work.</Text>
        ) : null}
        {vaani.bubbles.map((bubble) => (
          <View key={bubble.id} style={[styles.bubble, bubble.role === 'user' ? styles.user : styles.assistant]}>
            <Text style={styles.bubbleText}>{bubble.text || '…'}</Text>
            {bubble.metric ? (
              <Text style={styles.hud}>
                STT {Math.round(bubble.metric.vadToSttMs)} ms · token {Math.round(bubble.metric.sttToFirstTokenMs)} ms · audio{' '}
                {Math.round(bubble.metric.firstTokenToAudioMs)} ms · total {Math.round(bubble.metric.totalMs)} ms
                {bubble.metric.toolMs ? ` · tools ${Math.round(bubble.metric.toolMs)} ms` : ''}
              </Text>
            ) : null}
          </View>
        ))}
        {vaani.error ? <Text style={styles.error}>{vaani.error}</Text> : null}
      </ScrollView>
      <View style={styles.meterTrack}>
        <View style={[styles.meter, { width: `${Math.max(8, vaani.level * 100)}%` }]} />
      </View>
      <Text style={styles.listenHint}>
        {vaani.phase === 'listening'
          ? 'Say your question, then tap Send.'
          : vaani.phase === 'transcribing'
            ? 'Please wait on this screen. Speech stays on the phone.'
            : 'Tap to talk. Then tap Send to get an answer.'}
      </Text>
      <Pressable onPress={() => void vaani.toggleMic()} style={[styles.mic, vaani.phase !== 'idle' && styles.micOn]}>
        <Text style={styles.micText}>
          {vaani.phase === 'transcribing' ? `Working… ${waitSec}s` : PHASE_LABEL[vaani.phase]}
        </Text>
      </Pressable>
      <Pressable onPress={() => void vaani.sayTestLines()} style={styles.test}>
        <Text style={styles.testText}>Say test lines</Text>
        <Text style={styles.testHint}>Devanagari, then mixed script, then English. One voice per line.</Text>
      </Pressable>
      <View style={styles.nav}>
        {['Models', 'Settings', 'Benchmark', 'Metrics', 'About'].map((name) => (
          <Pressable key={name} onPress={() => props.open(name)} style={styles.navBtn}>
            <Text style={styles.navText}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20, paddingTop: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { color: theme.text, fontFamily: theme.fontBold, fontSize: 28 },
  sub: { color: theme.muted, fontFamily: theme.font, marginTop: 2 },
  badge: { backgroundColor: theme.accentDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: theme.ok, fontFamily: theme.fontBold, fontSize: 12 },
  langs: { flexDirection: 'row', gap: 8, marginTop: 16 },
  lang: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.card },
  langOn: { backgroundColor: theme.accent },
  langText: { color: theme.text, fontFamily: theme.fontBold },
  scroll: { flex: 1, marginTop: 16 },
  scrollContent: { paddingBottom: 12, gap: 10 },
  empty: { color: theme.muted, fontFamily: theme.font, fontSize: 16, lineHeight: 24 },
  bubble: { borderRadius: 16, padding: 12 },
  user: { backgroundColor: theme.user, alignSelf: 'flex-end', maxWidth: '90%' },
  assistant: { backgroundColor: theme.assistant, alignSelf: 'flex-start', maxWidth: '92%' },
  bubbleText: { color: theme.text, fontFamily: theme.font, fontSize: 16, lineHeight: 22 },
  hud: { color: theme.muted, fontFamily: theme.font, fontSize: 12, marginTop: 8 },
  error: { color: theme.danger, fontFamily: theme.font, marginTop: 8 },
  meterTrack: { height: 6, backgroundColor: theme.card, borderRadius: 99, overflow: 'hidden', marginBottom: 12 },
  meter: { height: 6, backgroundColor: theme.accent },
  listenHint: { color: theme.muted, fontFamily: theme.font, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  mic: { backgroundColor: theme.accent, minHeight: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: '#6E8BFF' },
  micText: { color: '#0E1116', fontFamily: theme.fontBold, fontSize: 18 },
  test: { alignItems: 'center', paddingVertical: 12 },
  testText: { color: theme.accent, fontFamily: theme.fontBold },
  testHint: { color: theme.muted, fontFamily: theme.font, fontSize: 12, marginTop: 4, textAlign: 'center' },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  navBtn: { backgroundColor: theme.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  navText: { color: theme.text, fontFamily: theme.font, fontSize: 13 },
});
