import { describe, it, expect } from 'vitest';
import { createFSRSInstance, createNewCard } from '@/lib/srs/fsrs';
import { createEmptyCard } from 'ts-fsrs';

describe('SRS (FSRS)', () => {
  it('creates a new card with initial parameters', () => {
    const card = createNewCard('test_word_1');
    expect(card.wordId).toBe('test_word_1');
    expect(card.type).toBe('recognition');
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.state).toBe(0); // 0 = New
    expect(card.nextContextIdx).toBe(0);
  });

  it('schedules correctly with ts-fsrs', () => {
    const f = createFSRSInstance(0.90);
    const emptyCard = createEmptyCard();
    const now = new Date();
    const result = f.repeat(emptyCard, now);

    // Should have again, hard, good, easy
    expect(result[1]).toBeDefined(); // Again
    expect(result[2]).toBeDefined(); // Hard
    expect(result[3]).toBeDefined(); // Good
    expect(result[4]).toBeDefined(); // Easy

    // Good rating should push the card into the future
    const goodDue = result[3].card.due.getTime();
    expect(goodDue).toBeGreaterThan(now.getTime());
  });
});
