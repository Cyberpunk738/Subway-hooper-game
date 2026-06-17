-- ============================================
-- LEADERBOARD TABLE FOR SUBWAY SUPER HOPPER
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- Create the leaderboard table
CREATE TABLE leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  score INT4 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert scores (anon users from the game)
CREATE POLICY "Anyone can insert scores"
  ON leaderboard FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anyone to read scores (for the leaderboard display)
CREATE POLICY "Anyone can read scores"
  ON leaderboard FOR SELECT
  TO anon
  USING (true);
