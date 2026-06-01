-- ============================================================
-- SEED AGENTS FROM REAL USERS
-- Reads actual user_profiles from your Supabase Auth and
-- creates an agent record for each one.
-- Safe to run multiple times (ON CONFLICT DO UPDATE).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Ensure departments exist ──────────────────────────────
INSERT INTO departments (name, code, description)
VALUES
    ('Customer Support', 'support',   'Handles general customer inquiries'),
    ('Technical Support','technical', 'Handles technical and product issues'),
    ('Sales',            'sales',     'Handles sales inquiries and conversions'),
    ('Billing',          'billing',   'Handles billing and payment issues')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Create one agent per user_profile ────────────────────
-- Uses CTEs to pre-compute row numbers (window functions not allowed in OFFSET).
WITH ranked_users AS (
    SELECT
        id,
        full_name,
        email,
        role,
        last_login,
        (ROW_NUMBER() OVER (ORDER BY created_at) - 1) AS rn
    FROM user_profiles
),
ranked_depts AS (
    SELECT
        id,
        (ROW_NUMBER() OVER (ORDER BY name) - 1) AS dn,
        COUNT(*) OVER ()                          AS total
    FROM departments
)
INSERT INTO agents (
    user_profile_id, name, email, role_title, department_id,
    is_online,
    performance_score, csat_score,
    tickets_solved_total, tickets_solved_trend,
    fcr_rate, fcr_trend,
    avg_handle_time, open_tickets
)
SELECT
    u.id,
    u.full_name,
    u.email,
    CASE u.role WHEN 'admin' THEN 'Team Lead' ELSE 'Support Agent' END,
    d.id,
    (u.last_login > NOW() - INTERVAL '30 minutes'),
    ROUND((70 + RANDOM() * 25)::numeric, 2),
    ROUND((72 + RANDOM() * 23)::numeric, 2),
    0, 0,
    ROUND((65 + RANDOM() * 25)::numeric, 2), 0,
    ROUND((7  + RANDOM() * 5 )::numeric, 2),
    0
FROM ranked_users u
JOIN ranked_depts d ON d.dn = u.rn % d.total
ON CONFLICT (email) DO UPDATE SET
    user_profile_id = EXCLUDED.user_profile_id,
    name            = EXCLUDED.name,
    role_title      = EXCLUDED.role_title,
    is_online       = EXCLUDED.is_online,
    updated_at      = NOW();

-- ── 3. Update tickets_solved_total from real call_recordings ─
UPDATE agents a
SET
    tickets_solved_total = sub.call_count,
    updated_at           = NOW()
FROM (
    SELECT agent_id, COUNT(*) AS call_count
    FROM   call_recordings
    WHERE  status    = 'completed'
      AND  agent_id IS NOT NULL
    GROUP BY agent_id
) sub
WHERE a.id = sub.agent_id;

-- ── 4. Update performance_score from avg sentiment_confidence ─
UPDATE agents a
SET
    performance_score = ROUND(sub.avg_confidence::numeric, 2),
    updated_at        = NOW()
FROM (
    SELECT agent_id, AVG(sentiment_confidence) AS avg_confidence
    FROM   call_recordings
    WHERE  status                = 'completed'
      AND  agent_id             IS NOT NULL
      AND  sentiment_confidence IS NOT NULL
    GROUP BY agent_id
    HAVING COUNT(*) > 0
) sub
WHERE a.id = sub.agent_id;

-- ── 5. Update csat_score from avg sentiment_score ────────────
UPDATE agents a
SET
    csat_score = ROUND(sub.avg_sentiment::numeric, 2),
    updated_at = NOW()
FROM (
    SELECT agent_id, AVG(sentiment_score) AS avg_sentiment
    FROM   call_recordings
    WHERE  status         = 'completed'
      AND  agent_id      IS NOT NULL
      AND  sentiment_score IS NOT NULL
    GROUP BY agent_id
    HAVING COUNT(*) > 0
) sub
WHERE a.id = sub.agent_id;

-- ── 6. Update avg_handle_time from real call durations ───────
UPDATE agents a
SET
    avg_handle_time = ROUND((sub.avg_seconds / 60.0)::numeric, 2),
    updated_at      = NOW()
FROM (
    SELECT agent_id, AVG(duration_seconds) AS avg_seconds
    FROM   call_recordings
    WHERE  status           = 'completed'
      AND  agent_id        IS NOT NULL
      AND  duration_seconds > 0
    GROUP BY agent_id
) sub
WHERE a.id = sub.agent_id;

-- ── 7. Verify results ────────────────────────────────────────
SELECT
    a.name,
    a.email,
    a.role_title,
    d.name                     AS department,
    a.is_online,
    a.performance_score,
    a.csat_score,
    a.tickets_solved_total     AS calls_handled,
    a.avg_handle_time
FROM agents a
LEFT JOIN departments d ON d.id = a.department_id
ORDER BY a.performance_score DESC;
