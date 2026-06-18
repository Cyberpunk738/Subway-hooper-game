-- ============================================
-- LEADERBOARD TABLE FOR SUBWAY SUPER HOPPER
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- Create the leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  score INT4 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read scores (for the leaderboard display)
CREATE POLICY "Anyone can read scores"
  ON leaderboard FOR SELECT
  TO anon
  USING (true);

-- RPC function: upsert a score (only saves if it's the player's new best)
CREATE OR REPLACE FUNCTION submit_best_score(p_username TEXT, p_score INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO leaderboard (username, score)
  VALUES (p_username, p_score)
  ON CONFLICT (username)
  DO UPDATE SET
    score = GREATEST(leaderboard.score, EXCLUDED.score),
    created_at = CASE
      WHEN EXCLUDED.score > leaderboard.score THEN now()
      ELSE leaderboard.created_at
    END;
END;
$$;

-- Allow anon users to call the function
GRANT EXECUTE ON FUNCTION submit_best_score(TEXT, INT) TO anon;


-- ============================================
-- MIGRATION: Run this ONCE if you already have data
-- (cleans up duplicate rows, keeps only each player's best)
-- ============================================

-- Step 1: Delete duplicate rows, keeping only the highest score per username
DELETE FROM leaderboard
WHERE id NOT IN (
  SELECT DISTINCT ON (username) id
  FROM leaderboard
  ORDER BY username, score DESC
);

-- Step 2: Add the unique constraint (skip if table was freshly created above)
ALTER TABLE leaderboard
  ADD CONSTRAINT leaderboard_username_unique UNIQUE (username);

-- Step 3: Remove the old INSERT policy (no longer needed — scores go through the RPC)
DROP POLICY IF EXISTS "Anyone can insert scores" ON leaderboard;
