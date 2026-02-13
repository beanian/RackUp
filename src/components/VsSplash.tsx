import { useState, useRef } from 'react';
import PlayerName from './PlayerName';

interface VsSplashProps {
  player1: { name: string; nickname?: string; emoji?: string };
  player2: { name: string; nickname?: string; emoji?: string };
  h2h: { p1Wins: number; p2Wins: number; total: number } | null;
  onDismiss: () => void;
  onEndSession?: () => void;
}

export default function VsSplash({ player1, player2, h2h, onDismiss, onEndSession }: VsSplashProps) {
  const [fadingOut, setFadingOut] = useState(false);
  const dismissed = useRef(false);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    setFadingOut(true);
    setTimeout(onDismiss, 300);
  };

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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-board-dark/95 ${fadingOut ? 'vs-fade-out' : ''}`}
    >
      {(() => {
        const eitherHasEmoji = !!(player1.emoji || player2.emoji);
        return (
          <div className="w-full max-w-[90vw] flex items-center gap-6 xl:gap-12">
            {/* Player 1 — slides from left */}
            <div className="flex-1 min-w-0 flex flex-col items-center vs-slide-left">
              {eitherHasEmoji && (
                <span className="text-[80px] xl:text-[120px] leading-none min-h-[1em]">{player1.emoji || '\u00A0'}</span>
              )}
              <PlayerName
                name={player1.name}
                nickname={player1.nickname}
                className="text-[28px] xl:text-[48px] 2xl:text-[60px] font-black text-chalk chalk-text mt-2 vs-slide-left text-center truncate max-w-full"
              />
            </div>

            {/* VS — pops in center */}
            <span className="flex-shrink-0 font-display text-[64px] xl:text-[96px] 2xl:text-[120px] font-black text-gold vs-pop vs-glow">
              VS
            </span>

            {/* Player 2 — slides from right */}
            <div className="flex-1 min-w-0 flex flex-col items-center vs-slide-right">
              {eitherHasEmoji && (
                <span className="text-[80px] xl:text-[120px] leading-none min-h-[1em]">{player2.emoji || '\u00A0'}</span>
              )}
              <PlayerName
                name={player2.name}
                nickname={player2.nickname}
                className="text-[28px] xl:text-[48px] 2xl:text-[60px] font-black text-chalk chalk-text mt-2 vs-slide-right text-center truncate max-w-full"
              />
            </div>
          </div>
        );
      })()}

      {/* Stat line — fades in after delay */}
      <p className="text-chalk-dim text-lg xl:text-2xl 2xl:text-3xl mt-6 xl:mt-10 italic vs-stat-fade">
        {statLine}
      </p>

      {/* Ready to Play button — fades in after animations settle */}
      <button
        onClick={dismiss}
        className="btn-press mt-10 xl:mt-14 px-12 xl:px-20 py-6 xl:py-10 bg-win text-board-dark text-[28px] xl:text-[48px] 2xl:text-[56px] font-black rounded-2xl shadow-lg min-h-[80px] xl:min-h-[120px] vs-hint-fade"
      >
        Ready to Play
      </button>

      {/* End Session button */}
      {onEndSession && (
        <button
          onClick={onEndSession}
          className="btn-press mt-4 xl:mt-6 px-8 xl:px-14 py-3 xl:py-5 panel text-chalk-dim text-lg xl:text-2xl font-semibold min-h-[56px] xl:min-h-[80px] vs-hint-fade"
        >
          End Session
        </button>
      )}
    </div>
  );
}
