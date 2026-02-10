import { db, type Player, type Session, type Frame } from './dexie';

// ── Player Services ──

export async function getActivePlayers(): Promise<Player[]> {
  return db.players.filter((p) => !p.archived).toArray();
}

export async function getAllPlayers(): Promise<Player[]> {
  return db.players.toArray();
}

export async function addPlayer(name: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.players.add({ id, name, createdAt: new Date(), archived: false });
  return id;
}

export async function renamePlayer(id: string, name: string): Promise<void> {
  await db.players.update(id, { name });
}

export async function archivePlayer(id: string): Promise<void> {
  await db.players.update(id, { archived: true });
}

export async function restorePlayer(id: string): Promise<void> {
  await db.players.update(id, { archived: false });
}

export async function deletePlayer(id: string): Promise<void> {
  const hasFrames = await db.frames
    .filter((f) => f.winnerId === id || f.loserId === id)
    .count();
  if (hasFrames > 0) {
    throw new Error('Cannot delete a player who has recorded frames');
  }
  await db.players.delete(id);
}

// ── Session Services ──

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.endedAt === null).first();
}

export async function startSession(playerIds: string[]): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  await db.sessions.add({ id, date, startedAt: now, endedAt: null, playerIds });
  return id;
}

export async function endSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { endedAt: new Date() });
}

export async function addPlayerToSession(sessionId: string, playerId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  if (!session.playerIds.includes(playerId)) {
    await db.sessions.update(sessionId, {
      playerIds: [...session.playerIds, playerId],
    });
  }
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

// ── Frame Services ──

export async function recordFrame(
  sessionId: string,
  winnerId: string,
  loserId: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.frames.add({
    id,
    sessionId,
    winnerId,
    loserId,
    recordedAt: new Date(),
  });
  return id;
}

export async function getSessionFrames(sessionId: string): Promise<Frame[]> {
  return db.frames.where('sessionId').equals(sessionId).sortBy('recordedAt');
}

export async function deleteLastFrame(sessionId: string): Promise<void> {
  const frames = await db.frames
    .where('sessionId')
    .equals(sessionId)
    .sortBy('recordedAt');
  if (frames.length > 0) {
    const last = frames[frames.length - 1];
    await db.frames.delete(last.id!);
  }
}

export async function getAllFrames(): Promise<Frame[]> {
  return db.frames.toArray();
}

export async function getFramesByDateRange(
  start: Date,
  end: Date,
): Promise<Frame[]> {
  return db.frames
    .where('recordedAt')
    .between(start, end, true, true)
    .toArray();
}

// ── Stats Helpers ──

export interface PlayerStats {
  playerId: string;
  playerName: string;
  framesWon: number;
  framesLost: number;
  winPercentage: number;
  sessionsPlayed: number;
  bestSession: { sessionId: string; wins: number } | null;
  headToHead: Record<string, { won: number; lost: number }>;
}

export async function getPlayerStats(
  playerId: string,
  frames?: Frame[],
  sessions?: Session[],
): Promise<PlayerStats> {
  const allFrames = frames ?? (await getAllFrames());
  const allSessions = sessions ?? (await getAllSessions());

  const player = await db.players.get(playerId);

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
  const headToHead: Record<string, { won: number; lost: number }> = {};
  for (const f of playerFrames) {
    const opponentId = f.winnerId === playerId ? f.loserId : f.winnerId;
    if (!headToHead[opponentId]) headToHead[opponentId] = { won: 0, lost: 0 };
    if (f.winnerId === playerId) headToHead[opponentId].won++;
    else headToHead[opponentId].lost++;
  }

  // Best session
  const sessionWins: Record<string, number> = {};
  for (const f of playerFrames) {
    if (f.winnerId === playerId) {
      sessionWins[f.sessionId] = (sessionWins[f.sessionId] || 0) + 1;
    }
  }
  let bestSession: { sessionId: string; wins: number } | null = null;
  for (const [sid, wins] of Object.entries(sessionWins)) {
    if (!bestSession || wins > bestSession.wins) {
      bestSession = { sessionId: sid, wins };
    }
  }

  return {
    playerId,
    playerName: player?.name ?? 'Unknown',
    framesWon,
    framesLost,
    winPercentage: total > 0 ? Math.round((framesWon / total) * 100) : 0,
    sessionsPlayed,
    bestSession,
    headToHead,
  };
}

export interface LeaderboardEntry {
  playerId: string;
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
