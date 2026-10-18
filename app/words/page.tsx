'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Word, type CardRow, type Context } from '@/lib/db';
import { createNewCard } from '@/lib/srs/fsrs';
import { exportWordBankCSV } from '@/lib/export/csv';
import { buildDictionaryFallbackGloss } from '@/lib/dict/cedict';
import { getWordPinyin } from '@/lib/dict/pinyin';
import { speakChinese } from '@/lib/tts/speak';
import { nanoid } from 'nanoid';
import {
  Search,
  Plus,
  Download,
  Volume2,
  BookOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WordBankPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'due' | 'alpha'>('recent');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);

  // Manual Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHanzi, setNewHanzi] = useState('');
  const [newSentence, setNewSentence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live queries
  const words = useLiveQuery(() => db.words.toArray(), [], []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const contexts = useLiveQuery(() => db.contexts.toArray(), [], []);
  const passages = useLiveQuery(() => db.passages.toArray(), [], []);
  const reviewLogs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);

  // Maps for rapid lookup
  const cardByWordId = useMemo(() => {
    const map = new Map<string, CardRow>();
    for (const c of cards) map.set(c.wordId, c);
    return map;
  }, [cards]);

  const contextsByWordId = useMemo(() => {
    const map = new Map<string, Context[]>();
    for (const ctx of contexts) {
      const list = map.get(ctx.wordId) || [];
      list.push(ctx);
      map.set(ctx.wordId, list);
    }
    return map;
  }, [contexts]);

  const passagesById = useMemo(() => {
    const map = new Map<string, { title: string }>();
    for (const p of passages) map.set(p.id, { title: p.title });
    return map;
  }, [passages]);

  // Strip tone marks for search comparison: "luò shí" -> "luoshi"
  const normalizeToneless = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  };

  // Filter and sort words
  const filteredWords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tonelessQuery = normalizeToneless(query);

    return words
      .filter(w => {
        // Status filter
        const card = cardByWordId.get(w.id);
        if (filterStatus === 'suspended' && w.status !== 'suspended') return false;
        if (filterStatus === 'known' && w.status !== 'known') return false;
        if (filterStatus === 'new' && (w.status !== 'active' || card?.state !== 0)) return false;
        if (filterStatus === 'learning' && (w.status !== 'active' || card?.state !== 1)) return false;
        if (filterStatus === 'review' && (w.status !== 'active' || card?.state !== 2)) return false;

        // Search match: hanzi, pinyin (with or without tones), or English gloss
        if (query) {
          const matchHanzi = w.simplified.includes(query);
          const matchGloss = w.gloss.toLowerCase().includes(query);
          const matchPinyin = w.pinyin.toLowerCase().includes(query) || normalizeToneless(w.pinyin).includes(tonelessQuery);
          if (!matchHanzi && !matchGloss && !matchPinyin) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') return b.createdAt - a.createdAt;
        if (sortBy === 'alpha') return a.simplified.localeCompare(b.simplified, 'zh');
        if (sortBy === 'due') {
          const dueA = cardByWordId.get(a.id)?.due || 0;
          const dueB = cardByWordId.get(b.id)?.due || 0;
          return dueA - dueB;
        }
        return 0;
      });
  }, [words, searchQuery, filterStatus, sortBy, cardByWordId]);

  const selectedWord = useMemo(
    () => words.find(w => w.id === selectedWordId) || null,
    [words, selectedWordId]
  );
  const selectedWordCard = selectedWord ? cardByWordId.get(selectedWord.id) : null;
  const selectedWordContexts = selectedWord ? contextsByWordId.get(selectedWord.id) || [] : [];
  const selectedWordLogs = selectedWord && selectedWordCard
    ? reviewLogs.filter(l => l.cardId === selectedWordCard.id).sort((a, b) => b.reviewedAt - a.reviewedAt)
    : [];

  // Manual Add Word
  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHanzi.trim()) return;
    setIsSubmitting(true);

    try {
      const surface = newHanzi.trim();
      const existing = await db.words.where('simplified').equals(surface).first();

      let wordId = existing?.id;
      const now = Date.now();

      if (existing) {
        await db.words.update(existing.id, {
          encounters: (existing.encounters || 1) + 1,
          updatedAt: now,
        });
      } else {
        const fallback = await buildDictionaryFallbackGloss(surface, newSentence);
        wordId = nanoid(10);
        const newWord: Word = {
          id: wordId,
          simplified: surface,
          pinyin: fallback.pinyin || getWordPinyin(surface),
          gloss: fallback.gloss,
          breakdown: fallback.breakdown,
          tags: [],
          status: 'active',
          encounters: 1,
          createdAt: now,
          updatedAt: now,
        };
        await db.words.add(newWord);

        const card = createNewCard(wordId);
        await db.cards.add(card);
      }

      if (wordId && newSentence.trim()) {
        const ctx: Context = {
          id: nanoid(10),
          wordId,
          passageId: null,
          sentence: newSentence.trim(),
          sentenceIdx: 0,
          createdAt: now,
        };
        await db.contexts.add(ctx);
      }

      setNewHanzi('');
      setNewSentence('');
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = async () => {
    const csv = await exportWordBankCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bamboo-wordbank-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteWord = async (wordId: string) => {
    if (confirm('Delete this word and its review history from your Word Bank?')) {
      await db.transaction('rw', [db.words, db.cards, db.contexts, db.reviewLogs], async () => {
        await db.words.delete(wordId);
        const card = await db.cards.where('wordId').equals(wordId).first();
        if (card) {
          await db.cards.delete(card.id);
          await db.reviewLogs.where('cardId').equals(card.id).delete();
        }
        await db.contexts.where('wordId').equals(wordId).delete();
      });
      setSelectedWordId(null);
    }
  };

  const handleResetProgress = async (wordId: string) => {
    const card = cardByWordId.get(wordId);
    if (!card) return;
    const fresh = createNewCard(wordId);
    await db.cards.put({ ...fresh, id: card.id });
    alert('Review progress reset to New.');
  };

  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    setCurrentTime(Date.now());
  }, []);

  const formatDue = (dueMs: number | undefined) => {
    if (!dueMs) return '—';
    const now = currentTime || 0;
    if (now === 0) return '—';
    const diff = dueMs - now;
    if (diff <= 0) return 'due now';
    const days = Math.round(diff / (24 * 60 * 60 * 1000));
    if (days < 1) return 'due today';
    return `in ${days}d`;
  };

  const getStatusBadge = (word: Word, card?: CardRow) => {
    if (word.status === 'suspended') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--ink-muted)]">Suspended</span>;
    }
    if (word.status === 'known') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary)] font-semibold">Known</span>;
    }
    if (!card || card.state === 0) {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--peek-bg)] text-[var(--peek)]">New</span>;
    }
    if (card.state === 1) {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary)]">Learning</span>;
    }
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary)] font-medium">Review</span>;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[var(--ink)]">
            Word Bank ({words.length})
          </h1>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            All words encountered across your readings with saved context sentences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add word</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--ink)] transition flex items-center gap-1.5"
            title="Export Word Bank to CSV (Anki-compatible)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            type="text"
            placeholder="Search hanzi, pinyin (e.g. luoshi), or English..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status filters */}
          <div className="flex gap-1 bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)]">
            {['all', 'new', 'learning', 'review', 'suspended', 'known'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-2.5 py-1 rounded capitalize transition font-medium',
                  filterStatus === status
                    ? 'bg-[var(--primary-tint)] text-[var(--primary)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                )}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'recent' | 'due' | 'alpha')}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs focus:outline-none"
          >
            <option value="recent">Recently added</option>
            <option value="due">Due date</option>
            <option value="alpha">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Words List */}
      {filteredWords.length === 0 ? (
        <div className="bg-[var(--surface)] p-12 rounded-2xl border border-[var(--border)] text-center text-xs text-[var(--ink-muted)] space-y-2">
          <p>No words found matching your search or filter.</p>
          {words.length === 0 && (
            <p>Read passages or click &ldquo;Add word&rdquo; above to build your vocabulary.</p>
          )}
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="divide-y divide-[var(--border)]">
            {filteredWords.map(w => {
              const card = cardByWordId.get(w.id);
              const ctxCount = (contextsByWordId.get(w.id) || []).length;

              return (
                <div
                  key={w.id}
                  onClick={() => setSelectedWordId(w.id)}
                  className="p-4 hover:bg-[var(--surface-hover)]/70 transition cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-serif text-xl font-bold text-[var(--ink)]">
                        {w.simplified}
                      </span>
                      <span className="text-xs text-[var(--ink-muted)] font-serif">
                        {w.pinyin}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink)] truncate">
                      {w.gloss}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--ink-muted)] shrink-0">
                    <div className="hidden sm:flex flex-col items-end">
                      {getStatusBadge(w, card)}
                      <span className="text-[11px] text-[var(--ink-muted)] mt-0.5">
                        {formatDue(card?.due)}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                      {ctxCount} {ctxCount === 1 ? 'ctx' : 'ctxs'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Word Detail Drawer (§6.6) */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[var(--surface)] w-full max-w-md h-full shadow-2xl p-6 border-l border-[var(--border)] overflow-y-auto space-y-6 animate-in slide-in-from-right">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-3xl font-bold text-[var(--ink)]">
                    {selectedWord.simplified}
                  </h2>
                  <button
                    onClick={() => speakChinese(selectedWord.simplified)}
                    className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)]"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm font-serif text-[var(--ink-muted)] mt-0.5">
                  {selectedWord.pinyin}
                </p>
              </div>
              <button
                onClick={() => setSelectedWordId(null)}
                className="p-1 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editable Gloss & Notes */}
            <div className="space-y-3 bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)] text-xs">
              <div>
                <label className="block text-[var(--ink-muted)] mb-1">Definition / Gloss</label>
                <input
                  type="text"
                  value={selectedWord.gloss}
                  onChange={e => {
                    const gloss = e.target.value;
                    db.words.update(selectedWord.id, { gloss });
                  }}
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-[var(--ink-muted)] mb-1">Personal Note</label>
                <textarea
                  rows={2}
                  value={selectedWord.userNote || ''}
                  placeholder="Add mnemonics or notes..."
                  onChange={e => {
                    const userNote = e.target.value;
                    db.words.update(selectedWord.id, { userNote });
                  }}
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] resize-none"
                />
              </div>
            </div>

            {/* Breakdown */}
            {selectedWord.breakdown && selectedWord.breakdown.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--ink-muted)]">Character Breakdown</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedWord.breakdown.map((b, idx) => (
                    <span key={idx} className="bg-[var(--surface-hover)] px-2.5 py-1 rounded">
                      <strong className="text-[var(--ink)] font-serif">{b.char}</strong>: {b.meaning}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* All Contexts */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--ink-muted)]">
                Context Sentences ({selectedWordContexts.length})
              </span>
              <div className="space-y-2">
                {selectedWordContexts.map(c => {
                  const passageTitle = c.passageId ? passagesById.get(c.passageId)?.title : 'Manual Add';
                  return (
                    <div key={c.id} className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs space-y-1">
                      <p className="font-serif text-[var(--ink)] italic leading-relaxed">
                        &ldquo;{c.sentence}&rdquo;
                      </p>
                      {c.passageId && (
                        <Link
                          href={`/read/${c.passageId}`}
                          className="text-[11px] text-[var(--primary)] hover:underline flex items-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>From: {passageTitle}</span>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FSRS Stats */}
            {selectedWordCard && (
              <div className="space-y-2 text-xs border-t border-[var(--border)] pt-4">
                <span className="font-semibold text-[var(--ink-muted)]">FSRS Spaced Repetition Stats</span>
                <div className="grid grid-cols-2 gap-2 text-[var(--ink)] bg-[var(--bg)] p-3 rounded-lg border border-[var(--border)] font-mono text-[11px]">
                  <div>Stability: {selectedWordCard.stability.toFixed(2)}d</div>
                  <div>Difficulty: {selectedWordCard.difficulty.toFixed(2)}</div>
                  <div>Reps: {selectedWordCard.reps}</div>
                  <div>Lapses: {selectedWordCard.lapses}</div>
                  <div>Next due: {formatDue(selectedWordCard.due)}</div>
                  <div>Encounters: {selectedWord.encounters || 1}×</div>
                </div>

                {selectedWordLogs.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <span className="text-[11px] font-semibold text-[var(--ink-muted)]">Recent Ratings</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedWordLogs.slice(0, 8).map(l => (
                        <span key={l.id} className="px-2 py-0.5 rounded bg-[var(--surface-hover)] text-[10px] font-mono">
                          {['', 'Again', 'Hard', 'Good', 'Easy'][l.rating]} ({new Date(l.reviewedAt).toLocaleDateString()})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions: Suspend, Known, Reset, Delete */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)] text-xs">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const next = selectedWord.status === 'suspended' ? 'active' : 'suspended';
                    db.words.update(selectedWord.id, { status: next });
                  }}
                  className="flex-1 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink)] font-medium transition"
                >
                  {selectedWord.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                </button>
                <button
                  onClick={() => {
                    const next = selectedWord.status === 'known' ? 'active' : 'known';
                    db.words.update(selectedWord.id, { status: next });
                  }}
                  className="flex-1 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink)] font-medium transition"
                >
                  {selectedWord.status === 'known' ? 'Unmark known' : 'Mark as known'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleResetProgress(selectedWord.id)}
                  className="flex-1 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
                >
                  Reset progress
                </button>
                <button
                  onClick={() => handleDeleteWord(selectedWord.id)}
                  className="flex-1 py-1.5 rounded-lg border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10 font-medium transition"
                >
                  Delete word
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Word Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleAddWord}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h3 className="font-semibold text-sm text-[var(--ink)]">Add Word to Bank</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block font-medium text-[var(--ink)] mb-1">Chinese characters (required)</label>
              <input
                type="text"
                required
                placeholder="e.g. 落实"
                value={newHanzi}
                onChange={e => setNewHanzi(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm font-serif focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-medium text-[var(--ink)] mb-1">Context sentence (optional)</label>
              <textarea
                rows={3}
                placeholder="Paste the sentence where you saw this word..."
                value={newSentence}
                onChange={e => setNewSentence(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] font-serif focus:outline-none focus:ring-2 focus:ring-[var(--focus)] resize-none"
              />
            </div>

            <p className="text-[11px] text-[var(--ink-muted)]">
              Pinyin and definitions are automatically looked up from the dictionary.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newHanzi.trim()}
                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-semibold hover:bg-[var(--primary-hover)] transition disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add to Bank'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
