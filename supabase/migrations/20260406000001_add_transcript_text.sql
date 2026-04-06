-- ============================================================
-- MIGRATION: Fix Voice Analysis Hub persistence
-- 1. Add transcript_text column to call_recordings
-- 2. Add RLS policies to allow authenticated users to INSERT/UPDATE
-- ============================================================

-- Step 1: Add transcript_text column if it doesn't exist
ALTER TABLE call_recordings
  ADD COLUMN IF NOT EXISTS transcript_text TEXT;

-- Step 2: Allow authenticated users to INSERT their own call records
CREATE POLICY "auth_users_insert_calls"
    ON call_recordings FOR INSERT TO authenticated
    WITH CHECK (fn_is_authenticated_user());

-- Step 3: Allow authenticated users to UPDATE call records
-- (needed so Gemini analysis results can be saved)
CREATE POLICY "auth_users_update_calls"
    ON call_recordings FOR UPDATE TO authenticated
    USING (fn_is_authenticated_user());
