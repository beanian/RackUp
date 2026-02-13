import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Frame, Session } from '../supabase';

// Helper: chainable query builder that is also PromiseLike (like real Supabase)
function createQueryChain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'gte', 'lte', 'order', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => result);
  chain.maybeSingle = vi.fn(() => result);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

let fromResults: Record<string, ReturnType<typeof createQueryChain>[]>;

function enqueue(table: string, result: { data?: unknown; error?: unknown }) {
  if (!fromResults[table]) fromResults[table] = [];
  fromResults[table].push(createQueryChain(result));
}

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const queue = fromResults[table] ?? [];
      return queue.shift() ?? createQueryChain();
    },
  },
}));

import { getPlayerStats, getLeaderboard } from '../services';

// Helper to create test data
function makeFrame(id: number, sessionId: number, winnerId: number, loserId: number, recordedAt: string): Frame {
  return { id, sessionId, winnerId, loserId, recordedAt: new Date(recordedAt), brush: false };
}

function makeSession(id: number, playerIds: number[], startedAt: string, endedAt: string | null = null): Session {
  return {
    id,
    date: startedAt.slice(0, 10),
    startedAt: new Date(startedAt),
    endedAt: endedAt ? new Date(endedAt) : null,
    playerIds,
  };
}

// Helper to create PlayerRow arrays for supabase mock
function playerRows(players: Array<{ id: number; name: string }>) {
  return players.map(p => ({
    id: p.id,
    name: p.name,
    created_at: '2025-01-01T00:00:00Z',
    archived: false,
  }));
}

function frameRows(frames: Frame[]) {
  return frames.map(f => ({
    id: f.id,
    session_id: f.sessionId,
    winner_id: f.winnerId,
    loser_id: f.loserId,
    recorded_at: f.recordedAt.toISOString(),
    brush: f.brush,
  }));
}

function sessionRows(sessions: Session[]) {
  return sessions.map(s => ({
    id: s.id,
    date: s.date,
    started_at: s.startedAt.toISOString(),
    ended_at: s.endedAt?.toISOString() ?? null,
    player_ids: s.playerIds,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fromResults = {};
});

describe('getPlayerStats', () => {
  it('calculates frames won and lost correctly', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
      makeFrame(2, 10, 1, 2, '2025-06-15T19:20:00Z'),
      makeFrame(3, 10, 2, 1, '2025-06-15T19:30:00Z'),
      makeFrame(4, 10, 1, 3, '2025-06-15T19:40:00Z'),
    ];
    const sessions: Session[] = [
      makeSession(10, [1, 2, 3], '2025-06-15T19:00:00Z'),
    ];

    // Mock the player name lookup
    enqueue('players', { data: { name: 'Alice' } });

    const stats = await getPlayerStats(1, frames, sessions);

    expect(stats.framesWon).toBe(3);
    expect(stats.framesLost).toBe(1);
    expect(stats.winPercentage).toBe(75);
    expect(stats.playerId).toBe(1);
  });

  it('calculates head-to-head records', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
      makeFrame(2, 10, 1, 2, '2025-06-15T19:20:00Z'),
      makeFrame(3, 10, 2, 1, '2025-06-15T19:30:00Z'),
      makeFrame(4, 10, 1, 3, '2025-06-15T19:40:00Z'),
      makeFrame(5, 10, 3, 1, '2025-06-15T19:50:00Z'),
    ];
    const sessions: Session[] = [
      makeSession(10, [1, 2, 3], '2025-06-15T19:00:00Z'),
    ];

    enqueue('players', { data: { name: 'Alice' } });

    const stats = await getPlayerStats(1, frames, sessions);

    expect(stats.headToHead[2]).toEqual({ won: 2, lost: 1 });
    expect(stats.headToHead[3]).toEqual({ won: 1, lost: 1 });
  });

  it('calculates sessions played', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
      makeFrame(2, 11, 1, 3, '2025-06-16T19:10:00Z'),
    ];
    const sessions: Session[] = [
      makeSession(10, [1, 2], '2025-06-15T19:00:00Z'),
      makeSession(11, [1, 3], '2025-06-16T19:00:00Z'),
      makeSession(12, [2, 3], '2025-06-17T19:00:00Z'),
    ];

    enqueue('players', { data: { name: 'Alice' } });

    const stats = await getPlayerStats(1, frames, sessions);

    expect(stats.sessionsPlayed).toBe(2);
  });

  it('identifies best session', async () => {
    const frames: Frame[] = [
      // Session 10: player 1 wins 2
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
      makeFrame(2, 10, 1, 2, '2025-06-15T19:20:00Z'),
      // Session 11: player 1 wins 4
      makeFrame(3, 11, 1, 3, '2025-06-16T19:10:00Z'),
      makeFrame(4, 11, 1, 3, '2025-06-16T19:20:00Z'),
      makeFrame(5, 11, 1, 3, '2025-06-16T19:30:00Z'),
      makeFrame(6, 11, 1, 3, '2025-06-16T19:40:00Z'),
    ];
    const sessions: Session[] = [
      makeSession(10, [1, 2], '2025-06-15T19:00:00Z'),
      makeSession(11, [1, 3], '2025-06-16T19:00:00Z'),
    ];

    enqueue('players', { data: { name: 'Alice' } });

    const stats = await getPlayerStats(1, frames, sessions);

    expect(stats.bestSession).toEqual({ sessionId: 11, wins: 4 });
  });

  it('returns null bestSession when player has no wins', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 2, 1, '2025-06-15T19:10:00Z'),
      makeFrame(2, 10, 2, 1, '2025-06-15T19:20:00Z'),
    ];
    const sessions: Session[] = [
      makeSession(10, [1, 2], '2025-06-15T19:00:00Z'),
    ];

    enqueue('players', { data: { name: 'Loser' } });

    const stats = await getPlayerStats(1, frames, sessions);

    expect(stats.bestSession).toBeNull();
    expect(stats.framesWon).toBe(0);
    expect(stats.framesLost).toBe(2);
    expect(stats.winPercentage).toBe(0);
  });

  it('handles player with no frames at all', async () => {
    const frames: Frame[] = [];
    const sessions: Session[] = [
      makeSession(10, [1, 2], '2025-06-15T19:00:00Z'),
    ];

    enqueue('players', { data: { name: 'NewPlayer' } });

    const stats = await getPlayerStats(1, frames, sessions);

    expect(stats.framesWon).toBe(0);
    expect(stats.framesLost).toBe(0);
    expect(stats.winPercentage).toBe(0);
    expect(stats.bestSession).toBeNull();
    expect(stats.headToHead).toEqual({});
  });

  it('returns "Unknown" when player name not found', async () => {
    enqueue('players', { data: null });

    const stats = await getPlayerStats(999, [], []);

    expect(stats.playerName).toBe('Unknown');
  });
});

describe('getLeaderboard', () => {
  const testPlayers = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ];

  function setupLeaderboardMocks(
    frames: Frame[],
    sessions: Session[],
    players: Array<{ id: number; name: string }> = testPlayers,
  ) {
    // getLeaderboard calls: getAllFrames(), getAllSessions(), getAllPlayers()
    // getAllFrames: from('frames').select('*')
    enqueue('frames', { data: frameRows(frames), error: null });
    // getAllSessions: from('sessions').select('*').order(...)
    enqueue('sessions', { data: sessionRows(sessions), error: null });
    // getAllPlayers: from('players').select('*')
    enqueue('players', { data: playerRows(players), error: null });
  }

  it('ranks players by frames won descending', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
      makeFrame(2, 10, 1, 3, '2025-06-15T19:20:00Z'),
      makeFrame(3, 10, 2, 1, '2025-06-15T19:30:00Z'),
      makeFrame(4, 10, 3, 2, '2025-06-15T19:40:00Z'),
    ];
    const sessions = [makeSession(10, [1, 2, 3], '2025-06-15T19:00:00Z')];

    setupLeaderboardMocks(frames, sessions);

    const leaderboard = await getLeaderboard();

    expect(leaderboard[0].playerName).toBe('Alice');
    expect(leaderboard[0].framesWon).toBe(2);
    expect(leaderboard[1].framesWon).toBe(1);
    expect(leaderboard[2].framesWon).toBe(1);
  });

  it('calculates win percentage correctly', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
      makeFrame(2, 10, 1, 2, '2025-06-15T19:20:00Z'),
      makeFrame(3, 10, 2, 1, '2025-06-15T19:30:00Z'),
    ];
    const sessions = [makeSession(10, [1, 2], '2025-06-15T19:00:00Z')];

    setupLeaderboardMocks(frames, sessions, testPlayers.slice(0, 2));

    const leaderboard = await getLeaderboard();

    const alice = leaderboard.find(e => e.playerName === 'Alice')!;
    expect(alice.winPercentage).toBe(67); // 2/3 rounds to 67

    const bob = leaderboard.find(e => e.playerName === 'Bob')!;
    expect(bob.winPercentage).toBe(33); // 1/3 rounds to 33
  });

  it('filters by date range when provided', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'), // inside range
      makeFrame(2, 10, 1, 2, '2025-06-15T19:20:00Z'), // inside range
      makeFrame(3, 11, 2, 1, '2025-07-15T19:10:00Z'), // outside range
    ];
    const sessions = [
      makeSession(10, [1, 2], '2025-06-15T19:00:00Z'),
      makeSession(11, [1, 2], '2025-07-15T19:00:00Z'),
    ];

    setupLeaderboardMocks(frames, sessions, testPlayers.slice(0, 2));

    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-30T23:59:59Z');
    const leaderboard = await getLeaderboard(start, end);

    const alice = leaderboard.find(e => e.playerName === 'Alice')!;
    expect(alice.framesWon).toBe(2);
    expect(alice.framesLost).toBe(0);

    const bob = leaderboard.find(e => e.playerName === 'Bob')!;
    expect(bob.framesWon).toBe(0);
    expect(bob.framesLost).toBe(2);
  });

  it('excludes players with no frames from the leaderboard', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
    ];
    const sessions = [makeSession(10, [1, 2, 3], '2025-06-15T19:00:00Z')];

    setupLeaderboardMocks(frames, sessions);

    const leaderboard = await getLeaderboard();

    // Charlie has 0 frames won and 0 lost, so excluded
    expect(leaderboard).toHaveLength(2);
    expect(leaderboard.find(e => e.playerName === 'Charlie')).toBeUndefined();
  });

  it('counts sessions attended correctly', async () => {
    const frames: Frame[] = [
      makeFrame(1, 10, 1, 2, '2025-06-15T19:10:00Z'),
      makeFrame(2, 11, 1, 2, '2025-06-16T19:10:00Z'),
      makeFrame(3, 11, 3, 2, '2025-06-16T19:20:00Z'),
    ];
    const sessions = [
      makeSession(10, [1, 2], '2025-06-15T19:00:00Z'),
      makeSession(11, [1, 2, 3], '2025-06-16T19:00:00Z'),
    ];

    setupLeaderboardMocks(frames, sessions);

    const leaderboard = await getLeaderboard();

    const alice = leaderboard.find(e => e.playerName === 'Alice')!;
    expect(alice.sessionsAttended).toBe(2);

    const charlie = leaderboard.find(e => e.playerName === 'Charlie')!;
    expect(charlie.sessionsAttended).toBe(1);
  });

  it('returns empty array when no frames exist', async () => {
    setupLeaderboardMocks([], []);

    const leaderboard = await getLeaderboard();

    expect(leaderboard).toEqual([]);
  });
});
