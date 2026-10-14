import type { LocalModel } from '../models/downloader';
import { SentenceChunker } from './chunker';
import { pickSherpaVoice, speakSherpa, stopSherpaPlayback } from './sherpa';
import { speakSystem, stopSystemSpeech } from './systemSpeech';

export type TestLine = {
  style: 'devanagari' | 'mixed' | 'english';
  text: string;
};

export const TEST_LINES: TestLine[] = [
  { style: 'devanagari', text: 'ठीक है, मैंने कल सुबह 7 बजे का अलार्म लगा दिया है। शाम 5 बजे मीटिंग है।' },
  { style: 'devanagari', text: 'बेंगलुरु में कल बारिश हो सकती है। रिमाइंडर कैलेंडर में डाल दिया है।' },
  { style: 'mixed', text: 'ठीक है, मैंने कल सुबह 7 बजे का alarm set कर दिया है।' },
  { style: 'mixed', text: 'Bangalore में कल बारिश हो सकती है। आपकी next meeting 5 PM पर है।' },
  { style: 'english', text: 'Tomorrow in Bangalore the high is 29 degrees. It should stay dry this evening.' },
  { style: 'english', text: 'Your next meeting is at 5 PM. I added a reminder to your calendar.' },
];

type Voice = { id: string; sid: number; modelDir: string } | null;

export class SpeechQueue {
  private queue: string[] = [];
  private running = false;
  private stopped = false;
  private firstAudio = false;
  private waiters: Array<() => void> = [];
  /** undefined until the first chunk of this reply chooses a voice. */
  private voice: Voice | undefined = undefined;
  onFirstAudio: () => void = () => undefined;

  constructor(
    private models: Record<string, LocalModel>,
    private kokoroSid: number,
    private preferSystem: boolean,
  ) {}

  enqueue(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.stopped) return;
    this.queue.push(trimmed);
    void this.pump();
  }

  /** Next enqueued chunks are a new reply and may pick a different voice. */
  beginReply(): void {
    this.voice = undefined;
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
    stopSystemSpeech();
    void stopSherpaPlayback();
    this.waiters.splice(0).forEach((wake) => wake());
  }

  drain(): Promise<void> {
    if (!this.running && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0 && !this.stopped) {
      const text = this.queue.shift();
      if (!text) break;
      if (this.voice === undefined) {
        this.voice = this.preferSystem ? null : pickSherpaVoice(text, this.models, this.kokoroSid);
      }
      if (this.voice) {
        await speakSherpa({
          text,
          voice: this.voice,
          cancelled: () => this.stopped,
          onFirstAudio: () => this.markFirst(),
        });
      } else {
        await speakSystem(text, () => this.markFirst());
      }
    }
    this.running = false;
    if (this.queue.length === 0) this.waiters.splice(0).forEach((wake) => wake());
  }

  private markFirst(): void {
    if (this.firstAudio) return;
    this.firstAudio = true;
    this.onFirstAudio();
  }
}

/** One test line is one reply, so each line keeps a single voice. */
export async function speakTestLines(queue: SpeechQueue): Promise<void> {
  for (const line of TEST_LINES) {
    queue.beginReply();
    const chunker = new SentenceChunker();
    for (const piece of chunker.push(line.text)) queue.enqueue(piece);
    const tail = chunker.flush();
    if (tail) queue.enqueue(tail);
    await queue.drain();
  }
}
