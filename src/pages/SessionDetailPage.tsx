import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSession, getSessionFrames, getAllPlayers } from '../db/services';
import type { Session, Player, Frame } from '../db/supabase';

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
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-chalk-dim text-xl xl:text-3xl">Loading...</p>
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-chalk-dim text-2xl xl:text-4xl font-semibold">
          Session not found
        </p>
        <Link
          to="/history"
          className="text-gold text-lg xl:text-2xl font-semibold underline"
        >
          Back to History
        </Link>
      </div>
    );
  }

  const getName = (id: number) => playerMap.get(id)?.name ?? 'Unknown';

  // Build standings
  const standingsMap = new Map<number, Standing>();
  for (const pid of session.playerIds) {
    standingsMap.set(pid, {
      playerId: pid,
      name: getName(pid),
      won: 0,
      lost: 0,
    });
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

  // Build head-to-head matchups
  const h2hKey = (a: number, b: number) =>
    a < b ? `${a}-${b}` : `${b}-${a}`;
  const h2hMap = new Map<
    string,
    { p1: number; p2: number; p1Wins: number; p2Wins: number }
  >();

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

  // Medal colors for top 3
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
    <div className="flex flex-col gap-6 xl:gap-10 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 xl:gap-5">
        <Link
          to="/history"
          className="btn-press text-gold text-3xl xl:text-5xl font-bold leading-none px-2 py-1 -ml-2 rounded"
        >
          &larr;
        </Link>
        <div>
          <h1 className="font-display text-2xl xl:text-4xl 2xl:text-5xl text-chalk chalk-text">{dateStr}</h1>
          <p className="text-chalk-dim text-sm xl:text-lg">{timeStr}</p>
        </div>
      </div>

      {/* Standings */}
      <section>
        <h2 className="font-display text-xl xl:text-3xl 2xl:text-4xl text-chalk chalk-text mb-3 xl:mb-6">Final Standings</h2>
        <div className="flex flex-col gap-2 xl:gap-4">
          {standings.map((s, i) => (
            <div
              key={s.playerId}
              className={`panel p-4 xl:p-6 flex items-center ${i === 0 ? 'border-gold/30' : ''}`}
            >
              <span
                className={`text-2xl xl:text-4xl 2xl:text-5xl font-bold w-10 xl:w-16 text-center score-num ${
                  medalColors[i] ?? 'text-chalk-dim'
                } ${i === 0 ? 'glow-gold' : ''}`}
              >
                {i + 1}
              </span>
              <div className="flex-1 ml-3 xl:ml-6">
                <p
                  className={`font-bold ${
                    i < 3 ? 'text-chalk text-[28px] xl:text-[44px] 2xl:text-[52px] leading-tight' : 'text-chalk text-xl xl:text-3xl'
                  } ${i === 0 ? 'glow-gold' : ''}`}
                >
                  {s.name}
                </p>
              </div>
              <div className="flex items-baseline gap-3 xl:gap-5 text-right">
                <span className="text-win font-bold text-[36px] xl:text-[56px] 2xl:text-[72px] leading-none score-num">
                  {s.won}
                </span>
                <span className="text-chalk-dim text-sm xl:text-xl">W</span>
                <span className="text-loss font-bold text-[36px] xl:text-[56px] 2xl:text-[72px] leading-none score-num">
                  {s.lost}
                </span>
                <span className="text-chalk-dim text-sm xl:text-xl">L</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Head-to-Head */}
      {headToHeads.length > 0 && (
        <section>
          <h2 className="font-display text-xl xl:text-3xl 2xl:text-4xl text-chalk chalk-text mb-3 xl:mb-6">Head-to-Head</h2>
          <div className="flex flex-col gap-2 xl:gap-4">
            {headToHeads.map((h, i) => {
              const p1Dominant = h.player1Wins > h.player2Wins;
              const p2Dominant = h.player2Wins > h.player1Wins;
              const total = h.player1Wins + h.player2Wins;
              const dominantPct = total > 0
                ? Math.round((Math.max(h.player1Wins, h.player2Wins) / total) * 100)
                : 0;
              return (
                <div
                  key={i}
                  className={`panel p-4 xl:p-6 flex items-center ${p1Dominant || p2Dominant ? 'border-win/20' : ''}`}
                >
                  <span
                    className={`flex-1 text-lg xl:text-2xl 2xl:text-3xl font-semibold text-right pr-3 xl:pr-6 ${
                      p1Dominant ? 'text-win' : 'text-chalk'
                    }`}
                  >
                    {p1Dominant && dominantPct >= 60 && <span className="text-gold mr-1 xl:mr-2 text-base xl:text-lg">&#9733;</span>}
                    {h.player1}
                  </span>
                  <div className="flex items-baseline gap-2 xl:gap-4 px-3 xl:px-6 border-x border-board-light/30">
                    <span
                      className={`font-bold text-2xl xl:text-4xl 2xl:text-5xl score-num ${
                        p1Dominant ? 'text-win' : 'text-chalk'
                      }`}
                    >
                      {h.player1Wins}
                    </span>
                    <span className="text-chalk-dim text-sm xl:text-xl">-</span>
                    <span
                      className={`font-bold text-2xl xl:text-4xl 2xl:text-5xl score-num ${
                        p2Dominant ? 'text-win' : 'text-chalk'
                      }`}
                    >
                      {h.player2Wins}
                    </span>
                  </div>
                  <span
                    className={`flex-1 text-lg xl:text-2xl 2xl:text-3xl font-semibold pl-3 xl:pl-6 ${
                      p2Dominant ? 'text-win' : 'text-chalk'
                    }`}
                  >
                    {h.player2}
                    {p2Dominant && dominantPct >= 60 && <span className="text-gold ml-1 xl:ml-2 text-base xl:text-lg">&#9733;</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Frame-by-Frame */}
      <section>
        <h2 className="font-display text-xl xl:text-3xl 2xl:text-4xl text-chalk chalk-text mb-3 xl:mb-6">
          Frames ({frames.length})
        </h2>
        <div className="flex flex-col">
          {frames.map((f, i) => {
            const startTime = f.startedAt
              ? new Date(f.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
              : null;
            let duration: string | null = null;
            if (f.startedAt) {
              const secs = Math.round((new Date(f.recordedAt).getTime() - new Date(f.startedAt).getTime()) / 1000);
              if (secs >= 3600) {
                const h = Math.floor(secs / 3600);
                const m = Math.floor((secs % 3600) / 60);
                duration = `${h}h ${m}m`;
              } else {
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                duration = m > 0 ? `${m}m ${s}s` : `${s}s`;
              }
            }
            const isLast = i === frames.length - 1;
            return (
              <div key={f.id} className="flex">
                {/* Timeline column */}
                <div className="flex flex-col items-center w-10 xl:w-16 flex-shrink-0">
                  <div className={`w-4 h-4 xl:w-5 xl:h-5 rounded-full border-2 flex-shrink-0 ${
                    i === 0 ? 'border-gold bg-gold/30' : 'border-chalk-dim/40 bg-board-dark'
                  }`} />
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-board-light/30" />
                  )}
                </div>
                {/* Frame content */}
                <div className={`flex-1 panel p-4 xl:p-6 flex items-center ${!isLast ? 'mb-2 xl:mb-4' : ''}`}>
                  <span className="text-chalk-dim font-bold text-lg xl:text-2xl w-8 xl:w-12 text-center score-num">
                    {i + 1}
                  </span>
                  <div className="flex-1 ml-3 xl:ml-6 flex items-center">
                    <p className="text-chalk text-lg xl:text-2xl 2xl:text-3xl flex-1">
                      <span className="text-win font-semibold">
                        {getName(f.winnerId)}
                      </span>
                      <span className="text-chalk-dim mx-2 xl:mx-4">beat</span>
                      <span className="text-loss font-semibold">
                        {getName(f.loserId)}
                      </span>
                    </p>
                    {startTime && (
                      <div className="text-right ml-4 xl:ml-6">
                        <span className="text-chalk-dim text-xs xl:text-sm uppercase tracking-wider">Started</span>
                        <p className="text-chalk text-sm xl:text-lg font-semibold">{startTime}</p>
                      </div>
                    )}
                    {duration && (
                      <div className="text-right ml-4 xl:ml-6">
                        <span className="text-chalk-dim text-xs xl:text-sm uppercase tracking-wider">Duration</span>
                        <p className="text-chalk text-sm xl:text-lg font-semibold">{duration}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {frames.length === 0 && (
            <p className="text-chalk-dim text-lg xl:text-2xl text-center py-4">
              No frames recorded in this session.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
