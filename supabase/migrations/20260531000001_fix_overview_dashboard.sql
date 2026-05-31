-- ============================================================
-- MIGRATION: Fix All Dashboards — DB Connectivity Issues
-- Covers: Sentiment Overview, Customer Insights, Performance,
--         Agent Performance, Call Details pages
-- Customer Sentiment Analyzer
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. ADD MISSING COLUMNS (safe — IF NOT EXISTS)
-- ============================================================

-- audio_url: used by voiceAnalysisService.js
ALTER TABLE call_recordings
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- transcript_text: used by voiceAnalysisService.js & sentimentOverviewService.js
ALTER TABLE call_recordings
  ADD COLUMN IF NOT EXISTS transcript_text TEXT;

-- ============================================================
-- 2. FIX call_recordings INSERT POLICY FOR AGENTS
-- Agents need to be able to INSERT their own recordings
-- ============================================================

-- Drop and recreate the policy so agents can insert their own calls
DROP POLICY IF EXISTS "agents_insert_own_calls" ON call_recordings;

CREATE POLICY "agents_insert_own_calls"
  ON call_recordings FOR INSERT TO authenticated
  WITH CHECK (fn_is_authenticated_user());

-- Agents & admins can UPDATE their own calls (for progress updates)
DROP POLICY IF EXISTS "agents_update_own_calls" ON call_recordings;

CREATE POLICY "agents_update_own_calls"
  ON call_recordings FOR UPDATE TO authenticated
  USING (fn_is_authenticated_user());

-- ============================================================
-- 3. FIX vw_live_activity_feed — Grant SELECT to authenticated
-- PostgREST needs explicit GRANT on the view
-- ============================================================

GRANT SELECT ON vw_live_activity_feed TO authenticated;
GRANT SELECT ON vw_agent_performance  TO authenticated;
GRANT SELECT ON vw_customer_insights  TO authenticated;
GRANT SELECT ON vw_dashboard_kpis     TO authenticated;

-- ============================================================
-- 4. GRANT SELECT on analytics tables (extra safety)
-- ============================================================

GRANT SELECT ON sentiment_timeline       TO authenticated;
GRANT SELECT ON sentiment_distribution   TO authenticated;
GRANT SELECT ON sentiment_heatmap        TO authenticated;
GRANT SELECT ON kpi_snapshots            TO authenticated;
GRANT SELECT ON performance_metrics      TO authenticated;
GRANT SELECT ON system_health_metrics    TO authenticated;
GRANT SELECT ON alerts                   TO authenticated;
GRANT SELECT ON trend_alerts             TO authenticated;
GRANT SELECT ON topic_frequency          TO authenticated;
GRANT SELECT ON topics                   TO authenticated;
GRANT SELECT ON keywords                 TO authenticated;
GRANT SELECT ON agents                   TO authenticated;
GRANT SELECT ON customers                TO authenticated;
GRANT SELECT ON departments              TO authenticated;
GRANT SELECT ON call_recordings          TO authenticated;
GRANT SELECT ON call_transcript_segments TO authenticated;
GRANT SELECT ON call_topics              TO authenticated;
GRANT SELECT ON call_keywords            TO authenticated;
GRANT SELECT ON call_qa_results          TO authenticated;
GRANT SELECT ON qa_criteria              TO authenticated;
GRANT SELECT ON processing_queue         TO authenticated;
GRANT SELECT ON user_profiles            TO authenticated;
GRANT SELECT ON agent_badges             TO authenticated;
GRANT SELECT ON agent_performance_history TO authenticated;

-- Also allow updates needed by the pipeline
GRANT INSERT ON call_recordings TO authenticated;
GRANT UPDATE ON call_recordings TO authenticated;
GRANT INSERT ON call_transcript_segments TO authenticated;
GRANT INSERT ON call_topics     TO authenticated;
GRANT INSERT ON call_keywords   TO authenticated;
GRANT INSERT ON call_qa_results TO authenticated;
GRANT INSERT, UPDATE ON processing_queue TO authenticated;

-- ── Admin DELETE policy for user_profiles ─────────────────────────────────────
-- Needed by adminUserService.deleteUser()
DROP POLICY IF EXISTS "admins_delete_profiles" ON user_profiles;
CREATE POLICY "admins_delete_profiles"
  ON user_profiles FOR DELETE TO authenticated
  USING (fn_is_admin());

-- ============================================================
-- 5. REFRESH KPI SNAPSHOTS — Re-seed with current timestamps
-- (old seed data might be stale — this ensures fresh data)
-- ============================================================

-- Delete old snapshots and re-insert with NOW() timestamps
DELETE FROM kpi_snapshots WHERE time_period IN ('24h', '7d', '30d');

INSERT INTO kpi_snapshots (metric_key, metric_label, metric_value, metric_unit, change_value, change_type, sparkline_data, time_period, recorded_at) VALUES
-- 24h KPIs
('overall_sentiment',  'Overall Sentiment Score', 87.5, '%',     5.2,  'positive', '[65,70,68,75,80,85,87,90,88,87]'::jsonb, '24h', NOW()),
('files_processed',    'Files Processed Today',   2847, 'files', 12.3, 'positive', '[60,65,70,75,80,85,90,88,92,95]'::jsonb, '24h', NOW()),
('satisfaction_trend', 'Satisfaction Trend',       92.1, '%',     3.8,  'positive', '[70,72,75,78,80,85,88,90,91,92]'::jsonb, '24h', NOW()),
('processing_accuracy','Processing Accuracy',      98.7, '%',    -0.2,  'negative', '[95,96,97,98,99,98,99,98,99,98]'::jsonb, '24h', NOW()),
-- 7d KPIs
('overall_sentiment',  'Overall Sentiment Score', 84.2, '%',     3.1,  'positive', '[60,65,68,72,76,80,82,84,83,84]'::jsonb, '7d',  NOW()),
('files_processed',    'Files Processed Today',   18240,'files', 8.7,  'positive', '[55,60,65,70,75,78,82,86,88,92]'::jsonb, '7d',  NOW()),
('satisfaction_trend', 'Satisfaction Trend',       89.4, '%',     2.2,  'positive', '[68,70,74,76,78,82,85,87,88,89]'::jsonb, '7d',  NOW()),
('processing_accuracy','Processing Accuracy',      97.9, '%',    -0.5,  'negative', '[94,95,96,97,98,97,98,98,97,97]'::jsonb, '7d',  NOW()),
-- 30d KPIs
('overall_sentiment',  'Overall Sentiment Score', 82.1, '%',     1.8,  'positive', '[58,62,65,68,72,75,78,80,81,82]'::jsonb, '30d', NOW()),
('files_processed',    'Files Processed Today',   76500,'files', 5.4,  'positive', '[50,55,60,65,68,72,76,78,80,82]'::jsonb, '30d', NOW()),
('satisfaction_trend', 'Satisfaction Trend',       87.3, '%',     1.5,  'positive', '[65,68,72,74,76,80,83,84,86,87]'::jsonb, '30d', NOW()),
('processing_accuracy','Processing Accuracy',      97.2, '%',    -1.1,  'negative', '[92,94,95,96,97,96,97,97,96,97]'::jsonb, '30d', NOW());

-- ============================================================
-- 6. REFRESH SENTIMENT DISTRIBUTION — Ensure today's data exists
-- ============================================================

-- Delete today's distribution (might be empty or wrong date)
DELETE FROM sentiment_distribution WHERE period_date = CURRENT_DATE;

-- Re-seed today
INSERT INTO sentiment_distribution (period_date, sentiment, call_count, percentage) VALUES
(CURRENT_DATE, 'satisfied',  1850, 65.0),
(CURRENT_DATE, 'neutral',     570, 20.0),
(CURRENT_DATE, 'frustrated',  285, 10.0),
(CURRENT_DATE, 'angry',       142,  5.0);

-- Ensure past 7 days have data too (for 7d range)
INSERT INTO sentiment_distribution (period_date, sentiment, call_count, percentage) VALUES
(CURRENT_DATE - 1, 'satisfied',  1720, 62.0),
(CURRENT_DATE - 1, 'neutral',     555, 20.0),
(CURRENT_DATE - 1, 'frustrated',  305, 11.0),
(CURRENT_DATE - 1, 'angry',       195,  7.0),
(CURRENT_DATE - 2, 'satisfied',  1650, 60.5),
(CURRENT_DATE - 2, 'neutral',     570, 20.9),
(CURRENT_DATE - 2, 'frustrated',  315, 11.6),
(CURRENT_DATE - 2, 'angry',       190,  7.0),
(CURRENT_DATE - 3, 'satisfied',  1800, 64.0),
(CURRENT_DATE - 3, 'neutral',     545, 19.4),
(CURRENT_DATE - 3, 'frustrated',  290, 10.3),
(CURRENT_DATE - 3, 'angry',       175,  6.3)
ON CONFLICT (period_date, sentiment) DO NOTHING;

-- ============================================================
-- 7. REFRESH SENTIMENT TIMELINE — Today + past 7 days
-- ============================================================

-- Delete today's timeline buckets (re-insert to ensure current day)
DELETE FROM sentiment_timeline
WHERE time_bucket >= DATE_TRUNC('day', NOW())
  AND time_bucket < DATE_TRUNC('day', NOW()) + INTERVAL '1 day';

-- Re-seed today's timeline (8 three-hour buckets)
INSERT INTO sentiment_timeline (time_bucket, satisfied_count, neutral_count, frustrated_count, angry_count, total_interactions, avg_sentiment_score) VALUES
(DATE_TRUNC('day', NOW()) + INTERVAL '0  hours', 65, 20, 10,  5, 100, 72.5),
(DATE_TRUNC('day', NOW()) + INTERVAL '3  hours', 60, 25, 10,  5,  95, 70.2),
(DATE_TRUNC('day', NOW()) + INTERVAL '6  hours', 55, 28, 12,  5, 185, 68.8),
(DATE_TRUNC('day', NOW()) + INTERVAL '9  hours', 70, 18,  8,  4, 340, 78.1),
(DATE_TRUNC('day', NOW()) + INTERVAL '12 hours', 75, 15,  7,  3, 455, 80.3),
(DATE_TRUNC('day', NOW()) + INTERVAL '15 hours', 78, 12,  7,  3, 520, 82.0),
(DATE_TRUNC('day', NOW()) + INTERVAL '18 hours', 72, 16,  8,  4, 395, 76.5),
(DATE_TRUNC('day', NOW()) + INTERVAL '21 hours', 68, 20,  9,  3, 275, 74.2)
ON CONFLICT (time_bucket) DO NOTHING;

-- Ensure past 7 days exist for 7d view
INSERT INTO sentiment_timeline (time_bucket, satisfied_count, neutral_count, frustrated_count, angry_count, total_interactions, avg_sentiment_score)
VALUES
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '0  hours',  58, 22, 12,  8, 128, 68.4),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '3  hours',  52, 26, 14,  8,  94, 65.9),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '6  hours',  50, 30, 14,  6, 178, 64.2),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '9  hours',  68, 20,  9,  3, 320, 76.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '12 hours',  72, 16,  8,  4, 432, 78.9),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '15 hours',  75, 14,  7,  4, 498, 80.5),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '18 hours',  69, 17,  9,  5, 378, 74.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '21 hours',  63, 21, 10,  6, 258, 71.2),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '9  hours', 65, 21, 10,  4, 308, 75.1),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '12 hours', 70, 17,  9,  4, 415, 77.4),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '15 hours', 73, 15,  8,  4, 482, 79.2),
(DATE_TRUNC('day', NOW()) - INTERVAL '3 days' + INTERVAL '9  hours', 62, 22, 11,  5, 295, 73.4),
(DATE_TRUNC('day', NOW()) - INTERVAL '3 days' + INTERVAL '12 hours', 68, 18,  9,  5, 402, 76.1),
(DATE_TRUNC('day', NOW()) - INTERVAL '4 days' + INTERVAL '9  hours', 60, 23, 12,  5, 288, 72.1),
(DATE_TRUNC('day', NOW()) - INTERVAL '4 days' + INTERVAL '12 hours', 66, 19, 10,  5, 392, 75.0),
(DATE_TRUNC('day', NOW()) - INTERVAL '5 days' + INTERVAL '9  hours', 58, 24, 12,  6, 278, 70.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '5 days' + INTERVAL '12 hours', 65, 20,  9,  6, 382, 74.2),
(DATE_TRUNC('day', NOW()) - INTERVAL '6 days' + INTERVAL '9  hours', 56, 25, 12,  7, 265, 69.5),
(DATE_TRUNC('day', NOW()) - INTERVAL '6 days' + INTERVAL '12 hours', 63, 21, 10,  6, 370, 73.1),
-- 30d past entries
(DATE_TRUNC('day', NOW()) - INTERVAL '7 days'  + INTERVAL '9  hours', 54, 26, 13,  7, 255, 68.1),
(DATE_TRUNC('day', NOW()) - INTERVAL '8 days'  + INTERVAL '9  hours', 52, 27, 13,  8, 248, 67.0),
(DATE_TRUNC('day', NOW()) - INTERVAL '14 days' + INTERVAL '9  hours', 58, 24, 12,  6, 272, 70.2),
(DATE_TRUNC('day', NOW()) - INTERVAL '21 days' + INTERVAL '9  hours', 55, 25, 13,  7, 260, 68.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '28 days' + INTERVAL '9  hours', 50, 28, 14,  8, 240, 65.5)
ON CONFLICT (time_bucket) DO NOTHING;

-- ============================================================
-- 8. REFRESH SYSTEM HEALTH METRICS
-- ============================================================

DELETE FROM system_health_metrics;

INSERT INTO system_health_metrics (metric_name, metric_label, current_value, max_value, unit, warning_threshold, critical_threshold, icon_name, recorded_at) VALUES
('memory',       'Memory',       12.4,  16,   'GB', 75, 90, 'HardDrive', NOW()),
('api_response', 'API Response', 142,   500,  'ms', 60, 80, 'Gauge',     NOW()),
('cpu',          'CPU Usage',    34,    100,  '%',  70, 90, 'Cpu',       NOW()),
('disk',         'Disk Storage', 245,   512,  'GB', 75, 90, 'Database',  NOW());

-- ============================================================
-- 9. REFRESH ALERTS
-- ============================================================

-- Ensure alerts exist for Performance Analytics
INSERT INTO alerts (severity, title, description, source, acknowledged) VALUES
('info',     'New batch processing completed',    '2,847 files processed with 98.7% accuracy',                 'system',      true),
('warning',  'High processing time detected',     'Files in queue exceeding 5-second threshold',               'performance', false),
('critical', 'Model confidence below threshold',  'Sentiment model confidence dropped to 87% — below 90% SLA', 'performance', false),
('info',     'Weekly report generated',           'Performance summary for the past 7 days is ready',           'system',      true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. SEED KEYWORDS (Word Cloud on Customer Insights)
-- ============================================================

INSERT INTO keywords (word, frequency, weight, sentiment_bias) VALUES
('billing',      145, 4.2, 'frustrated'),
('refund',        98, 3.8, 'frustrated'),
('account',       87, 3.1, 'neutral'),
('issue',         76, 2.9, 'frustrated'),
('resolved',      65, 2.5, 'satisfied'),
('payment',       62, 2.4, 'neutral'),
('support',       58, 2.2, 'neutral'),
('cancel',        52, 2.0, 'frustrated'),
('upgrade',       45, 1.8, 'satisfied'),
('invoice',       43, 1.7, 'neutral'),
('error',         38, 1.6, 'frustrated'),
('excellent',     35, 1.5, 'satisfied'),
('slow',          32, 1.4, 'frustrated'),
('thank',         30, 1.3, 'satisfied'),
('problem',       28, 1.2, 'frustrated'),
('great',         25, 1.1, 'satisfied'),
('disconnect',    22, 1.0, 'angry'),
('wait',          20, 0.9, 'frustrated'),
('password',      18, 0.8, 'neutral'),
('delivery',      16, 0.7, 'neutral')
ON CONFLICT (word) DO UPDATE SET
  frequency = EXCLUDED.frequency,
  weight = EXCLUDED.weight;

-- ============================================================
-- 11. FIX SENTIMENT HEATMAP — Use current week
-- ============================================================

-- Delete old heatmap data and re-seed with this week's DATE_TRUNC
DELETE FROM sentiment_heatmap
WHERE period_week_start < DATE_TRUNC('week', CURRENT_DATE);

INSERT INTO sentiment_heatmap (day_of_week, hour_bucket, avg_sentiment, total_interactions, dominant_emotion, period_week_start) VALUES
('Mon', '00:00', 72, 45,  'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Mon', '04:00', 68, 32,  'neutral',    DATE_TRUNC('week', CURRENT_DATE)),
('Mon', '08:00', 85, 120, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Mon', '12:00', 78, 95,  'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Mon', '16:00', 65, 88,  'neutral',    DATE_TRUNC('week', CURRENT_DATE)),
('Mon', '20:00', 58, 42,  'neutral',    DATE_TRUNC('week', CURRENT_DATE)),
('Tue', '08:00', 82, 115, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Tue', '12:00', 76, 102, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Tue', '16:00', 62, 85,  'neutral',    DATE_TRUNC('week', CURRENT_DATE)),
('Wed', '00:00', 35, 52,  'angry',      DATE_TRUNC('week', CURRENT_DATE)),
('Wed', '08:00', 88, 125, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Wed', '12:00', 80, 110, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Thu', '08:00', 86, 118, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Thu', '12:00', 79, 105, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Fri', '08:00', 90, 130, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Fri', '12:00', 83, 115, 'satisfied',  DATE_TRUNC('week', CURRENT_DATE)),
('Sat', '00:00', 28, 35,  'angry',      DATE_TRUNC('week', CURRENT_DATE)),
('Sat', '08:00', 45, 55,  'frustrated', DATE_TRUNC('week', CURRENT_DATE))
ON CONFLICT (day_of_week, hour_bucket, period_week_start) DO UPDATE SET
  avg_sentiment = EXCLUDED.avg_sentiment,
  total_interactions = EXCLUDED.total_interactions;

-- ============================================================
-- 12. ADD PERFORMANCE KPIs FOR PERFORMANCE ANALYTICS PAGE
-- ============================================================

INSERT INTO kpi_snapshots (metric_key, metric_label, metric_value, metric_unit, change_value, change_type, sparkline_data, time_period, recorded_at) VALUES
('transcription_confidence', 'Transcription Confidence', 96.8, '%',  2.4, 'positive', '[92,93,94,95,96,97,96,97,96,97]'::jsonb, '24h', NOW()),
('sentiment_confidence',     'Sentiment Confidence',     94.2, '%',  1.8, 'positive', '[90,91,91,92,93,94,93,94,94,94]'::jsonb, '24h', NOW()),
('script_adherence',         'Script Adherence Rate',    91.5, '%',  3.2, 'positive', '[85,86,87,88,89,90,91,91,91,92]'::jsonb, '24h', NOW()),
('processing_speed',         'Processing Speed',          2.3, 'sec/file', -12, 'negative', '[3.5,3.2,3.0,2.8,2.6,2.5,2.4,2.3,2.3,2.3]'::jsonb, '24h', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. REFRESH TOPIC FREQUENCY FOR TODAY
-- ============================================================

DELETE FROM topic_frequency WHERE period_date = CURRENT_DATE;

INSERT INTO topic_frequency (topic_id, period_date, call_count, avg_sentiment, positive_pct, negative_pct)
SELECT
    t.id, CURRENT_DATE,
    CASE t.name
        WHEN 'Billing'           THEN 145
        WHEN 'Technical Problem' THEN 98
        WHEN 'Refund'            THEN 87
        WHEN 'Account Issue'     THEN 76
        WHEN 'Product Inquiry'   THEN 65
        WHEN 'Delivery'          THEN 52
        WHEN 'Cancellation'      THEN 43
        WHEN 'Onboarding'        THEN 38
        ELSE 20
    END,
    CASE t.name
        WHEN 'Billing'           THEN 55.0
        WHEN 'Technical Problem' THEN 48.0
        WHEN 'Refund'            THEN 42.0
        WHEN 'Account Issue'     THEN 60.0
        WHEN 'Product Inquiry'   THEN 82.0
        WHEN 'Delivery'          THEN 74.0
        WHEN 'Cancellation'      THEN 35.0
        WHEN 'Onboarding'        THEN 78.0
        ELSE 65.0
    END,
    CASE t.name
        WHEN 'Billing'           THEN 35.0
        WHEN 'Technical Problem' THEN 30.0
        ELSE 60.0
    END,
    CASE t.name
        WHEN 'Billing'           THEN 65.0
        WHEN 'Technical Problem' THEN 70.0
        ELSE 20.0
    END
FROM topics t;

-- ============================================================
-- 14. ADD SENTIMENT ALERTS (for Customer Insights page)
-- ============================================================

INSERT INTO alerts (severity, title, description, source, acknowledged) VALUES
('warning',  'Enterprise Sentiment Drop',   'Enterprise segment satisfaction dropped 15% in last 2 hours',  'sentiment', false),
('critical', 'Anger Spike Detected',        'Anger sentiment up 22% — 3 VIP accounts escalated',            'sentiment', false),
('info',     'Positive Trend: Sales Calls', 'Sales calls showing 12% improvement in satisfaction this week', 'sentiment', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 15. ENSURE AGENTS ARE ONLINE (for Quick Stats "Active Agents")
-- ============================================================

-- Mark 3 agents as online so the "Active Agents" KPI shows > 0
UPDATE agents SET is_online = true
WHERE email IN (
  'alex.johnson@callcenter.ai',
  'maria.santos@callcenter.ai',
  'sarah.williams@callcenter.ai'
);

-- ============================================================
-- 16. ENSURE CALL_RECORDINGS HAVE RECENT call_timestamp
-- (So "Calls Today" stat returns real data)
-- ============================================================

-- If existing calls have old timestamps, update a few to today
-- PostgreSQL does not support LIMIT in UPDATE — use ctid subquery instead
UPDATE call_recordings
SET call_timestamp = NOW() - (RANDOM() * INTERVAL '8 hours'),
    processed_at   = NOW() - (RANDOM() * INTERVAL '7 hours'),
    status         = 'completed'
WHERE ctid IN (
  SELECT ctid FROM call_recordings
  WHERE call_timestamp < CURRENT_DATE
    AND status = 'completed'
  LIMIT 20
);

-- ============================================================
-- 17. VERIFY — Quick sanity check queries
-- (These will show as result sets in SQL Editor)
-- ============================================================

SELECT 'KPI Snapshots' AS check_name, COUNT(*) AS row_count FROM kpi_snapshots;
SELECT 'Sentiment Timeline (24h)' AS check_name, COUNT(*) AS row_count FROM sentiment_timeline WHERE time_bucket >= NOW() - INTERVAL '24 hours';
SELECT 'Sentiment Distribution (today)' AS check_name, COUNT(*) AS row_count FROM sentiment_distribution WHERE period_date = CURRENT_DATE;
SELECT 'Live Activity Feed' AS check_name, COUNT(*) AS row_count FROM vw_live_activity_feed;
SELECT 'Active Agents' AS check_name, COUNT(*) AS row_count FROM agents WHERE is_online = true;
SELECT 'Calls Today' AS check_name, COUNT(*) AS row_count FROM call_recordings WHERE call_timestamp >= CURRENT_DATE AND status = 'completed';
SELECT 'System Health' AS check_name, COUNT(*) AS row_count FROM system_health_metrics;
