import { describe, it, expect } from 'vitest';
import { Note } from './note';

describe('Note', () => {
  it('rejects invalid names and octaves', () => {
    expect(() => new Note('H', 4)).toThrow();
    expect(() => new Note('C', 0)).toThrow();
    expect(() => new Note('C', 9)).toThrow();
  });

  it('moves by semitones across octaves', () => {
    expect(new Note('B', 3).move(1).toString()).toBe('C4');
    expect(new Note('C', 4).move(12).toString()).toBe('C5');
    expect(new Note('E', 4).move(-5).toString()).toBe('B3');
  });

  it('computes total semitones', () => {
    expect(new Note('C', 1).totalSemitones).toBe(0);
    expect(new Note('A', 4).totalSemitones).toBe(45);
  });

  it('round-trips through fromTotalSemitones', () => {
    const n = new Note('F#', 3);
    expect(Note.fromTotalSemitones(n.totalSemitones).toString()).toBe('F#3');
  });
});
