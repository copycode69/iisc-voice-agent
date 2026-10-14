const ABBREVIATIONS = new Set(['a.m', 'p.m', 'dr', 'mr', 'mrs', 'st', 'vs', 'e.g', 'i.e']);

/**
 * `.` `!` `?` end a sentence only when whitespace follows.
 * A dot at the end of the buffer waits for the next delta or flush().
 * `।` is always a boundary. Abbreviations and decimals are not.
 */
function boundaryAt(buffer: string, index: number): boolean {
  const ch = buffer[index];
  if (ch === '।') return true;
  if (ch !== '.' && ch !== '!' && ch !== '?') return false;
  const next = buffer[index + 1];
  if (next === undefined || !/\s/.test(next)) return false;
  if (ch === '.') {
    const token = buffer.slice(0, index).match(/(\S+)$/)?.[1]?.toLowerCase() ?? '';
    if (ABBREVIATIONS.has(token)) return false;
  }
  return true;
}

function findBoundary(buffer: string): number {
  for (let index = 0; index < buffer.length; index += 1) {
    if (boundaryAt(buffer, index)) return index;
  }
  return -1;
}

/** Emit a spoken chunk on sentence punctuation, or on a comma once the buffer is long. */
export class SentenceChunker {
  private buffer = '';

  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    let guard = 0;
    while (guard < 20) {
      guard += 1;
      const index = findBoundary(this.buffer);
      if (index >= 0) {
        const end = index + 1;
        const piece = this.buffer.slice(0, end).trim();
        this.buffer = this.buffer.slice(end).trimStart();
        if (piece) out.push(piece);
        continue;
      }
      if (this.buffer.length <= 90) break;
      const comma = this.buffer.lastIndexOf(',', 90);
      const cut = comma > 20 ? comma + 1 : 90;
      const piece = this.buffer.slice(0, cut).trim();
      this.buffer = this.buffer.slice(cut).trimStart();
      if (piece) out.push(piece);
    }
    return out;
  }

  flush(): string | null {
    const text = this.buffer.trim();
    this.buffer = '';
    return text || null;
  }
}

export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}
