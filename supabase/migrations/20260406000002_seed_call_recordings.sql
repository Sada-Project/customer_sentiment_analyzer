-- ============================================================
-- MIGRATION: Seed Call Recordings + Multi-Period Analytics Data
-- Fixes the Live Activity Feed & multi-period chart data
-- Customer Sentiment Analyzer
-- ============================================================

-- ============================================================
-- 1. SEED AGENTS (needed for call recordings)
-- ============================================================

INSERT INTO agents (name, email, role_title, department_id, is_online, performance_score, csat_score, tickets_solved_total, fcr_rate, avg_handle_time)
SELECT
    a.name, a.email, a.role_title, d.id, a.is_online,
    a.performance_score, a.csat_score, a.tickets_solved, a.fcr_rate, a.handle_time
FROM (VALUES
    ('Alex Johnson',   'alex.johnson@callcenter.ai',   'Senior Support Agent',     'support',   true,  88.5, 91.2, 342, 78.4, 8.2),
    ('Maria Santos',   'maria.santos@callcenter.ai',   'Technical Specialist',     'technical', true,  92.3, 94.1, 289, 82.1, 7.5),
    ('David Kim',      'david.kim@callcenter.ai',      'Billing Specialist',       'billing',   false, 85.1, 88.7, 421, 75.3, 9.1),
    ('Sarah Williams', 'sarah.williams@callcenter.ai', 'Sales Representative',     'sales',     true,  79.8, 83.5, 198, 71.2, 11.3),
    ('James Cooper',   'james.cooper@callcenter.ai',   'Support Agent',            'support',   false, 76.4, 80.1, 156, 68.9, 10.8)
) AS a(name, email, role_title, dept_code, is_online, performance_score, csat_score, tickets_solved, fcr_rate, handle_time)
JOIN departments d ON d.code = a.dept_code
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 2. SEED CALL RECORDINGS
-- ============================================================

-- Recent completed calls  (past 24h, linked to seeded customers)
INSERT INTO call_recordings (
    customer_id, agent_id,
    file_name, file_format, file_size_bytes, duration_seconds,
    sentiment, sentiment_score, sentiment_confidence,
    interaction_type, status,
    call_timestamp, processed_at,
    agent_talk_pct, customer_talk_pct,
    script_adherence_score, transcription_confidence,
    ai_summary, transcript_text
)
SELECT
    c.id,
    (SELECT id FROM agents ORDER BY RANDOM() LIMIT 1),
    'call_' || c.customer_ref || '_' || TO_CHAR(c.last_interaction_at, 'YYYYMMDD') || '.mp3',
    'mp3',
    (1200000 + (FLOOR(RANDOM() * 4000000)))::bigint,
    (120 + (FLOOR(RANDOM() * 600)))::int,
    c.dominant_emotion,
    c.sentiment_score::decimal,
    (80 + (FLOOR(RANDOM() * 18)))::decimal,
    CASE (FLOOR(RANDOM() * 5))::int
        WHEN 0 THEN 'support_call'
        WHEN 1 THEN 'sales_call'
        WHEN 2 THEN 'feedback_session'
        WHEN 3 THEN 'onboarding_call'
        ELSE 'follow_up'
    END,
    'completed',
    c.last_interaction_at,
    c.last_interaction_at + INTERVAL '4 minutes',
    (42 + (FLOOR(RANDOM() * 22)))::decimal,
    (38 + (FLOOR(RANDOM() * 22)))::decimal,
    (74 + (FLOOR(RANDOM() * 25)))::decimal,
    (87 + (FLOOR(RANDOM() * 12)))::decimal,
    CASE c.dominant_emotion
        WHEN 'satisfied'  THEN 'Customer expressed high satisfaction with the service. Issue was resolved on first contact. No follow-up required.'
        WHEN 'neutral'    THEN 'Standard inquiry handled according to protocol. Customer was informed of next steps. Ticket closed.'
        WHEN 'frustrated' THEN 'Customer expressed dissatisfaction with wait times. Agent provided workaround and escalated priority. Follow-up scheduled.'
        WHEN 'angry'      THEN 'High-priority escalation. Customer reported critical account issue. Escalated to tier-2 team. Supervisor notified.'
    END,
    CASE c.dominant_emotion
        WHEN 'satisfied'  THEN 'Agent: Thank you for calling, how can I help you today? Customer: Everything has been great, I just wanted to confirm my renewal. Agent: Absolutely, let me pull up your account. Your renewal is confirmed for next month.'
        WHEN 'neutral'    THEN 'Agent: Good afternoon, Customer Support. How may I assist you? Customer: I have a question about my billing cycle date. Agent: I can help with that. Let me check your account details right away.'
        WHEN 'frustrated' THEN 'Agent: I understand your frustration and I sincerely apologize. Customer: This is the third time I am calling about the same issue. Nothing gets fixed! Agent: I completely understand, let me escalate this right now and make sure it gets resolved today.'
        WHEN 'angry'      THEN 'Agent: I am very sorry for this experience. Customer: This is completely unacceptable! My account has been locked for two days! Agent: I hear you and I am treating this as an urgent priority. I am escalating to our senior team immediately.'
    END
FROM customers c
ON CONFLICT DO NOTHING;

-- One call currently processing
INSERT INTO call_recordings (
    customer_id, file_name, file_format, file_size_bytes, duration_seconds,
    sentiment, sentiment_score, sentiment_confidence,
    interaction_type, status, call_timestamp, processing_started_at
)
SELECT
    c.id,
    'call_live_processing_001.mp3',
    'mp3',
    2384920,
    0,
    NULL, NULL, NULL,
    'support_call',
    'processing',
    NOW() - INTERVAL '3 minutes',
    NOW() - INTERVAL '1 minute'
FROM customers c
WHERE c.customer_ref = 'CUST-2847'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. SEED TRANSCRIPT SEGMENTS for the 5 most recent calls
-- ============================================================

-- First turn (agent greeting) for each of the 5 most recent completed calls
INSERT INTO call_transcript_segments (call_id, segment_index, speaker, message, sentiment, timestamp_offset)
SELECT
    cr.id, 0, 'agent',
    'Thank you for calling Customer Support. My name is ' ||
        (SELECT name FROM agents ORDER BY RANDOM() LIMIT 1) ||
        '. How may I assist you today?',
    'neutral',
    '00:00'
FROM call_recordings cr
WHERE cr.status = 'completed'
ORDER BY cr.call_timestamp DESC
LIMIT 5
ON CONFLICT (call_id, segment_index) DO NOTHING;

-- Second turn (customer opening) based on sentiment
INSERT INTO call_transcript_segments (call_id, segment_index, speaker, message, sentiment, timestamp_offset)
SELECT
    cr.id, 1, 'customer',
    CASE c.dominant_emotion
        WHEN 'satisfied'  THEN 'Hi, yes! I just wanted to check on my account subscription renewal. Everything has been working so well lately, I am very happy with the service.'
        WHEN 'neutral'    THEN 'Hello. I have a question about the billing date on my account. I noticed it changed last month and I want to understand why.'
        WHEN 'frustrated' THEN 'Yes. I have been calling about this same issue for the third time now. Every time I call someone tells me something different and nothing gets resolved.'
        WHEN 'angry'      THEN 'Finally someone answered! I have been on hold for 20 minutes and my account has been completely locked for 2 days. This is completely unacceptable!'
    END,
    c.dominant_emotion::sentiment_type,
    '00:14'
FROM call_recordings cr
JOIN customers c ON cr.customer_id = c.id
WHERE cr.status = 'completed'
ORDER BY cr.call_timestamp DESC
LIMIT 5
ON CONFLICT (call_id, segment_index) DO NOTHING;

-- Third turn (agent response)
INSERT INTO call_transcript_segments (call_id, segment_index, speaker, message, sentiment, timestamp_offset)
SELECT
    cr.id, 2, 'agent',
    CASE c.dominant_emotion
        WHEN 'satisfied'  THEN 'I am so glad to hear that! I can confirm your subscription is active and your renewal is scheduled for next month. Is there anything else I can help you with?'
        WHEN 'neutral'    THEN 'Of course, I can certainly look into that for you. Let me pull up your account details. Can you confirm your customer reference number for me?'
        WHEN 'frustrated' THEN 'I completely understand your frustration and I sincerely apologize for the inconvenience. I am going to personally ensure this gets resolved today. Let me review your full case history right now.'
        WHEN 'angry'      THEN 'I am very sorry for this unacceptable experience. I understand how critical this is for you. I am escalating your case to our senior support team immediately and setting this as highest priority.'
    END,
    'neutral'::sentiment_type,
    '00:45'
FROM call_recordings cr
JOIN customers c ON cr.customer_id = c.id
WHERE cr.status = 'completed'
ORDER BY cr.call_timestamp DESC
LIMIT 5
ON CONFLICT (call_id, segment_index) DO NOTHING;

-- ============================================================
-- 4. KPI SNAPSHOTS FOR 7d and 30d periods
-- ============================================================

INSERT INTO kpi_snapshots (metric_key, metric_label, metric_value, metric_unit, change_value, change_type, sparkline_data, time_period) VALUES
-- 7-day KPIs
('overall_sentiment',  'Overall Sentiment Score', 84.2, '%',     3.1,  'positive', '[60,65,68,72,76,80,82,84,83,84]'::jsonb, '7d'),
('files_processed',    'Files Processed Today',   18240, 'files', 8.7, 'positive', '[55,60,65,70,75,78,82,86,88,92]'::jsonb, '7d'),
('satisfaction_trend', 'Satisfaction Trend',       89.4, '%',     2.2,  'positive', '[68,70,74,76,78,82,85,87,88,89]'::jsonb, '7d'),
('processing_accuracy','Processing Accuracy',      97.9, '%',    -0.5,  'negative', '[94,95,96,97,98,97,98,98,97,97]'::jsonb, '7d'),
-- 30-day KPIs
('overall_sentiment',  'Overall Sentiment Score', 82.1, '%',     1.8,  'positive', '[58,62,65,68,72,75,78,80,81,82]'::jsonb, '30d'),
('files_processed',    'Files Processed Today',   76500, 'files', 5.4, 'positive', '[50,55,60,65,68,72,76,78,80,82]'::jsonb, '30d'),
('satisfaction_trend', 'Satisfaction Trend',       87.3, '%',     1.5,  'positive', '[65,68,72,74,76,80,83,84,86,87]'::jsonb, '30d'),
('processing_accuracy','Processing Accuracy',      97.2, '%',    -1.1,  'negative', '[92,94,95,96,97,96,97,97,96,97]'::jsonb, '30d');

-- ============================================================
-- 5. SENTIMENT TIMELINE — past 7 days (daily 3h buckets)
-- ============================================================

INSERT INTO sentiment_timeline (time_bucket, satisfied_count, neutral_count, frustrated_count, angry_count, total_interactions, avg_sentiment_score)
VALUES
-- Yesterday
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '0  hours', 58, 22, 12,  8, 128, 68.4),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '3  hours', 52, 26, 14,  8,  94, 65.9),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '6  hours', 50, 30, 14,  6, 178, 64.2),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '9  hours', 68, 20,  9,  3, 320, 76.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '12 hours', 72, 16,  8,  4, 432, 78.9),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '15 hours', 75, 14,  7,  4, 498, 80.5),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '18 hours', 69, 17,  9,  5, 378, 74.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '1 day' + INTERVAL '21 hours', 63, 21, 10,  6, 258, 71.2),
-- 2 days ago
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '0  hours', 55, 24, 13,  8, 110, 66.5),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '6  hours', 48, 28, 15,  9, 165, 62.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '9  hours', 65, 21, 10,  4, 308, 75.1),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '12 hours', 70, 17,  9,  4, 415, 77.4),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '15 hours', 73, 15,  8,  4, 482, 79.2),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '18 hours', 66, 18, 10,  6, 364, 72.9),
(DATE_TRUNC('day', NOW()) - INTERVAL '2 days' + INTERVAL '21 hours', 60, 23, 11,  6, 245, 69.8),
-- 3 days ago
(DATE_TRUNC('day', NOW()) - INTERVAL '3 days' + INTERVAL '9  hours', 62, 22, 11,  5, 295, 73.4),
(DATE_TRUNC('day', NOW()) - INTERVAL '3 days' + INTERVAL '12 hours', 68, 18,  9,  5, 402, 76.1),
(DATE_TRUNC('day', NOW()) - INTERVAL '3 days' + INTERVAL '15 hours', 71, 15,  9,  5, 465, 78.3),
-- 4 days ago
(DATE_TRUNC('day', NOW()) - INTERVAL '4 days' + INTERVAL '9  hours', 60, 23, 12,  5, 288, 72.1),
(DATE_TRUNC('day', NOW()) - INTERVAL '4 days' + INTERVAL '12 hours', 66, 19, 10,  5, 392, 75.0),
(DATE_TRUNC('day', NOW()) - INTERVAL '4 days' + INTERVAL '15 hours', 69, 16,  9,  6, 452, 77.0),
-- 5 days ago
(DATE_TRUNC('day', NOW()) - INTERVAL '5 days' + INTERVAL '9  hours', 58, 24, 12,  6, 278, 70.8),
(DATE_TRUNC('day', NOW()) - INTERVAL '5 days' + INTERVAL '12 hours', 65, 20,  9,  6, 382, 74.2),
-- 6 days ago
(DATE_TRUNC('day', NOW()) - INTERVAL '6 days' + INTERVAL '9  hours', 56, 25, 12,  7, 265, 69.5),
(DATE_TRUNC('day', NOW()) - INTERVAL '6 days' + INTERVAL '12 hours', 63, 21, 10,  6, 370, 73.1)
ON CONFLICT (time_bucket) DO NOTHING;

-- ============================================================
-- 6. SENTIMENT DISTRIBUTION — past 7 days
-- ============================================================

INSERT INTO sentiment_distribution (period_date, sentiment, call_count, percentage) VALUES
-- Yesterday
(CURRENT_DATE - 1, 'satisfied',  1720, 62.0),
(CURRENT_DATE - 1, 'neutral',     555, 20.0),
(CURRENT_DATE - 1, 'frustrated',  305, 11.0),
(CURRENT_DATE - 1, 'angry',       195,  7.0),
-- 2 days ago
(CURRENT_DATE - 2, 'satisfied',  1650, 60.5),
(CURRENT_DATE - 2, 'neutral',     570, 20.9),
(CURRENT_DATE - 2, 'frustrated',  315, 11.6),
(CURRENT_DATE - 2, 'angry',       190,  7.0),
-- 3 days ago
(CURRENT_DATE - 3, 'satisfied',  1800, 64.0),
(CURRENT_DATE - 3, 'neutral',     545, 19.4),
(CURRENT_DATE - 3, 'frustrated',  290, 10.3),
(CURRENT_DATE - 3, 'angry',       175,  6.3),
-- 4 days ago
(CURRENT_DATE - 4, 'satisfied',  1780, 63.2),
(CURRENT_DATE - 4, 'neutral',     558, 19.8),
(CURRENT_DATE - 4, 'frustrated',  300, 10.6),
(CURRENT_DATE - 4, 'angry',       180,  6.4),
-- 5 days ago
(CURRENT_DATE - 5, 'satisfied',  1710, 61.8),
(CURRENT_DATE - 5, 'neutral',     568, 20.5),
(CURRENT_DATE - 5, 'frustrated',  308, 11.1),
(CURRENT_DATE - 5, 'angry',       182,  6.6),
-- 6 days ago
(CURRENT_DATE - 6, 'satisfied',  1690, 61.2),
(CURRENT_DATE - 6, 'neutral',     575, 20.8),
(CURRENT_DATE - 6, 'frustrated',  312, 11.3),
(CURRENT_DATE - 6, 'angry',       186,  6.7)
ON CONFLICT (period_date, sentiment) DO NOTHING;

-- ============================================================
-- 7. AGENT BADGES
-- ============================================================

INSERT INTO agent_badges (agent_id, badge, label)
SELECT a.id, 'top_performer'::badge_type, 'Top Performer'
FROM agents a WHERE a.email = 'maria.santos@callcenter.ai'
ON CONFLICT (agent_id, badge) DO NOTHING;

INSERT INTO agent_badges (agent_id, badge, label)
SELECT a.id, 'customer_champion'::badge_type, 'Customer Champion'
FROM agents a WHERE a.email = 'alex.johnson@callcenter.ai'
ON CONFLICT (agent_id, badge) DO NOTHING;

INSERT INTO agent_badges (agent_id, badge, label)
SELECT a.id, 'fastest_resolver'::badge_type, 'Fastest Resolver'
FROM agents a WHERE a.email = 'maria.santos@callcenter.ai'
ON CONFLICT (agent_id, badge) DO NOTHING;

-- ============================================================
-- 8. AGENT PERFORMANCE HISTORY (for trend charts)
-- ============================================================

INSERT INTO agent_performance_history (agent_id, period_date, tickets_solved, fcr_rate, avg_handle_time, performance_score, csat_score)
SELECT
    a.id,
    CURRENT_DATE - d.days,
    (30 + (FLOOR(RANDOM() * 25)))::int,
    (70 + (FLOOR(RANDOM() * 25)))::decimal,
    (7 + (RANDOM() * 5))::decimal,
    (78 + (FLOOR(RANDOM() * 18)))::decimal,
    (82 + (FLOOR(RANDOM() * 16)))::decimal
FROM agents a
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS d(days)
ON CONFLICT (agent_id, period_date) DO NOTHING;

