import Dexie, { type Table } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';

export interface Player {
  id?: string;
  name: string;
  createdAt: Date;
  archived: boolean;
}

export interface Session {
  id?: string;
  date: string; // YYYY-MM-DD
  startedAt: Date;
  endedAt: Date | null;
  playerIds: string[];
}

export interface Frame {
  id?: string;
  sessionId: string;
  winnerId: string;
  loserId: string;
  recordedAt: Date;
}

class RackUpDB extends Dexie {
  players!: Table<Player, string>;
  sessions!: Table<Session, string>;
  frames!: Table<Frame, string>;

  constructor() {
    super('RackUpDB', { addons: [dexieCloud] });
    this.version(1).stores({
      players: '@id, name',
      sessions: '@id, startedAt',
      frames: '@id, sessionId, recordedAt',
    });

    this.cloud.configure({
      databaseUrl: 'https://zlibmtpue.dexie.cloud',
      requireAuth: true,
    });
  }
}

export const db = new RackUpDB();
