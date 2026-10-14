import { SentenceChunker } from './chunker';

function feed(text: string): string[] {
  const chunker = new SentenceChunker();
  const out: string[] = [];
  let index = 0;
  while (index < text.length) {
    const size = 1 + Math.floor(Math.random() * 7);
    out.push(...chunker.push(text.slice(index, index + size)));
    index += size;
  }
  const tail = chunker.flush();
  if (tail) out.push(tail);
  return out;
}

function same(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((piece, index) => piece === expected[index]);
}

let failed = 0;

function check(label: string, text: string, expected: string[]): void {
  for (let run = 0; run < 8; run += 1) {
    const actual = feed(text);
    if (!same(actual, expected)) {
      failed += 1;
      console.error('FAIL', label, JSON.stringify(actual));
      return;
    }
  }
  console.log('ok', label, JSON.stringify(expected));
}

check('decimal temperature', 'Tomorrow the high is 28.4 degrees. Rain chance is 40%.', [
  'Tomorrow the high is 28.4 degrees.',
  'Rain chance is 40%.',
]);

check('meeting time', 'Your meeting is at 5.30 p.m. today. I set a reminder.', [
  'Your meeting is at 5.30 p.m. today.',
  'I set a reminder.',
]);

check('devanagari danda', 'ठीक है। कल सुबह 7 बजे का alarm set है।', [
  'ठीक है।',
  'कल सुबह 7 बजे का alarm set है।',
]);

const long =
  'Tomorrow morning in Bangalore it will be cloudy, then warmer later, and dry by evening with a light breeze across the city.';
if (long.length <= 90) {
  failed += 1;
  console.error('FAIL long sentence is not long enough', long.length);
} else {
  const parts = feed(long);
  const joined = parts.join(' ').replace(/\s+/g, ' ');
  const original = long.replace(/\s+/g, ' ');
  if (parts.length < 2 || !parts[0].endsWith(',') || joined !== original) {
    failed += 1;
    console.error('FAIL long comma split', JSON.stringify(parts));
  } else {
    console.log('ok long comma split', JSON.stringify(parts));
  }
}

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('chunker self-test passed');
