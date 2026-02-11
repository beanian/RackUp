import type { Player, Session, Frame } from './supabase';

// Row types matching PostgreSQL snake_case columns

export interface PlayerRow {
  id: number;
  name: string;
  created_at: string;
  archived: boolean;
}

export interface SessionRow {
  id: number;
  date: string;
  started_at: string;
  ended_at: string | null;
  player_ids: number[];
}

export interface FrameRow {
  id: number;
  session_id: number;
  winner_id: number;
  loser_id: number;
  recorded_at: string;
  video_file_path: string | null;
}

// Mapper functions: snake_case rows → camelCase interfaces

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
    archived: row.archived,
  };
}

export function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    date: row.date,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : null,
    playerIds: row.player_ids,
  };
}

export function mapFrame(row: FrameRow): Frame {
  return {
    id: row.id,
    sessionId: row.session_id,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    recordedAt: new Date(row.recorded_at),
    videoFilePath: row.video_file_path ?? undefined,
  };
}
