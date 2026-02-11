import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { loadAchievementsCache } from './utils/achievements';
import './index.css';

// Pre-load achievements from DB into memory cache
loadAchievementsCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
