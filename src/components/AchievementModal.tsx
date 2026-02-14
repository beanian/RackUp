import type { Player } from '../db/supabase';
import type { Achievement } from '../utils/achievements';
import { getUnlockedForPlayer } from '../utils/achievements';
import PlayerName from './PlayerName';

interface Props {
  achievement: Achievement;
  players: Player[];
  onClose: () => void;
}

export default function AchievementModal({ achievement, players, onClose }: Props) {
  const borderColor = achievement.category === 'honour' ? 'border-gold/40' : 'border-loss/40';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className={`panel p-6 xl:p-8 max-w-sm xl:max-w-md w-[90vw] flex flex-col gap-4 xl:gap-5 !border-2 ${borderColor}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Achievement header */}
        <div className={`flex flex-col items-center text-center gap-1 rounded-xl p-4 ${bgTint}`}>
          <span className="text-4xl xl:text-5xl">{achievement.icon}</span>
          <h2 className={`font-display text-xl xl:text-2xl font-bold ${accentColor}`}>
            {achievement.name}
          </h2>
          <p className="text-chalk-dim text-sm xl:text-base">{achievement.description}</p>
          <span className={`text-xs uppercase tracking-wider font-semibold mt-1 ${accentColor}/60`}>
            Badge of {achievement.category === 'honour' ? 'Honour' : 'Shame'}
          </span>
        </div>

        {/* Players who have it */}
        <div>
          <h3 className={`text-xs xl:text-sm font-semibold uppercase tracking-wider mb-2 ${accentColor}`}>
            Unlocked by ({unlocked.length})
          </h3>
          {unlocked.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {unlocked.map(({ player, unlockedAt }) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between bg-board-dark/50 rounded-lg px-3 py-2 border border-board-light/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {player.emoji && <span className="text-lg flex-shrink-0">{player.emoji}</span>}
                    <PlayerName
                      name={player.name}
                      nickname={player.nickname}
                      className="text-chalk font-semibold text-sm xl:text-base truncate"
                    />
                  </div>
                  <span className="text-chalk-dim text-xs xl:text-sm flex-shrink-0 ml-2">
                    {new Date(unlockedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-chalk-dim text-sm italic">No one has unlocked this yet.</p>
          )}
        </div>

        {/* Players who don't have it */}
        {locked.length > 0 && (
          <div>
            <h3 className="text-xs xl:text-sm font-semibold uppercase tracking-wider mb-2 text-chalk-dim">
              Not yet ({locked.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {locked.map(p => (
                <span
                  key={p.id}
                  className="text-chalk-dim/50 text-xs xl:text-sm bg-board-dark/30 rounded-full px-2.5 py-1 border border-board-light/10"
                >
                  {p.emoji ? `${p.emoji} ` : ''}{p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="btn-press w-full py-3 xl:py-4 panel text-chalk text-base xl:text-lg font-bold min-h-[44px] xl:min-h-[56px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
