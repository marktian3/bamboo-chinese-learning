import { db, getSettings, type CardRow, type Word, type Context } from '@/lib/db';

export interface ReviewQueueItem {
  card: CardRow;
  word: Word;
  context: Context | null;
  totalContexts: number;
}

/**
 * Builds the daily SRS queue (§6.7)
 */
export async function buildReviewQueue(): Promise<ReviewQueueItem[]> {
  const settings = await getSettings();
  const now = Date.now();

  // 1. Find suspended or known words to exclude
  const excludedWordIds = new Set(
    await db.words
      .where('status')
      .anyOf(['suspended', 'known'])
      .primaryKeys()
  );

  // 2. Count new cards reviewed today so we don't exceed newCardsPerDay
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  const todayLogs = await db.reviewLogs
    .where('reviewedAt')
    .aboveOrEqual(startOfTodayMs)
    .toArray();

  const newCardsReviewedToday = new Set(
    todayLogs.filter(l => l.prevCard.state === 0).map(l => l.cardId)
  ).size;

  const remainingNewQuota = Math.max(0, settings.newCardsPerDay - newCardsReviewedToday);

  // 3. Due review & learning cards (due <= now, state != 0)
  const allDue = await db.cards
    .where('due')
    .belowOrEqual(now)
    .toArray();

  const validDue = allDue.filter(c => !excludedWordIds.has(c.wordId));

  const reviewAndLearningCards = validDue
    .filter(c => c.state !== 0)
    .sort((a, b) => a.due - b.due) // Most overdue first
    .slice(0, settings.maxReviewsPerDay);

  // 4. New cards (state === 0), oldest first
  const newCards = validDue
    .filter(c => c.state === 0)
    .sort((a, b) => a.due - b.due)
    .slice(0, remainingNewQuota);

  const selectedCards = [...reviewAndLearningCards, ...newCards];

  // 5. Hydrate each card with its Word and rotated Context
  const queueItems: ReviewQueueItem[] = [];

  for (const card of selectedCards) {
    const word = await db.words.get(card.wordId);
    if (!word) continue;

    const contexts = await db.contexts
      .where('wordId')
      .equals(card.wordId)
      .toArray();

    // Round-robin through contexts
    const context = contexts.length > 0
      ? contexts[card.nextContextIdx % contexts.length]
      : null;

    queueItems.push({
      card,
      word,
      context,
      totalContexts: contexts.length,
    });
  }

  return queueItems;
}
