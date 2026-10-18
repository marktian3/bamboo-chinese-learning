import { db, getSettings, type GlossItem, type Mark, type Passage } from '@/lib/db';
import { buildDictionaryFallbackGloss } from '@/lib/dict/cedict';

// Simple fast SHA-1 or string hash for cache keys
export function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function getGlossCacheKey(word: string, sentence: string): string {
  return generateHash(`${word}|${sentence}`);
}

export function getTranslationCacheKey(sentence: string): string {
  return generateHash(sentence);
}

/**
 * Extracts appropriate context window for LLM prompt (§7.1)
 */
export function extractPassageContext(passageText: string, words: string[]): string {
  if (passageText.length <= 4000) {
    return passageText;
  }

  const paragraphs = passageText.split('\n');
  const relevantIndices = new Set<number>();

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (words.some(w => p.includes(w))) {
      if (i > 0) relevantIndices.add(i - 1);
      relevantIndices.add(i);
      if (i < paragraphs.length - 1) relevantIndices.add(i + 1);
    }
  }

  const sorted = Array.from(relevantIndices).sort((a, b) => a - b);
  return sorted.map(idx => paragraphs[idx]).join('\n\n');
}

/**
 * Fetches contextual glosses for marks.
 * Checks Dexie cache first, batches LLM calls, and falls back to CC-CEDICT.
 */
export async function fetchGlossesForMarks(
  passage: Passage,
  marks: Mark[],
  options: { forceRefresh?: boolean } = {}
): Promise<Map<string, GlossItem>> {
  const result = new Map<string, GlossItem>();
  const settings = await getSettings();
  const hasKey = Boolean(settings.apiKey?.trim());

  const marksNeedingFetch: Mark[] = [];

  // 1. Check local cache first
  for (const mark of marks) {
    const fullKey = mark.glossKey || getGlossCacheKey(mark.surface, mark.surface);

    if (!options.forceRefresh) {
      const cached = await db.glossCache.get(fullKey);
      if (cached) {
        result.set(mark.id, cached.data);
        continue;
      }
    }
    marksNeedingFetch.push(mark);
  }

  if (marksNeedingFetch.length === 0) {
    return result;
  }

  // 2. If no API key is provided, use offline dictionary fallback
  if (!hasKey) {
    for (const mark of marksNeedingFetch) {
      const fallback = await buildDictionaryFallbackGloss(mark.surface);
      result.set(mark.id, fallback);
      const key = getGlossCacheKey(mark.surface, mark.surface);
      await db.glossCache.put({ key, data: fallback, createdAt: Date.now() });
    }
    return result;
  }

  // 3. Batch LLM requests (max 25 per request)
  const BATCH_SIZE = 25;
  const batches: Mark[][] = [];
  for (let i = 0; i < marksNeedingFetch.length; i += BATCH_SIZE) {
    batches.push(marksNeedingFetch.slice(i, i + BATCH_SIZE));
  }

  // Process batches
  for (const batch of batches) {
    const words = batch.map(m => m.surface);
    const context = extractPassageContext(passage.text, words);

    const items = batch.map(m => {
      // Find sentence for mark
      const token = passage.tokens.find(t => t.start === m.start);
      const sentenceText = token ? passage.text.slice(Math.max(0, m.start - 20), Math.min(passage.text.length, m.end + 20)) : m.surface;
      return {
        id: m.id,
        word: m.surface,
        sentence: sentenceText,
      };
    });

    try {
      const res = await fetch('/api/llm/gloss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-api-key': settings.apiKey,
          'x-llm-base-url': settings.baseUrl,
          'x-llm-model': settings.model,
        },
        body: JSON.stringify({
          passageTitle: passage.title,
          context,
          items,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data?.items) {
          for (const item of json.data.items) {
            const mark = batch.find(m => m.id === item.id) || batch.find(m => m.surface === item.word);
            if (mark) {
              const key = getGlossCacheKey(mark.surface, item.word);
              result.set(mark.id, item);
              await db.glossCache.put({ key, data: item, createdAt: Date.now() });
            }
          }
        }
      } else {
        throw new Error('Gloss API responded with error');
      }
    } catch (err) {
      console.warn('LLM gloss fetch failed, falling back to dictionary for batch:', err);
      // Fallback to dictionary for any unresolved in this batch
      for (const mark of batch) {
        if (!result.has(mark.id)) {
          const fallback = await buildDictionaryFallbackGloss(mark.surface);
          result.set(mark.id, fallback);
        }
      }
    }
  }

  return result;
}

/**
 * Fetches sentence translation with caching (§7.3)
 */
export async function fetchSentenceTranslation(
  sentenceText: string,
  passageContext: string
): Promise<string> {
  const cacheKey = getTranslationCacheKey(sentenceText);
  const cached = await db.translationCache.get(cacheKey);
  if (cached) {
    return cached.translation;
  }

  const settings = await getSettings();
  if (!settings.apiKey) {
    return 'Add DeepSeek API key in Settings for automatic translations.';
  }

  try {
    const res = await fetch('/api/llm/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-api-key': settings.apiKey,
        'x-llm-base-url': settings.baseUrl,
        'x-llm-model': settings.model,
      },
      body: JSON.stringify({
        context: passageContext.slice(0, 2000),
        sentences: [{ id: 's_0', text: sentenceText }],
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const translation = json.data?.items?.[0]?.translation;
      if (translation) {
        await db.translationCache.put({
          key: cacheKey,
          translation,
          createdAt: Date.now(),
        });
        return translation;
      }
    }
  } catch (err) {
    console.error('Translation error:', err);
  }

  return 'Translation currently unavailable.';
}
