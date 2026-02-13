import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllSessions, getSessionFrames, getAllPlayers } from '@shared/db/services';
import type { Session, Player, Frame } from '@shared/db/supabase';
import PlayerName from '@shared/components/PlayerName';

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
    return <div className="text-center text-chalk-dim py-12">Loading...</div>;
  }

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-chalk-dim text-xl font-semibold">No sessions yet</p>
        <p className="text-chalk-dim text-sm">
          Start a session from the main app to begin tracking games.
        </p>
      </div>
    );
  }

  const totalSessions = summaries.length;
  const totalFrames = summaries.reduce((sum, s) => sum + s.frameCount, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Summary stats */}
      <div className="panel p-3 flex items-center justify-around">
        <div className="flex flex-col items-center">
          <span className="text-chalk font-black text-xl score-num">{totalSessions}</span>
          <span className="text-chalk-dim text-[10px] uppercase tracking-wider">Sessions</span>
        </div>
        <div className="w-px h-8 bg-board-light/30" />
        <div className="flex flex-col items-center">
          <span className="text-chalk font-black text-xl score-num">{totalFrames}</span>
          <span className="text-chalk-dim text-[10px] uppercase tracking-wider">Frames</span>
        </div>
      </div>

      {/* Session cards */}
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
          <Link key={session.id} to={`/history/${session.id}`} className="btn-press block panel p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-chalk text-base font-semibold">{dateStr}</p>
                <p className="text-chalk-dim text-xs">{timeStr}</p>
              </div>
              <div className="text-right">
                <p className="text-chalk-dim text-xs">
                  {players.length} player{players.length !== 1 ? 's' : ''}
                </p>
                <p className="text-chalk-dim text-xs">
                  {frameCount} frame{frameCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {winnerName && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gold text-sm font-bold font-display">Winner:</span>
                <PlayerName name={winnerName} nickname={winnerNickname} className="text-chalk text-sm font-semibold glow-gold" />
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mt-2">
              {players.map((p) => (
                <PlayerName
                  key={p.id}
                  name={p.name}
                  nickname={p.nickname}
                  className="bg-board-dark/50 text-chalk-dim text-xs px-2 py-0.5 rounded border border-board-light/30"
                />
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
