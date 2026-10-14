import { ScrollView, StyleSheet, Text } from 'react-native';
import { ScreenHeader } from '../ui/Screen';
import { theme } from '../ui/theme';

export function AboutScreen(props: { onBack: () => void }) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader title="About" onBack={props.onBack} />
      <Text style={styles.body}>
        Vaani runs speech-to-text and speech synthesis on the phone. Whisper and Silero VAD stay in app storage.
        Kokoro and Piper do too. Only the language-model request leaves the phone, and only the transcript is sent.
        Microphone audio is not uploaded.
      </Text>
      <Text style={styles.body}>
        Airplane mode is the proof: the transcript still appears, and Say test lines still speaks. The cloud reply
        fails until the network returns.
      </Text>
      <Text style={styles.body}>
        Built for the Computational Intelligence Lab, Department of Aerospace Engineering, IISc Bangalore.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20 },
  body: { color: theme.text, fontFamily: theme.font, fontSize: 16, lineHeight: 24, marginBottom: 14 },
});
