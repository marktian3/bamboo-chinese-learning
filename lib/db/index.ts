import { db, DEFAULT_SETTINGS, type AppSettings } from './schema';

export * from './schema';

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app');
  if (existing) {
    return { ...DEFAULT_SETTINGS, ...existing };
  }
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated: AppSettings = { ...current, ...partial, id: 'app' };
  await db.settings.put(updated);
  return updated;
}
