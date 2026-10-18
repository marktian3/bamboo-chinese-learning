import { type Token } from '@/lib/db';
import { splitSentences } from './sentences';

const CJK_REGEX = /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/;

export interface Segmenter {
  segment(text: string, merges?: { start: number; end: number }[]): Token[];
}

export class IntlChineseSegmenter implements Segmenter {
  private segmenter: Intl.Segmenter;

  constructor() {
    this.segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  }

  segment(text: string, merges: { start: number; end: number }[] = []): Token[] {
    if (!text) return [];

    const sentences = splitSentences(text);

    // Helper to find sentence and paragraph for a character offset
    const findLocation = (offset: number): { sentenceIdx: number; paragraphIdx: number } => {
      for (const s of sentences) {
        if (offset >= s.start && offset < s.end) {
          return { sentenceIdx: s.index, paragraphIdx: s.paragraphIdx };
        }
      }
      const last = sentences[sentences.length - 1];
      return {
        sentenceIdx: last ? last.index : 0,
        paragraphIdx: last ? last.paragraphIdx : 0,
      };
    };

    // Base segmentation using Intl.Segmenter
    const baseTokens: Token[] = [];
    const segments = this.segmenter.segment(text);

    for (const seg of segments) {
      const segText = seg.segment;
      const start = seg.index;
      const end = start + segText.length;
      const isWord = Boolean(seg.isWordLike && CJK_REGEX.test(segText));
      const loc = findLocation(start);

      baseTokens.push({
        id: `t_${start}_${end}`,
        text: segText,
        start,
        end,
        isWord,
        sentenceIdx: loc.sentenceIdx,
        paragraphIdx: loc.paragraphIdx,
      });
    }

    if (!merges || merges.length === 0) {
      return baseTokens;
    }

    // Apply user boundary overrides (merges)
    // Sort merges by start offset
    const sortedMerges = [...merges].sort((a, b) => a.start - b.start);
    const resultTokens: Token[] = [];
    let i = 0;

    while (i < baseTokens.length) {
      const currentToken = baseTokens[i];

      // Check if currentToken starts or is within an active merge
      const activeMerge = sortedMerges.find(
        m => m.start <= currentToken.start && currentToken.end <= m.end
      );

      if (activeMerge && currentToken.start === activeMerge.start) {
        // Collect all tokens within this merge
        const mergedTextParts: string[] = [];
        let mergedEnd = currentToken.end;
        let isWord = false;
        const start = currentToken.start;
        const sentenceIdx = currentToken.sentenceIdx;
        const paragraphIdx = currentToken.paragraphIdx;

        while (i < baseTokens.length && baseTokens[i].end <= activeMerge.end) {
          mergedTextParts.push(baseTokens[i].text);
          mergedEnd = baseTokens[i].end;
          if (baseTokens[i].isWord) isWord = true;
          i++;
        }

        const mergedText = text.slice(start, mergedEnd);
        resultTokens.push({
          id: `t_${start}_${mergedEnd}`,
          text: mergedText,
          start,
          end: mergedEnd,
          isWord: isWord || CJK_REGEX.test(mergedText),
          sentenceIdx,
          paragraphIdx,
        });
      } else {
        resultTokens.push(currentToken);
        i++;
      }
    }

    return resultTokens;
  }
}

export const defaultSegmenter = new IntlChineseSegmenter();

export function segmentText(text: string, merges?: { start: number; end: number }[]): Token[] {
  return defaultSegmenter.segment(text, merges);
}
