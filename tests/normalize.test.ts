import { describe, it, expect } from 'vitest';
import { normalizeChineseText, validateChineseText, generateDefaultTitle } from '@/lib/segment/normalize';

describe('Chinese Text Normalization & Validation', () => {
  it('strips zero-width characters and trims whitespace', () => {
    const raw = '\u200B  你好世界  \uFEFF';
    expect(normalizeChineseText(raw)).toBe('你好世界');
  });

  it('converts half-width punctuation between CJK characters to full-width', () => {
    const raw = '中国,北京.科技!未来?';
    expect(normalizeChineseText(raw)).toBe('中国，北京。科技！未来？');
  });

  it('collapses multiple spaces while keeping single newlines', () => {
    const raw = '第一行    有空格。\n\n第二行。';
    expect(normalizeChineseText(raw)).toBe('第一行 有空格。\n\n第二行。');
  });

  it('validates CJK presence and character limits', () => {
    expect(validateChineseText('').valid).toBe(false);
    expect(validateChineseText('Hello world without chinese').valid).toBe(false);
    expect(validateChineseText('随着人工智能发展').valid).toBe(true);
    expect(validateChineseText('a'.repeat(10001)).valid).toBe(false);
  });

  it('generates appropriate default title from first line', () => {
    expect(generateDefaultTitle('简短标题\n正文')).toBe('简短标题');
    expect(generateDefaultTitle('这是一个非常非常非常非常非常长的第一行文本内容')).toBe('这是一个非常非常非常非常非常长的…');
  });
});
