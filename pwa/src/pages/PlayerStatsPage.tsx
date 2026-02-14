import { useState, useEffect, useMemo } from 'react';
import type { Player, Frame, Session } from '@shared/db/supabase';
import {
  getAllPlayers,
  getAllFrames,
  getAllSessions,
  getPlayerStats,
  type PlayerStats,
} from '@shared/db/services';
import {
  ACHIEVEMENTS,
  getUnlockedForPlayer,
  loadAchievementsCache,
  isCacheLoaded,
} from '@shared/utils/achievements';
import PlayerName from '@shared/components/PlayerName';

type SubTab = 'overview' | 'h2h' | 'badges';

export default function PlayerStatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allFrames, setAllFrames] = useState<Frame[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [achCacheReady, setAchCacheReady] = useState(isCacheLoaded());

  // Load base data
  useEffect(() => {
    async function load() {
      const [p, f, s] = await Promise.all([
        getAllPlayers(),
        getAllFrames(),
        getAllSessions(),
      ]);
      setPlayers(p);
      setAllFrames(f);
      setAllSessions(s);
      if (p.length > 0) setSelectedPlayerId(p[0].id!);
    }
    load();
  }, []);

  // Ensure achievements cache
  useEffect(() => {
    if (!achCacheReady) {
      loadAchievementsCache().then(() => setAchCacheReady(true));
    }
  }, [achCacheReady]);

  // Load player stats
  useEffect(() => {
    if (selectedPlayerId === null) return;
    getPlayerStats(selectedPlayerId, allFrames, allSessions).then(setStats);
  }, [selectedPlayerId, allFrames, allSessions]);

  // Player maps
  const playerMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const p of players) {
      if (p.id !== undefined) map[p.id] = p.name;
    }
    return map;
  }, [players]);

  const playerNicknameMap = useMemo(() => {
    const map: Record<number, string | undefined> = {};
    for (const p of players) {
      if (p.id !== undefined) map[p.id] = p.nickname;
    }
    return map;
  }, [players]);

  // Current form
  const currentForm = useMemo(() => {
    if (!selectedPlayerId) return [];
    return allSessions
      .filter((s) => s.playerIds.includes(selectedPlayerId))
      .slice(0, 5)
      .map((s) => {
        const sessionFrames = allFrames.filter((f) => f.sessionId === s.id);
        const wins = sessionFrames.filter((f) => f.winnerId === selectedPlayerId).length;
        const losses = sessionFrames.filter((f) => f.loserId === selectedPlayerId).length;
        return { sessionId: s.id!, date: s.date, wins, losses };
      });
  }, [selectedPlayerId, allFrames, allSessions]);

  // Achievements
  const unlockedMap = useMemo(() => {
    if (!achCacheReady || selectedPlayerId === null) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const u of getUnlockedForPlayer(selectedPlayerId)) {
      map.set(u.id, u.unlockedAt);
    }
    return map;
  }, [achCacheReady, selectedPlayerId, allFrames]);

  const unlockedCount = useMemo(() => {
    let c = 0;
    for (const ach of ACHIEVEMENTS) { if (unlockedMap.has(ach.id)) c++; }
    return c;
  }, [unlockedMap]);

  if (players.length === 0) {
    return (
      <div className="text-center text-chalk-dim py-12">
        Loading players...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Player selector — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {players.map((p) => {
          const isSelected = selectedPlayerId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setSelectedPlayerId(p.id!); setSubTab('overview'); }}
              className={`btn-press flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] py-2.5 px-3 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'panel !border-gold text-gold'
                  : 'bg-board-dark border-board-light/30 text-chalk'
              }`}
            >
              {p.emoji && <span className="text-xl mb-0.5">{p.emoji}</span>}
              <span className={`text-xs font-bold truncate max-w-[70px] ${isSelected ? 'text-gold' : ''}`}>
                {p.name}
              </span>
            </button>
          );
        })}
      </div>

      {stats && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1.5">
            {([
              { key: 'overview' as const, label: 'Overview' },
              { key: 'h2h' as const, label: 'H2H' },
              { key: 'badges' as const, label: `Badges ${unlockedCount}/${ACHIEVEMENTS.length}` },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={`btn-press flex-1 py-2 rounded-lg font-bold transition-colors text-sm ${
                  subTab === key
                    ? 'panel text-gold !border-gold/30'
                    : 'bg-board-dark text-chalk-dim border border-board-light/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Overview */}
          {subTab === 'overview' && (
            <div className="flex flex-col gap-3">
              <div className="panel p-4">
                <h3 className="text-chalk-dim text-xs font-semibold mb-2 uppercase tracking-wider">
                  Overall Record
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <StatBox label="Won" value={stats.framesWon} color="text-win" />
                  <StatBox label="Lost" value={stats.framesLost} color="text-loss" />
                  <StatBox label="Win %" value={`${stats.winPercentage}%`} color="text-chalk" />
                </div>
              </div>

              <div className="panel p-4">
                <h3 className="text-chalk-dim text-xs font-semibold mb-2 uppercase tracking-wider">
                  Sessions
                </h3>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <StatBox label="Played" value={stats.sessionsPlayed} color="text-chalk" />
                  <StatBox
                    label="Best Session"
                    value={stats.bestSession ? `${stats.bestSession.wins} wins` : '--'}
                    color="text-gold"
                  />
                </div>
              </div>

              {currentForm.length > 0 && (
                <div className="panel p-4">
                  <h3 className="text-chalk-dim text-xs font-semibold mb-2 uppercase tracking-wider">
                    Current Form (Last 5)
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {currentForm.map((s) => (
                      <div
                        key={s.sessionId}
                        className="flex items-center justify-between bg-board-dark/50 rounded-lg px-3 py-2 border border-board-light/20"
                      >
                        <span className="text-chalk-dim text-xs">{s.date}</span>
                        <div className="flex gap-2">
                          <span className="text-win font-bold text-base score-num">{s.wins}W</span>
                          <span className="text-loss font-bold text-base score-num">{s.losses}L</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Head to Head */}
          {subTab === 'h2h' && (
            Object.keys(stats.headToHead).length > 0 ? (
              <div className="panel p-4">
                <div className="flex flex-col gap-1.5">
                  {Object.entries(stats.headToHead)
                    .sort(([, a], [, b]) => (b.won + b.lost) - (a.won + a.lost))
                    .map(([opponentId, record]) => {
                      const total = record.won + record.lost;
                      const winPct = total > 0 ? Math.round((record.won / total) * 100) : 0;
                      return (
                        <div
                          key={opponentId}
                          className="flex items-center justify-between bg-board-dark/50 rounded-lg px-3 py-2.5 border border-board-light/20"
                        >
                          <PlayerName
                            name={playerMap[Number(opponentId)] ?? `Player ${opponentId}`}
                            nickname={playerNicknameMap[Number(opponentId)]}
                            className="text-chalk font-semibold truncate mr-2 text-sm"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-win font-bold score-num">{record.won}W</span>
                            <span className="text-loss font-bold score-num">{record.lost}L</span>
                            <span className="text-chalk-dim text-xs">({winPct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center text-chalk-dim py-12">
                No head-to-head data yet.
              </div>
            )
          )}

          {/* Badges */}
          {subTab === 'badges' && (
            <div className="flex flex-col gap-3">
              {/* Badges of Honour */}
              <div className="panel p-3">
                <h3 className="text-gold text-xs font-semibold mb-2 uppercase tracking-wider">
                  Badges of Honour
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {ACHIEVEMENTS.filter(a => a.category === 'honour').map((ach) => {
                    const unlockedAt = unlockedMap.get(ach.id);
                    const unlocked = unlockedAt !== undefined;
                    return (
                      <div
                        key={ach.id}
                        className={`flex flex-col items-center text-center p-2.5 rounded-xl border-2 transition-all ${
                          unlocked
                            ? 'border-gold/40 bg-gold/10'
                            : 'border-board-light/20 bg-board-dark/30 opacity-40'
                        }`}
                      >
                        <span className="text-2xl mb-0.5">{ach.icon}</span>
                        <span className={`text-[10px] font-bold leading-tight ${unlocked ? 'text-gold' : 'text-chalk-dim'}`}>
                          {ach.name}
                        </span>
                        <span className="text-[9px] text-chalk-dim mt-0.5 leading-tight">
                          {ach.description}
                        </span>
                        {unlocked && (
                          <span className="text-[8px] text-gold/60 mt-0.5 leading-tight">
                            {new Date(unlockedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Badges of Shame */}
              <div className="panel p-3">
                <h3 className="text-loss text-xs font-semibold mb-2 uppercase tracking-wider">
                  Badges of Shame
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {ACHIEVEMENTS.filter(a => a.category === 'shame').map((ach) => {
                    const unlockedAt = unlockedMap.get(ach.id);
                    const unlocked = unlockedAt !== undefined;
                    return (
                      <div
                        key={ach.id}
                        className={`flex flex-col items-center text-center p-2.5 rounded-xl border-2 transition-all ${
                          unlocked
                            ? 'border-loss/40 bg-loss/10'
                            : 'border-board-light/20 bg-board-dark/30 opacity-40'
                        }`}
                      >
                        <span className="text-2xl mb-0.5">{ach.icon}</span>
                        <span className={`text-[10px] font-bold leading-tight ${unlocked ? 'text-loss' : 'text-chalk-dim'}`}>
                          {ach.name}
                        </span>
                        <span className="text-[9px] text-chalk-dim mt-0.5 leading-tight">
                          {ach.description}
                        </span>
                        {unlocked && (
                          <span className="text-[8px] text-loss/60 mt-0.5 leading-tight">
                            {new Date(unlockedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-black score-num text-3xl leading-none ${color}`}>{value}</span>
      <span className="text-chalk-dim text-[10px] uppercase mt-1">{label}</span>
    </div>
  );
}
