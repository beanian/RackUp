import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LeaderboardPage from './pages/LeaderboardPage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import HistoryPage from './pages/HistoryPage';
import SessionDetailPage from './pages/SessionDetailPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LeaderboardPage />} />
        <Route path="/players" element={<PlayerStatsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:sessionId" element={<SessionDetailPage />} />
      </Routes>
    </Layout>
  );
}
