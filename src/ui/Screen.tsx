import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function ScreenHeader(props: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {props.onBack ? (
        <Pressable onPress={props.onBack} style={styles.back} hitSlop={12}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}
      <Text style={styles.title}>{props.title}</Text>
      <View style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  back: { width: 64 },
  backText: { color: theme.accent, fontFamily: theme.fontBold, fontSize: 16 },
  title: { color: theme.text, fontFamily: theme.fontBold, fontSize: 18 },
});
