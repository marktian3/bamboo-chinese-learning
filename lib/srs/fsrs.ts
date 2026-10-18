import {
  fsrs,
  generatorParameters,
  Rating,
  createEmptyCard,
  type Card as FSRSCard,
  type RecordLogItem,
} from 'ts-fsrs';
import { type CardRow, type ReviewLogRow, db, getSettings } from '@/lib/db';
import { nanoid } from 'nanoid';

export function createFSRSInstance(requestRetention = 0.90) {
  const params = generatorParameters({
    request_retention: requestRetention,
    enable_fuzz: true,
  });
  return fsrs(params);
}

export function cardRowToFSRS(card: CardRow): FSRSCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

export function fsrsToCardRow(
  fsrsCard: FSRSCard,
  cardId: string,
  wordId: string,
  type: 'recognition' | 'cloze',
  nextContextIdx: number
): CardRow {
  return {
    id: cardId,
    wordId,
    type,
    due: fsrsCard.due.getTime(),
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    elapsed_days: fsrsCard.elapsed_days,
    scheduled_days: fsrsCard.scheduled_days,
    learning_steps: fsrsCard.learning_steps,
    reps: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: fsrsCard.state,
    last_review: fsrsCard.last_review ? fsrsCard.last_review.getTime() : undefined,
    nextContextIdx,
  };
}

/**
 * Creates a brand new recognition card for a word
 */
export function createNewCard(wordId: string): CardRow {
  const emptyFSRSCard = createEmptyCard();

  return fsrsToCardRow(
    emptyFSRSCard,
    nanoid(10),
    wordId,
    'recognition',
    0
  );
}

/**
 * Calculates next interval preview strings for rating buttons (Again, Hard, Good, Easy)
 */
export async function getIntervalPreviews(card: CardRow): Promise<Record<1 | 2 | 3 | 4, string>> {
  const settings = await getSettings();
  const f = createFSRSInstance(settings.desiredRetention);
  const fsrsCard = cardRowToFSRS(card);
  const now = new Date();

  const record = f.repeat(fsrsCard, now);

  const formatInterval = (item: RecordLogItem): string => {
    const nextDue = item.card.due.getTime();
    const diffMs = nextDue - now.getTime();
    const diffMins = Math.round(diffMs / (60 * 1000));
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 60) return `${Math.max(1, diffMins)}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  return {
    1: formatInterval(record[Rating.Again]),
    2: formatInterval(record[Rating.Hard]),
    3: formatInterval(record[Rating.Good]),
    4: formatInterval(record[Rating.Easy]),
  };
}

/**
 * Applies a review rating to a card and records review log
 */
export async function rateCard(
  card: CardRow,
  rating: 1 | 2 | 3 | 4,
  durationMs = 0
): Promise<{ updatedCard: CardRow; log: ReviewLogRow }> {
  const settings = await getSettings();
  const f = createFSRSInstance(settings.desiredRetention);
  const fsrsCard = cardRowToFSRS(card);
  const now = new Date();

  const record = f.repeat(fsrsCard, now);
  const ratingMap: Record<1 | 2 | 3 | 4, RecordLogItem> = {
    1: record[Rating.Again],
    2: record[Rating.Hard],
    3: record[Rating.Good],
    4: record[Rating.Easy],
  };
  const nextItem = ratingMap[rating];

  const prevCardState: Omit<CardRow, 'id'> = { ...card };

  const updatedCard = fsrsToCardRow(
    nextItem.card,
    card.id,
    card.wordId,
    card.type,
    card.nextContextIdx + 1
  );

  const log: ReviewLogRow = {
    id: nanoid(10),
    cardId: card.id,
    rating,
    reviewedAt: now.getTime(),
    durationMs,
    prevCard: prevCardState,
  };

  await db.transaction('rw', [db.cards, db.reviewLogs, db.words], async () => {
    await db.cards.put(updatedCard);
    await db.reviewLogs.add(log);

    // Leech check (§6.7): lapses >= 8 auto-tags the word as 'leech'
    if (updatedCard.lapses >= 8) {
      const word = await db.words.get(card.wordId);
      if (word && !word.tags.includes('leech')) {
        await db.words.update(card.wordId, {
          tags: [...word.tags, 'leech'],
        });
      }
    }
  });

  return { updatedCard, log };
}

/**
 * Undoes the last review: restores previous card state and deletes log (§6.7)
 */
export async function undoLastReview(logId: string): Promise<boolean> {
  const log = await db.reviewLogs.get(logId);
  if (!log) return false;

  await db.transaction('rw', [db.cards, db.reviewLogs], async () => {
    const restoredCard: CardRow = {
      ...log.prevCard,
      id: log.cardId,
    };
    await db.cards.put(restoredCard);
    await db.reviewLogs.delete(logId);
  });

  return true;
}
