import { db, type DictEntry, type GlossItem } from '@/lib/db';
import { getWordPinyin } from './pinyin';

let memoryDictCache: Map<string, DictEntry> | null = null;
let loadPromise: Promise<Map<string, DictEntry>> | null = null;

export async function loadDictionary(): Promise<Map<string, DictEntry>> {
  if (memoryDictCache) return memoryDictCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const map = new Map<string, DictEntry>();

    // 1. Check Dexie dict table
    try {
      const count = await db.dict.count();
      if (count > 0) {
        const entries = await db.dict.toArray();
        for (const e of entries) {
          map.set(e.key, e);
        }
        memoryDictCache = map;
        return map;
      }
    } catch {
      // IndexedDB might not be available during SSR or testing
    }

    // 2. Fetch from static public/dict/cedict.json
    try {
      const res = await fetch('/dict/cedict.json');
      if (res.ok) {
        const raw = await res.json() as Record<string, { pinyin: string; definitions: string[] }>;
        const entriesToPersist: DictEntry[] = [];

        for (const [key, val] of Object.entries(raw)) {
          const entry: DictEntry = {
            key,
            pinyin: val.pinyin,
            definitions: val.definitions,
          };
          map.set(key, entry);
          entriesToPersist.push(entry);
        }

        // Cache in Dexie asynchronously in chunks
        try {
          if (entriesToPersist.length > 0) {
            const CHUNK_SIZE = 10000;
            for (let i = 0; i < entriesToPersist.length; i += CHUNK_SIZE) {
              await db.dict.bulkPut(entriesToPersist.slice(i, i + CHUNK_SIZE));
            }
          }
        } catch {
          // ignore cache error
        }
      }
    } catch {
      // ignore network fetch error
    }

    memoryDictCache = map;
    return map;
  })();

  return loadPromise;
}

export async function lookupDictionary(word: string): Promise<DictEntry | null> {
  const dict = await loadDictionary();
  return dict.get(word) || null;
}

/**
 * Builds a dictionary fallback gloss item for a word (§7.5)
 */
export async function buildDictionaryFallbackGloss(
  word: string,
  sentence?: string
): Promise<GlossItem> {
  const dict = await loadDictionary();
  const entry = dict.get(word);

  const wordPinyin = getWordPinyin(word, sentence);
  const gloss = entry && entry.definitions.length > 0
    ? entry.definitions[0]
    : 'definition unavailable';

  const breakdown: { char: string; meaning: string }[] = [];
  for (const char of word) {
    const charEntry = dict.get(char);
    breakdown.push({
      char,
      meaning: charEntry && charEntry.definitions.length > 0
        ? charEntry.definitions[0]
        : 'character',
    });
  }

  const extraDefs = entry && entry.definitions.length > 1
    ? entry.definitions.slice(1, 3).join('; ')
    : undefined;

  return {
    word,
    pinyin: wordPinyin,
    gloss,
    inContext: extraDefs ? `Other dictionary senses: ${extraDefs}` : 'From CC-CEDICT offline dictionary',
    breakdown,
    note: 'Offline dictionary fallback (add a DeepSeek API key in Settings for contextual AI analysis)',
    isDictionaryFallback: true,
  };
}
