export interface SentenceSpan {
  index: number;
  text: string;
  start: number;
  end: number;
  paragraphIdx: number;
}

const SENTENCE_END_REGEX = /([。！？!?；]|……|\.{3,})([」』”’）》)\]]*)/g;

/**
 * Splits text into sentences, handling Chinese punctuation, trailing quotes/brackets,
 * and paragraph breaks. Preserves accurate character offsets.
 */
export function splitSentences(text: string): SentenceSpan[] {
  const sentences: SentenceSpan[] = [];
  if (!text) return sentences;

  // First split by paragraphs (lines) to maintain paragraphIdx
  const lines = text.split('\n');
  let currentOffset = 0;
  let sentenceIdx = 0;

  for (let pIdx = 0; pIdx < lines.length; pIdx++) {
    const line = lines[pIdx];
    if (line.length === 0) {
      currentOffset += 1; // newline char
      continue;
    }

    let lineStart = 0;
    SENTENCE_END_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = SENTENCE_END_REGEX.exec(line)) !== null) {
      const matchEnd = match.index + match[0].length;
      const sentenceText = line.slice(lineStart, matchEnd);

      if (sentenceText.trim().length > 0) {
        sentences.push({
          index: sentenceIdx++,
          text: sentenceText,
          start: currentOffset + lineStart,
          end: currentOffset + matchEnd,
          paragraphIdx: pIdx,
        });
      }
      lineStart = matchEnd;
    }

    // Remainder of line if not terminated by punctuation
    if (lineStart < line.length) {
      const remainingText = line.slice(lineStart);
      if (remainingText.trim().length > 0) {
        sentences.push({
          index: sentenceIdx++,
          text: remainingText,
          start: currentOffset + lineStart,
          end: currentOffset + line.length,
          paragraphIdx: pIdx,
        });
      }
    }

    currentOffset += line.length + 1; // +1 for the newline char
  }

  return sentences;
}
