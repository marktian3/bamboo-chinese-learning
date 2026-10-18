'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSettings, updateSettings, type AppSettings } from '@/lib/db';

type Theme = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  settings: null,
  refreshSettings: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('bamboo-theme') as Theme) || 'system';
    }
    return 'system';
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const applyTheme = useCallback((t: Theme) => {
    let effective: 'light' | 'dark' = 'light';
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = prefersDark ? 'dark' : 'light';
    } else {
      effective = t;
    }
    setResolvedTheme(effective);
    document.documentElement.setAttribute('data-theme', effective);
    localStorage.setItem('bamboo-theme', t);
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(s);
      if (s.theme) {
        setThemeState(s.theme);
        applyTheme(s.theme);
      }
    } catch {
      // fallback
    }
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(theme);
    refreshSettings();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = (localStorage.getItem('bamboo-theme') as Theme) || 'system';
      if (current === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme, refreshSettings, theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    updateSettings({ theme: t }).catch(console.error);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, settings, refreshSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
