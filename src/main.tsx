import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { loadAchievementsCache } from './utils/achievements';
import { applyTheme, getStoredTheme } from './utils/theme';
import './index.css';

// Apply saved theme before first paint
applyTheme(getStoredTheme());

// Pre-load achievements from DB into memory cache
loadAchievementsCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
