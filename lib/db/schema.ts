import Dexie, { type EntityTable } from 'dexie';

export type Token = {
  id: string;
  text: string;
  start: number;
  end: number;
  isWord: boolean;
  sentenceIdx: number;
  paragraphIdx: number;
};

export type Passage = {
  id: string;
  title: string;
  text: string;
  tokens: Token[];
  merges: { start: number; end: number }[];
  phase: 'pass1' | 'revealed' | 'pass2' | 'completed';
  status: string;
  scrollY: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
};

export type Mark = {
  id: string;
  passageId: string;
  start: number;
  end: number;
  surface: string;
  sentenceIdx: number;
  peek: 'none' | 'pinyin' | 'meaning';
  inferResult?: 'knew' | 'partial' | 'none';
  addToBank: boolean;
  glossKey?: string;
  createdAt: number;
};

export type Word = {
  id: string;
  simplified: string;
  pinyin: string;
  gloss: string;
  breakdown: { char: string; meaning: string }[];
  pos?: string;
  register?: string;
  type?: string;
  note?: string;
  userNote?: string;
  tags: string[];
  status: 'active' | 'suspended' | 'known';
  encounters: number;
  createdAt: number;
  updatedAt: number;
};

export type Context = {
  id: string;
  wordId: string;
  passageId: string | null;
  sentence: string;
  sentenceIdx: number;
  inContext?: string;
  translation?: string;
  createdAt: number;
};

export type CardRow = {
  id: string;
  wordId: string;
  type: 'recognition' | 'cloze';
  due: number; // epoch ms
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3; // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review?: number;
  nextContextIdx: number;
};

export type ReviewLogRow = {
  id: string;
  cardId: string;
  rating: 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
  reviewedAt: number;
  durationMs: number;
  prevCard: Omit<CardRow, 'id'>;
};

export type GlossBreakdownItem = {
  char: string;
  meaning: string;
};

export type GlossItem = {
  id?: string;
  word: string;
  pinyin: string;
  gloss: string;
  inContext: string;
  breakdown: GlossBreakdownItem[];
  pos?: string;
  register?: 'formal' | 'neutral' | 'colloquial' | 'literary' | string;
  type?: 'word' | 'phrase' | 'chengyu' | 'name' | 'grammar' | string;
  note?: string;
  segmentation?: { ok: boolean; suggested: string | null };
  isDictionaryFallback?: boolean;
};

export type GlossCacheEntry = {
  key: string; // sha1 or word|sentence
  data: GlossItem;
  createdAt: number;
};

export type TranslationCacheEntry = {
  key: string;
  translation: string;
  createdAt: number;
};

export type DictEntry = {
  key: string; // simplified word
  traditional?: string;
  pinyin: string;
  definitions: string[];
};

export type AppSettings = {
  id: 'app';
  apiKey: string;
  baseUrl: string;
  model: string;
  lookupStyle: 'deferred' | 'instant';
  fontFamily: 'Noto Serif SC' | 'LXGW WenKai' | 'Noto Sans SC';
  fontSize: number;
  lineHeight: 'compact' | 'normal' | 'airy';
  pinyinDisplay: 'off' | 'marked' | 'all';
  toneColors: boolean;
  underlineWordBank: boolean;
  ttsVoice: string;
  ttsSpeed: number;
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  desiredRetention: number;
  autoPlayAudio: boolean;
  theme: 'system' | 'light' | 'dark';
};

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  lookupStyle: 'deferred',
  fontFamily: 'Noto Serif SC',
  fontSize: 28,
  lineHeight: 'normal',
  pinyinDisplay: 'marked',
  toneColors: true,
  underlineWordBank: true,
  ttsVoice: '',
  ttsSpeed: 0.9,
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  desiredRetention: 0.90,
  autoPlayAudio: true,
  theme: 'system',
};

export class BambooDB extends Dexie {
  passages!: EntityTable<Passage, 'id'>;
  marks!: EntityTable<Mark, 'id'>;
  words!: EntityTable<Word, 'id'>;
  contexts!: EntityTable<Context, 'id'>;
  cards!: EntityTable<CardRow, 'id'>;
  reviewLogs!: EntityTable<ReviewLogRow, 'id'>;
  glossCache!: EntityTable<GlossCacheEntry, 'key'>;
  translationCache!: EntityTable<TranslationCacheEntry, 'key'>;
  settings!: EntityTable<AppSettings, 'id'>;
  dict!: EntityTable<DictEntry, 'key'>;

  constructor() {
    super('bamboo_db');
    this.version(1).stores({
      passages: 'id, phase, status, createdAt, updatedAt, lastOpenedAt',
      marks: 'id, passageId, [passageId+start]',
      words: 'id, &simplified, status, createdAt',
      contexts: 'id, wordId, passageId, [wordId+passageId+sentenceIdx]',
      cards: 'id, wordId, due, state',
      reviewLogs: 'id, cardId, reviewedAt',
      glossCache: 'key',
      translationCache: 'key',
      settings: 'id',
      dict: 'key',
    });
  }
}

export const db = new BambooDB();
