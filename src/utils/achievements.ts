import type { Frame, Session } from '../db/supabase';
import { supabase } from '../db/supabase';
import { getMaxStreak } from './streaks';

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (ctx: CheckContext) => boolean;
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: number; // timestamp
}

interface CheckContext {
  playerId: number;
  allFrames: Frame[];
  allSessions: Session[];
  sessionFrames?: Frame[];
  monthlyTopId?: number;
}

// ── In-memory cache for achievements (loaded from DB) ──
const cache: Record<number, UnlockedAchievement[]> = {};
let cacheLoaded = false;

export async function loadAchievementsCache(): Promise<void> {
  const { data, error } = await supabase
    .from('player_achievements')
    .select('player_id, achievement_id, unlocked_at');
  if (error) {
    console.warn('Failed to load achievements from DB:', error.message);
    return;
  }
  // Clear and rebuild
  for (const key of Object.keys(cache)) delete cache[Number(key)];
  for (const row of data ?? []) {
    const pid = row.player_id as number;
    if (!cache[pid]) cache[pid] = [];
    cache[pid].push({
      id: row.achievement_id as string,
      unlockedAt: new Date(row.unlocked_at as string).getTime(),
    });
  }
  cacheLoaded = true;
}

function persistToDb(playerId: number, achievementId: string): void {
  supabase
    .from('player_achievements')
    .insert({ player_id: playerId, achievement_id: achievementId })
    .then(({ error }) => {
      if (error && !error.message.includes('duplicate')) {
        console.warn('Failed to persist achievement:', error.message);
      }
    });
}

// ── Helper: group frames by session ──
function framesBySession(frames: Frame[]): Map<number, Frame[]> {
  const map = new Map<number, Frame[]>();
  for (const f of frames) {
    const list = map.get(f.sessionId);
    if (list) list.push(f);
    else map.set(f.sessionId, [f]);
  }
  return map;
}

// ── Helper: count wins per opponent ──
function winsPerOpponent(playerId: number, frames: Frame[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const f of frames) {
    if (f.winnerId === playerId) {
      counts.set(f.loserId, (counts.get(f.loserId) ?? 0) + 1);
    }
  }
  return counts;
}

// ── Helper: total frames between two players ──
function totalFramesBetween(playerId: number, frames: Frame[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const f of frames) {
    if (f.winnerId === playerId || f.loserId === playerId) {
      const opponent = f.winnerId === playerId ? f.loserId : f.winnerId;
      counts.set(opponent, (counts.get(opponent) ?? 0) + 1);
    }
  }
  return counts;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Milestones ──
  {
    id: 'first-win',
    name: 'First Blood',
    icon: '\uD83C\uDFAF',
    description: 'Win your first frame',
    check: ({ playerId, allFrames }) =>
      allFrames.some(f => f.winnerId === playerId),
  },
  {
    id: 'wins-10',
    name: 'Double Digits',
    icon: '\uD83D\uDD1F',
    description: 'Win 10 frames',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.winnerId === playerId).length >= 10,
  },
  {
    id: 'wins-50',
    name: 'Half Century',
    icon: '\uD83C\uDFC5',
    description: 'Win 50 frames',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.winnerId === playerId).length >= 50,
  },
  {
    id: 'wins-100',
    name: 'Century',
    icon: '\uD83D\uDCAF',
    description: 'Win 100 frames',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.winnerId === playerId).length >= 100,
  },
  {
    id: 'wins-250',
    name: 'Living Legend',
    icon: '\u2B50',
    description: 'Win 250 frames',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.winnerId === playerId).length >= 250,
  },

  // ── Streaks ──
  {
    id: 'streak-3',
    name: 'Hat Trick',
    icon: '\uD83C\uDFA9',
    description: '3 wins in a row',
    check: ({ playerId, sessionFrames }) =>
      sessionFrames ? getMaxStreak(sessionFrames, playerId) >= 3 : false,
  },
  {
    id: 'streak-5',
    name: 'On Fire',
    icon: '\uD83D\uDD25',
    description: '5 wins in a row',
    check: ({ playerId, sessionFrames }) =>
      sessionFrames ? getMaxStreak(sessionFrames, playerId) >= 5 : false,
  },

  // ── Session achievements ──
  {
    id: 'perfect-session',
    name: 'Flawless',
    icon: '\uD83D\uDC8E',
    description: 'Win all your frames (3+ wins, 0 losses)',
    check: ({ playerId, sessionFrames }) => {
      if (!sessionFrames) return false;
      const wins = sessionFrames.filter(f => f.winnerId === playerId).length;
      const losses = sessionFrames.filter(f => f.loserId === playerId).length;
      return wins >= 3 && losses === 0;
    },
  },
  {
    id: 'sweep',
    name: 'Clean Sweep',
    icon: '\uD83E\uDDF9',
    description: 'Beat every opponent in a session',
    check: ({ playerId, sessionFrames }) => {
      if (!sessionFrames) return false;
      // Find all opponents in this session
      const opponents = new Set<number>();
      for (const f of sessionFrames) {
        if (f.winnerId === playerId) opponents.add(f.loserId);
        else if (f.loserId === playerId) opponents.add(f.winnerId);
      }
      if (opponents.size < 2) return false; // need at least 2 opponents
      // Check player beat every one of them
      const beaten = new Set<number>();
      for (const f of sessionFrames) {
        if (f.winnerId === playerId) beaten.add(f.loserId);
      }
      for (const opp of opponents) {
        if (!beaten.has(opp)) return false;
      }
      return true;
    },
  },

  // ── Attendance ──
  {
    id: 'sessions-10',
    name: 'Regular',
    icon: '\uD83D\uDCC5',
    description: 'Play 10 sessions',
    check: ({ playerId, allSessions }) =>
      allSessions.filter(s => s.playerIds.includes(playerId)).length >= 10,
  },
  {
    id: 'sessions-50',
    name: 'Veteran',
    icon: '\uD83C\uDF96\uFE0F',
    description: 'Play 50 sessions',
    check: ({ playerId, allSessions }) =>
      allSessions.filter(s => s.playerIds.includes(playerId)).length >= 50,
  },

  // ── Rivalry (the heart of a 3-player club) ──
  {
    id: 'rival-10',
    name: 'Nemesis',
    icon: '\uD83D\uDC4A',
    description: '10 wins against one opponent',
    check: ({ playerId, allFrames }) => {
      for (const c of winsPerOpponent(playerId, allFrames).values()) {
        if (c >= 10) return true;
      }
      return false;
    },
  },
  {
    id: 'rival-25',
    name: 'Arch Rival',
    icon: '\u2694\uFE0F',
    description: '25 wins against one opponent',
    check: ({ playerId, allFrames }) => {
      for (const c of winsPerOpponent(playerId, allFrames).values()) {
        if (c >= 25) return true;
      }
      return false;
    },
  },
  {
    id: 'rivalry-50',
    name: '50 Club',
    icon: '\uD83E\uDD1D',
    description: '50 frames played against one opponent',
    check: ({ playerId, allFrames }) => {
      for (const c of totalFramesBetween(playerId, allFrames).values()) {
        if (c >= 50) return true;
      }
      return false;
    },
  },

  // ── Session moments ──
  {
    id: 'comeback',
    name: 'Comeback King',
    icon: '\uD83D\uDC51',
    description: 'Come back from 3+ down to beat an opponent',
    check: ({ playerId, sessionFrames }) => {
      if (!sessionFrames) return false;
      const opponents = new Set<number>();
      for (const f of sessionFrames) {
        if (f.winnerId === playerId) opponents.add(f.loserId);
        else if (f.loserId === playerId) opponents.add(f.winnerId);
      }
      for (const opp of opponents) {
        let diff = 0; // positive = player ahead
        let wasDown3 = false;
        for (const f of sessionFrames) {
          if (f.winnerId === playerId && f.loserId === opp) diff++;
          else if (f.winnerId === opp && f.loserId === playerId) diff--;
          if (diff <= -3) wasDown3 = true;
        }
        if (wasDown3 && diff > 0) return true;
      }
      return false;
    },
  },
  {
    id: 'marathon',
    name: 'Marathon Man',
    icon: '\uD83C\uDFC3',
    description: 'Play in a 20+ frame session',
    check: ({ playerId, allFrames, allSessions }) => {
      const grouped = framesBySession(allFrames);
      for (const s of allSessions) {
        if (!s.id || !s.playerIds.includes(playerId)) continue;
        const count = grouped.get(s.id)?.length ?? 0;
        if (count >= 20) return true;
      }
      return false;
    },
  },
  {
    id: 'opening-break',
    name: 'Opening Break',
    icon: '\uD83C\uDFB1',
    description: 'Win the first frame of 10 sessions',
    check: ({ playerId, allFrames }) => {
      const grouped = framesBySession(allFrames);
      let count = 0;
      for (const frames of grouped.values()) {
        // Sort by recordedAt to find the first frame
        frames.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
        if (frames[0]?.winnerId === playerId) count++;
      }
      return count >= 10;
    },
  },

  // ── Very hard ──
  {
    id: 'streak-10',
    name: 'Perfect 10',
    icon: '\u26A1',
    description: '10 wins in a row in a session',
    check: ({ playerId, sessionFrames }) =>
      sessionFrames ? getMaxStreak(sessionFrames, playerId) >= 10 : false,
  },
  {
    id: 'dynasty',
    name: 'Dynasty',
    icon: '\uD83C\uDFC6',
    description: '100 wins against one opponent',
    check: ({ playerId, allFrames }) => {
      for (const c of winsPerOpponent(playerId, allFrames).values()) {
        if (c >= 100) return true;
      }
      return false;
    },
  },
  {
    id: 'sessions-100',
    name: 'Iron Man',
    icon: '\uD83D\uDCAA',
    description: 'Play 100 sessions',
    check: ({ playerId, allSessions }) =>
      allSessions.filter(s => s.playerIds.includes(playerId)).length >= 100,
  },

  // ── Brushes (winning without opponent potting a ball) ──
  {
    id: 'brush-1',
    name: 'First Brush',
    icon: '\uD83E\uDDF9',
    description: 'Brush an opponent for the first time',
    check: ({ playerId, allFrames }) =>
      allFrames.some(f => f.winnerId === playerId && f.brush),
  },
  {
    id: 'brush-5',
    name: 'Brush Off',
    icon: '\uD83D\uDCA8',
    description: 'Brush opponents 5 times',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.winnerId === playerId && f.brush).length >= 5,
  },
  {
    id: 'brush-10',
    name: 'Brush Master',
    icon: '\uD83E\uDDF9',
    description: 'Brush opponents 10 times',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.winnerId === playerId && f.brush).length >= 10,
  },
  {
    id: 'brush-25',
    name: 'Street Sweeper',
    icon: '\uD83C\uDF2A\uFE0F',
    description: 'Brush opponents 25 times',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.winnerId === playerId && f.brush).length >= 25,
  },

  // ── Brushed (losing without potting a ball) ──
  {
    id: 'brushed-1',
    name: 'Dust Bunny',
    icon: '\uD83D\uDCA9',
    description: 'Get brushed for the first time',
    check: ({ playerId, allFrames }) =>
      allFrames.some(f => f.loserId === playerId && f.brush),
  },
  {
    id: 'brushed-5',
    name: 'Doormat',
    icon: '\uD83E\uDEE3',
    description: 'Get brushed 5 times',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.loserId === playerId && f.brush).length >= 5,
  },
  {
    id: 'brushed-10',
    name: 'Punching Bag',
    icon: '\uD83E\uDD4A',
    description: 'Get brushed 10 times',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.loserId === playerId && f.brush).length >= 10,
  },
  {
    id: 'brushed-25',
    name: 'Human Broom',
    icon: '\uD83E\uDEE0',
    description: 'Get brushed 25 times',
    check: ({ playerId, allFrames }) =>
      allFrames.filter(f => f.loserId === playerId && f.brush).length >= 25,
  },

  // ── Monthly ──
  {
    id: 'giant-killer',
    name: 'Giant Killer',
    icon: '\uD83D\uDDE1\uFE0F',
    description: 'Beat the monthly #1',
    check: ({ playerId, allFrames, monthlyTopId }) =>
      monthlyTopId !== undefined &&
      monthlyTopId !== playerId &&
      allFrames.some(f => f.winnerId === playerId && f.loserId === monthlyTopId),
  },
];

export function isCacheLoaded(): boolean {
  return cacheLoaded;
}

export function getUnlockedForPlayer(playerId: number): UnlockedAchievement[] {
  return cache[playerId] ?? [];
}

export function checkAndUnlock(
  playerId: number,
  allFrames: Frame[],
  allSessions: Session[],
  sessionFrames?: Frame[],
  monthlyTopId?: number,
): Achievement[] {
  if (!cacheLoaded) return []; // cache not ready yet, skip

  const unlocked = cache[playerId] ?? [];
  const unlockedIds = new Set(unlocked.map(u => u.id));

  const ctx: CheckContext = { playerId, allFrames, allSessions, sessionFrames, monthlyTopId };
  const newlyUnlocked: Achievement[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlockedIds.has(ach.id)) continue;
    if (ach.check(ctx)) {
      const entry = { id: ach.id, unlockedAt: Date.now() };
      unlocked.push(entry);
      newlyUnlocked.push(ach);
      persistToDb(playerId, ach.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    cache[playerId] = unlocked;
  }

  return newlyUnlocked;
}
