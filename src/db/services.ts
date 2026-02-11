import { supabase, type Player, type Session, type Frame } from './supabase';
import {
  mapPlayer,
  mapSession,
  mapFrame,
  type PlayerRow,
  type SessionRow,
  type FrameRow,
} from './mappers';

// ── Player Services ──

export async function getActivePlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('archived', false);
  if (error) throw error;
  return (data as PlayerRow[]).map(mapPlayer);
}

export async function getAllPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*');
  if (error) throw error;
  return (data as PlayerRow[]).map(mapPlayer);
}

export async function addPlayer(name: string): Promise<number> {
  const { data, error } = await supabase
    .from('players')
    .insert({ name, archived: false })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function renamePlayer(id: number, name: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function archivePlayer(id: number): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ archived: true })
    .eq('id', id);
  if (error) throw error;
}

export async function restorePlayer(id: number): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ archived: false })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePlayer(id: number): Promise<void> {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Session Services ──

export async function getActiveSession(): Promise<Session | undefined> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .is('ended_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data as SessionRow) : undefined;
}

export async function startSession(playerIds: number[]): Promise<number> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      date,
      started_at: now.toISOString(),
      ended_at: null,
      player_ids: playerIds,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function endSession(sessionId: number): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function addPlayerToSession(sessionId: number, playerId: number): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('sessions')
    .select('player_ids')
    .eq('id', sessionId)
    .single();
  if (fetchError) throw fetchError;
  const current = (data as { player_ids: number[] }).player_ids;
  if (!current.includes(playerId)) {
    const { error } = await supabase
      .from('sessions')
      .update({ player_ids: [...current, playerId] })
      .eq('id', sessionId);
    if (error) throw error;
  }
}

export async function getSession(id: number): Promise<Session | undefined> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data as SessionRow) : undefined;
}

export async function getAllSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data as SessionRow[]).map(mapSession);
}

// ── Frame Services ──

export async function recordFrame(
  sessionId: number,
  winnerId: number,
  loserId: number,
  videoFilePath?: string,
): Promise<number> {
  const row: Record<string, unknown> = {
    session_id: sessionId,
    winner_id: winnerId,
    loser_id: loserId,
    recorded_at: new Date().toISOString(),
  };
  if (videoFilePath) {
    row.video_file_path = videoFilePath;
  }
  const { data, error } = await supabase
    .from('frames')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function getSessionFrames(sessionId: number): Promise<Frame[]> {
  const { data, error } = await supabase
    .from('frames')
    .select('*')
    .eq('session_id', sessionId)
    .order('recorded_at', { ascending: true });
  if (error) throw error;
  return (data as FrameRow[]).map(mapFrame);
}

export async function deleteLastFrame(sessionId: number): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('frames')
    .select('id')
    .eq('session_id', sessionId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (data) {
    const { error } = await supabase.from('frames').delete().eq('id', data.id);
    if (error) throw error;
  }
}

export async function getAllFrames(): Promise<Frame[]> {
  const { data, error } = await supabase.from('frames').select('*');
  if (error) throw error;
  return (data as FrameRow[]).map(mapFrame);
}

export async function getFramesByDateRange(
  start: Date,
  end: Date,
): Promise<Frame[]> {
  const { data, error } = await supabase
    .from('frames')
    .select('*')
    .gte('recorded_at', start.toISOString())
    .lte('recorded_at', end.toISOString());
  if (error) throw error;
  return (data as FrameRow[]).map(mapFrame);
}

// ── Stats Helpers ──

export interface PlayerStats {
  playerId: number;
  playerName: string;
  framesWon: number;
  framesLost: number;
  winPercentage: number;
  sessionsPlayed: number;
  bestSession: { sessionId: number; wins: number } | null;
  headToHead: Record<number, { won: number; lost: number }>;
}

export async function getPlayerStats(
  playerId: number,
  frames?: Frame[],
  sessions?: Session[],
): Promise<PlayerStats> {
  const allFrames = frames ?? (await getAllFrames());
  const allSessions = sessions ?? (await getAllSessions());

  // Fetch the player name
  const { data: playerData } = await supabase
    .from('players')
    .select('name')
    .eq('id', playerId)
    .maybeSingle();

  const playerFrames = allFrames.filter(
    (f) => f.winnerId === playerId || f.loserId === playerId,
  );
  const framesWon = playerFrames.filter((f) => f.winnerId === playerId).length;
  const framesLost = playerFrames.filter((f) => f.loserId === playerId).length;
  const total = framesWon + framesLost;

  const sessionsPlayed = allSessions.filter((s) =>
    s.playerIds.includes(playerId),
  ).length;

  // Head-to-head
  const headToHead: Record<number, { won: number; lost: number }> = {};
  for (const f of playerFrames) {
    const opponentId = f.winnerId === playerId ? f.loserId : f.winnerId;
    if (!headToHead[opponentId]) headToHead[opponentId] = { won: 0, lost: 0 };
    if (f.winnerId === playerId) headToHead[opponentId].won++;
    else headToHead[opponentId].lost++;
  }

  // Best session
  const sessionWins: Record<number, number> = {};
  for (const f of playerFrames) {
    if (f.winnerId === playerId) {
      sessionWins[f.sessionId] = (sessionWins[f.sessionId] || 0) + 1;
    }
  }
  let bestSession: { sessionId: number; wins: number } | null = null;
  for (const [sid, wins] of Object.entries(sessionWins)) {
    if (!bestSession || wins > bestSession.wins) {
      bestSession = { sessionId: Number(sid), wins };
    }
  }

  return {
    playerId,
    playerName: playerData?.name ?? 'Unknown',
    framesWon,
    framesLost,
    winPercentage: total > 0 ? Math.round((framesWon / total) * 100) : 0,
    sessionsPlayed,
    bestSession,
    headToHead,
  };
}

export interface LeaderboardEntry {
  playerId: number;
  playerName: string;
  framesWon: number;
  framesLost: number;
  winPercentage: number;
  sessionsAttended: number;
}

export async function getLeaderboard(
  startDate?: Date,
  endDate?: Date,
): Promise<LeaderboardEntry[]> {
  const allFrames = await getAllFrames();
  const allSessions = await getAllSessions();
  const players = await getAllPlayers();

  const filtered = startDate && endDate
    ? allFrames.filter((f) => {
        const t = new Date(f.recordedAt).getTime();
        return t >= startDate.getTime() && t <= endDate.getTime();
      })
    : allFrames;

  const filteredSessionIds = new Set(filtered.map((f) => f.sessionId));
  const filteredSessions = allSessions.filter(
    (s) => s.id !== undefined && filteredSessionIds.has(s.id),
  );

  const entries: LeaderboardEntry[] = players.map((p) => {
    const won = filtered.filter((f) => f.winnerId === p.id).length;
    const lost = filtered.filter((f) => f.loserId === p.id).length;
    const total = won + lost;
    const sessionsAttended = filteredSessions.filter(
      (s) => p.id !== undefined && s.playerIds.includes(p.id),
    ).length;

    return {
      playerId: p.id!,
      playerName: p.name,
      framesWon: won,
      framesLost: lost,
      winPercentage: total > 0 ? Math.round((won / total) * 100) : 0,
      sessionsAttended,
    };
  });

  return entries
    .filter((e) => e.framesWon + e.framesLost > 0)
    .sort((a, b) => b.framesWon - a.framesWon);
}
