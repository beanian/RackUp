import { useState, useEffect, useCallback } from 'react';
import type { Player, Session, Frame } from '../db/supabase';
import { supabase } from '../db/supabase';
import { mapPlayer, mapSession, mapFrame, type PlayerRow, type SessionRow, type FrameRow } from '../db/mappers';

interface MonthlyEntry {
  name: string;
  nickname?: string;
  emoji?: string;
  won: number;
  lost: number;
}

interface HomeData {
  activeSession: Session | undefined;
  players: Player[];
  allPlayers: Player[];
  sessionFrames: Frame[];
  allFrames: Frame[];
  monthlyLeaderboard: MonthlyEntry[];
  refresh: () => void;
}

export function useHomeData(): HomeData {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSession, setActiveSession] = useState<Session | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [sessionFrames, setSessionFrames] = useState<Frame[]>([]);
  const [allFrames, setAllFrames] = useState<Frame[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<MonthlyEntry[]>([]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Fetch active session
      const { data: sessData } = await supabase
        .from('sessions')
        .select('*')
        .is('ended_at', null)
        .limit(1)
        .maybeSingle();

      const session = sessData ? mapSession(sessData as SessionRow) : undefined;

      // Fetch all players
      const { data: allPlayerData } = await supabase.from('players').select('*');
      const allP = (allPlayerData as PlayerRow[] | null)?.map(mapPlayer) ?? [];
      const activeP = allP.filter((p) => !p.archived);

      // Fetch session frames
      let frames: Frame[] = [];
      if (session?.id !== undefined) {
        const { data: frameData } = await supabase
          .from('frames')
          .select('*')
          .eq('session_id', session.id)
          .order('recorded_at', { ascending: true });
        frames = (frameData as FrameRow[] | null)?.map(mapFrame) ?? [];
      }

      // Fetch all frames for predictions/achievements
      const { data: allFrameData } = await supabase.from('frames').select('*');
      const allF = (allFrameData as FrameRow[] | null)?.map(mapFrame) ?? [];

      // Monthly leaderboard
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const { data: monthFrameData } = await supabase
        .from('frames')
        .select('*')
        .gte('recorded_at', startOfMonth.toISOString())
        .lte('recorded_at', endOfMonth.toISOString());

      const monthFrames = (monthFrameData as FrameRow[] | null)?.map(mapFrame) ?? [];

      const map = new Map<number, MonthlyEntry>();
      for (const p of allP) {
        if (p.id !== undefined) map.set(p.id, { name: p.name, nickname: p.nickname, emoji: p.emoji, won: 0, lost: 0 });
      }
      for (const f of monthFrames) {
        const w = map.get(f.winnerId);
        if (w) w.won++;
        const l = map.get(f.loserId);
        if (l) l.lost++;
      }
      const MIN_FRAMES = 5;
      const board = [...map.values()]
        .filter((e) => e.won + e.lost > 0)
        .sort((a, b) => {
          const aTotal = a.won + a.lost;
          const bTotal = b.won + b.lost;
          const aQualified = aTotal >= MIN_FRAMES;
          const bQualified = bTotal >= MIN_FRAMES;
          if (aQualified !== bQualified) return aQualified ? -1 : 1;
          const aPct = aTotal > 0 ? a.won / aTotal : 0;
          const bPct = bTotal > 0 ? b.won / bTotal : 0;
          if (aPct !== bPct) return bPct - aPct;
          return bTotal - aTotal;
        });

      if (!cancelled) {
        setActiveSession(session);
        setAllPlayers(allP);
        setPlayers(activeP);
        setSessionFrames(frames);
        setAllFrames(allF);
        setMonthlyLeaderboard(board);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { activeSession, players, allPlayers, sessionFrames, allFrames, monthlyLeaderboard, refresh };
}
