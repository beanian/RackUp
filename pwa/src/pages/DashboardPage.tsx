import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllSessions,
  getAllPlayers,
  getSessionFrames,
  getLeaderboard,
  type LeaderboardEntry,
} from '@shared/db/services';
import type { Session, Player, Frame } from '@shared/db/supabase';
import {
  ACHIEVEMENTS,
  loadAchievementsCache,
  isCacheLoaded,
  getUnlockedForPlayer,
} from '@shared/utils/achievements';
import PlayerName from '@shared/components/PlayerName';

interface SessionStanding {
  playerId: number;
  name: string;
  nickname?: string;
  won: number;
  lost: number;
}

interface RecentBadge {
  playerId: number;
  playerName: string;
  playerNickname?: string;
  achievementId: string;
  achievementName: string;
  achievementIcon: string;
  achievementDescription: string;
  unlockedAt: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [playerMap, setPlayerMap] = useState<Map<number, Player>>(new Map());
  const [latestFrames, setLatestFrames] = useState<Frame[]>([]);
  const [latestSession, setLatestSession] = useState<Session | null>(null);
  const [monthlyLeader, setMonthlyLeader] = useState<LeaderboardEntry | null>(null);
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Load all data in parallel, including achievements cache
      const [allSessions, allPlayers] = await Promise.all([
        getAllSessions(),
        getAllPlayers(),
        isCacheLoaded() ? Promise.resolve() : loadAchievementsCache(),
      ]);

      if (cancelled) return;

      const pMap = new Map(allPlayers.map((p) => [p.id!, p]));

      // Latest completed session
      const completed = allSessions.filter((s) => s.endedAt !== null);
      let latestSess: Session | null = null;
      let frames: Frame[] = [];
      if (completed.length > 0) {
        latestSess = completed[0]; // already sorted newest-first by getAllSessions
        frames = await getSessionFrames(latestSess.id!);
      }

      if (cancelled) return;

      // Monthly leader (current month)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const leaderboard = await getLeaderboard(monthStart, monthEnd);

      if (cancelled) return;

      // Set all state in one batch so the UI renders with everything ready
      setPlayerMap(pMap);
      if (latestSess) {
        setLatestSession(latestSess);
        setLatestFrames(frames);
      }
      if (leaderboard.length > 0) {
        setMonthlyLeader(leaderboard[0]);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Build latest session standings
  const latestStandings = useMemo((): SessionStanding[] => {
    if (!latestSession) return [];
    const map = new Map<number, SessionStanding>();
    for (const pid of latestSession.playerIds) {
      const p = playerMap.get(pid);
      map.set(pid, {
        playerId: pid,
        name: p?.name ?? 'Unknown',
        nickname: p?.nickname,
        won: 0,
        lost: 0,
      });
    }
    for (const f of latestFrames) {
      const w = map.get(f.winnerId);
      if (w) w.won++;
      const l = map.get(f.loserId);
      if (l) l.lost++;
    }
    return Array.from(map.values()).sort((a, b) => b.won - a.won || a.lost - b.lost);
  }, [latestSession, latestFrames, playerMap]);

  // Build recent badges (last 10, across all players)
  const recentBadges = useMemo((): RecentBadge[] => {
    if (loading || !isCacheLoaded()) return [];
    const achMap = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
    const badges: RecentBadge[] = [];

    for (const [, player] of playerMap) {
      const unlocked = getUnlockedForPlayer(player.id!);
      for (const u of unlocked) {
        const ach = achMap.get(u.id);
        if (!ach) continue;
        badges.push({
          playerId: player.id!,
          playerName: player.name,
          playerNickname: player.nickname,
          achievementId: u.id,
          achievementName: ach.name,
          achievementIcon: ach.icon,
          achievementDescription: ach.description,
          unlockedAt: u.unlockedAt,
        });
      }
    }

    badges.sort((a, b) => b.unlockedAt - a.unlockedAt);
    return badges.slice(0, 10);
  }, [loading, playerMap]);

  if (loading) {
    return <div className="text-center text-chalk-dim py-12">Loading...</div>;
  }

  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });
  const leaderPlayer = monthlyLeader ? playerMap.get(monthlyLeader.playerId) : null;

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* ── Monthly Leader Spotlight ── */}
      {monthlyLeader && (
        <section className="panel p-0 overflow-hidden">
          <div className="bg-gold/10 border-b border-gold/20 px-4 py-2">
            <h2 className="font-display text-lg text-gold glow-gold">
              {monthName} Leader
            </h2>
          </div>
          <div className="flex flex-col items-center py-5 gap-2">
            <span className="text-5xl">
              {leaderPlayer?.emoji || '\uD83C\uDFC6'}
            </span>
            <PlayerName
              name={monthlyLeader.playerName}
              nickname={leaderPlayer?.nickname}
              className="text-chalk text-2xl font-bold font-display glow-gold chalk-text"
            />
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="text-win font-black text-2xl score-num">{monthlyLeader.framesWon}</span>
                <span className="text-chalk-dim text-[10px] uppercase tracking-wider">Wins</span>
              </div>
              <div className="w-px h-8 bg-board-light/30" />
              <div className="flex flex-col items-center">
                <span className="text-loss font-black text-2xl score-num">{monthlyLeader.framesLost}</span>
                <span className="text-chalk-dim text-[10px] uppercase tracking-wider">Losses</span>
              </div>
              <div className="w-px h-8 bg-board-light/30" />
              <div className="flex flex-col items-center">
                <span className="text-gold font-black text-2xl score-num">{monthlyLeader.winPercentage}%</span>
                <span className="text-chalk-dim text-[10px] uppercase tracking-wider">Win Rate</span>
              </div>
            </div>
            <p className="text-chalk-dim text-xs mt-1">
              {monthlyLeader.sessionsAttended} session{monthlyLeader.sessionsAttended !== 1 ? 's' : ''} this month
            </p>
          </div>
        </section>
      )}

      {!monthlyLeader && (
        <section className="panel p-5 text-center">
          <p className="text-chalk-dim text-sm">No frames recorded this month yet.</p>
        </section>
      )}

      {/* ── Latest Session Results ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg text-chalk chalk-text">Latest Session</h2>
          {latestSession && (
            <Link to={`/history/${latestSession.id}`} className="text-gold text-xs font-semibold">
              View Details &rarr;
            </Link>
          )}
        </div>
        {latestSession ? (
          <div className="panel overflow-hidden">
            {/* Session date header */}
            <div className="px-4 py-2 border-b border-board-light/20 flex justify-between items-center">
              <span className="text-chalk text-sm font-semibold">
                {new Date(latestSession.startedAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-chalk-dim text-xs">
                {latestFrames.length} frame{latestFrames.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Standings */}
            {latestStandings.map((s, i) => {
              const isWinner = i === 0;
              const medalColor = i === 0 ? 'text-gold' : i === 1 ? 'text-silver' : i === 2 ? 'text-bronze' : 'text-chalk-dim';
              return (
                <div
                  key={s.playerId}
                  className={`flex items-center px-4 py-3 border-b border-board-light/10 last:border-b-0 ${isWinner ? 'bg-gold/5' : ''}`}
                >
                  <span className={`w-7 text-center shrink-0 font-black score-num text-lg ${medalColor} ${isWinner ? 'glow-gold' : ''}`}>
                    {i + 1}
                  </span>
                  <PlayerName
                    name={s.name}
                    nickname={s.nickname}
                    className={`flex-1 ml-2 font-bold text-base truncate ${isWinner ? 'text-chalk glow-gold chalk-text' : 'text-chalk'}`}
                  />
                  <span className="w-10 text-center shrink-0 text-win font-black score-num text-lg">
                    {s.won}
                  </span>
                  <span className="text-chalk-dim text-xs mx-0.5">-</span>
                  <span className="w-10 text-center shrink-0 text-loss font-black score-num text-lg">
                    {s.lost}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel p-5 text-center">
            <p className="text-chalk-dim text-sm">No completed sessions yet.</p>
          </div>
        )}
      </section>

      {/* ── Recent Badges ── */}
      <section>
        <h2 className="font-display text-lg text-chalk chalk-text mb-2">Recent Badges</h2>
        {recentBadges.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {recentBadges.map((badge, i) => {
              const timeAgo = formatTimeAgo(badge.unlockedAt);
              return (
                <div key={`${badge.playerId}-${badge.achievementId}-${i}`} className="panel p-3 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{badge.achievementIcon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-chalk font-bold text-sm truncate">{badge.achievementName}</p>
                    <p className="text-chalk-dim text-xs truncate">{badge.achievementDescription}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PlayerName
                        name={badge.playerName}
                        nickname={badge.playerNickname}
                        className="text-gold text-xs font-semibold truncate"
                      />
                      {timeAgo && (
                        <span className="text-chalk-dim text-[10px] shrink-0">&middot; {timeAgo}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel p-5 text-center">
            <p className="text-chalk-dim text-sm">No badges unlocked yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string | null {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 0) return null;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return null;
}
