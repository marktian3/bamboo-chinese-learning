'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { BookOpen, Layers, Sparkles, Settings as SettingsIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();

  // Hide nav entirely in reading mode
  const isReader = pathname.startsWith('/read/');

  const dueCount = useLiveQuery(async () => {
    try {
      const now = Date.now();
      const suspendedOrKnownWords = await db.words
        .where('status')
        .anyOf(['suspended', 'known'])
        .primaryKeys();
      const excludedSet = new Set(suspendedOrKnownWords);

      const dueCards = await db.cards
        .where('due')
        .belowOrEqual(now)
        .toArray();

      return dueCards.filter(c => !excludedSet.has(c.wordId)).length;
    } catch {
      return 0;
    }
  }, [], 0);

  if (isReader) {
    return null;
  }

  const navItems = [
    { href: '/', label: 'Library', icon: BookOpen },
    { href: '/review', label: 'Review', icon: Sparkles, badge: dueCount },
    { href: '/words', label: 'Word Bank', icon: Layers },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Top Nav */}
      <header className="hidden sm:block sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-90">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[var(--primary)] text-white font-serif font-bold text-base shadow-sm">
              竹
            </span>
            <span className="font-semibold text-lg tracking-tight text-[var(--ink)]">
              Bamboo
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--primary-tint)] text-[var(--primary)]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary)] text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/about"
              title="About & Licenses"
              className={cn(
                'p-2 rounded-lg text-sm font-medium transition-colors ml-1 text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]',
                pathname === '/about' && 'text-[var(--primary)] bg-[var(--primary-tint)]'
              )}
            >
              <Info className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-2 py-1 safe-area-pb">
        <div className="flex items-center justify-around h-13">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center flex-1 py-1 text-xs transition-colors',
                  isActive
                    ? 'text-[var(--primary)] font-semibold'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 mb-0.5" />
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2.5 inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[var(--primary)] text-white min-w-4 text-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
