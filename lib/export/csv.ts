import { db } from '@/lib/db';

export async function exportWordBankCSV(): Promise<string> {
  const words = await db.words.toArray();
  const contexts = await db.contexts.toArray();

  const contextsByWord = new Map<string, typeof contexts>();
  for (const ctx of contexts) {
    const list = contextsByWord.get(ctx.wordId) || [];
    list.push(ctx);
    contextsByWord.set(ctx.wordId, list);
  }

  const escapeCSV = (str: string | undefined | null) => {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headers = ['Hanzi', 'Pinyin', 'Meaning', 'Sentence', 'SentenceTranslation', 'Notes', 'Tags'];
  const rows: string[] = [headers.join(',')];

  for (const word of words) {
    const wordContexts = contextsByWord.get(word.id) || [];
    const primaryContext = wordContexts[0];
    const sentence = primaryContext ? primaryContext.sentence : '';
    const translation = primaryContext?.translation || '';
    const notes = [word.note, word.userNote].filter(Boolean).join('; ');
    const tags = word.tags.join(', ');

    const row = [
      escapeCSV(word.simplified),
      escapeCSV(word.pinyin),
      escapeCSV(word.gloss),
      escapeCSV(sentence),
      escapeCSV(translation),
      escapeCSV(notes),
      escapeCSV(tags),
    ];
    rows.push(row.join(','));
  }

  // Prepend UTF-8 BOM
  return '\uFEFF' + rows.join('\r\n');
}
