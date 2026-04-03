-- ============================================================
-- MIGRATION 3: Analytics & Dashboard Schema
-- Aggregations, KPIs, Performance, Alerts, Heatmap, Seed Data
-- Customer Sentiment Analyzer
-- ============================================================

-- ============================================================
-- SENTIMENT TIMELINE (Sentiment Overview chart)
-- Aggregated per 3-hour buckets
-- ============================================================

CREATE TABLE sentiment_timeline (
    id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_bucket        TIMESTAMPTZ NOT NULL,   -- 3-hour bucket: 00:00, 03:00, 06:00...
    satisfied_count    INTEGER     NOT NULL DEFAULT 0,
    neutral_count      INTEGER     NOT NULL DEFAULT 0,
    frustrated_count   INTEGER     NOT NULL DEFAULT 0,
    angry_count        INTEGER     NOT NULL DEFAULT 0,
    total_interactions INTEGER     NOT NULL DEFAULT 0,
    avg_sentiment_score DECIMAL(5,2),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(time_bucket)
);

CREATE INDEX idx_sentiment_timeline_bucket ON sentiment_timeline(time_bucket DESC);

CREATE TRIGGER trg_sentiment_timeline_updated_at
    BEFORE UPDATE ON sentiment_timeline
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- SENTIMENT DISTRIBUTION (Donut chart)
-- ============================================================

CREATE TABLE sentiment_distribution (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_date    DATE        NOT NULL,
    sentiment      sentiment_type NOT NULL,
    call_count     INTEGER     NOT NULL DEFAULT 0,
    percentage     DECIMAL(5,2),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_date, sentiment)
);

CREATE INDEX idx_sent_dist_date      ON sentiment_distribution(period_date DESC);
CREATE INDEX idx_sent_dist_sentiment ON sentiment_distribution(sentiment);

-- ============================================================
-- SENTIMENT HEATMAP (day × hour buckets)
-- ============================================================

CREATE TABLE sentiment_heatmap (
    id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week        TEXT           NOT NULL CHECK (day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
    hour_bucket        TEXT           NOT NULL,  -- '00:00','04:00','08:00','12:00','16:00','20:00'
    avg_sentiment      DECIMAL(5,2)   NOT NULL CHECK (avg_sentiment BETWEEN 0 AND 100),
    total_interactions INTEGER        NOT NULL DEFAULT 0,
    dominant_emotion   sentiment_type,
    period_week_start  DATE           NOT NULL DEFAULT CURRENT_DATE,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE(day_of_week, hour_bucket, period_week_start)
);

CREATE INDEX idx_heatmap_period ON sentiment_heatmap(period_week_start DESC);

CREATE TRIGGER trg_heatmap_updated_at
    BEFORE UPDATE ON sentiment_heatmap
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- KPI SNAPSHOTS (Overview KPI cards)
-- ============================================================

CREATE TABLE kpi_snapshots (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_key      TEXT        NOT NULL,  -- 'overall_sentiment','files_processed','satisfaction_trend','accuracy'
    metric_label    TEXT        NOT NULL,
    metric_value    DECIMAL(12,4) NOT NULL,
    metric_unit     TEXT,                  -- '%', 'files', 'ms', etc.
    change_value    DECIMAL(10,4),
    change_type     TEXT        CHECK (change_type IN ('positive','negative','neutral')),
    sparkline_data  JSONB,                 -- [65, 70, 75, ...] array of recent values
    time_period     TEXT        NOT NULL DEFAULT '24h',
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kpi_metric_key  ON kpi_snapshots(metric_key);
CREATE INDEX idx_kpi_recorded    ON kpi_snapshots(recorded_at DESC);

-- ============================================================
-- PERFORMANCE METRICS (Performance Analytics page)
-- ============================================================

CREATE TABLE performance_metrics (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_bucket          TIMESTAMPTZ NOT NULL,     -- 4-hour bucket
    files_uploaded       INTEGER     NOT NULL DEFAULT 0,
    files_processed      INTEGER     NOT NULL DEFAULT 0,
    files_failed         INTEGER     NOT NULL DEFAULT 0,
    avg_processing_time  DECIMAL(8,3),             -- seconds per file
    avg_accuracy         DECIMAL(5,2),             -- transcription accuracy %
    avg_script_adherence DECIMAL(5,2),             -- script adherence %
    avg_sentiment_conf   DECIMAL(5,2),             -- sentiment confidence %
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(time_bucket)
);

CREATE INDEX idx_perf_metrics_bucket ON performance_metrics(time_bucket DESC);

-- ============================================================
-- SYSTEM HEALTH METRICS (Gauges on Performance page)
-- ============================================================

CREATE TABLE system_health_metrics (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name       TEXT        NOT NULL,   -- 'memory','cpu','api_response','disk'
    metric_label      TEXT        NOT NULL,
    current_value     DECIMAL(10,3) NOT NULL,
    max_value         DECIMAL(10,3) NOT NULL,
    unit              TEXT        NOT NULL,   -- 'GB','%','ms'
    warning_threshold DECIMAL(5,2) NOT NULL DEFAULT 75,  -- % of max
    critical_threshold DECIMAL(5,2) NOT NULL DEFAULT 90, -- % of max
    icon_name         TEXT,                  -- lucide icon name
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sys_health_name     ON system_health_metrics(metric_name);
CREATE INDEX idx_sys_health_recorded ON system_health_metrics(recorded_at DESC);

-- ============================================================
-- ALERTS (System & Sentiment alerts)
-- ============================================================

CREATE TABLE alerts (
    id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    severity         alert_severity NOT NULL DEFAULT 'info',
    title            TEXT           NOT NULL,
    description      TEXT,
    resolution       TEXT,
    source           TEXT           NOT NULL DEFAULT 'system' CHECK (source IN ('system','sentiment','performance','security')),
    related_call_id  UUID           REFERENCES call_recordings(id) ON DELETE SET NULL,
    acknowledged     BOOLEAN        NOT NULL DEFAULT false,
    acknowledged_by  UUID           REFERENCES user_profiles(id) ON DELETE SET NULL,
    acknowledged_at  TIMESTAMPTZ,
    auto_resolved    BOOLEAN        NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_severity    ON alerts(severity);
CREATE INDEX idx_alerts_source      ON alerts(source);
CREATE INDEX idx_alerts_ack         ON alerts(acknowledged);
CREATE INDEX idx_alerts_created     ON alerts(created_at DESC);

CREATE TRIGGER trg_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- TREND ALERTS (Customer Insights — TrendAlertWidget)
-- ============================================================

CREATE TABLE trend_alerts (
    id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type      TEXT           NOT NULL,   -- 'sentiment_drop','volume_spike','keyword_surge'
    title           TEXT           NOT NULL,
    description     TEXT,
    severity        alert_severity NOT NULL DEFAULT 'info',
    metric_value    DECIMAL(12,4),
    threshold_value DECIMAL(12,4),
    related_topic   TEXT,
    related_segment TEXT,
    is_active       BOOLEAN        NOT NULL DEFAULT true,
    detected_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trend_alerts_type     ON trend_alerts(alert_type);
CREATE INDEX idx_trend_alerts_severity ON trend_alerts(severity);
CREATE INDEX idx_trend_alerts_detected ON trend_alerts(detected_at DESC);
CREATE INDEX idx_trend_alerts_active   ON trend_alerts(is_active);

-- ============================================================
-- TOPIC FREQUENCY (Topic Bubble Chart data)
-- ============================================================

CREATE TABLE topic_frequency (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id         UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    period_date      DATE        NOT NULL,
    call_count       INTEGER     NOT NULL DEFAULT 0,
    avg_sentiment    DECIMAL(5,2),
    positive_pct     DECIMAL(5,2),
    negative_pct     DECIMAL(5,2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(topic_id, period_date)
);

CREATE INDEX idx_topic_freq_topic  ON topic_frequency(topic_id);
CREATE INDEX idx_topic_freq_period ON topic_frequency(period_date DESC);

-- ============================================================
-- RLS for analytics tables
-- ============================================================

ALTER TABLE sentiment_timeline     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_heatmap      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_frequency        ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read analytics
CREATE POLICY "auth_read_timeline"     ON sentiment_timeline     FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_distribution" ON sentiment_distribution FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_heatmap"      ON sentiment_heatmap      FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_kpi"          ON kpi_snapshots          FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_performance"  ON performance_metrics     FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_system"       ON system_health_metrics   FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_alerts"       ON alerts                  FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_trend_alerts" ON trend_alerts            FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "auth_read_topic_freq"   ON topic_frequency         FOR SELECT TO authenticated USING (fn_is_authenticated_user());

-- Only admins can write analytics data
CREATE POLICY "admins_manage_timeline"     ON sentiment_timeline     FOR ALL TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_manage_distribution" ON sentiment_distribution FOR ALL TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_manage_heatmap"      ON sentiment_heatmap      FOR ALL TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_manage_kpi"          ON kpi_snapshots          FOR ALL TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_manage_performance"  ON performance_metrics     FOR ALL TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_manage_system"       ON system_health_metrics   FOR ALL TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_manage_alerts"       ON alerts                  FOR ALL TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_manage_trend_alerts" ON trend_alerts            FOR ALL TO authenticated USING (fn_is_admin());

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Live activity feed (Sentiment Overview)
CREATE OR REPLACE VIEW vw_live_activity_feed AS
SELECT
    cr.id,
    cr.call_ref,
    c.full_name     AS customer,
    c.customer_ref  AS customer_id,
    cr.sentiment,
    cr.sentiment_confidence AS confidence,
    cr.call_timestamp AS timestamp,
    cr.duration_seconds,
    cr.status,
    cr.interaction_type,
    a.name          AS agent_name,
    (SELECT message FROM call_transcript_segments
     WHERE call_id = cr.id ORDER BY segment_index LIMIT 1) AS first_message
FROM call_recordings cr
LEFT JOIN customers c ON cr.customer_id = c.id
LEFT JOIN agents a    ON cr.agent_id = a.id
ORDER BY cr.call_timestamp DESC;

-- Agent performance summary
CREATE OR REPLACE VIEW vw_agent_performance AS
SELECT
    a.id,
    a.name,
    a.role_title,
    a.email,
    a.avatar_url,
    a.is_online,
    a.last_seen,
    d.name          AS department,
    d.code          AS department_code,
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
LEFT JOIN departments d ON a.department_id = d.id;

-- Customer insights summary
CREATE OR REPLACE VIEW vw_customer_insights AS
SELECT
    c.id,
    c.customer_ref,
    COALESCE(c.company_name, c.full_name) AS customer_name,
    c.segment,
    c.sentiment_score         AS sentiment,
    c.dominant_emotion        AS emotion,
    c.sentiment_trend         AS trend,
    c.sentiment_trend_pct     AS trend_value,
    c.total_interactions      AS interactions,
    c.last_interaction_at,
    c.satisfaction_score,
    c.avg_response_time,
    (SELECT interaction_type FROM call_recordings
     WHERE customer_id = c.id ORDER BY call_timestamp DESC LIMIT 1) AS last_interaction_type
FROM customers c
ORDER BY c.last_interaction_at DESC NULLS LAST;

-- Dashboard KPI summary (latest snapshot per metric)
CREATE OR REPLACE VIEW vw_dashboard_kpis AS
SELECT DISTINCT ON (metric_key)
    metric_key,
    metric_label,
    metric_value,
    metric_unit,
    change_value,
    change_type,
    sparkline_data,
    time_period,
    recorded_at
FROM kpi_snapshots
ORDER BY metric_key, recorded_at DESC;

-- ============================================================
-- SEED DATA — Sample data for immediate dashboard use
-- ============================================================

-- Sample customers
INSERT INTO customers (customer_ref, full_name, company_name, segment, sentiment_score, dominant_emotion, sentiment_trend, sentiment_trend_pct, total_interactions, satisfaction_score, avg_response_time, last_interaction_at) VALUES
('CUST-2847', 'Sarah Mitchell',  'Acme Corporation',       'enterprise', 28,  'angry',      'down',   -15, 24, 2.1, 2.5, NOW() - INTERVAL '2 hours'),
('CUST-2846', 'James Rodriguez', 'TechStart Inc.',         'smb',        85,  'satisfied',  'up',      12, 18, 4.5, 1.2, NOW() - INTERVAL '5 hours'),
('CUST-2845', 'Emily Chen',      'Global Solutions Ltd.',  'enterprise', 72,  'satisfied',  'stable',   2, 32, 3.8, 3.1, NOW() - INTERVAL '8 hours'),
('CUST-2844', 'Michael Thompson','Innovation Labs',        'smb',        38,  'frustrated', 'down',    -8, 15, 2.5, 4.2, NOW() - INTERVAL '10 hours'),
('CUST-2843', 'Lisa Anderson',   'Digital Ventures',       'individual', 92,  'satisfied',  'up',      18,  8, 4.8, 0.8, NOW() - INTERVAL '12 hours'),
('CUST-2842', 'David Park',      'Enterprise Systems Co.', 'enterprise', 22,  'angry',      'down',   -22, 45, 1.8, 5.5, NOW() - INTERVAL '15 hours'),
('CUST-2841', 'Jennifer White',  'CloudTech Partners',     'smb',        78,  'satisfied',  'up',       6, 22, 4.1, 2.0, NOW() - INTERVAL '20 hours'),
('CUST-2840', 'Robert Taylor',   'StartupHub Inc.',        'individual', 65,  'neutral',    'stable',   1, 12, 3.5, 1.5, NOW() - INTERVAL '1 day'),
('CUST-2839', 'Amanda Garcia',   'MegaCorp Industries',    'enterprise', 88,  'satisfied',  'up',      14, 38, 4.6, 1.8, NOW() - INTERVAL '2 days'),
('CUST-2838', 'Kevin Martinez',  'SmallBiz Solutions',     'smb',        45,  'frustrated', 'down',    -5, 19, 2.8, 3.5, NOW() - INTERVAL '2 days');

-- KPI snapshots
INSERT INTO kpi_snapshots (metric_key, metric_label, metric_value, metric_unit, change_value, change_type, sparkline_data, time_period) VALUES
('overall_sentiment',  'Overall Sentiment Score', 87.5, '%',     5.2,  'positive', '[65,70,68,75,80,85,87,90,88,87]'::jsonb, '24h'),
('files_processed',    'Files Processed Today',   2847, 'files', 12.3, 'positive', '[60,65,70,75,80,85,90,88,92,95]'::jsonb, '24h'),
('satisfaction_trend', 'Satisfaction Trend',       92.1, '%',     3.8,  'positive', '[70,72,75,78,80,85,88,90,91,92]'::jsonb, '24h'),
('processing_accuracy','Processing Accuracy',      98.7, '%',    -0.2,  'negative', '[95,96,97,98,99,98,99,98,99,98]'::jsonb, '24h');

-- Sentiment timeline (today)
INSERT INTO sentiment_timeline (time_bucket, satisfied_count, neutral_count, frustrated_count, angry_count, total_interactions, avg_sentiment_score) VALUES
(DATE_TRUNC('day', NOW()) + INTERVAL '0  hours', 65, 20, 10,  5, 145, 72.5),
(DATE_TRUNC('day', NOW()) + INTERVAL '3  hours', 60, 25, 10,  5,  98, 70.2),
(DATE_TRUNC('day', NOW()) + INTERVAL '6  hours', 55, 28, 12,  5, 187, 68.8),
(DATE_TRUNC('day', NOW()) + INTERVAL '9  hours', 70, 18,  8,  4, 342, 78.1),
(DATE_TRUNC('day', NOW()) + INTERVAL '12 hours', 75, 15,  7,  3, 456, 80.3),
(DATE_TRUNC('day', NOW()) + INTERVAL '15 hours', 78, 12,  7,  3, 523, 82.0),
(DATE_TRUNC('day', NOW()) + INTERVAL '18 hours', 72, 16,  8,  4, 398, 76.5),
(DATE_TRUNC('day', NOW()) + INTERVAL '21 hours', 68, 20,  9,  3, 276, 74.2);

-- Sentiment distribution (today)
INSERT INTO sentiment_distribution (period_date, sentiment, call_count, percentage) VALUES
(CURRENT_DATE, 'satisfied',  1850, 65.0),
(CURRENT_DATE, 'neutral',     570, 20.0),
(CURRENT_DATE, 'frustrated',  285, 10.0),
(CURRENT_DATE, 'angry',       142,  5.0);

-- Sentiment heatmap (current week)
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
('Sat', '08:00', 45, 55,  'frustrated', DATE_TRUNC('week', CURRENT_DATE));

-- Performance metrics
INSERT INTO performance_metrics (time_bucket, files_uploaded, files_processed, avg_processing_time, avg_accuracy, avg_script_adherence, avg_sentiment_conf) VALUES
(DATE_TRUNC('day', NOW()) + INTERVAL '0  hours', 156, 145, 2.3, 96.2, 89.5, 94.1),
(DATE_TRUNC('day', NOW()) + INTERVAL '4  hours',  95,  89, 2.1, 96.5, 90.2, 94.5),
(DATE_TRUNC('day', NOW()) + INTERVAL '8  hours', 342, 312, 2.4, 95.8, 88.7, 93.8),
(DATE_TRUNC('day', NOW()) + INTERVAL '12 hours', 468, 428, 2.2, 96.1, 91.8, 94.2),
(DATE_TRUNC('day', NOW()) + INTERVAL '16 hours', 421, 389, 2.3, 96.9, 92.4, 94.8),
(DATE_TRUNC('day', NOW()) + INTERVAL '20 hours', 289, 267, 2.1, 97.2, 93.1, 95.0);

-- System health metrics
INSERT INTO system_health_metrics (metric_name, metric_label, current_value, max_value, unit, warning_threshold, critical_threshold, icon_name) VALUES
('memory',       'Memory',       12.4,  16,   'GB', 75, 90, 'HardDrive'),
('api_response', 'API Response', 142,   500,  'ms', 60, 80, 'Gauge'),
('cpu',          'CPU Usage',    34,    100,  '%',  70, 90, 'Cpu'),
('disk',         'Disk Storage', 245,   512,  'GB', 75, 90, 'Database');

-- Trend alerts
INSERT INTO trend_alerts (alert_type, title, description, severity, metric_value, threshold_value, is_active) VALUES
('sentiment_drop', 'Sentiment Drop Detected',      'Enterprise segment satisfaction dropped 15% in last 2 hours',  'warning',  65,   75,  true),
('volume_spike',   'Unusual Call Volume Spike',    'Call volume 40% above normal for this time period',            'info',     523,  375, true),
('keyword_surge',  'Negative Keyword Surge',       '"Billing error" mentioned 3x more than baseline today',        'warning',  45,   15,  true),
('sentiment_drop', 'Critical Sentiment Alert',     'Customer anger score exceeded critical threshold in Wed 00:00', 'critical', 28,   40,  true);

-- System alerts
INSERT INTO alerts (severity, title, description, source, acknowledged) VALUES
('info',     'New batch processing completed',    '2,847 files processed with 98.7% accuracy',                'system',      true),
('warning',  'High processing time detected',     'Files in queue exceeding 5-second threshold',              'performance', false),
('critical', 'Model confidence below threshold',  'Sentiment model confidence dropped to 87% — below 90% SLA', 'performance', false),
('info',     'Weekly report generated',           'Performance summary for the past 7 days is ready',          'system',      true);

-- Topic frequency (today)
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
FROM topics t
WHERE t.name IN ('Billing','Technical Problem','Refund','Account Issue','Product Inquiry','Delivery','Cancellation','Onboarding');
