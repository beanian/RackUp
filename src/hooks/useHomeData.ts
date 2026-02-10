import { useState, useEffect, useCallback } from 'react';
import type { Player, Session, Frame } from '../db/dexie';
import {
  getActiveSession,
  getAllPlayers,
  getActivePlayers,
  getSessionFrames,
  getFramesByDateRange,
} from '../db/services';

interface MonthlyEntry {
  name: string;
  won: number;
  lost: number;
}

interface HomeData {
  activeSession: Session | undefined;
  players: Player[];
  allPlayers: Player[];
  sessionFrames: Frame[];
  monthlyLeaderboard: MonthlyEntry[];
  refresh: () => void;
}

export function useHomeData(): HomeData {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSession, setActiveSession] = useState<Session | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [sessionFrames, setSessionFrames] = useState<Frame[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<MonthlyEntry[]>([]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = await getActiveSession();
      const allP = await getAllPlayers();
      const activeP = await getActivePlayers();

      let frames: Frame[] = [];
      if (session?.id !== undefined) {
        frames = await getSessionFrames(session.id);
      }

      // Monthly leaderboard
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthFrames = await getFramesByDateRange(startOfMonth, endOfMonth);

      const map = new Map<string, MonthlyEntry>();
      for (const p of allP) {
        if (p.id !== undefined) map.set(p.id, { name: p.name, won: 0, lost: 0 });
      }
      for (const f of monthFrames) {
        const w = map.get(f.winnerId);
        if (w) w.won++;
        const l = map.get(f.loserId);
        if (l) l.lost++;
      }
      const board = [...map.values()]
        .filter((e) => e.won + e.lost > 0)
        .sort((a, b) => b.won - a.won);

      if (!cancelled) {
        setActiveSession(session);
        setAllPlayers(allP);
        setPlayers(activeP);
        setSessionFrames(frames);
        setMonthlyLeaderboard(board);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { activeSession, players, allPlayers, sessionFrames, monthlyLeaderboard, refresh };
}
