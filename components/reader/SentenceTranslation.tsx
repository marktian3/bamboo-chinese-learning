'use client';

import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { fetchSentenceTranslation } from '@/lib/llm/client';

interface SentenceTranslationProps {
  sentenceText: string;
  passageContext: string;
}

export function SentenceTranslation({
  sentenceText,
  passageContext,
}: SentenceTranslationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && !translation) {
      setLoading(true);
      setIsOpen(true);
      try {
        const result = await fetchSentenceTranslation(sentenceText, passageContext);
        setTranslation(result);
      } catch {
        setTranslation('Translation error');
      } finally {
        setLoading(false);
      }
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <span className="inline-block ml-1 align-baseline relative">
      <button
        type="button"
        onClick={handleToggle}
        className="opacity-40 hover:opacity-100 transition p-0.5 rounded text-[var(--ink-muted)] hover:text-[var(--primary)] text-xs inline-flex items-center"
        title="Translate sentence (译)"
      >
        <Languages className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <span className="block my-1.5 p-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-sans text-[var(--ink-muted)] leading-relaxed italic animate-in fade-in select-text">
          {loading ? (
            <span className="flex items-center gap-1.5 not-italic">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary)]" />
              <span>Translating sentence...</span>
            </span>
          ) : (
            translation
          )}
        </span>
      )}
    </span>
  );
}
