-- ============================================================
-- FIX: Reset fake random numbers → real computed values
-- Links existing call_recordings to agents, then recalculates
-- all metrics from actual data.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Add audio_url & transcript_text columns if missing ────
ALTER TABLE call_recordings
    ADD COLUMN IF NOT EXISTS audio_url        TEXT,
    ADD COLUMN IF NOT EXISTS transcript_text  TEXT,
    ADD COLUMN IF NOT EXISTS submitted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_call_rec_submitted_by ON call_recordings(submitted_by);

-- ── 2. Link existing calls to agents ─────────────────────────
-- For calls that have no agent_id, try to match via submitted_by
-- (the user who uploaded the call) → their agent row.
UPDATE call_recordings cr
SET    agent_id = ag.id
FROM   agents ag
JOIN   user_profiles up ON up.id = ag.user_profile_id
WHERE  cr.agent_id     IS NULL
  AND  cr.submitted_by  IS NOT NULL
  AND  up.id = cr.submitted_by;

-- ── 3. Reset fake random values to 0 for ALL agents ──────────
-- We start clean — only real computed data will remain.
UPDATE agents
SET
    performance_score    = 0,
    csat_score           = 0,
    tickets_solved_total = 0,
    fcr_rate             = 0,
    avg_handle_time      = 0,
    updated_at           = NOW();

-- ── 4. Compute tickets_solved_total (real call count) ────────
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

-- ── 5. Compute performance_score from sentiment_confidence ────
UPDATE agents a
SET
    performance_score = ROUND(sub.avg_conf::numeric, 2),
    updated_at        = NOW()
FROM (
    SELECT agent_id, AVG(sentiment_confidence) AS avg_conf
    FROM   call_recordings
    WHERE  status                = 'completed'
      AND  agent_id             IS NOT NULL
      AND  sentiment_confidence IS NOT NULL
    GROUP BY agent_id
    HAVING COUNT(*) > 0
) sub
WHERE a.id = sub.agent_id;

-- ── 6. Compute csat_score from sentiment_score ────────────────
UPDATE agents a
SET
    csat_score = ROUND(sub.avg_sent::numeric, 2),
    updated_at = NOW()
FROM (
    SELECT agent_id, AVG(sentiment_score) AS avg_sent
    FROM   call_recordings
    WHERE  status          = 'completed'
      AND  agent_id       IS NOT NULL
      AND  sentiment_score IS NOT NULL
    GROUP BY agent_id
    HAVING COUNT(*) > 0
) sub
WHERE a.id = sub.agent_id;

-- ── 7. Compute avg_handle_time from call durations ───────────
UPDATE agents a
SET
    avg_handle_time = ROUND((sub.avg_secs / 60.0)::numeric, 2),
    updated_at      = NOW()
FROM (
    SELECT agent_id, AVG(duration_seconds) AS avg_secs
    FROM   call_recordings
    WHERE  status           = 'completed'
      AND  agent_id        IS NOT NULL
      AND  duration_seconds > 0
    GROUP BY agent_id
) sub
WHERE a.id = sub.agent_id;

-- ── 8. FCR Rate: we don't have real FCR data → set to 0 ──────
-- FCR (First Call Resolution) needs a separate tracking system.
-- Setting to 0 is honest — better than a random fake number.
UPDATE agents SET fcr_rate = 0, updated_at = NOW()
WHERE fcr_rate > 0 AND tickets_solved_total = 0;

-- ── 9. Verify final results ───────────────────────────────────
SELECT
    a.name,
    a.tickets_solved_total           AS calls_handled,
    ROUND(a.performance_score, 1)    AS perf_score,
    ROUND(a.csat_score, 1)           AS csat,
    ROUND(a.avg_handle_time, 1)      AS avg_handle_min,
    CASE
        WHEN a.tickets_solved_total > 0 THEN 'REAL ✅'
        ELSE 'No calls linked yet'
    END AS data_status
FROM agents a
ORDER BY a.tickets_solved_total DESC, a.name;
