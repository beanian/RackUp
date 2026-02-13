-- Add brush flag to frames table
-- A brush is when a player wins without the opponent getting a shot
ALTER TABLE frames ADD COLUMN IF NOT EXISTS brush BOOLEAN NOT NULL DEFAULT FALSE;
