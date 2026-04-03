-- ============================================================
-- MIGRATION 1: Core Schema — Enums, Users, Customers, Agents
-- Customer Sentiment Analyzer
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role        AS ENUM ('admin', 'agent');
CREATE TYPE sentiment_type   AS ENUM ('satisfied', 'neutral', 'frustrated', 'angry');
CREATE TYPE call_status      AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE interaction_type AS ENUM ('support_call', 'sales_call', 'feedback_session', 'onboarding_call', 'follow_up');
CREATE TYPE customer_segment AS ENUM ('enterprise', 'smb', 'individual', 'premium');
CREATE TYPE alert_severity   AS ENUM ('info', 'warning', 'critical');
CREATE TYPE trend_direction  AS ENUM ('up', 'down', 'stable');
CREATE TYPE file_format      AS ENUM ('mp3', 'wav', 'm4a', 'ogg', 'webm');
CREATE TYPE badge_type       AS ENUM ('top_performer', 'fastest_resolver', 'customer_champion', 'most_improved', 'perfect_score');

-- ============================================================
-- USER PROFILES (Auth Integration)
-- ============================================================

CREATE TABLE user_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL UNIQUE,
    username    TEXT        NOT NULL UNIQUE,
    full_name   TEXT        NOT NULL,
    role        user_role   NOT NULL DEFAULT 'agent',
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    avatar_url  TEXT,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_role      ON user_profiles(role);
CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active);

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT        NOT NULL UNIQUE,
    code        TEXT        NOT NULL UNIQUE,  -- 'support','technical','sales','billing'
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO departments (name, code, description) VALUES
    ('Customer Support',    'support',   'Handles general customer inquiries and issues'),
    ('Technical Support',   'technical', 'Handles technical and product-related issues'),
    ('Sales',               'sales',     'Handles sales inquiries and conversions'),
    ('Billing',             'billing',   'Handles billing and payment issues');

-- ============================================================
-- AGENTS (linked to user_profiles)
-- ============================================================

CREATE TABLE agents (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_profile_id     UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
    name                TEXT        NOT NULL,
    email               TEXT        NOT NULL UNIQUE,
    role_title          TEXT        NOT NULL,           -- 'Senior Support Agent', etc.
    department_id       UUID        REFERENCES departments(id) ON DELETE SET NULL,
    avatar_url          TEXT,
    is_online           BOOLEAN     NOT NULL DEFAULT false,
    last_seen           TIMESTAMPTZ,
    -- Aggregated performance (updated via triggers/cron)
    performance_score   DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (performance_score BETWEEN 0 AND 100),
    csat_score          DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (csat_score BETWEEN 0 AND 100),
    tickets_solved_total INTEGER     NOT NULL DEFAULT 0,
    tickets_solved_trend INTEGER     NOT NULL DEFAULT 0,   -- % change vs last period
    fcr_rate            DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (fcr_rate BETWEEN 0 AND 100),
    fcr_trend           INTEGER      NOT NULL DEFAULT 0,
    avg_handle_time     DECIMAL(6,2) NOT NULL DEFAULT 0,   -- in minutes
    open_tickets        INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_department    ON agents(department_id);
CREATE INDEX idx_agents_is_online     ON agents(is_online);
CREATE INDEX idx_agents_performance   ON agents(performance_score DESC);
CREATE INDEX idx_agents_user_profile  ON agents(user_profile_id);

-- ============================================================
-- AGENT BADGES
-- ============================================================

CREATE TABLE agent_badges (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id    UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    badge       badge_type  NOT NULL,
    label       TEXT        NOT NULL,   -- Display label
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, badge)
);

CREATE INDEX idx_agent_badges_agent  ON agent_badges(agent_id);

-- ============================================================
-- AGENT PERFORMANCE HISTORY (for trend charts)
-- ============================================================

CREATE TABLE agent_performance_history (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id          UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    period_date       DATE        NOT NULL,
    tickets_solved    INTEGER     NOT NULL DEFAULT 0,
    fcr_rate          DECIMAL(5,2),
    avg_handle_time   DECIMAL(6,2),
    performance_score DECIMAL(5,2),
    csat_score        DECIMAL(5,2),
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, period_date)
);

CREATE INDEX idx_agent_perf_history_agent   ON agent_performance_history(agent_id);
CREATE INDEX idx_agent_perf_history_date    ON agent_performance_history(period_date DESC);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
    id                  UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_ref        TEXT             NOT NULL UNIQUE,  -- e.g. 'CUST-2847'
    full_name           TEXT             NOT NULL,
    company_name        TEXT,
    email               TEXT,
    phone               TEXT,
    segment             customer_segment NOT NULL DEFAULT 'individual',
    lifetime_value      DECIMAL(12,2)    NOT NULL DEFAULT 0,
    satisfaction_score  DECIMAL(3,1)     CHECK (satisfaction_score BETWEEN 1 AND 5),
    sentiment_score     DECIMAL(5,2)     CHECK (sentiment_score BETWEEN 0 AND 100),
    dominant_emotion    sentiment_type,
    sentiment_trend     trend_direction  NOT NULL DEFAULT 'stable',
    sentiment_trend_pct DECIMAL(6,2)     NOT NULL DEFAULT 0, -- % change
    total_interactions  INTEGER          NOT NULL DEFAULT 0,
    avg_response_time   DECIMAL(6,2),   -- in hours
    last_interaction_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_ref         ON customers(customer_ref);
CREATE INDEX idx_customers_segment     ON customers(segment);
CREATE INDEX idx_customers_sentiment   ON customers(sentiment_score DESC);
CREATE INDEX idx_customers_last_inter  ON customers(last_interaction_at DESC);

-- ============================================================
-- SHARED TRIGGER: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- AUTH TRIGGER: auto-create user_profile on sign-up
-- ============================================================

CREATE OR REPLACE FUNCTION fn_handle_new_auth_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO user_profiles (id, email, username, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent'::user_role),
        COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION fn_handle_new_auth_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments    ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION fn_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
$$;

-- Helper: is current user active agent or admin?
CREATE OR REPLACE FUNCTION fn_is_authenticated_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND is_active = true
    );
$$;

-- user_profiles policies
CREATE POLICY "users_select_own"   ON user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "admins_select_all"  ON user_profiles FOR SELECT TO authenticated USING (fn_is_admin());
CREATE POLICY "admins_insert"      ON user_profiles FOR INSERT TO authenticated WITH CHECK (fn_is_admin());
CREATE POLICY "admins_update_all"  ON user_profiles FOR UPDATE TO authenticated USING (fn_is_admin());
CREATE POLICY "users_update_own"   ON user_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- departments: all authenticated can read, only admins write
CREATE POLICY "all_select_departments" ON departments FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "admins_manage_departments" ON departments FOR ALL TO authenticated USING (fn_is_admin());

-- agents: all authenticated can read, only admins write
CREATE POLICY "all_select_agents"  ON agents FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "admins_manage_agents" ON agents FOR ALL TO authenticated USING (fn_is_admin());

-- customers: all authenticated can read, only admins write
CREATE POLICY "all_select_customers"   ON customers FOR SELECT TO authenticated USING (fn_is_authenticated_user());
CREATE POLICY "admins_manage_customers" ON customers FOR ALL TO authenticated USING (fn_is_admin());
