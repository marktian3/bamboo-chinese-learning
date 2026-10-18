import React from 'react';

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)] font-serif">竹 Bamboo</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1">
          A calm, local-first Chinese reading and spaced repetition application.
        </p>
      </div>

      <section className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink)]">About the Project</h2>
        <p className="text-sm text-[var(--ink)] leading-relaxed">
          Bamboo helps intermediate Chinese learners make the jump to native reading material without losing flow.
          Using a three-pass reading model (Read &amp; Mark → Reveal → Re-read) and FSRS-powered spaced repetition with full context sentences, it turns authentic reading into lasting vocabulary.
        </p>
      </section>

      <section className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Licenses &amp; Attributions</h2>
        <div className="space-y-3 text-sm text-[var(--ink-muted)]">
          <div>
            <strong className="text-[var(--ink)] font-medium">CC-CEDICT</strong>
            <p className="text-xs mt-0.5">
              Chinese-English dictionary compiled by MDBG and the open-source community.
              Licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)</a>.
            </p>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <strong className="text-[var(--ink)] font-medium">Typography</strong>
            <ul className="text-xs list-disc list-inside mt-1 space-y-1">
              <li><strong>Noto Serif SC &amp; Noto Sans SC:</strong> Designed by Adobe &amp; Google, licensed under the SIL Open Font License (OFL).</li>
              <li><strong>LXGW WenKai (霞鹜文楷):</strong> An open-source Kai/imitation-Song typeface by lxgw, based on Klee One. Licensed under the SIL Open Font License.</li>
              <li><strong>Inter:</strong> Designed by Rasmus Andersson, licensed under the SIL Open Font License.</li>
            </ul>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <strong className="text-[var(--ink)] font-medium">Core Algorithms &amp; Libraries</strong>
            <ul className="text-xs list-disc list-inside mt-1 space-y-1">
              <li><strong>ts-fsrs:</strong> Free Spaced Repetition Scheduler implementation by the Open Spaced Repetition project (MIT).</li>
              <li><strong>pinyin-pro:</strong> High-performance Chinese pinyin conversion library (MIT).</li>
              <li><strong>Dexie.js:</strong> Minimalistic wrapper for IndexedDB (Apache 2.0).</li>
              <li><strong>Radix UI &amp; Lucide Icons:</strong> Accessible UI primitives and iconography (MIT).</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="text-center text-xs text-[var(--ink-faint)]">
        Bamboo · Local-first &amp; Private · All data lives in your browser
      </div>
    </div>
  );
}
