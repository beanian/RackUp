export type ThemeId = 'baize' | 'pub' | 'tournament' | 'midnight' | 'vintage' | 'crimson' | 'slate' | 'copper';

export const THEMES: { id: ThemeId; label: string; description: string; dot: string }[] = [
  { id: 'baize', label: 'Baize', description: 'Green felt & chalk', dot: '#1e3228' },
  { id: 'pub', label: 'Classic Pub', description: 'Warm mahogany & brass', dot: '#2a1a0e' },
  { id: 'tournament', label: 'Tournament', description: 'Navy & neon broadcast', dot: '#0a0e1a' },
  { id: 'midnight', label: 'Midnight', description: 'True black OLED', dot: '#000000' },
  { id: 'vintage', label: 'Vintage', description: 'Sepia & aged brass', dot: '#2e2414' },
  { id: 'crimson', label: 'Crimson', description: 'Burgundy & cherry wood', dot: '#2a1212' },
  { id: 'slate', label: 'Slate', description: 'Cool grey stone', dot: '#1e2228' },
  { id: 'copper', label: 'Copper', description: 'Warm industrial', dot: '#261c10' },
];

const VALID_IDS = new Set<string>(THEMES.map(t => t.id));
const STORAGE_KEY = 'rackup-theme';

export function getStoredTheme(): ThemeId {
  const val = localStorage.getItem(STORAGE_KEY);
  if (val && VALID_IDS.has(val)) return val as ThemeId;
  return 'baize';
}

export function setStoredTheme(id: ThemeId): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function applyTheme(id: ThemeId): void {
  if (id === 'baize') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', id);
  }
}
