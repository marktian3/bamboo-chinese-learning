import { pinyin } from 'pinyin-pro';

export interface PinyinSyllable {
  syllable: string;
  tone: 1 | 2 | 3 | 4 | 5;
}

const TONE_1_CHARS = /[āēīōūǖ]/i;
const TONE_2_CHARS = /[áéíóúǘ]/i;
const TONE_3_CHARS = /[ǎěǐǒǔǚ]/i;
const TONE_4_CHARS = /[àèìòùǜ]/i;

export function detectTone(syllable: string): 1 | 2 | 3 | 4 | 5 {
  if (TONE_1_CHARS.test(syllable)) return 1;
  if (TONE_2_CHARS.test(syllable)) return 2;
  if (TONE_3_CHARS.test(syllable)) return 3;
  if (TONE_4_CHARS.test(syllable)) return 4;
  return 5;
}

export function getToneColor(tone: 1 | 2 | 3 | 4 | 5): string {
  switch (tone) {
    case 1: return 'var(--tone-1)';
    case 2: return 'var(--tone-2)';
    case 3: return 'var(--tone-3)';
    case 4: return 'var(--tone-4)';
    default: return 'var(--tone-5)';
  }
}

/**
 * Converts a Chinese word to pinyin with tone marks,
 * using the full sentence for improved polyphone disambiguation when provided.
 */
export function getWordPinyin(word: string, contextSentence?: string): string {
  if (!word) return '';

  if (contextSentence && contextSentence.includes(word)) {
    try {
      // Get pinyin for the whole sentence and slice the relevant part
      const sentencePinyinList = pinyin(contextSentence, { toneType: 'symbol', type: 'array' });
      // Find the character index of word in contextSentence
      const wordIdx = contextSentence.indexOf(word);
      if (wordIdx !== -1) {
        const wordSyllables = sentencePinyinList.slice(wordIdx, wordIdx + word.length);
        if (wordSyllables.length === word.length) {
          return wordSyllables.join(' ');
        }
      }
    } catch {
      // fallback
    }
  }

  return pinyin(word, { toneType: 'symbol', type: 'string' });
}

export function parsePinyinSyllables(pinyinStr: string): PinyinSyllable[] {
  if (!pinyinStr) return [];
  const parts = pinyinStr.trim().split(/\s+/);
  return parts.map(syllable => ({
    syllable,
    tone: detectTone(syllable),
  }));
}
