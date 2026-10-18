import { z } from 'zod';
import { db, type AppSettings } from '@/lib/db';

export const ExportSchema = z.object({
  app: z.literal('bamboo'),
  schemaVersion: z.literal(1),
  exportedAt: z.number(),
  data: z.object({
    passages: z.array(z.any()),
    marks: z.array(z.any()),
    words: z.array(z.any()),
    contexts: z.array(z.any()),
    cards: z.array(z.any()),
    reviewLogs: z.array(z.any()),
    settings: z.any().optional(),
  }),
});

export type ExportData = z.infer<typeof ExportSchema>;

export async function exportDatabaseJSON(includeApiKey = false): Promise<string> {
  const passages = await db.passages.toArray();
  const marks = await db.marks.toArray();
  const words = await db.words.toArray();
  const contexts = await db.contexts.toArray();
  const cards = await db.cards.toArray();
  const reviewLogs = await db.reviewLogs.toArray();
  const settings = await db.settings.get('app');

  let sanitizedSettings: AppSettings | undefined = undefined;
  if (settings) {
    sanitizedSettings = {
      ...settings,
      apiKey: includeApiKey ? settings.apiKey : '',
    };
  }

  const exportPayload: ExportData = {
    app: 'bamboo',
    schemaVersion: 1,
    exportedAt: Date.now(),
    data: {
      passages,
      marks,
      words,
      contexts,
      cards,
      reviewLogs,
      settings: sanitizedSettings,
    },
  };

  return JSON.stringify(exportPayload, null, 2);
}

export async function importDatabaseJSON(
  jsonString: string,
  mode: 'merge' | 'replace'
): Promise<{ success: boolean; error?: string; counts?: { words: number; passages: number } }> {
  try {
    const parsed = JSON.parse(jsonString);
    const validated = ExportSchema.parse(parsed);

    if (mode === 'replace') {
      await db.transaction('rw', [db.passages, db.marks, db.words, db.contexts, db.cards, db.reviewLogs, db.settings], async () => {
        await db.passages.clear();
        await db.marks.clear();
        await db.words.clear();
        await db.contexts.clear();
        await db.cards.clear();
        await db.reviewLogs.clear();

        if (validated.data.passages.length) await db.passages.bulkPut(validated.data.passages);
        if (validated.data.marks.length) await db.marks.bulkPut(validated.data.marks);
        if (validated.data.words.length) await db.words.bulkPut(validated.data.words);
        if (validated.data.contexts.length) await db.contexts.bulkPut(validated.data.contexts);
        if (validated.data.cards.length) await db.cards.bulkPut(validated.data.cards);
        if (validated.data.reviewLogs.length) await db.reviewLogs.bulkPut(validated.data.reviewLogs);
        if (validated.data.settings) await db.settings.put(validated.data.settings);
      });
    } else {
      // Merge mode
      await db.transaction('rw', [db.passages, db.marks, db.words, db.contexts, db.cards, db.reviewLogs], async () => {
        if (validated.data.passages.length) await db.passages.bulkPut(validated.data.passages);
        if (validated.data.marks.length) await db.marks.bulkPut(validated.data.marks);
        if (validated.data.words.length) await db.words.bulkPut(validated.data.words);
        if (validated.data.contexts.length) await db.contexts.bulkPut(validated.data.contexts);
        if (validated.data.cards.length) await db.cards.bulkPut(validated.data.cards);
        if (validated.data.reviewLogs.length) await db.reviewLogs.bulkPut(validated.data.reviewLogs);
      });
    }

    return {
      success: true,
      counts: {
        words: validated.data.words.length,
        passages: validated.data.passages.length,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid import file';
    return { success: false, error: msg };
  }
}
