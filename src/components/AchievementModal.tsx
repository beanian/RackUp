import type { Player } from '../db/supabase';
import type { Achievement } from '../utils/achievements';
import { getUnlockedForPlayer } from '../utils/achievements';

interface Props {
  achievement: Achievement;
  players: Player[];
  onClose: () => void;
}

export default function AchievementModal({ achievement, players, onClose }: Props) {
  const accentColor = achievement.category === 'honour' ? 'text-gold' : 'text-loss';
  const bgTint = achievement.category === 'honour' ? 'bg-gold/5' : 'bg-loss/5';

  // Find which players have this achievement
  const unlocked: { player: Player; unlockedAt: number }[] = [];
  const locked: Player[] = [];

  for (const p of players) {
    if (p.id === undefined) continue;
    const playerAchs = getUnlockedForPlayer(p.id);
    const match = playerAchs.find(u => u.id === achievement.id);
    if (match) {
      unlocked.push({ player: p, unlockedAt: match.unlockedAt });
    } else {
      locked.push(p);
    }
  }

  // Sort unlocked by date (earliest first)
  unlocked.sort((a, b) => a.unlockedAt - b.unlockedAt);

  const solidBorder = achievement.category === 'honour' ? 'border-gold/50' : 'border-loss/50';
  const chipStyle = achievement.category === 'honour'
    ? { background: 'rgba(212, 175, 55, 0.2)', border: '1px solid rgba(212, 175, 55, 0.5)' }
    : { background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)' };

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '16px', paddingBottom: '80px' }}
      onClick={onClose}
    >
      <div
        className={`rounded-xl p-4 xl:p-6 max-w-sm xl:max-w-md w-full max-h-full flex flex-col border-2 ${solidBorder}`}
        style={{ background: 'rgba(10, 18, 12, 0.98)', boxShadow: '0 0 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(240,236,224,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Achievement header */}
        <div className={`flex items-center gap-3 rounded-xl p-3 mb-3 flex-shrink-0 ${bgTint}`}>
          <span className="text-3xl xl:text-4xl flex-shrink-0">{achievement.icon}</span>
          <div>
            <h2 className={`font-display text-lg xl:text-2xl font-bold leading-tight ${accentColor}`}>
              {achievement.name}
            </h2>
            <p className="text-chalk-dim text-xs xl:text-sm">{achievement.description}</p>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${accentColor}/60`}>
              Badge of {achievement.category === 'honour' ? 'Honour' : 'Shame'}
            </span>
          </div>
        </div>

        {/* Scrollable player lists */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 mb-3">
          {/* Players who have it */}
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${accentColor}`}>
              Unlocked ({unlocked.length})
            </h3>
            {unlocked.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {unlocked.map(({ player }) => (
                  <span
                    key={player.id}
                    className="text-xs font-semibold text-chalk rounded-full px-3 py-1.5"
                    style={chipStyle}
                  >
                    {player.emoji ? `${player.emoji} ` : ''}{player.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-chalk-dim text-sm italic">No one yet.</p>
            )}
          </div>

          {/* Players who don't have it — only show when some have unlocked */}
          {locked.length > 0 && unlocked.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1.5 text-chalk-dim">
                Not yet ({locked.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {locked.map(p => (
                  <span
                    key={p.id}
                    className="text-chalk-dim/50 text-xs rounded-full px-2.5 py-1 border border-board-light/10 bg-board-dark/30"
                  >
                    {p.emoji ? `${p.emoji} ` : ''}{p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className={`btn-press w-full py-3 rounded-lg text-chalk text-base font-bold min-h-[44px] flex-shrink-0 border-2 ${solidBorder}`}
          style={{ background: 'rgba(20, 32, 24, 0.9)' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
