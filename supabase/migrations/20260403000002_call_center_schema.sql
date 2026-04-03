-- ============================================================
-- MIGRATION 2: Call Center Schema
-- call_recordings, transcripts, topics, keywords, QA
-- Customer Sentiment Analyzer
-- ============================================================

-- ============================================================
-- CALL RECORDINGS (Core fact table)
-- ============================================================

CREATE TABLE call_recordings (
    id                    UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_ref              TEXT             UNIQUE,             -- Auto-generated e.g. 'CALL-20260101-001'
    customer_id           UUID             REFERENCES customers(id) ON DELETE SET NULL,
    agent_id              UUID             REFERENCES agents(id) ON DELETE SET NULL,
    -- File info
    file_name             TEXT,
    file_format           file_format,
    file_size_bytes       BIGINT,
    duration_seconds      INTEGER,                            -- in seconds
    -- Sentiment analysis
    sentiment             sentiment_type,
    sentiment_score       DECIMAL(5,2)     CHECK (sentiment_score BETWEEN 0 AND 100),
    sentiment_confidence  DECIMAL(5,2)     CHECK (sentiment_confidence BETWEEN 0 AND 100),
    -- Interaction info
    interaction_type      interaction_type NOT NULL DEFAULT 'support_call',
    -- Talk ratio
    agent_talk_pct        DECIMAL(5,2)     CHECK (agent_talk_pct BETWEEN 0 AND 100),
    customer_talk_pct     DECIMAL(5,2)     CHECK (customer_talk_pct BETWEEN 0 AND 100),
    -- AI analysis
    ai_summary            TEXT,
    script_adherence_score DECIMAL(5,2)   CHECK (script_adherence_score BETWEEN 0 AND 100),
    transcription_confidence DECIMAL(5,2) CHECK (transcription_confidence BETWEEN 0 AND 100),
    -- Processing
    status                call_status      NOT NULL DEFAULT 'pending',
    call_timestamp        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    processing_started_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,        -- How long to process in ms
    processed_at          TIMESTAMPTZ,
    error_message         TEXT,
    -- Metadata
    created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_rec_customer    ON call_recordings(customer_id);
CREATE INDEX idx_call_rec_agent       ON call_recordings(agent_id);
CREATE INDEX idx_call_rec_sentiment   ON call_recordings(sentiment);
CREATE INDEX idx_call_rec_status      ON call_recordings(status);
CREATE INDEX idx_call_rec_timestamp   ON call_recordings(call_timestamp DESC);
CREATE INDEX idx_call_rec_interaction ON call_recordings(interaction_type);

-- Auto-generate call_ref
CREATE OR REPLACE FUNCTION fn_generate_call_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.call_ref = 'CALL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                   LPAD(nextval('call_ref_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$;

CREATE SEQUENCE call_ref_seq START 1;

CREATE TRIGGER trg_call_recordings_ref
    BEFORE INSERT ON call_recordings
    FOR EACH ROW WHEN (NEW.call_ref IS NULL)
    EXECUTE FUNCTION fn_generate_call_ref();

CREATE TRIGGER trg_call_recordings_updated_at
    BEFORE UPDATE ON call_recordings
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- CALL TRANSCRIPT SEGMENTS (per-turn conversation)
-- ============================================================

CREATE TABLE call_transcript_segments (
    id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id          UUID           NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE,
    segment_index    INTEGER        NOT NULL,    -- Turn order: 0,1,2,...
    speaker          TEXT           NOT NULL CHECK (speaker IN ('agent','customer')),
    message          TEXT           NOT NULL,
    sentiment        sentiment_type,
    timestamp_offset TEXT,          -- e.g. '00:35' from call start
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcript_call    ON call_transcript_segments(call_id);
CREATE INDEX idx_transcript_speaker ON call_transcript_segments(speaker);
CREATE UNIQUE INDEX idx_transcript_order ON call_transcript_segments(call_id, segment_index);

-- ============================================================
-- TOPICS (Smart Topics / Topic Bubble Chart)
-- ============================================================

CREATE TABLE topics (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT    NOT NULL UNIQUE,
    category    TEXT,   -- 'billing','technical','service','product'
    color       TEXT,   -- hex color for bubble chart
    icon_name   TEXT,   -- lucide icon name
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_topics_category ON topics(category);

-- Pre-seed common topics
INSERT INTO topics (name, category, color, icon_name) VALUES
    ('Billing',            'billing',   '#3B82F6', 'DollarSign'),
    ('Refund',             'billing',   '#6366F1', 'RefreshCw'),
    ('Account Issue',      'account',   '#F59E0B', 'AlertCircle'),
    ('Technical Problem',  'technical', '#EF4444', 'Wrench'),
    ('Product Inquiry',    'product',   '#10B981', 'Package'),
    ('Delivery',           'logistics', '#8B5CF6', 'Truck'),
    ('Cancellation',       'account',   '#F97316', 'XCircle'),
    ('Onboarding',         'service',   '#14B8A6', 'BookOpen'),
    ('Escalation',         'service',   '#EF4444', 'AlertTriangle'),
    ('Feedback',           'service',   '#22C55E', 'MessageSquare'),
    ('Password Reset',     'technical', '#64748B', 'Lock'),
    ('Service Outage',     'technical', '#DC2626', 'WifiOff');

-- ============================================================
-- CALL_TOPICS (many-to-many) — powers Smart Topics & bubble chart
-- ============================================================

CREATE TABLE call_topics (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id           UUID        NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE,
    topic_id          UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    relevance_score   DECIMAL(5,2) CHECK (relevance_score BETWEEN 0 AND 1),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(call_id, topic_id)
);

CREATE INDEX idx_call_topics_call  ON call_topics(call_id);
CREATE INDEX idx_call_topics_topic ON call_topics(topic_id);

-- ============================================================
-- KEYWORDS — powers Word Cloud
-- ============================================================

CREATE TABLE keywords (
    id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    word           TEXT           NOT NULL UNIQUE,
    sentiment_bias sentiment_type,             -- overall tendency
    frequency      INTEGER        NOT NULL DEFAULT 0,
    weight         DECIMAL(5,2)   NOT NULL DEFAULT 1.0,  -- for word cloud size
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_keywords_frequency ON keywords(frequency DESC);
CREATE INDEX idx_keywords_sentiment ON keywords(sentiment_bias);

CREATE TRIGGER trg_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- CALL_KEYWORDS (many-to-many)
-- ============================================================

CREATE TABLE call_keywords (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id          UUID        NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE,
    keyword_id       UUID        NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    occurrence_count INTEGER     NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(call_id, keyword_id)
);

CREATE INDEX idx_call_keywords_call    ON call_keywords(call_id);
CREATE INDEX idx_call_keywords_keyword ON call_keywords(keyword_id);

-- ============================================================
-- QA CRITERIA TEMPLATES (Script Compliance)
-- ============================================================

CREATE TABLE qa_criteria (
    id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    title          TEXT    NOT NULL,         -- 'Opening Greeting'
    description    TEXT,                     -- 'Verified standard welcome phrase used'
    category       TEXT    NOT NULL DEFAULT 'compliance',  -- 'compliance','quality','empathy'
    is_mandatory   BOOLEAN NOT NULL DEFAULT true,
    display_order  INTEGER NOT NULL DEFAULT 0,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qa_criteria_active ON qa_criteria(is_active);

INSERT INTO qa_criteria (title, description, category, display_order) VALUES
    ('Opening Greeting',      'Verified standard welcome phrase used',          'compliance', 1),
    ('Identity Verification', 'Customer identity confirmed before proceeding',  'compliance', 2),
    ('Active Listening',      'Agent demonstrated understanding of the issue',  'quality',    3),
    ('Empathy Statement',     'Agent expressed empathy during the call',        'empathy',    4),
    ('Issue Resolution',      'Customer issue was fully addressed',             'quality',    5),
    ('Closing Etiquette',     'Proper call closure with confirmation',          'compliance', 6),
    ('Hold Procedure',        'Customer informed before placing on hold',       'compliance', 7),
    ('Escalation Protocol',   'Correct escalation path followed if needed',    'compliance', 8);

CREATE TRIGGER trg_qa_criteria_updated_at
    BEFORE UPDATE ON qa_criteria
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- CALL QA RESULTS (per-call script compliance)
-- ============================================================

CREATE TABLE call_qa_results (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id         UUID        NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE,
    criteria_id     UUID        NOT NULL REFERENCES qa_criteria(id) ON DELETE CASCADE,
    passed          BOOLEAN     NOT NULL,
    details         TEXT,       -- agent quote or note
    score           DECIMAL(5,2),
    reviewed_by     UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(call_id, criteria_id)
);

CREATE INDEX idx_call_qa_call     ON call_qa_results(call_id);
CREATE INDEX idx_call_qa_criteria ON call_qa_results(criteria_id);
CREATE INDEX idx_call_qa_passed   ON call_qa_results(passed);

-- ============================================================
-- PROCESSING QUEUE (Voice Analysis Hub)
-- ============================================================

CREATE TABLE processing_queue (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id         UUID        REFERENCES call_recordings(id) ON DELETE CASCADE,
    file_name       TEXT        NOT NULL,
    file_format     file_format,
    file_size_bytes BIGINT,
    status          call_status NOT NULL DEFAULT 'pending',
    progress_pct    INTEGER     NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    source          TEXT        NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','recording')),
    error_message   TEXT,
    submitted_by    UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proc_queue_status    ON processing_queue(status);
CREATE INDEX idx_proc_queue_submitted ON processing_queue(submitted_by);
CREATE INDEX idx_proc_queue_created   ON processing_queue(created_at DESC);

CREATE TRIGGER trg_proc_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- RLS for call tables
-- ============================================================

ALTER TABLE call_recordings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_topics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_keywords          ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_qa_results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_select_calls"
    ON call_recordings FOR SELECT TO authenticated
    USING (fn_is_authenticated_user());

CREATE POLICY "admins_manage_calls"
    ON call_recordings FOR ALL TO authenticated
    USING (fn_is_admin());

CREATE POLICY "auth_users_select_transcripts"
    ON call_transcript_segments FOR SELECT TO authenticated
    USING (fn_is_authenticated_user());

CREATE POLICY "auth_users_select_call_topics"
    ON call_topics FOR SELECT TO authenticated
    USING (fn_is_authenticated_user());

CREATE POLICY "auth_users_select_call_keywords"
    ON call_keywords FOR SELECT TO authenticated
    USING (fn_is_authenticated_user());

CREATE POLICY "auth_users_select_qa"
    ON call_qa_results FOR SELECT TO authenticated
    USING (fn_is_authenticated_user());

CREATE POLICY "admins_manage_qa"
    ON call_qa_results FOR ALL TO authenticated
    USING (fn_is_admin());

CREATE POLICY "auth_users_select_queue"
    ON processing_queue FOR SELECT TO authenticated
    USING (fn_is_authenticated_user());

CREATE POLICY "agent_manage_own_queue"
    ON processing_queue FOR ALL TO authenticated
    USING (submitted_by = auth.uid() OR fn_is_admin());
