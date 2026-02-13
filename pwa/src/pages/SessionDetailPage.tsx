import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSession, getSessionFrames, getAllPlayers } from '@shared/db/services';
import type { Session, Player, Frame } from '@shared/db/supabase';

interface Standing {
  playerId: number;
  name: string;
  won: number;
  lost: number;
}

interface HeadToHead {
  player1: string;
  player2: string;
  player1Wins: number;
  player2Wins: number;
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<number, Player>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const id = Number(sessionId);
      if (isNaN(id)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const [sess, allPlayers] = await Promise.all([
        getSession(id),
        getAllPlayers(),
      ]);

      if (!sess) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const sessionFrames = await getSessionFrames(id);
      const pMap = new Map(allPlayers.map((p) => [p.id!, p]));

      if (!cancelled) {
        setSession(sess);
        setFrames(sessionFrames);
        setPlayerMap(pMap);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return <div className="text-center text-chalk-dim py-12">Loading...</div>;
  }

  if (notFound || !session) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-chalk-dim text-xl font-semibold">Session not found</p>
        <Link to="/history" className="text-gold font-semibold underline">
          Back to History
        </Link>
      </div>
    );
  }

  const getName = (id: number) => playerMap.get(id)?.name ?? 'Unknown';

  // Build standings
  const standingsMap = new Map<number, Standing>();
  for (const pid of session.playerIds) {
    standingsMap.set(pid, { playerId: pid, name: getName(pid), won: 0, lost: 0 });
  }
  for (const f of frames) {
    const w = standingsMap.get(f.winnerId);
    if (w) w.won++;
    const l = standingsMap.get(f.loserId);
    if (l) l.lost++;
  }
  const standings = Array.from(standingsMap.values()).sort(
    (a, b) => b.won - a.won || a.lost - b.lost,
  );

  // Build head-to-head
  const h2hKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const h2hMap = new Map<string, { p1: number; p2: number; p1Wins: number; p2Wins: number }>();
  for (const f of frames) {
    const key = h2hKey(f.winnerId, f.loserId);
    if (!h2hMap.has(key)) {
      const p1 = Math.min(f.winnerId, f.loserId);
      const p2 = Math.max(f.winnerId, f.loserId);
      h2hMap.set(key, { p1, p2, p1Wins: 0, p2Wins: 0 });
    }
    const entry = h2hMap.get(key)!;
    if (f.winnerId === entry.p1) entry.p1Wins++;
    else entry.p2Wins++;
  }
  const headToHeads: HeadToHead[] = Array.from(h2hMap.values()).map((h) => ({
    player1: getName(h.p1),
    player2: getName(h.p2),
    player1Wins: h.p1Wins,
    player2Wins: h.p2Wins,
  }));

  const medalColors = ['text-gold', 'text-silver', 'text-bronze'];

  const date = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          to="/history"
          className="btn-press text-gold text-2xl font-bold leading-none px-2 py-1 -ml-2 rounded"
        >
          &larr;
        </Link>
        <div>
          <h1 className="font-display text-xl text-chalk chalk-text">{dateStr}</h1>
          <p className="text-chalk-dim text-xs">{timeStr}</p>
        </div>
      </div>

      {/* Standings */}
      <section>
        <h2 className="font-display text-lg text-chalk chalk-text mb-2">Final Standings</h2>
        <div className="flex flex-col gap-1.5">
          {standings.map((s, i) => (
            <div
              key={s.playerId}
              className={`panel p-3 flex items-center ${i === 0 ? 'border-gold/30' : ''}`}
            >
              <span className={`text-xl font-bold w-8 text-center score-num ${medalColors[i] ?? 'text-chalk-dim'} ${i === 0 ? 'glow-gold' : ''}`}>
                {i + 1}
              </span>
              <span className={`flex-1 ml-2 font-bold text-base ${i === 0 ? 'text-chalk glow-gold' : 'text-chalk'}`}>
                {s.name}
              </span>
              <div className="flex items-baseline gap-2 text-right">
                <span className="text-win font-bold text-2xl score-num">{s.won}</span>
                <span className="text-chalk-dim text-xs">W</span>
                <span className="text-loss font-bold text-2xl score-num">{s.lost}</span>
                <span className="text-chalk-dim text-xs">L</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Head-to-Head */}
      {headToHeads.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-chalk chalk-text mb-2">Head-to-Head</h2>
          <div className="flex flex-col gap-1.5">
            {headToHeads.map((h, i) => {
              const p1Dominant = h.player1Wins > h.player2Wins;
              const p2Dominant = h.player2Wins > h.player1Wins;
              return (
                <div key={i} className="panel p-3 flex items-center">
                  <span className={`flex-1 text-sm font-semibold text-right pr-2 truncate ${p1Dominant ? 'text-win' : 'text-chalk'}`}>
                    {h.player1}
                  </span>
                  <div className="flex items-baseline gap-1.5 px-3 border-x border-board-light/30">
                    <span className={`font-bold text-xl score-num ${p1Dominant ? 'text-win' : 'text-chalk'}`}>
                      {h.player1Wins}
                    </span>
                    <span className="text-chalk-dim text-xs">-</span>
                    <span className={`font-bold text-xl score-num ${p2Dominant ? 'text-win' : 'text-chalk'}`}>
                      {h.player2Wins}
                    </span>
                  </div>
                  <span className={`flex-1 text-sm font-semibold pl-2 truncate ${p2Dominant ? 'text-win' : 'text-chalk'}`}>
                    {h.player2}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Frame-by-Frame */}
      <section>
        <h2 className="font-display text-lg text-chalk chalk-text mb-2">
          Frames ({frames.length})
        </h2>
        <div className="flex flex-col">
          {frames.map((f, i) => {
            const isLast = i === frames.length - 1;
            let duration: string | null = null;
            if (f.startedAt) {
              const secs = Math.round((new Date(f.recordedAt).getTime() - new Date(f.startedAt).getTime()) / 1000);
              if (secs >= 60) {
                const m = Math.floor(secs / 60);
                duration = `${m}m`;
              }
            }
            return (
              <div key={f.id} className="flex">
                {/* Timeline */}
                <div className="flex flex-col items-center w-8 flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    i === 0 ? 'border-gold bg-gold/30' : 'border-chalk-dim/40 bg-board-dark'
                  }`} />
                  {!isLast && <div className="w-0.5 flex-1 bg-board-light/30" />}
                </div>
                {/* Content */}
                <div className={`flex-1 panel p-3 flex items-center ${!isLast ? 'mb-1.5' : ''}`}>
                  <span className="text-chalk-dim font-bold text-sm w-6 text-center score-num">
                    {i + 1}
                  </span>
                  <p className="flex-1 ml-2 text-sm">
                    <span className="text-win font-semibold">{getName(f.winnerId)}</span>
                    <span className="text-chalk-dim mx-1.5">beat</span>
                    <span className="text-loss font-semibold">{getName(f.loserId)}</span>
                  </p>
                  {duration && (
                    <span className="text-chalk-dim text-xs ml-2">{duration}</span>
                  )}
                </div>
              </div>
            );
          })}
          {frames.length === 0 && (
            <p className="text-chalk-dim text-sm text-center py-4">
              No frames recorded in this session.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
