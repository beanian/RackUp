import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper: create a chainable query builder mock that is also PromiseLike.
// Supabase query builders can be awaited directly OR terminated with .single()/.maybeSingle().
function createQueryChain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'gte', 'lte', 'order', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => result);
  chain.maybeSingle = vi.fn(() => result);
  // Make the chain thenable so `await chain.eq(...)` resolves to the result
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

let fromResults: Record<string, ReturnType<typeof createQueryChain>[]>;

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const queue = fromResults[table] ?? fromResults['*'] ?? [];
      return queue.shift() ?? createQueryChain();
    },
  },
}));

import {
  getActivePlayers,
  getAllPlayers,
  addPlayer,
  renamePlayer,
  archivePlayer,
  restorePlayer,
  deletePlayer,
  getActiveSession,
  startSession,
  endSession,
  addPlayerToSession,
  getSession,
  getAllSessions,
  recordFrame,
  getSessionFrames,
  deleteLastFrame,
  getAllFrames,
  getFramesByDateRange,
} from '../services';

beforeEach(() => {
  vi.clearAllMocks();
  fromResults = {};
});

// Helper to enqueue a chain for a table
function enqueue(table: string, result: { data?: unknown; error?: unknown }) {
  if (!fromResults[table]) fromResults[table] = [];
  const chain = createQueryChain(result);
  fromResults[table].push(chain);
  return chain;
}

// ── Player Service Tests ──

describe('getActivePlayers', () => {
  it('returns mapped active players', async () => {
    const rows = [
      { id: 1, name: 'Alice', created_at: '2025-01-01T00:00:00Z', archived: false },
      { id: 2, name: 'Bob', created_at: '2025-01-02T00:00:00Z', archived: false },
    ];
    const chain = enqueue('players', { data: rows, error: null });

    const players = await getActivePlayers();

    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('archived', false);
    expect(players).toHaveLength(2);
    expect(players[0].name).toBe('Alice');
    expect(players[1].name).toBe('Bob');
    expect(players[0].createdAt).toBeInstanceOf(Date);
  });

  it('throws on supabase error', async () => {
    enqueue('players', { data: null, error: { message: 'DB error' } });

    await expect(getActivePlayers()).rejects.toEqual({ message: 'DB error' });
  });
});

describe('getAllPlayers', () => {
  it('returns all players mapped', async () => {
    const rows = [
      { id: 1, name: 'Alice', created_at: '2025-01-01T00:00:00Z', archived: false },
      { id: 3, name: 'Charlie', created_at: '2025-02-01T00:00:00Z', archived: true },
    ];
    enqueue('players', { data: rows, error: null });

    const players = await getAllPlayers();

    expect(players).toHaveLength(2);
    expect(players[1].archived).toBe(true);
  });
});

describe('addPlayer', () => {
  it('inserts a player and returns the id', async () => {
    const chain = enqueue('players', { data: { id: 42 }, error: null });

    const id = await addPlayer('NewPlayer');

    expect(chain.insert).toHaveBeenCalledWith({ name: 'NewPlayer', archived: false });
    expect(id).toBe(42);
  });

  it('throws on insert error', async () => {
    enqueue('players', { data: null, error: { message: 'Duplicate' } });

    await expect(addPlayer('Dup')).rejects.toEqual({ message: 'Duplicate' });
  });
});

describe('renamePlayer', () => {
  it('updates the player name', async () => {
    const chain = enqueue('players', { error: null });

    await renamePlayer(1, 'NewName');

    expect(chain.update).toHaveBeenCalledWith({ name: 'NewName' });
    expect(chain.eq).toHaveBeenCalledWith('id', 1);
  });

  it('throws on update error', async () => {
    enqueue('players', { error: { message: 'Not found' } });

    await expect(renamePlayer(999, 'X')).rejects.toEqual({ message: 'Not found' });
  });
});

describe('archivePlayer', () => {
  it('sets archived to true', async () => {
    const chain = enqueue('players', { error: null });

    await archivePlayer(5);

    expect(chain.update).toHaveBeenCalledWith({ archived: true });
    expect(chain.eq).toHaveBeenCalledWith('id', 5);
  });
});

describe('restorePlayer', () => {
  it('sets archived to false', async () => {
    const chain = enqueue('players', { error: null });

    await restorePlayer(5);

    expect(chain.update).toHaveBeenCalledWith({ archived: false });
    expect(chain.eq).toHaveBeenCalledWith('id', 5);
  });
});

describe('deletePlayer', () => {
  it('deletes the player by id', async () => {
    const chain = enqueue('players', { error: null });

    await deletePlayer(3);

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 3);
  });
});

// ── Session Service Tests ──

describe('getActiveSession', () => {
  it('returns mapped session when one exists', async () => {
    const row = {
      id: 10, date: '2025-06-15',
      started_at: '2025-06-15T19:00:00Z', ended_at: null,
      player_ids: [1, 2],
    };
    enqueue('sessions', { data: row, error: null });

    const session = await getActiveSession();

    expect(session).toBeDefined();
    expect(session!.id).toBe(10);
    expect(session!.endedAt).toBeNull();
    expect(session!.playerIds).toEqual([1, 2]);
  });

  it('returns undefined when no active session', async () => {
    enqueue('sessions', { data: null, error: null });

    const session = await getActiveSession();

    expect(session).toBeUndefined();
  });
});

describe('startSession', () => {
  it('inserts a session and returns the id', async () => {
    const chain = enqueue('sessions', { data: { id: 20 }, error: null });

    const id = await startSession([1, 2, 3]);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ player_ids: [1, 2, 3], ended_at: null }),
    );
    expect(id).toBe(20);
  });
});

describe('endSession', () => {
  it('sets ended_at on the session', async () => {
    const chain = enqueue('sessions', { error: null });

    await endSession(10);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ ended_at: expect.any(String) }),
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 10);
  });
});

describe('addPlayerToSession', () => {
  it('adds a player to the session player_ids', async () => {
    // First from('sessions') call: select player_ids
    enqueue('sessions', { data: { player_ids: [1, 2] }, error: null });
    // Second from('sessions') call: update
    const updateChain = enqueue('sessions', { error: null });

    await addPlayerToSession(10, 3);

    expect(updateChain.update).toHaveBeenCalledWith({ player_ids: [1, 2, 3] });
  });

  it('does not add a duplicate player', async () => {
    enqueue('sessions', { data: { player_ids: [1, 2, 3] }, error: null });

    await addPlayerToSession(10, 2);

    // Only one from('sessions') call should happen (the select), no update enqueued
    expect(fromResults['sessions']).toEqual([]);
  });
});

describe('getSession', () => {
  it('returns a session by id', async () => {
    const row = {
      id: 10, date: '2025-06-15',
      started_at: '2025-06-15T19:00:00Z', ended_at: '2025-06-15T21:00:00Z',
      player_ids: [1, 2],
    };
    enqueue('sessions', { data: row, error: null });

    const session = await getSession(10);

    expect(session).toBeDefined();
    expect(session!.endedAt).toBeInstanceOf(Date);
  });

  it('returns undefined when session not found', async () => {
    enqueue('sessions', { data: null, error: null });

    const session = await getSession(999);

    expect(session).toBeUndefined();
  });
});

describe('getAllSessions', () => {
  it('returns all sessions mapped and ordered', async () => {
    const rows = [
      { id: 2, date: '2025-06-16', started_at: '2025-06-16T19:00:00Z', ended_at: '2025-06-16T21:00:00Z', player_ids: [1, 3] },
      { id: 1, date: '2025-06-15', started_at: '2025-06-15T19:00:00Z', ended_at: '2025-06-15T21:00:00Z', player_ids: [1, 2] },
    ];
    const chain = enqueue('sessions', { data: rows, error: null });

    const sessions = await getAllSessions();

    expect(sessions).toHaveLength(2);
    expect(chain.order).toHaveBeenCalledWith('started_at', { ascending: false });
  });
});

// ── Frame Service Tests ──

describe('recordFrame', () => {
  it('inserts a frame and returns the id', async () => {
    const chain = enqueue('frames', { data: { id: 100 }, error: null });

    const id = await recordFrame(10, 1, 2);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 10,
        winner_id: 1,
        loser_id: 2,
        recorded_at: expect.any(String),
      }),
    );
    expect(id).toBe(100);
  });
});

describe('getSessionFrames', () => {
  it('returns frames for a session ordered by recorded_at', async () => {
    const rows = [
      { id: 100, session_id: 10, winner_id: 1, loser_id: 2, recorded_at: '2025-06-15T19:10:00Z' },
      { id: 101, session_id: 10, winner_id: 2, loser_id: 1, recorded_at: '2025-06-15T19:20:00Z' },
    ];
    const chain = enqueue('frames', { data: rows, error: null });

    const frames = await getSessionFrames(10);

    expect(frames).toHaveLength(2);
    expect(frames[0].winnerId).toBe(1);
    expect(frames[1].winnerId).toBe(2);
    expect(chain.order).toHaveBeenCalledWith('recorded_at', { ascending: true });
  });
});

describe('deleteLastFrame', () => {
  it('deletes the most recent frame in a session', async () => {
    // First from('frames') call: select to find the last frame
    const selectChain = enqueue('frames', { data: { id: 101 }, error: null });
    // Second from('frames') call: delete
    const deleteChain = enqueue('frames', { error: null });

    await deleteLastFrame(10);

    expect(selectChain.order).toHaveBeenCalledWith('recorded_at', { ascending: false });
    expect(selectChain.limit).toHaveBeenCalledWith(1);
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 101);
  });

  it('does nothing when there are no frames', async () => {
    enqueue('frames', { data: null, error: null });

    await deleteLastFrame(10);

    // Only one from('frames') should be consumed (the select); no delete chain needed
    expect(fromResults['frames']).toEqual([]);
  });
});

describe('getAllFrames', () => {
  it('returns all frames mapped', async () => {
    const rows = [
      { id: 100, session_id: 10, winner_id: 1, loser_id: 2, recorded_at: '2025-06-15T19:10:00Z' },
    ];
    enqueue('frames', { data: rows, error: null });

    const frames = await getAllFrames();

    expect(frames).toHaveLength(1);
    expect(frames[0].sessionId).toBe(10);
  });
});

describe('getFramesByDateRange', () => {
  it('filters frames within the given date range', async () => {
    const rows = [
      { id: 100, session_id: 10, winner_id: 1, loser_id: 2, recorded_at: '2025-06-15T19:10:00Z' },
    ];
    const chain = enqueue('frames', { data: rows, error: null });

    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-30T23:59:59Z');
    const frames = await getFramesByDateRange(start, end);

    expect(frames).toHaveLength(1);
    expect(chain.gte).toHaveBeenCalledWith('recorded_at', start.toISOString());
    expect(chain.lte).toHaveBeenCalledWith('recorded_at', end.toISOString());
  });
});
