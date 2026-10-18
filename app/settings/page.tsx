'use client';

import React, { useEffect, useState } from 'react';
import { getSettings, updateSettings, db, type AppSettings } from '@/lib/db';
import { useTheme } from '@/components/ThemeProvider';
import { exportDatabaseJSON, importDatabaseJSON } from '@/lib/export/json';
import { exportWordBankCSV } from '@/lib/export/csv';
import { Eye, EyeOff, Check, AlertCircle, RefreshCw, Download, Upload, Trash2, Key, Sliders, BookOpen, SunMoon } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [includeKeyInExport, setIncludeKeyInExport] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);

    const loadVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const zhVoices = voices.filter(v => v.lang.includes('zh') || v.lang.includes('cmn'));
        setAvailableVoices(zhVoices.length > 0 ? zhVoices : voices);
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleChange = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await updateSettings({ [key]: value });
    setSaveMessage('Saved');
    setTimeout(() => setSaveMessage(null), 1500);
  };

  const handleTestConnection = async () => {
    if (!settings) return;
    setTestStatus({ loading: true });
    try {
      const res = await fetch('/api/llm/ping', {
        method: 'POST',
        headers: {
          'x-user-api-key': settings.apiKey,
          'x-llm-base-url': settings.baseUrl,
          'x-llm-model': settings.model,
        },
      });
      const data = await res.json();
      if (data.ok) {
        setTestStatus({ loading: false, success: true, message: `Connected successfully (${data.model})` });
      } else {
        setTestStatus({ loading: false, success: false, message: data.error || 'Connection failed' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setTestStatus({ loading: false, success: false, message: msg });
    }
  };

  const handleExportJSON = async () => {
    const jsonStr = await exportDatabaseJSON(includeKeyInExport);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bamboo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    const csvStr = await exportWordBankCSV();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bamboo-words-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'merge' | 'replace') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportStatus('Importing...');
    const result = await importDatabaseJSON(text, mode);
    if (result.success) {
      setImportStatus(`Imported successfully! (${result.counts?.words} words, ${result.counts?.passages} passages)`);
      const updated = await getSettings();
      setSettings(updated);
    } else {
      setImportStatus(`Import failed: ${result.error}`);
    }
    e.target.value = '';
    setTimeout(() => setImportStatus(null), 4000);
  };

  const handleDeleteAll = async () => {
    if (deleteConfirm !== 'DELETE') return;
    await db.transaction('rw', [db.passages, db.marks, db.words, db.contexts, db.cards, db.reviewLogs, db.glossCache, db.translationCache], async () => {
      await db.passages.clear();
      await db.marks.clear();
      await db.words.clear();
      await db.contexts.clear();
      await db.cards.clear();
      await db.reviewLogs.clear();
      await db.glossCache.clear();
      await db.translationCache.clear();
    });
    setDeleteConfirm('');
    alert('All passages, words, and review history have been wiped.');
  };

  if (!settings) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center text-[var(--ink-muted)]">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Settings</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Configure reading experience, spaced repetition, AI provider, and data.
          </p>
        </div>
        {saveMessage && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--primary-tint)] text-[var(--primary)] font-medium flex items-center gap-1 animate-fade-in">
            <Check className="w-3.5 h-3.5" /> {saveMessage}
          </span>
        )}
      </div>

      {/* AI Settings */}
      <section className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
          <Key className="w-5 h-5 text-[var(--primary)]" />
          <h2>AI Provider (DeepSeek / OpenAI compatible)</h2>
        </div>
        <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
          Security note: Stored only in this browser. Sent only to your configured AI provider via this app&apos;s server for contextual meanings and sentence translations.
        </p>

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={settings.apiKey}
                onChange={e => handleChange('apiKey', e.target.value)}
                className="w-full px-3.5 py-2 pr-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)] p-1"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={settings.baseUrl}
                onChange={e => handleChange('baseUrl', e.target.value)}
                placeholder="https://api.deepseek.com"
                className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">
                Model
              </label>
              <input
                type="text"
                value={settings.model}
                onChange={e => handleChange('model', e.target.value)}
                placeholder="deepseek-chat"
                className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={testStatus.loading || !settings.apiKey}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--surface-hover)] text-[var(--ink)] hover:bg-[var(--border)] transition disabled:opacity-50 flex items-center gap-2"
            >
              {testStatus.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Test Connection
            </button>
            {testStatus.message && (
              <span className={`text-xs flex items-center gap-1.5 ${testStatus.success ? 'text-[var(--primary)]' : 'text-[var(--danger)]'}`}>
                {testStatus.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {testStatus.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Reading Experience */}
      <section className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] space-y-5 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
          <BookOpen className="w-5 h-5 text-[var(--primary)]" />
          <h2>Reading Experience</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Lookup Style
            </label>
            <select
              value={settings.lookupStyle}
              onChange={e => handleChange('lookupStyle', e.target.value as 'deferred' | 'instant')}
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            >
              <option value="deferred">Deferred (recommended, Read & Mark → Reveal)</option>
              <option value="instant">Instant (shows popover immediately)</option>
            </select>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Deferred lets you read without popups, testing inference before checking definitions.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Font Family
            </label>
            <select
              value={settings.fontFamily}
              onChange={e => handleChange('fontFamily', e.target.value as AppSettings['fontFamily'])}
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            >
              <option value="Noto Serif SC">Noto Serif SC (思源宋体 - Classic)</option>
              <option value="LXGW WenKai">LXGW WenKai (霞鹜文楷 - Kai/Brush)</option>
              <option value="Noto Sans SC">Noto Sans SC (思源黑体 - Clean Modern)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-[var(--ink)]">
                Font Size ({settings.fontSize}px)
              </label>
            </div>
            <input
              type="range"
              min="20"
              max="40"
              value={settings.fontSize}
              onChange={e => handleChange('fontSize', Number(e.target.value))}
              className="w-full accent-[var(--primary)] cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Line Height
            </label>
            <select
              value={settings.lineHeight}
              onChange={e => handleChange('lineHeight', e.target.value as 'compact' | 'normal' | 'airy')}
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            >
              <option value="compact">Compact (1.8)</option>
              <option value="normal">Normal (2.2 - preserves ruby space)</option>
              <option value="airy">Airy (2.6)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Pass 2 Pinyin Display
            </label>
            <select
              value={settings.pinyinDisplay}
              onChange={e => handleChange('pinyinDisplay', e.target.value as 'off' | 'marked' | 'all')}
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            >
              <option value="marked">Marked words only (default)</option>
              <option value="all">All words</option>
              <option value="off">Off</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              TTS Voice & Speed ({settings.ttsSpeed}×)
            </label>
            <div className="space-y-2">
              <select
                value={settings.ttsVoice}
                onChange={e => handleChange('ttsVoice', e.target.value)}
                className="w-full px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
              >
                <option value="">Default Chinese Voice</option>
                {availableVoices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <input
                type="range"
                min="0.6"
                max="1.2"
                step="0.05"
                value={settings.ttsSpeed}
                onChange={e => handleChange('ttsSpeed', parseFloat(e.target.value))}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-2 border-t border-[var(--border)]">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={settings.toneColors}
              onChange={e => handleChange('toneColors', e.target.checked)}
              className="rounded accent-[var(--primary)] w-4 h-4 cursor-pointer"
            />
            Tone-colored pinyin (1=red, 2=orange, 3=green, 4=blue)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={settings.underlineWordBank}
              onChange={e => handleChange('underlineWordBank', e.target.checked)}
              className="rounded accent-[var(--primary)] w-4 h-4 cursor-pointer"
            />
            Underline known Word Bank words with a faint dotted line
          </label>
        </div>
      </section>

      {/* Review / SRS Settings */}
      <section className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
          <Sliders className="w-5 h-5 text-[var(--primary)]" />
          <h2>Review & Spaced Repetition (FSRS)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              New cards per day
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.newCardsPerDay}
              onChange={e => handleChange('newCardsPerDay', parseInt(e.target.value, 10) || 0)}
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Max reviews per day
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              value={settings.maxReviewsPerDay}
              onChange={e => handleChange('maxReviewsPerDay', parseInt(e.target.value, 10) || 10)}
              className="w-full px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-[var(--ink)]">
                Desired retention ({Math.round(settings.desiredRetention * 100)}%)
              </label>
            </div>
            <input
              type="range"
              min="0.80"
              max="0.97"
              step="0.01"
              value={settings.desiredRetention}
              onChange={e => handleChange('desiredRetention', parseFloat(e.target.value))}
              className="w-full accent-[var(--primary)] cursor-pointer mt-2"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={settings.autoPlayAudio}
              onChange={e => handleChange('autoPlayAudio', e.target.checked)}
              className="rounded accent-[var(--primary)] w-4 h-4 cursor-pointer"
            />
            Auto-play Chinese audio when card answer is shown
          </label>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
          <SunMoon className="w-5 h-5 text-[var(--primary)]" />
          <h2>Appearance</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Theme
          </label>
          <div className="flex gap-3">
            {(['system', 'light', 'dark'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setTheme(mode);
                  handleChange('theme', mode);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition ${
                  theme === mode
                    ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
          <Download className="w-5 h-5 text-[var(--primary)]" />
          <h2>Data & Export</h2>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-hover)] text-[var(--ink)] flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" /> Export All (JSON)
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-hover)] text-[var(--ink)] flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" /> Export Word Bank (CSV / Anki)
          </button>

          <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={includeKeyInExport}
              onChange={e => setIncludeKeyInExport(e.target.checked)}
              className="rounded accent-[var(--primary)]"
            />
            Include API key in export
          </label>
        </div>

        <div className="border-t border-[var(--border)] pt-4 space-y-2">
          <label className="block text-sm font-medium text-[var(--ink)]">
            Import JSON Backup
          </label>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-hover)] text-[var(--ink)] flex items-center gap-2 cursor-pointer transition">
              <Upload className="w-4 h-4" /> Merge Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => handleImportFile(e, 'merge')}
              />
            </label>

            <label className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-hover)] text-[var(--ink)] flex items-center gap-2 cursor-pointer transition">
              <Upload className="w-4 h-4" /> Replace All Data
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => handleImportFile(e, 'replace')}
              />
            </label>
          </div>
          {importStatus && (
            <p className="text-xs text-[var(--primary)] font-medium">{importStatus}</p>
          )}
        </div>

        {/* Delete All Danger Zone */}
        <div className="border-t border-[var(--border)] pt-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--danger)] flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Danger Zone: Delete All Data
          </div>
          <p className="text-xs text-[var(--ink-muted)]">
            Permanently erases all passages, saved words, review logs, and cached definitions from IndexedDB.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder='Type "DELETE" to confirm'
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--danger)]"
            />
            <button
              onClick={handleDeleteAll}
              disabled={deleteConfirm !== 'DELETE'}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-40 transition"
            >
              Confirm Wipe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
