import type { Frame } from '../db/supabase';

export function getWinStreak(frames: Frame[], winnerId: number): number {
  let streak = 0;
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].winnerId === winnerId) {
      streak++;
    } else if (frames[i].loserId === winnerId) {
      break;
    }
    // Skip frames where this player wasn't involved
  }
  return streak;
}

export function getStreakMessage(streak: number): string | null {
  if (streak < 2) return null;
  if (streak === 2) return '2 in a row!';
  if (streak === 3) return 'Hat trick!';
  if (streak === 4) return 'On fire! 4 straight!';
  return `UNSTOPPABLE! ${streak} straight!`;
}

export function getMaxStreak(frames: Frame[], playerId: number): number {
  let max = 0;
  let current = 0;
  for (const f of frames) {
    if (f.winnerId === playerId) {
      current++;
      if (current > max) max = current;
    } else if (f.loserId === playerId) {
      current = 0;
    }
  }
  return max;
}

export function getMaxLoseStreak(frames: Frame[], playerId: number): number {
  let max = 0;
  let current = 0;
  for (const f of frames) {
    if (f.loserId === playerId) {
      current++;
      if (current > max) max = current;
    } else if (f.winnerId === playerId) {
      current = 0;
    }
  }
  return max;
}
