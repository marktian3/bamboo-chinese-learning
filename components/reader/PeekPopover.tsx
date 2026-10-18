'use client';

import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { speakChinese } from '@/lib/tts/speak';
import { parsePinyinSyllables, getToneColor } from '@/lib/dict/pinyin';
import { type GlossItem } from '@/lib/db';

interface PeekPopoverProps {
  word: string;
  pinyinStr: string;
  glossItem?: GlossItem | null;
  onShowMeaning: () => void;
  toneColorsEnabled: boolean;
  ttsVoice?: string;
  ttsSpeed?: number;
}

export function PeekPopover({
  word,
  pinyinStr,
  glossItem,
  onShowMeaning,
  toneColorsEnabled,
  ttsVoice,
  ttsSpeed,
}: PeekPopoverProps) {
  const [hasRevealedMeaning, setHasRevealedMeaning] = useState(false);
  const syllables = parsePinyinSyllables(pinyinStr);

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakChinese(word, { voiceName: ttsVoice, rate: ttsSpeed });
  };

  const handleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasRevealedMeaning(true);
    onShowMeaning();
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl min-w-[200px] max-w-[280px] text-xs space-y-2 animate-in fade-in zoom-in-95"
    >
      {/* Pinyin and Audio */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 font-serif text-base font-semibold">
          {syllables.map((s, idx) => (
            <span
              key={idx}
              style={{
                color: toneColorsEnabled ? getToneColor(s.tone) : 'var(--ink)',
              }}
            >
              {s.syllable}
            </span>
          ))}
        </div>
        <button
          onClick={handlePlayAudio}
          className="p-1 rounded-md text-[var(--ink-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] transition"
          title="Listen"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      {/* Show Meaning or Gloss */}
      {hasRevealedMeaning || glossItem ? (
        <div className="pt-1 border-t border-[var(--border)] space-y-1">
          <p className="font-semibold text-sm text-[var(--ink)]">
            {glossItem?.gloss || 'Loading definition...'}
          </p>
          {glossItem?.isDictionaryFallback && (
            <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-[var(--peek-bg)] text-[var(--peek)] font-medium">
              dictionary
            </span>
          )}
        </div>
      ) : (
        <button
          onClick={handleReveal}
          className="w-full py-1.5 px-3 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)] text-[var(--ink)] font-medium transition text-center"
        >
          Show meaning
        </button>
      )}
    </div>
  );
}
