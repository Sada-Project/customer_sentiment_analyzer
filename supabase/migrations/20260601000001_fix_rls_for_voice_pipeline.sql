-- ============================================================
-- RUN THIS SQL IN: Supabase Dashboard → SQL Editor
-- Purpose: Allow the Voice Analysis pipeline to save topics
--          and keywords to the database after Gemini analysis.
-- ============================================================

-- 1. topics table: allow INSERT and UPDATE for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'topics' AND policyname = 'auth_users_upsert_topics'
  ) THEN
    CREATE POLICY auth_users_upsert_topics
      ON topics FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'topics' AND policyname = 'auth_users_update_topics'
  ) THEN
    CREATE POLICY auth_users_update_topics
      ON topics FOR UPDATE TO authenticated
      USING (true);
  END IF;
END $$;

-- 2. call_topics: allow INSERT and UPDATE for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_topics' AND policyname = 'auth_users_insert_call_topics'
  ) THEN
    CREATE POLICY auth_users_insert_call_topics
      ON call_topics FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_topics' AND policyname = 'auth_users_update_call_topics'
  ) THEN
    CREATE POLICY auth_users_update_call_topics
      ON call_topics FOR UPDATE TO authenticated
      USING (true);
  END IF;
END $$;

-- 3. keywords: allow INSERT and UPDATE for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'keywords' AND policyname = 'auth_users_upsert_keywords'
  ) THEN
    CREATE POLICY auth_users_upsert_keywords
      ON keywords FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'keywords' AND policyname = 'auth_users_update_keywords'
  ) THEN
    CREATE POLICY auth_users_update_keywords
      ON keywords FOR UPDATE TO authenticated
      USING (true);
  END IF;
END $$;

-- 4. call_keywords: allow INSERT and UPDATE for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_keywords' AND policyname = 'auth_users_insert_call_keywords'
  ) THEN
    CREATE POLICY auth_users_insert_call_keywords
      ON call_keywords FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_keywords' AND policyname = 'auth_users_update_call_keywords'
  ) THEN
    CREATE POLICY auth_users_update_call_keywords
      ON call_keywords FOR UPDATE TO authenticated
      USING (true);
  END IF;
END $$;

-- Verify policies were created
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('topics', 'call_topics', 'keywords', 'call_keywords')
ORDER BY tablename, cmd;
