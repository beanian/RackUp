import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllSessions, getSessionFrames, getAllPlayers } from '../db/services';
import type { Session, Player, Frame } from '../db/dexie';

interface SessionSummary {
  session: Session;
  players: Player[];
  frameCount: number;
  winnerName: string | null;
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
            const wins: Record<string, number> = {};
            for (const f of frames) {
              wins[f.winnerId] = (wins[f.winnerId] || 0) + 1;
            }

            let winnerName: string | null = null;
            let maxWins = 0;
            for (const [pid, count] of Object.entries(wins)) {
              if (count > maxWins) {
                maxWins = count;
                winnerName = playerMap.get(pid)?.name ?? 'Unknown';
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

  return (
    <div className="flex flex-col gap-3 xl:gap-5">
      <h1 className="font-display text-2xl xl:text-5xl 2xl:text-6xl text-chalk chalk-text mb-2 xl:mb-4">Session History</h1>

      {summaries.map(({ session, players, frameCount, winnerName }) => {
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
                <span className="text-chalk text-lg xl:text-2xl 2xl:text-3xl font-semibold glow-gold">
                  {winnerName}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 xl:gap-3 mt-2 xl:mt-4">
              {players.map((p) => (
                <span
                  key={p.id}
                  className="bg-board-dark/50 text-chalk-dim text-sm xl:text-base 2xl:text-lg px-2 xl:px-3 py-0.5 xl:py-1 rounded border border-board-light/30"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
