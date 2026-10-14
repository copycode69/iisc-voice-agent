import * as Speech from 'expo-speech';
import { hasDevanagari } from './chunker';

export async function offlineVoices(): Promise<Speech.Voice[]> {
  const voices = await Speech.getAvailableVoicesAsync();
  return voices.filter((voice) => !/network|online/i.test(voice.name));
}

export function speakSystem(text: string, onFirstAudio: () => void): Promise<void> {
  const language = hasDevanagari(text) ? 'hi-IN' : 'en-IN';
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language,
      onStart: () => onFirstAudio(),
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (error) => reject(error),
    });
  });
}

export function stopSystemSpeech(): void {
  Speech.stop();
}
