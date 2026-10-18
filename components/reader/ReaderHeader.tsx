'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { type Passage, type AppSettings } from '@/lib/db';
import { ArrowLeft, Type, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReaderHeaderProps {
  passage: Passage;
  onUpdateTitle: (title: string) => void;
  settings: AppSettings;
  onUpdateSettings: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onPhaseChange?: (phase: Passage['phase']) => void;
}

export function ReaderHeader({
  passage,
  onUpdateTitle,
  settings,
  onUpdateSettings,
  onPhaseChange,
}: ReaderHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(passage.title);
  const [isAaOpen, setIsAaOpen] = useState(false);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateTitle(titleInput.trim());
    } else {
      setTitleInput(passage.title);
    }
  };

  const phases = [
    { id: 'pass1', label: '① Read & Mark' },
    { id: 'revealed', label: '② Reveal' },
    { id: 'pass2', label: '③ Re-read' },
  ] as const;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-4 sm:px-6 h-14 flex items-center justify-between">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-3 max-w-[45%] sm:max-w-[40%]">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] transition p-1.5 rounded-lg hover:bg-[var(--surface-hover)]"
          title="Return to Library"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Library</span>
        </Link>

        <span className="text-[var(--border)] hidden sm:inline">|</span>

        {isEditingTitle ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
              className="text-sm font-semibold px-2 py-0.5 rounded border border-[var(--primary)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleTitleSubmit}
              className="p-1 text-[var(--primary)] hover:bg-[var(--primary-tint)] rounded"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            title="Click to rename"
            className="text-xs sm:text-sm font-semibold text-[var(--ink)] truncate max-w-full hover:underline text-left"
          >
            {passage.title}
          </button>
        )}
      </div>

      {/* Middle: Phase Progress Bar */}
      <div className="hidden md:flex items-center gap-1 sm:gap-2 text-xs font-medium">
        {phases.map((p, idx) => {
          const isActive = passage.phase === p.id;
          const isPast =
            (p.id === 'pass1' && (passage.phase === 'revealed' || passage.phase === 'pass2' || passage.phase === 'completed')) ||
            (p.id === 'revealed' && (passage.phase === 'pass2' || passage.phase === 'completed'));

          return (
            <React.Fragment key={p.id}>
              {idx > 0 && <span className="text-[var(--ink-faint)]">─</span>}
              <button
                onClick={() => onPhaseChange?.(p.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full transition cursor-pointer',
                  isActive
                    ? 'bg-[var(--primary-tint)] text-[var(--primary)] font-bold'
                    : isPast
                    ? 'text-[var(--ink)] hover:text-[var(--primary)]'
                    : 'text-[var(--ink-faint)] hover:text-[var(--ink-muted)]'
                )}
              >
                {p.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Right: Aa Menu Popover */}
      <div className="relative">
        <button
          onClick={() => setIsAaOpen(!isAaOpen)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs sm:text-sm font-medium transition',
            isAaOpen ? 'bg-[var(--surface-hover)] border-[var(--ink-muted)]' : 'bg-[var(--bg)] hover:bg-[var(--surface-hover)]'
          )}
          title="Reader typography & preferences"
        >
          <Type className="w-4 h-4" />
          <span>Aa</span>
        </button>

        {isAaOpen && (
          <div className="absolute right-0 top-11 w-72 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 font-semibold text-[var(--ink)]">
              <span>Typography &amp; Display</span>
              <button
                onClick={() => setIsAaOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-sm"
              >
                ✕
              </button>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex justify-between items-center mb-1 text-[var(--ink)]">
                <span>Font Size</span>
                <span className="font-mono">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">A</span>
                <input
                  type="range"
                  min="20"
                  max="40"
                  value={settings.fontSize}
                  onChange={e => onUpdateSettings('fontSize', Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
                <span className="text-base font-bold">A</span>
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-[var(--ink)] mb-1">Font Family</label>
              <select
                value={settings.fontFamily}
                onChange={e => onUpdateSettings('fontFamily', e.target.value as AppSettings['fontFamily'])}
                className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
              >
                <option value="Noto Serif SC">Noto Serif SC (思源宋体)</option>
                <option value="LXGW WenKai">LXGW WenKai (霞鹜文楷)</option>
                <option value="Noto Sans SC">Noto Sans SC (思源黑体)</option>
              </select>
            </div>

            {/* Line Height */}
            <div>
              <label className="block text-[var(--ink)] mb-1">Line Height</label>
              <div className="flex gap-1">
                {(['compact', 'normal', 'airy'] as const).map(lh => (
                  <button
                    key={lh}
                    onClick={() => onUpdateSettings('lineHeight', lh)}
                    className={cn(
                      'flex-1 py-1 capitalize rounded border transition',
                      settings.lineHeight === lh
                        ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary)] font-semibold'
                        : 'border-[var(--border)] bg-[var(--bg)] text-[var(--ink-muted)]'
                    )}
                  >
                    {lh}
                  </button>
                ))}
              </div>
            </div>

            {/* Pinyin Display in Pass 2 */}
            <div>
              <label className="block text-[var(--ink)] mb-1">Pass 2 Pinyin Ruby</label>
              <select
                value={settings.pinyinDisplay}
                onChange={e => onUpdateSettings('pinyinDisplay', e.target.value as 'off' | 'marked' | 'all')}
                className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
              >
                <option value="marked">Marked words only (default)</option>
                <option value="all">All words</option>
                <option value="off">Off</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="space-y-2 border-t border-[var(--border)] pt-2 text-[var(--ink)]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.toneColors}
                  onChange={e => onUpdateSettings('toneColors', e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                Tone-colored pinyin
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.underlineWordBank}
                  onChange={e => onUpdateSettings('underlineWordBank', e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                Highlight Word Bank words
              </label>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
