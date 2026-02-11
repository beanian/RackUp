import { useState, useEffect, useMemo } from 'react';
import type { Player, Frame, Session } from '../db/supabase';
import {
  getAllPlayers,
  getAllFrames,
  getAllSessions,
  getPlayerStats,
  getLeaderboard,
  type PlayerStats,
  type LeaderboardEntry,
} from '../db/services';
import { ACHIEVEMENTS, getUnlockedForPlayer, checkAndUnlock, loadAchievementsCache, isCacheLoaded } from '../utils/achievements';

type MainTab = 'player' | 'leaderboard';
type StatsSubTab = 'overview' | 'h2h' | 'achievements';
type TimePeriod = 'month' | 'year' | 'alltime';

function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getYearRange(year: number): { start: Date; end: Date } {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function StatsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('leaderboard');
  const [players, setPlayers] = useState<Player[]>([]);
  const [allFrames, setAllFrames] = useState<Frame[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);

  // Player stats state
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);

  // Leaderboard state
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

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
      if (p.length > 0 && !selectedPlayerId) {
        setSelectedPlayerId(p[0].id!);
      }
    }
    load();
  }, []);

  // Load player stats when selection changes
  useEffect(() => {
    if (selectedPlayerId === null) return;
    getPlayerStats(selectedPlayerId, allFrames, allSessions).then(setPlayerStats);
  }, [selectedPlayerId, allFrames, allSessions]);

  // Load leaderboard when period changes
  useEffect(() => {
    async function loadBoard() {
      let entries: LeaderboardEntry[];
      if (timePeriod === 'month') {
        const { start, end } = getMonthRange(selectedYear, selectedMonth);
        entries = await getLeaderboard(start, end);
      } else if (timePeriod === 'year') {
        const { start, end } = getYearRange(selectedYear);
        entries = await getLeaderboard(start, end);
      } else {
        entries = await getLeaderboard();
      }
      setLeaderboard(entries);
    }
    loadBoard();
  }, [timePeriod, selectedMonth, selectedYear, allFrames]);

  // Derive available years from sessions
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    for (const s of allSessions) {
      const y = new Date(s.startedAt).getFullYear();
      if (y > 2000) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allSessions]);

  // Player name map
  const playerMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const p of players) {
      if (p.id !== undefined) map[p.id] = p.name;
    }
    return map;
  }, [players]);

  // Current form: last 5 sessions results for selected player
  const currentForm = useMemo(() => {
    if (!selectedPlayerId) return [];
    const playerSessions = allSessions
      .filter((s) => s.playerIds.includes(selectedPlayerId))
      .slice(0, 5);

    return playerSessions.map((s) => {
      const sessionFrames = allFrames.filter((f) => f.sessionId === s.id);
      const wins = sessionFrames.filter((f) => f.winnerId === selectedPlayerId).length;
      const losses = sessionFrames.filter((f) => f.loserId === selectedPlayerId).length;
      return { sessionId: s.id!, date: s.date, wins, losses };
    });
  }, [selectedPlayerId, allFrames, allSessions]);

  return (
    <div className="flex flex-col gap-4 xl:gap-6 pb-2">
      {/* Main tab switcher */}
      <div className="flex gap-2 xl:gap-4">
        <button
          onClick={() => setMainTab('player')}
          className={`btn-press flex-1 py-4 xl:py-6 rounded-xl text-lg xl:text-2xl 2xl:text-3xl font-bold transition-colors min-h-16 xl:min-h-24 ${
            mainTab === 'player'
              ? 'panel text-gold !border-gold/30'
              : 'bg-board-dark text-chalk-dim border border-board-light/30'
          }`}
        >
          <span className="font-display">Player Stats</span>
        </button>
        <button
          onClick={() => setMainTab('leaderboard')}
          className={`btn-press flex-1 py-4 xl:py-6 rounded-xl text-lg xl:text-2xl 2xl:text-3xl font-bold transition-colors min-h-16 xl:min-h-24 ${
            mainTab === 'leaderboard'
              ? 'panel text-gold !border-gold/30'
              : 'bg-board-dark text-chalk-dim border border-board-light/30'
          }`}
        >
          <span className="font-display">Leaderboards</span>
        </button>
      </div>

      {mainTab === 'player' && (
        <PlayerStatsView
          players={players}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
          stats={playerStats}
          playerMap={playerMap}
          currentForm={currentForm}
          allFrames={allFrames}
          allSessions={allSessions}
        />
      )}

      {mainTab === 'leaderboard' && (
        <LeaderboardView
          leaderboard={leaderboard}
          timePeriod={timePeriod}
          onTimePeriodChange={setTimePeriod}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableYears={availableYears}
        />
      )}
    </div>
  );
}

// ── Player Stats View ──

function PlayerStatsView({
  players,
  selectedPlayerId,
  onSelectPlayer,
  stats,
  playerMap,
  currentForm,
  allFrames,
  allSessions,
}: {
  players: Player[];
  selectedPlayerId: number | null;
  onSelectPlayer: (id: number) => void;
  stats: PlayerStats | null;
  playerMap: Record<number, string>;
  currentForm: { sessionId: number; date: string; wins: number; losses: number }[];
  allFrames: Frame[];
  allSessions: Session[];
}) {
  const [subTab, setSubTab] = useState<StatsSubTab>('overview');
  const [achCacheReady, setAchCacheReady] = useState(isCacheLoaded());

  // Ensure achievements cache is loaded from DB
  useEffect(() => {
    if (!achCacheReady) {
      loadAchievementsCache().then(() => setAchCacheReady(true));
    }
  }, [achCacheReady]);

  // Run global achievement checks when player is selected
  useEffect(() => {
    if (achCacheReady && selectedPlayerId !== null && allFrames.length > 0) {
      checkAndUnlock(selectedPlayerId, allFrames, allSessions);
    }
  }, [achCacheReady, selectedPlayerId, allFrames, allSessions]);

  const unlockedIds = useMemo(() => {
    if (!achCacheReady || selectedPlayerId === null) return new Set<string>();
    return new Set(getUnlockedForPlayer(selectedPlayerId).map(u => u.id));
  }, [achCacheReady, selectedPlayerId, allFrames]); // re-derive when frames change

  const unlockedCount = useMemo(() => {
    let c = 0;
    for (const ach of ACHIEVEMENTS) { if (unlockedIds.has(ach.id)) c++; }
    return c;
  }, [unlockedIds]);

  if (players.length === 0) {
    return (
      <div className="text-center text-chalk-dim py-12 text-xl xl:text-3xl">
        No players yet. Add players to see stats.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 xl:gap-6">
      {/* Player selector */}
      <select
        value={selectedPlayerId ?? ''}
        onChange={(e) => onSelectPlayer(Number(e.target.value))}
        className="w-full min-h-16 xl:min-h-24 px-4 xl:px-6 rounded-xl bg-board border border-board-light text-chalk font-bold text-xl xl:text-3xl appearance-none cursor-pointer"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {stats && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-2 xl:gap-3">
            {([
              { key: 'overview' as const, label: 'Overview' },
              { key: 'h2h' as const, label: 'Head to Head' },
              { key: 'achievements' as const, label: `Badges (${unlockedCount}/${ACHIEVEMENTS.length})` },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={`btn-press flex-1 py-3 xl:py-4 rounded-xl font-bold transition-colors min-h-12 xl:min-h-16 text-sm xl:text-xl ${
                  subTab === key
                    ? 'panel text-gold !border-gold/30'
                    : 'bg-board-dark text-chalk-dim border border-board-light/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {subTab === 'overview' && (
            <>
              <div className="panel p-5 xl:p-8">
                <h3 className="text-chalk-dim text-base xl:text-xl font-semibold mb-3 xl:mb-5 uppercase tracking-wider">
                  Overall Record
                </h3>
                <div className="grid grid-cols-3 gap-3 xl:gap-6 text-center">
                  <StatBox label="Won" value={stats.framesWon} color="text-win" />
                  <StatBox label="Lost" value={stats.framesLost} color="text-loss" />
                  <StatBox label="Win %" value={`${stats.winPercentage}%`} color="text-chalk" />
                </div>
              </div>

              <div className="panel p-5 xl:p-8">
                <h3 className="text-chalk-dim text-base xl:text-xl font-semibold mb-3 xl:mb-5 uppercase tracking-wider">
                  Sessions
                </h3>
                <div className="grid grid-cols-2 gap-3 xl:gap-6 text-center">
                  <StatBox label="Played" value={stats.sessionsPlayed} color="text-chalk" />
                  <StatBox
                    label="Best Session"
                    value={stats.bestSession ? `${stats.bestSession.wins} wins` : '--'}
                    color="text-gold"
                  />
                </div>
              </div>

              {currentForm.length > 0 && (
                <div className="panel p-5 xl:p-8">
                  <h3 className="text-chalk-dim text-base xl:text-xl font-semibold mb-3 xl:mb-5 uppercase tracking-wider">
                    Current Form (Last 5 Sessions)
                  </h3>
                  <div className="flex flex-col gap-2 xl:gap-4">
                    {currentForm.map((s) => (
                      <div
                        key={s.sessionId}
                        className="flex items-center justify-between bg-board-dark/50 rounded-lg px-4 py-3 xl:px-6 xl:py-5 border border-board-light/20"
                      >
                        <span className="text-chalk-dim text-sm xl:text-lg">{s.date}</span>
                        <div className="flex gap-3 xl:gap-5">
                          <span className="text-win font-bold text-lg xl:text-2xl 2xl:text-3xl score-num">
                            {s.wins}W
                          </span>
                          <span className="text-loss font-bold text-lg xl:text-2xl 2xl:text-3xl score-num">
                            {s.losses}L
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Head to Head tab */}
          {subTab === 'h2h' && (
            Object.keys(stats.headToHead).length > 0 ? (
              <div className="panel p-5 xl:p-8">
                <div className="flex flex-col gap-2 xl:gap-4">
                  {Object.entries(stats.headToHead)
                    .sort(([, a], [, b]) => (b.won + b.lost) - (a.won + a.lost))
                    .map(([opponentId, record]) => {
                      const total = record.won + record.lost;
                      const winPct = total > 0 ? Math.round((record.won / total) * 100) : 0;
                      return (
                        <div
                          key={opponentId}
                          className="flex items-center justify-between bg-board-dark/50 rounded-lg px-4 py-3 xl:px-6 xl:py-5 border border-board-light/20"
                        >
                          <span className="text-chalk font-semibold truncate mr-3 text-lg xl:text-2xl">
                            {playerMap[Number(opponentId)] ?? `Player ${opponentId}`}
                          </span>
                          <div className="flex items-center gap-3 xl:gap-5 shrink-0">
                            <span className="text-win font-bold score-num xl:text-2xl">{record.won}W</span>
                            <span className="text-loss font-bold score-num xl:text-2xl">{record.lost}L</span>
                            <span className="text-chalk-dim text-sm xl:text-lg">({winPct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center text-chalk-dim py-12 text-xl xl:text-3xl">
                No head-to-head data yet.
              </div>
            )
          )}

          {/* Achievements tab */}
          {subTab === 'achievements' && (
            <div className="panel p-5 xl:p-8">
              <div className="grid grid-cols-3 gap-3 xl:gap-4">
                {ACHIEVEMENTS.map((ach) => {
                  const unlocked = unlockedIds.has(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`flex flex-col items-center text-center p-3 xl:p-4 rounded-xl border-2 transition-all ${
                        unlocked
                          ? 'border-gold/40 bg-gold/10'
                          : 'border-board-light/20 bg-board-dark/30 opacity-40'
                      }`}
                    >
                      <span className="text-2xl xl:text-4xl mb-1">{ach.icon}</span>
                      <span className={`text-xs xl:text-sm font-bold leading-tight ${unlocked ? 'text-gold' : 'text-chalk-dim'}`}>
                        {ach.name}
                      </span>
                      <span className="text-[10px] xl:text-xs text-chalk-dim mt-0.5 leading-tight">
                        {ach.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Leaderboard View ──

function LeaderboardView({
  leaderboard,
  timePeriod,
  onTimePeriodChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  availableYears,
}: {
  leaderboard: LeaderboardEntry[];
  timePeriod: TimePeriod;
  onTimePeriodChange: (p: TimePeriod) => void;
  selectedMonth: number;
  onMonthChange: (m: number) => void;
  selectedYear: number;
  onYearChange: (y: number) => void;
  availableYears: number[];
}) {
  return (
    <div className="flex flex-col gap-4 xl:gap-6">
      {/* Time period tabs */}
      <div className="flex gap-2 xl:gap-4">
        {(['month', 'year', 'alltime'] as TimePeriod[]).map((period) => (
          <button
            key={period}
            onClick={() => onTimePeriodChange(period)}
            className={`btn-press flex-1 py-3 xl:py-5 rounded-xl font-bold transition-colors min-h-12 xl:min-h-20 text-base xl:text-2xl ${
              timePeriod === period
                ? 'panel text-gold !border-gold/30'
                : 'bg-board-dark text-chalk-dim border border-board-light/30'
            }`}
          >
            {period === 'month' ? 'Monthly' : period === 'year' ? 'Yearly' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Month/Year pickers */}
      {timePeriod === 'month' && (
        <div className="flex gap-2 xl:gap-4">
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="flex-1 min-h-16 xl:min-h-24 px-4 xl:px-6 rounded-xl bg-board border border-board-light text-chalk font-semibold text-lg xl:text-2xl appearance-none cursor-pointer"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="w-28 xl:w-40 min-h-16 xl:min-h-24 px-4 xl:px-6 rounded-xl bg-board border border-board-light text-chalk font-semibold text-lg xl:text-2xl appearance-none cursor-pointer"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {timePeriod === 'year' && (
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="w-full min-h-16 xl:min-h-24 px-4 xl:px-6 rounded-xl bg-board border border-board-light text-chalk font-semibold text-lg xl:text-2xl appearance-none cursor-pointer"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}

      {/* Leaderboard entries */}
      {leaderboard.length === 0 ? (
        <div className="text-center text-chalk-dim py-12 text-xl xl:text-3xl">
          No frames recorded for this period.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {/* Table header */}
          <div className="flex items-center px-4 py-2 xl:px-6 xl:py-3 border-b border-board-light/20 text-chalk-dim text-xs xl:text-base uppercase tracking-wider font-semibold">
            <span className="w-8 xl:w-12 text-center shrink-0">#</span>
            <span className="flex-1 ml-2 xl:ml-4">Player</span>
            <span className="w-14 xl:w-20 text-center shrink-0">W</span>
            <span className="w-14 xl:w-20 text-center shrink-0">L</span>
            <span className="w-14 xl:w-20 text-center shrink-0">%</span>
          </div>
          {/* Rows */}
          {leaderboard.map((entry, idx) => {
            const rank = idx + 1;
            const isChampion = rank === 1;
            const rankColor =
              rank === 1
                ? 'text-gold'
                : rank === 2
                  ? 'text-silver'
                  : rank === 3
                    ? 'text-bronze'
                    : 'text-chalk-dim';

            return (
              <div
                key={entry.playerId}
                className={`flex items-center px-4 py-3 xl:px-6 xl:py-4 border-b border-board-light/10 last:border-b-0 ${isChampion ? 'bg-gold/5' : ''}`}
              >
                <span className={`w-8 xl:w-12 text-center shrink-0 font-black score-num text-xl xl:text-3xl 2xl:text-4xl ${rankColor} ${isChampion ? 'glow-gold' : ''}`}>
                  {rank}
                </span>
                <span className={`flex-1 ml-2 xl:ml-4 text-chalk font-bold text-lg xl:text-2xl 2xl:text-3xl truncate chalk-text ${isChampion ? 'glow-gold' : ''}`}>
                  {entry.playerName}
                </span>
                <span className="w-14 xl:w-20 text-center shrink-0 text-win font-black score-num text-xl xl:text-3xl 2xl:text-4xl">
                  {entry.framesWon}
                </span>
                <span className="w-14 xl:w-20 text-center shrink-0 text-loss font-black score-num text-xl xl:text-3xl 2xl:text-4xl">
                  {entry.framesLost}
                </span>
                <span className="w-14 xl:w-20 text-center shrink-0 text-chalk font-bold score-num text-lg xl:text-2xl 2xl:text-3xl">
                  {entry.winPercentage}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared Components ──

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-black score-num text-[36px] xl:text-[56px] 2xl:text-[72px] leading-none ${color}`}>
        {value}
      </span>
      <span className="text-chalk-dim text-xs xl:text-base 2xl:text-lg uppercase mt-1 xl:mt-2">{label}</span>
    </div>
  );
}
