-- ============================================================
-- FIX: agents.user_profile_id → ON DELETE CASCADE
-- When a user_profile is deleted, their agent row is deleted too.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Drop the old SET NULL constraint and replace with CASCADE
ALTER TABLE agents
    DROP CONSTRAINT IF EXISTS agents_user_profile_id_fkey;

ALTER TABLE agents
    ADD CONSTRAINT agents_user_profile_id_fkey
    FOREIGN KEY (user_profile_id)
    REFERENCES user_profiles(id)
    ON DELETE CASCADE;

-- Also clean up any orphaned agent rows that have no user_profile
-- (like "anas ibrahim" whose profile was already deleted)
DELETE FROM agents
WHERE user_profile_id IS NULL;

-- Verify: show remaining agents
SELECT a.name, a.email, a.role_title, up.full_name AS profile_name
FROM agents a
LEFT JOIN user_profiles up ON a.user_profile_id = up.id
ORDER BY a.name;
