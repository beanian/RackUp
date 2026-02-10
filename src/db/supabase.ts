import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gzghgnydhttmkigsnfag.supabase.co';
const supabaseAnonKey = 'sb_publishable_l4wmE0p6qBULc64jv1LPnQ_UnPuaGND';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Player {
  id?: number;
  name: string;
  createdAt: Date;
  archived: boolean;
}

export interface Session {
  id?: number;
  date: string; // YYYY-MM-DD
  startedAt: Date;
  endedAt: Date | null;
  playerIds: number[];
}

export interface Frame {
  id?: number;
  sessionId: number;
  winnerId: number;
  loserId: number;
  recordedAt: Date;
}
