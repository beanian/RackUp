import { useState } from 'react';
import { THEMES, getStoredTheme, setStoredTheme, applyTheme, type ThemeId } from '../utils/theme';

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState<ThemeId>(getStoredTheme);

  const select = (id: ThemeId) => {
    setCurrent(id);
    setStoredTheme(id);
    applyTheme(id);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => select(t.id)}
          className={`btn-press flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
            current === t.id
              ? 'bg-gold/15 border border-gold/50'
              : 'border border-board-light/20 hover:border-chalk-dim/30'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full flex-shrink-0 border ${
              current === t.id ? 'border-gold' : 'border-chalk-dim/30'
            }`}
            style={{ backgroundColor: t.dot }}
          />
          <div className="min-w-0">
            <span className={`text-sm font-semibold block truncate ${current === t.id ? 'text-gold' : 'text-chalk'}`}>
              {t.label}
            </span>
            <span className="text-[10px] text-chalk-dim block truncate">{t.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
