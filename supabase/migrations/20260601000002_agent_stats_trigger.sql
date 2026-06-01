-- ============================================================
-- AUTO-COUNT CALLS PER AGENT — Trigger Migration
-- Every time a call_recording is marked 'completed',
-- the agent's stats are recalculated automatically from real data.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Function: recalculate one agent's stats ───────────────
CREATE OR REPLACE FUNCTION refresh_agent_stats(p_agent_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count       INTEGER;
    v_avg_conf    DECIMAL;
    v_avg_sent    DECIMAL;
    v_avg_handle  DECIMAL;
BEGIN
    -- Count completed calls
    SELECT COUNT(*)
    INTO   v_count
    FROM   call_recordings
    WHERE  agent_id = p_agent_id
      AND  status   = 'completed';

    -- Avg sentiment_confidence → performance_score
    SELECT AVG(sentiment_confidence)
    INTO   v_avg_conf
    FROM   call_recordings
    WHERE  agent_id              = p_agent_id
      AND  status                = 'completed'
      AND  sentiment_confidence  IS NOT NULL;

    -- Avg sentiment_score → csat_score
    SELECT AVG(sentiment_score)
    INTO   v_avg_sent
    FROM   call_recordings
    WHERE  agent_id        = p_agent_id
      AND  status          = 'completed'
      AND  sentiment_score IS NOT NULL;

    -- Avg handle time in minutes
    SELECT AVG(duration_seconds) / 60.0
    INTO   v_avg_handle
    FROM   call_recordings
    WHERE  agent_id          = p_agent_id
      AND  status            = 'completed'
      AND  duration_seconds  > 0;

    -- Update agents row
    UPDATE agents
    SET
        tickets_solved_total = v_count,
        performance_score    = COALESCE(ROUND(v_avg_conf::numeric,  2), performance_score),
        csat_score           = COALESCE(ROUND(v_avg_sent::numeric,  2), csat_score),
        avg_handle_time      = COALESCE(ROUND(v_avg_handle::numeric, 2), avg_handle_time),
        updated_at           = NOW()
    WHERE id = p_agent_id;
END;
$$;

-- ── 2. Trigger function: fires on INSERT / UPDATE ─────────────
CREATE OR REPLACE FUNCTION trg_update_agent_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only act when a call becomes 'completed' and has an agent
    IF NEW.status = 'completed' AND NEW.agent_id IS NOT NULL THEN
        -- If status changed TO completed, recalculate
        IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed' THEN
            PERFORM refresh_agent_stats(NEW.agent_id);
        END IF;
    END IF;

    -- If agent_id changed (reassigned), update old agent too
    IF TG_OP = 'UPDATE'
        AND OLD.agent_id IS NOT NULL
        AND OLD.agent_id IS DISTINCT FROM NEW.agent_id
    THEN
        PERFORM refresh_agent_stats(OLD.agent_id);
    END IF;

    RETURN NEW;
END;
$$;

-- ── 3. Attach trigger to call_recordings ─────────────────────
DROP TRIGGER IF EXISTS trg_call_completed_agent_stats ON call_recordings;

CREATE TRIGGER trg_call_completed_agent_stats
AFTER INSERT OR UPDATE OF status, agent_id
ON call_recordings
FOR EACH ROW
EXECUTE FUNCTION trg_update_agent_stats();

-- ── 4. Backfill: recalculate NOW for all existing agents ──────
-- (catches any calls that were completed before this trigger existed)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT DISTINCT agent_id FROM call_recordings
             WHERE agent_id IS NOT NULL AND status = 'completed'
    LOOP
        PERFORM refresh_agent_stats(r.agent_id);
    END LOOP;
END;
$$;

-- ── 5. Verify ────────────────────────────────────────────────
SELECT
    a.name,
    a.tickets_solved_total  AS calls_handled,
    a.performance_score,
    a.csat_score,
    ROUND(a.avg_handle_time::numeric, 1) || 'm' AS avg_handle,
    a.is_online
FROM agents a
ORDER BY a.tickets_solved_total DESC;
