'use client';

import React, { useEffect, useState } from 'react';
import { type Mark, type GlossItem, type Word } from '@/lib/db';
import { RevealItem } from './RevealItem';
import { ArrowRight, AlertCircle, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RevealPanelProps {
  marks: Mark[];
  passageText: string;
  glosses: Map<string, GlossItem>;
  wordsMap: Map<string, Word>;
  isOpen: boolean;
  hasApiKey: boolean;
  onClose: () => void;
  onStartReReading: () => void;
  onUpdateMark: (markId: string, updates: Partial<Mark>) => void;
  onApplySegmentation?: (markId: string, suggested: string) => void;
  onHoverMark: (markId: string | null) => void;
  selectedMarkId?: string | null;
  onSelectMark: (markId: string | null) => void;
  toneColorsEnabled: boolean;
  ttsVoice?: string;
  ttsSpeed?: number;
}

export function RevealPanel({
  marks,
  passageText,
  glosses,
  wordsMap,
  isOpen,
  hasApiKey,
  onClose,
  onStartReReading,
  onUpdateMark,
  onApplySegmentation,
  onHoverMark,
  selectedMarkId,
  onSelectMark,
  toneColorsEnabled,
  ttsVoice,
  ttsSpeed,
}: RevealPanelProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  // Keyboard navigation: J/K next/prev item, A toggle add to bank
  useEffect(() => {
    if (!isOpen || marks.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const currentIndex = selectedMarkId
        ? marks.findIndex(m => m.id === selectedMarkId)
        : 0;

      if (e.key === 'j' || e.key === 'J') {
        const nextIdx = Math.min(marks.length - 1, currentIndex + 1);
        onSelectMark(marks[nextIdx].id);
      } else if (e.key === 'k' || e.key === 'K') {
        const prevIdx = Math.max(0, currentIndex - 1);
        onSelectMark(marks[prevIdx].id);
      } else if ((e.key === 'a' || e.key === 'A') && selectedMarkId) {
        const target = marks.find(m => m.id === selectedMarkId);
        if (target) {
          onUpdateMark(selectedMarkId, { addToBank: !target.addToBank });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, marks, selectedMarkId, onSelectMark, onUpdateMark]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-xs z-30 lg:hidden"
      />

      {/* Main Panel */}
      <aside
        className={cn(
          'fixed right-0 bottom-0 z-40 bg-[var(--surface)] border-l border-[var(--border)] flex flex-col shadow-2xl transition-all duration-200 ease-out',
          // Desktop: side panel
          'lg:top-14 lg:h-[calc(100vh-3.5rem)]',
          isMaximized ? 'w-full lg:w-[600px]' : 'w-full lg:w-[400px]',
          // Mobile: bottom sheet
          'max-lg:h-[75vh] max-lg:rounded-t-2xl max-lg:border-t'
        )}
      >
        {/* Panel Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-[var(--ink)]">
              {marks.length} marked {marks.length === 1 ? 'word' : 'words'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="hidden lg:flex p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]"
              title={isMaximized ? 'Restore size' : 'Expand width'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dictionary mode banner if no key */}
        {!hasApiKey && (
          <div className="px-4 py-2.5 bg-[var(--peek-bg)]/50 border-b border-[var(--peek)]/30 text-xs text-[var(--ink)] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--peek)] shrink-0 mt-0.5" />
            <p>
              <strong>Dictionary mode:</strong> Add a DeepSeek API key in Settings for rich contextual explanations.
            </p>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {marks.map(mark => {
            const gloss = glosses.get(mark.id);
            const existingWord = wordsMap.get(mark.surface);
            const isSelected = selectedMarkId === mark.id;

            return (
              <RevealItem
                key={mark.id}
                mark={mark}
                passageText={passageText}
                glossItem={gloss}
                existingWord={existingWord}
                isSelected={isSelected}
                onSelect={() => onSelectMark(mark.id)}
                onToggleAddToBank={checked => onUpdateMark(mark.id, { addToBank: checked })}
                onApplySegmentation={suggested => onApplySegmentation?.(mark.id, suggested)}
                onHover={hovered => onHoverMark(hovered ? mark.id : null)}
                toneColorsEnabled={toneColorsEnabled}
                ttsVoice={ttsVoice}
                ttsSpeed={ttsSpeed}
              />
            );
          })}
        </div>

        {/* Panel Footer */}
        <div className="p-4 border-t border-[var(--border)] shrink-0 bg-[var(--surface)]">
          <button
            onClick={onStartReReading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>Start re-reading →</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
