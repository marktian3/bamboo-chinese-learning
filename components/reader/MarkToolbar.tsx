'use client';

import React, { useState } from 'react';
import { Eye, ChevronLeft, ChevronRight, Scissors, X } from 'lucide-react';
import { PeekPopover } from './PeekPopover';
import { type GlossItem, type Mark } from '@/lib/db';

interface MarkToolbarProps {
  mark: Mark;
  pinyinStr: string;
  glossItem?: GlossItem | null;
  canExtendLeft: boolean;
  canExtendRight: boolean;
  canSplit: boolean;
  onPeekPinyin: () => void;
  onPeekMeaning: () => void;
  onExtendLeft: () => void;
  onExtendRight: () => void;
  onSplit: () => void;
  onUnmark: () => void;
  onClose: () => void;
  toneColorsEnabled: boolean;
  ttsVoice?: string;
  ttsSpeed?: number;
}

export function MarkToolbar({
  mark,
  pinyinStr,
  glossItem,
  canExtendLeft,
  canExtendRight,
  canSplit,
  onPeekPinyin,
  onPeekMeaning,
  onExtendLeft,
  onExtendRight,
  onSplit,
  onUnmark,
  onClose,
  toneColorsEnabled,
  ttsVoice,
  ttsSpeed,
}: MarkToolbarProps) {
  const [mode, setMode] = useState<'toolbar' | 'peek'>('toolbar');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOpenPeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode('peek');
    onPeekPinyin();
  };

  if (mode === 'peek') {
    return (
      <PeekPopover
        word={mark.surface}
        pinyinStr={pinyinStr}
        glossItem={glossItem}
        onShowMeaning={onPeekMeaning}
        toneColorsEnabled={toneColorsEnabled}
        ttsVoice={ttsVoice}
        ttsSpeed={ttsSpeed}
      />
    );
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="flex items-center gap-0.5 sm:gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl text-xs font-medium text-[var(--ink)] animate-in fade-in zoom-in-95 select-none z-50 whitespace-nowrap"
    >
      <button
        type="button"
        onClick={handleOpenPeek}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--surface-hover)] text-[var(--ink)] transition"
        title="Peek pinyin and meaning"
      >
        <Eye className="w-3.5 h-3.5 text-[var(--peek)]" />
        <span className="hidden sm:inline">Peek</span>
      </button>

      <span className="w-[1px] h-3.5 bg-[var(--border)] my-auto inline-block" />

      <button
        type="button"
        onClick={onExtendLeft}
        disabled={!canExtendLeft}
        className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition"
        title="Extend selection left"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Extend</span>
      </button>

      <button
        type="button"
        onClick={onExtendRight}
        disabled={!canExtendRight}
        className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition"
        title="Extend selection right"
      >
        <span className="hidden sm:inline">Extend</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {canSplit && (
        <>
          <span className="w-[1px] h-3.5 bg-[var(--border)] my-auto inline-block" />
          <button
            type="button"
            onClick={onSplit}
            className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[var(--surface-hover)] text-[var(--ink)] transition"
            title="Split back into separate words"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>
        </>
      )}

      <span className="w-[1px] h-3.5 bg-[var(--border)] my-auto inline-block" />

      <button
        type="button"
        onClick={onUnmark}
        className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[var(--surface-hover)] text-[var(--danger)] transition"
        title="Unmark"
      >
        <X className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Unmark</span>
      </button>
    </div>
  );
}
