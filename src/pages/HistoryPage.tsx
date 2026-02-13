import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllSessions, getSessionFrames, getAllPlayers } from '../db/services';
import type { Session, Player, Frame } from '../db/supabase';
import PlayerName from '../components/PlayerName';

interface SessionSummary {
  session: Session;
  players: Player[];
  frameCount: number;
  winnerName: string | null;
  winnerNickname?: string;
}

export default function HistoryPage() {
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [sessions, players] = await Promise.all([
        getAllSessions(),
        getAllPlayers(),
      ]);

      const playerMap = new Map(players.map((p) => [p.id!, p]));

      const results: SessionSummary[] = await Promise.all(
        sessions
          .filter((s) => s.endedAt !== null)
          .map(async (session) => {
            const frames: Frame[] = await getSessionFrames(session.id!);
            const wins: Record<number, number> = {};
            for (const f of frames) {
              wins[f.winnerId] = (wins[f.winnerId] || 0) + 1;
            }

            let winnerName: string | null = null;
            let winnerNickname: string | undefined;
            let maxWins = 0;
            for (const [pid, count] of Object.entries(wins)) {
              if (count > maxWins) {
                maxWins = count;
                const winner = playerMap.get(Number(pid));
                winnerName = winner?.name ?? 'Unknown';
                winnerNickname = winner?.nickname;
              }
            }

            const sessionPlayers = session.playerIds
              .map((id) => playerMap.get(id))
              .filter((p): p is Player => p !== undefined);

            return {
              session,
              players: sessionPlayers,
              frameCount: frames.length,
              winnerName,
              winnerNickname,
            };
          }),
      );

      if (!cancelled) {
        setSummaries(results);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-chalk-dim text-xl xl:text-3xl">Loading...</p>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-chalk-dim text-2xl xl:text-4xl font-semibold">No sessions yet</p>
        <p className="text-chalk-dim text-lg xl:text-2xl">
          Start a session from the Home tab to begin tracking games.
        </p>
      </div>
    );
  }

  const totalSessions = summaries.length;
  const totalFrames = summaries.reduce((sum, s) => sum + s.frameCount, 0);
  const winCounts: Record<string, number> = {};
  for (const s of summaries) {
    if (s.winnerName) {
      winCounts[s.winnerName] = (winCounts[s.winnerName] || 0) + 1;
    }
  }
  const topWinner = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-3 xl:gap-5">
      <h1 className="font-display text-2xl xl:text-5xl 2xl:text-6xl text-chalk chalk-text mb-2 xl:mb-4">Session History</h1>

      {/* Summary stats */}
      <div className="panel p-4 xl:p-6 flex items-center justify-around">
        <div className="flex flex-col items-center">
          <span className="text-chalk font-black text-2xl xl:text-4xl score-num">{totalSessions}</span>
          <span className="text-chalk-dim text-xs xl:text-sm uppercase tracking-wider">Sessions</span>
        </div>
        <div className="w-px h-8 xl:h-12 bg-board-light/30" />
        <div className="flex flex-col items-center">
          <span className="text-chalk font-black text-2xl xl:text-4xl score-num">{totalFrames}</span>
          <span className="text-chalk-dim text-xs xl:text-sm uppercase tracking-wider">Frames</span>
        </div>
        {topWinner && (
          <>
            <div className="w-px h-8 xl:h-12 bg-board-light/30" />
            <div className="flex flex-col items-center">
              <span className="text-gold font-black text-xl xl:text-3xl glow-gold">{topWinner[0]}</span>
              <span className="text-chalk-dim text-xs xl:text-sm uppercase tracking-wider">{topWinner[1]} session win{topWinner[1] !== 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>

      {summaries.map(({ session, players, frameCount, winnerName, winnerNickname }) => {
        const date = new Date(session.startedAt);
        const dateStr = date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const timeStr = date.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });

        return (
          <Link
            key={session.id}
            to={`/history/${session.id}`}
            className="btn-press block panel p-5 xl:p-8"
          >
            <div className="flex justify-between items-start mb-2 xl:mb-4">
              <div>
                <p className="text-chalk text-lg xl:text-2xl 2xl:text-3xl font-semibold">{dateStr}</p>
                <p className="text-chalk-dim text-sm xl:text-lg">{timeStr}</p>
              </div>
              <div className="text-right">
                <p className="text-chalk-dim text-sm xl:text-lg">
                  {players.length} player{players.length !== 1 ? 's' : ''}
                </p>
                <p className="text-chalk-dim text-sm xl:text-lg">
                  {frameCount} frame{frameCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {winnerName && (
              <div className="flex items-center gap-2 xl:gap-4 mt-2">
                <span className="text-gold text-base xl:text-xl 2xl:text-2xl font-bold font-display">Winner:</span>
                <PlayerName name={winnerName} nickname={winnerNickname} className="text-chalk text-lg xl:text-2xl 2xl:text-3xl font-semibold glow-gold" />
              </div>
            )}

            <div className="flex flex-wrap gap-2 xl:gap-3 mt-2 xl:mt-4">
              {players.map((p) => (
                <PlayerName
                  key={p.id}
                  name={p.name}
                  nickname={p.nickname}
                  className="bg-board-dark/50 text-chalk-dim text-sm xl:text-base 2xl:text-lg px-2 xl:px-3 py-0.5 xl:py-1 rounded border border-board-light/30"
                />
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
