'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, BookOpen } from 'lucide-react';

interface FinishModalProps {
  charCount: number;
  newWordsCount: number;
  reviewSoonerCount: number;
  inferStats: { knew: number; partial: number; none: number };
  onClose: () => void;
  onConfirmFinish: () => Promise<void>;
}

export function FinishModal({
  charCount,
  newWordsCount,
  reviewSoonerCount,
  inferStats,
  onClose,
  onConfirmFinish,
}: FinishModalProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const handleFinishAndGo = async (destination: '/' | '/review') => {
    setSubmitting(true);
    await onConfirmFinish();
    router.push(destination);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-in zoom-in-95"
      >
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold font-serif text-[var(--ink)]">
            Nice work!
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">
            You completed this reading passage.
          </p>
        </div>

        {/* Stats Summary */}
        <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)] text-xs space-y-2.5 text-left">
          <div className="flex justify-between items-center text-[var(--ink)]">
            <span>Characters read:</span>
            <span className="font-mono font-bold">{charCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-[var(--primary)] font-medium">
            <span>New words to Word Bank:</span>
            <span className="font-mono font-bold">{newWordsCount}</span>
          </div>
          {reviewSoonerCount > 0 && (
            <div className="flex justify-between items-center text-[var(--peek)] font-medium">
              <span>Existing words (review sooner):</span>
              <span className="font-mono font-bold">{reviewSoonerCount}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-[var(--ink-muted)] pt-2 border-t border-[var(--border)]">
            <span>Inference checks:</span>
            <span>
              Guessed {inferStats.knew} · Partly {inferStats.partial} · ✗ {inferStats.none}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => handleFinishAndGo('/')}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-hover)] text-[var(--ink)] transition flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-4 h-4" />
            <span>Back to Library</span>
          </button>

          <button
            onClick={() => handleFinishAndGo('/review')}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>Review Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
