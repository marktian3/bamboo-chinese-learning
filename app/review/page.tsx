'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { db, getSettings, type Context, type AppSettings } from '@/lib/db';
import { buildReviewQueue, type ReviewQueueItem } from '@/lib/srs/queue';
import { rateCard, undoLastReview, getIntervalPreviews } from '@/lib/srs/fsrs';
import { speakChinese } from '@/lib/tts/speak';
import { parsePinyinSyllables, getToneColor } from '@/lib/dict/pinyin';
import {
  Volume2,
  RotateCcw,
  BookOpen,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerShown, setIsAnswerShown] = useState(false);
  const [intervalPreviews, setIntervalPreviews] = useState<Record<1 | 2 | 3 | 4, string> | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [lastReviewLogId, setLastReviewLogId] = useState<string | null>(null);
  const [showMoreContexts, setShowMoreContexts] = useState(false);
  const [allContexts, setAllContexts] = useState<Context[]>([]);

  // Session summary stats
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  const cardStartTimeRef = useRef<number>(0);

  // Load settings and review queue
  useEffect(() => {
    setSessionStartTime(Date.now());
    cardStartTimeRef.current = Date.now();
    async function init() {
      const s = await getSettings();
      setSettings(s);
      const items = await buildReviewQueue();
      setQueue(items);
      if (items.length === 0) {
        setIsSessionComplete(true);
      }
    }
    init();
  }, []);

  const currentItem = queue[currentIndex] || null;

  // Load interval previews and extra contexts when current card changes
  useEffect(() => {
    if (!currentItem) return;
    setIsAnswerShown(false);
    setShowMoreContexts(false);
    cardStartTimeRef.current = Date.now();

    getIntervalPreviews(currentItem.card).then(setIntervalPreviews);

    db.contexts
      .where('wordId')
      .equals(currentItem.word.id)
      .toArray()
      .then(setAllContexts);
  }, [currentIndex, currentItem]);

  const handleShowAnswer = React.useCallback(() => {
    setIsAnswerShown(true);
    if (settings?.autoPlayAudio && currentItem) {
      speakChinese(currentItem.word.simplified, {
        voiceName: settings.ttsVoice,
        rate: settings.ttsSpeed,
      });
    }
  }, [settings, currentItem]);

  const handleRate = React.useCallback(async (rating: 1 | 2 | 3 | 4) => {
    if (!currentItem) return;

    const durationMs = Date.now() - cardStartTimeRef.current;
    const { log } = await rateCard(currentItem.card, rating, durationMs);
    setLastReviewLogId(log.id);

    setReviewedCount(prev => prev + 1);
    if (rating === 3 || rating === 4) {
      setCorrectCount(prev => prev + 1);
    }

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsSessionComplete(true);
    }
  }, [currentItem, currentIndex, queue.length]);

  const handleUndo = React.useCallback(async () => {
    if (!lastReviewLogId || currentIndex === 0) return;
    const success = await undoLastReview(lastReviewLogId);
    if (success) {
      setLastReviewLogId(null);
      setCurrentIndex(prev => Math.max(0, prev - 1));
      setReviewedCount(prev => Math.max(0, prev - 1));
    }
  }, [lastReviewLogId, currentIndex]);

  const handleSuspend = React.useCallback(async () => {
    if (!currentItem) return;
    await db.words.update(currentItem.word.id, { status: 'suspended' });
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsSessionComplete(true);
    }
  }, [currentItem, currentIndex, queue.length]);

  const handleMarkAsKnown = React.useCallback(async () => {
    if (!currentItem) return;
    await db.words.update(currentItem.word.id, { status: 'known' });
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsSessionComplete(true);
    }
  }, [currentItem, currentIndex, queue.length]);

  // Handle keyboard shortcuts (§6.7)
  // Space: Show answer / Good
  // 1: Again, 2: Hard, 3: Good, 4: Easy
  // Z: Undo, S: Suspend, K: Mark as known
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isSessionComplete || !currentItem) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!isAnswerShown) {
          handleShowAnswer();
        } else {
          handleRate(3); // Good
        }
      } else if (isAnswerShown && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(parseInt(e.key, 10) as 1 | 2 | 3 | 4);
      } else if (e.key === 'z' || e.key === 'Z') {
        handleUndo();
      } else if (e.key === 's' || e.key === 'S') {
        handleSuspend();
      } else if (e.key === 'k' || e.key === 'K') {
        handleMarkAsKnown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswerShown, currentItem, isSessionComplete, handleShowAnswer, handleRate, handleUndo, handleSuspend, handleMarkAsKnown]);

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentItem) {
      speakChinese(currentItem.word.simplified, {
        voiceName: settings?.ttsVoice,
        rate: settings?.ttsSpeed,
      });
    }
  };

  // Session Summary Screen
  if (isSessionComplete) {
    const timeSpentMins = Math.max(1, Math.round((Date.now() - sessionStartTime) / (60 * 1000)));
    const accuracy = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 100;

    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center text-3xl font-serif">
          🎋
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-serif text-[var(--ink)]">
            {reviewedCount > 0 ? 'Session Complete' : 'All caught up!'}
          </h1>
          <p className="text-sm text-[var(--ink-muted)]">
            {reviewedCount > 0
              ? 'Great job keeping up with your daily spaced repetition reviews.'
              : 'You have no flashcards due for review right now.'}
          </p>
        </div>

        {reviewedCount > 0 && (
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-3 text-left text-sm">
            <div className="flex justify-between items-center text-[var(--ink)]">
              <span>Cards reviewed:</span>
              <span className="font-mono font-bold text-base">{reviewedCount}</span>
            </div>
            <div className="flex justify-between items-center text-[var(--primary)] font-semibold">
              <span>Retention accuracy:</span>
              <span className="font-mono text-base">{accuracy}%</span>
            </div>
            <div className="flex justify-between items-center text-[var(--ink-muted)]">
              <span>Time spent:</span>
              <span className="font-mono">{timeSpentMins} min</span>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition shadow-sm flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Read something new</span>
          </Link>
          <Link
            href="/words"
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--ink)] transition flex items-center justify-center gap-2"
          >
            <span>Word Bank</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentItem || !settings) {
    return null;
  }

  const { word, context, card } = currentItem;
  const isLeech = word.tags.includes('leech') || card.lapses >= 8;
  const syllables = parsePinyinSyllables(word.pinyin);

  // Highlight word inside sentence
  const renderHighlightedSentence = (sentence: string) => {
    const idx = sentence.indexOf(word.simplified);
    if (idx === -1) return <span>&ldquo;{sentence}&rdquo;</span>;
    const before = sentence.slice(0, idx);
    const after = sentence.slice(idx + word.simplified.length);
    return (
      <span>
        &ldquo;{before}
        <span className="font-bold text-[var(--mark)]">{word.simplified}</span>
        {after}&rdquo;
      </span>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Top Header: Progress & Undo */}
      <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[var(--ink)]">
            Card {currentIndex + 1} of {queue.length}
          </span>
          <span>·</span>
          <span>Due {queue.length - currentIndex}</span>
        </div>

        <div className="flex items-center gap-2">
          {lastReviewLogId && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 hover:text-[var(--ink)] p-1 rounded hover:bg-[var(--surface-hover)] transition"
              title="Undo last rating (Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo (Z)</span>
            </button>
          )}
          <button
            onClick={handleSuspend}
            className="hover:text-[var(--ink)] p-1 rounded hover:bg-[var(--surface-hover)]"
            title="Suspend card (S)"
          >
            Suspend (S)
          </button>
          <button
            onClick={handleMarkAsKnown}
            className="hover:text-[var(--ink)] p-1 rounded hover:bg-[var(--surface-hover)]"
            title="Mark as known (K)"
          >
            Known (K)
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-[var(--primary)] h-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      {/* Card Body */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-10 shadow-sm space-y-6 min-h-[380px] flex flex-col justify-between transition-all">
        {/* Leech warning badge (§6.7) */}
        {isLeech && (
          <div className="p-2.5 rounded-lg bg-[var(--peek-bg)]/60 border border-[var(--peek)]/40 text-xs text-[var(--ink)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--peek)] shrink-0" />
            <span>This one is tricky (8+ lapses); try adding a mnemonic or personal note!</span>
          </div>
        )}

        {/* Word Display (64px desktop / 52px mobile, reading font) */}
        <div className="text-center space-y-4 my-auto">
          <div className="font-serif text-5xl sm:text-6xl font-bold tracking-wide text-[var(--ink)]">
            {word.simplified}
          </div>

          {/* Context Sentence (Front & Back) */}
          {context && (
            <div className="max-w-lg mx-auto text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed italic font-serif">
              {renderHighlightedSentence(context.sentence)}
            </div>
          )}

          {/* BACK OF CARD: Pinyin, Gloss, Breakdown, Translations */}
          {isAnswerShown && (
            <div className="space-y-4 pt-6 border-t border-[var(--border)] animate-in fade-in duration-200">
              {/* Pinyin and TTS Audio */}
              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-wrap gap-1 font-serif text-2xl font-semibold">
                  {syllables.map((s, idx) => (
                    <span
                      key={idx}
                      style={{
                        color: settings.toneColors ? getToneColor(s.tone) : 'var(--ink)',
                      }}
                    >
                      {s.syllable}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handlePlayAudio}
                  className="p-1.5 rounded-md text-[var(--ink-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] transition"
                  title="Play pronunciation"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Gloss */}
              <div className="text-lg font-bold text-[var(--ink)]">
                {word.gloss}
              </div>

              {/* In-context & Translation */}
              {context?.inContext && (
                <div className="text-xs text-[var(--ink)] bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)] max-w-lg mx-auto text-left">
                  <span className="font-semibold text-[var(--ink-muted)]">In context: </span>
                  {context.inContext}
                </div>
              )}

              {/* Per-character breakdown */}
              {word.breakdown && word.breakdown.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 text-xs text-[var(--ink-muted)]">
                  {word.breakdown.map((b, idx) => (
                    <span key={idx} className="bg-[var(--surface-hover)] px-2.5 py-1 rounded-md">
                      <strong className="text-[var(--ink)] font-serif text-sm">{b.char}</strong> {b.meaning}
                    </span>
                  ))}
                </div>
              )}

              {/* Collapsible extra contexts */}
              {allContexts.length > 1 && (
                <div className="pt-2 text-xs text-left max-w-lg mx-auto">
                  <button
                    onClick={() => setShowMoreContexts(!showMoreContexts)}
                    className="flex items-center gap-1 font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  >
                    {showMoreContexts ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>{allContexts.length - 1} more context sentences</span>
                  </button>
                  {showMoreContexts && (
                    <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-[var(--border)] italic text-[var(--ink-muted)]">
                      {allContexts
                        .filter(c => c.id !== context?.id)
                        .map(c => (
                          <div key={c.id}>{renderHighlightedSentence(c.sentence)}</div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM: Show Answer or FSRS Rating Bar */}
        <div className="pt-6">
          {!isAnswerShown ? (
            <button
              onClick={handleShowAnswer}
              className="w-full py-3.5 rounded-xl text-base font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition shadow-sm"
            >
              Show answer (Space)
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {/* Again */}
              <button
                onClick={() => handleRate(1)}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)]/10 font-semibold transition"
              >
                <span className="text-sm">Again (1)</span>
                <span className="text-xs font-normal opacity-80">{intervalPreviews?.[1] || '1m'}</span>
              </button>

              {/* Hard */}
              <button
                onClick={() => handleRate(2)}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-[var(--peek)] text-[var(--peek)] hover:bg-[var(--peek-bg)] font-semibold transition"
              >
                <span className="text-sm">Hard (2)</span>
                <span className="text-xs font-normal opacity-80">{intervalPreviews?.[2] || '6m'}</span>
              </button>

              {/* Good */}
              <button
                onClick={() => handleRate(3)}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold transition shadow-sm"
              >
                <span className="text-sm">Good (3)</span>
                <span className="text-xs font-normal opacity-90">{intervalPreviews?.[3] || '10m'}</span>
              </button>

              {/* Easy */}
              <button
                onClick={() => handleRate(4)}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-sky-600 dark:border-sky-400 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 font-semibold transition"
              >
                <span className="text-sm">Easy (4)</span>
                <span className="text-xs font-normal opacity-80">{intervalPreviews?.[4] || '4d'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
