-- ============================================================
-- DYNAMIC is_online — Run in Supabase SQL Editor
-- Makes is_online computed live from last_login (not stored)
-- ============================================================

-- ── 1. Update the view to compute is_online dynamically ──────
-- Instead of reading the stored boolean, we check last_login
-- every time the view is queried → always real-time accurate.
CREATE OR REPLACE VIEW vw_agent_performance AS
SELECT
    a.id,
    a.name,
    a.role_title,
    a.email,
    a.avatar_url,
    -- Dynamic: true if user logged in within last 30 minutes
    COALESCE(
        up.last_login > NOW() - INTERVAL '30 minutes',
        false
    )                   AS is_online,
    up.last_login       AS last_seen,
    d.name              AS department,
    d.code              AS department_code,
    a.performance_score,
    a.csat_score,
    a.tickets_solved_total,
    a.tickets_solved_trend,
    a.fcr_rate,
    a.fcr_trend,
    a.avg_handle_time,
    a.open_tickets,
    COALESCE(
        (SELECT JSON_AGG(JSON_BUILD_OBJECT('badge', ab.badge, 'label', ab.label, 'earned_at', ab.earned_at))
         FROM agent_badges ab WHERE ab.agent_id = a.id),
        '[]'::json
    ) AS badges
FROM agents a
LEFT JOIN departments    d  ON a.department_id    = d.id
LEFT JOIN user_profiles  up ON a.user_profile_id  = up.id;

-- Grant access
GRANT SELECT ON vw_agent_performance TO authenticated;

-- ── 2. Also update user_profiles.last_login on every login ───
-- Supabase Auth calls a hook on sign-in. We update last_login
-- via a trigger on auth.sessions so it stays current.
CREATE OR REPLACE FUNCTION sync_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE user_profiles
    SET last_login = NOW(),
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;

-- Attach to auth.sessions (fires on every new session = login)
DROP TRIGGER IF EXISTS trg_sync_last_login ON auth.sessions;
CREATE TRIGGER trg_sync_last_login
AFTER INSERT ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION sync_last_login();

-- ── 3. Verify: see current online status ─────────────────────
SELECT
    a.name,
    up.last_login,
    (up.last_login > NOW() - INTERVAL '30 minutes') AS is_online_now,
    EXTRACT(EPOCH FROM (NOW() - up.last_login)) / 60 AS minutes_since_login
FROM agents a
LEFT JOIN user_profiles up ON a.user_profile_id = up.id
ORDER BY up.last_login DESC NULLS LAST;
