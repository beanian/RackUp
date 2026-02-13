import { useState, useEffect, useMemo } from 'react';
import {
  getAllSessions,
  getLeaderboard,
  type LeaderboardEntry,
} from '@shared/db/services';
import type { Session } from '@shared/db/supabase';
import PlayerName from '@shared/components/PlayerName';

type TimePeriod = 'month' | 'year' | 'alltime';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getYearRange(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

export default function LeaderboardPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllSessions().then(setSessions);
  }, []);

  useEffect(() => {
    setLoading(true);
    async function load() {
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
      setLoading(false);
    }
    load();
  }, [timePeriod, selectedMonth, selectedYear]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    for (const s of sessions) {
      const y = new Date(s.startedAt).getFullYear();
      if (y > 2000) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [sessions]);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-3xl text-chalk chalk-text">Leaderboard</h1>

      {/* Time period tabs */}
      <div className="flex gap-1.5">
        {(['month', 'year', 'alltime'] as TimePeriod[]).map((period) => (
          <button
            key={period}
            onClick={() => setTimePeriod(period)}
            className={`btn-press flex-1 py-2.5 rounded-lg font-bold transition-colors text-sm ${
              timePeriod === period
                ? 'panel text-gold !border-gold/30'
                : 'bg-board-dark text-chalk-dim border border-board-light/30'
            }`}
          >
            {period === 'month' ? 'Monthly' : period === 'year' ? 'Yearly' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Pickers */}
      {timePeriod === 'month' && (
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="flex-1 h-11 px-3 rounded-lg bg-board border border-board-light text-chalk font-semibold text-sm appearance-none cursor-pointer"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-24 h-11 px-3 rounded-lg bg-board border border-board-light text-chalk font-semibold text-sm appearance-none cursor-pointer"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {timePeriod === 'year' && (
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-full h-11 px-3 rounded-lg bg-board border border-board-light text-chalk font-semibold text-sm appearance-none cursor-pointer"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}

      {/* Leaderboard table */}
      {loading ? (
        <div className="text-center text-chalk-dim py-12">Loading...</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center text-chalk-dim py-12">
          No frames recorded for this period.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-3 py-2 border-b border-board-light/20 text-chalk-dim text-[11px] uppercase tracking-wider font-semibold">
            <span className="w-7 text-center shrink-0">#</span>
            <span className="flex-1 ml-2">Player</span>
            <span className="w-10 text-center shrink-0">W</span>
            <span className="w-10 text-center shrink-0">L</span>
            <span className="w-11 text-center shrink-0">%</span>
          </div>
          {/* Rows */}
          {leaderboard.map((entry, idx) => {
            const rank = idx + 1;
            const isChampion = rank === 1;
            const rankColor =
              rank === 1 ? 'text-gold'
              : rank === 2 ? 'text-silver'
              : rank === 3 ? 'text-bronze'
              : 'text-chalk-dim';

            return (
              <div
                key={entry.playerId}
                className={`flex items-center px-3 py-3 border-b border-board-light/10 last:border-b-0 ${isChampion ? 'bg-gold/5' : ''}`}
              >
                <span className={`w-7 text-center shrink-0 font-black score-num text-lg ${rankColor} ${isChampion ? 'glow-gold' : ''}`}>
                  {rank}
                </span>
                <PlayerName
                  name={entry.playerName}
                  className={`flex-1 ml-2 text-chalk font-bold text-base truncate chalk-text ${isChampion ? 'glow-gold' : ''}`}
                />
                <span className="w-10 text-center shrink-0 text-win font-black score-num text-lg">
                  {entry.framesWon}
                </span>
                <span className="w-10 text-center shrink-0 text-loss font-black score-num text-lg">
                  {entry.framesLost}
                </span>
                <span className="w-11 text-center shrink-0 text-chalk font-bold score-num text-base">
                  {entry.winPercentage}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  function onMonthChange(m: number) {
    setSelectedMonth(m);
  }
}
