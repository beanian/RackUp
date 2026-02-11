import { describe, it, expect } from 'vitest';
import { mapPlayer, mapSession, mapFrame } from '../mappers';
import type { PlayerRow, SessionRow, FrameRow } from '../mappers';

describe('mapPlayer', () => {
  it('maps a PlayerRow to a Player with camelCase fields', () => {
    const row: PlayerRow = {
      id: 1,
      name: 'Dave',
      emoji: null,
      created_at: '2025-06-15T10:30:00.000Z',
      archived: false,
    };

    const player = mapPlayer(row);

    expect(player).toEqual({
      id: 1,
      name: 'Dave',
      createdAt: new Date('2025-06-15T10:30:00.000Z'),
      archived: false,
    });
  });

  it('preserves archived flag when true', () => {
    const row: PlayerRow = {
      id: 5,
      name: 'Old Player',
      emoji: null,
      created_at: '2024-01-01T00:00:00.000Z',
      archived: true,
    };

    const player = mapPlayer(row);

    expect(player.archived).toBe(true);
  });

  it('converts created_at string to a Date object', () => {
    const row: PlayerRow = {
      id: 2,
      name: 'Test',
      emoji: null,
      created_at: '2025-12-25T18:00:00.000Z',
      archived: false,
    };

    const player = mapPlayer(row);

    expect(player.createdAt).toBeInstanceOf(Date);
    expect(player.createdAt.toISOString()).toBe('2025-12-25T18:00:00.000Z');
  });
});

describe('mapSession', () => {
  it('maps a SessionRow to a Session with camelCase fields', () => {
    const row: SessionRow = {
      id: 10,
      date: '2025-06-15',
      started_at: '2025-06-15T19:00:00.000Z',
      ended_at: '2025-06-15T21:30:00.000Z',
      player_ids: [1, 2, 3],
    };

    const session = mapSession(row);

    expect(session).toEqual({
      id: 10,
      date: '2025-06-15',
      startedAt: new Date('2025-06-15T19:00:00.000Z'),
      endedAt: new Date('2025-06-15T21:30:00.000Z'),
      playerIds: [1, 2, 3],
    });
  });

  it('maps ended_at to null when session is still active', () => {
    const row: SessionRow = {
      id: 11,
      date: '2025-06-16',
      started_at: '2025-06-16T20:00:00.000Z',
      ended_at: null,
      player_ids: [1, 4],
    };

    const session = mapSession(row);

    expect(session.endedAt).toBeNull();
  });

  it('preserves player_ids array as playerIds', () => {
    const row: SessionRow = {
      id: 12,
      date: '2025-07-01',
      started_at: '2025-07-01T18:00:00.000Z',
      ended_at: null,
      player_ids: [10, 20, 30, 40],
    };

    const session = mapSession(row);

    expect(session.playerIds).toEqual([10, 20, 30, 40]);
    expect(session.playerIds).toHaveLength(4);
  });
});

describe('mapFrame', () => {
  it('maps a FrameRow to a Frame with camelCase fields', () => {
    const row: FrameRow = {
      id: 100,
      session_id: 10,
      winner_id: 1,
      loser_id: 2,
      recorded_at: '2025-06-15T19:15:00.000Z',
      video_file_path: null,
    };

    const frame = mapFrame(row);

    expect(frame).toEqual({
      id: 100,
      sessionId: 10,
      winnerId: 1,
      loserId: 2,
      recordedAt: new Date('2025-06-15T19:15:00.000Z'),
      videoFilePath: undefined,
    });
  });

  it('converts recorded_at string to a Date object', () => {
    const row: FrameRow = {
      id: 101,
      session_id: 10,
      winner_id: 3,
      loser_id: 4,
      recorded_at: '2025-08-20T22:45:30.500Z',
      video_file_path: null,
    };

    const frame = mapFrame(row);

    expect(frame.recordedAt).toBeInstanceOf(Date);
    expect(frame.recordedAt.getTime()).toBe(
      new Date('2025-08-20T22:45:30.500Z').getTime(),
    );
  });

  it('maps session_id, winner_id, loser_id to camelCase', () => {
    const row: FrameRow = {
      id: 200,
      session_id: 99,
      winner_id: 7,
      loser_id: 8,
      recorded_at: '2025-01-01T00:00:00.000Z',
      video_file_path: null,
    };

    const frame = mapFrame(row);

    expect(frame.sessionId).toBe(99);
    expect(frame.winnerId).toBe(7);
    expect(frame.loserId).toBe(8);
  });
});
