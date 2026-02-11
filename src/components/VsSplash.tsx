import { useEffect, useState, useRef } from 'react';

interface VsSplashProps {
  player1: { name: string; emoji?: string };
  player2: { name: string; emoji?: string };
  h2h: { p1Wins: number; p2Wins: number; total: number } | null;
  onDismiss: () => void;
}

export default function VsSplash({ player1, player2, h2h, onDismiss }: VsSplashProps) {
  const [fadingOut, setFadingOut] = useState(false);
  const dismissed = useRef(false);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    setFadingOut(true);
    setTimeout(onDismiss, 300);
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, 3500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statLine = (() => {
    if (!h2h || h2h.total === 0) return 'First ever meeting!';
    if (h2h.p1Wins === h2h.p2Wins) return `Dead even! ${h2h.p1Wins}-${h2h.p2Wins} all time`;
    if (h2h.p1Wins > h2h.p2Wins) {
      const pct = Math.round((h2h.p1Wins / h2h.total) * 100);
      return `${player1.name} wins ${pct}% of the time (${h2h.p1Wins}-${h2h.p2Wins})`;
    }
    const pct = Math.round((h2h.p2Wins / h2h.total) * 100);
    return `${player2.name} wins ${pct}% of the time (${h2h.p2Wins}-${h2h.p1Wins})`;
  })();

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-board-dark/95 cursor-pointer ${fadingOut ? 'vs-fade-out' : ''}`}
      onClick={dismiss}
    >
      <div className="flex items-center gap-6 xl:gap-12">
        {/* Player 1 — slides from left */}
        <div className="flex flex-col items-center vs-slide-left">
          {player1.emoji && (
            <span className="text-[80px] xl:text-[120px] leading-none">{player1.emoji}</span>
          )}
          <span
            className="text-[28px] xl:text-[48px] 2xl:text-[60px] font-black text-chalk chalk-text mt-2 vs-slide-left"
            style={{ animationDelay: '0.1s' }}
          >
            {player1.name}
          </span>
        </div>

        {/* VS — pops in center */}
        <span className="font-display text-[64px] xl:text-[96px] 2xl:text-[120px] font-black text-gold vs-pop vs-glow">
          VS
        </span>

        {/* Player 2 — slides from right */}
        <div className="flex flex-col items-center vs-slide-right">
          {player2.emoji && (
            <span className="text-[80px] xl:text-[120px] leading-none">{player2.emoji}</span>
          )}
          <span
            className="text-[28px] xl:text-[48px] 2xl:text-[60px] font-black text-chalk chalk-text mt-2 vs-slide-right"
            style={{ animationDelay: '0.1s' }}
          >
            {player2.name}
          </span>
        </div>
      </div>

      {/* Stat line — fades in after delay */}
      <p className="text-chalk-dim text-lg xl:text-2xl 2xl:text-3xl mt-6 xl:mt-10 italic vs-stat-fade">
        {statLine}
      </p>

      {/* Tap to continue hint */}
      <p className="text-chalk-dim/50 text-sm xl:text-lg absolute bottom-8 xl:bottom-12 vs-hint-fade">
        tap to continue
      </p>
    </div>
  );
}
