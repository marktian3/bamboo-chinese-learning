const CJK_REGEX = /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/;

// Half-width to full-width punctuation mappings when between CJK characters
const PUNCTUATION_MAP: Record<string, string> = {
  ',': '，',
  '.': '。',
  '!': '！',
  '?': '？',
  ';': '；',
  ':': '：',
  '(': '（',
  ')': '）',
};

/**
 * Normalizes text on save:
 * - strips zero-width characters
 * - collapses runs of spaces and tabs (preserving newlines)
 * - converts half-width punctuation between CJK characters to full-width
 * - trims trailing/leading whitespace
 */
export function normalizeChineseText(raw: string): string {
  if (!raw) return '';

  // 1. Strip zero-width characters (ZWSP, ZWNJ, ZWJ, BOM, etc.)
  let text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2. Normalize newlines
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Collapse multiple spaces and tabs within a line
  text = text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');

  // 4. Collapse 3+ consecutive newlines to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // 5. Convert half-width punctuation following CJK characters to full-width
  // e.g. "你好,世界" -> "你好，世界", "未来?" -> "未来？"
  for (const [half, full] of Object.entries(PUNCTUATION_MAP)) {
    const escaped = half.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`([\\u4e00-\\u9fa5])${escaped}([\\u4e00-\\u9fa5]|\\s|$)`, 'g');
    text = text.replace(regex, `$1${full}$2`);
  }

  return text.trim();
}

/**
 * Validates text:
 * - checks character count <= 10,000
 * - checks for at least one CJK character
 * - computes CJK percentage
 */
export function validateChineseText(text: string): {
  valid: boolean;
  charCount: number;
  cjkCount: number;
  cjkPercentage: number;
  error?: string;
  warning?: string;
} {
  const charCount = text.length;
  let cjkCount = 0;

  for (const char of text) {
    if (CJK_REGEX.test(char)) {
      cjkCount++;
    }
  }

  const cjkPercentage = charCount > 0 ? (cjkCount / charCount) * 100 : 0;

  if (charCount === 0) {
    return { valid: false, charCount, cjkCount, cjkPercentage, error: 'Text cannot be empty.' };
  }

  if (charCount > 10000) {
    return { valid: false, charCount, cjkCount, cjkPercentage, error: 'Text exceeds the 10,000 character limit.' };
  }

  if (cjkCount === 0) {
    return { valid: false, charCount, cjkCount, cjkPercentage, error: 'Text must contain at least one Chinese character.' };
  }

  let warning: string | undefined = undefined;
  if (charCount > 6000) {
    warning = 'Long passages may be slower to reveal.';
  } else if (cjkPercentage < 30) {
    warning = 'Less than 30% of characters are Chinese. This text might not be primarily Chinese.';
  }

  return { valid: true, charCount, cjkCount, cjkPercentage, warning };
}

export function generateDefaultTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 16) {
    return firstLine || 'Untitled Passage';
  }
  return firstLine.slice(0, 16) + '…';
}
