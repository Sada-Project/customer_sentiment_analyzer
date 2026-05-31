-- ============================================================
-- SEED: Departments + Agents
-- Run this in Supabase SQL Editor → it is safe to run multiple times
-- ============================================================

-- ── 1. Departments (safe upsert) ────────────────────────────
INSERT INTO departments (name, code, description)
VALUES
    ('Customer Support', 'support',   'Handles general customer inquiries'),
    ('Technical Support','technical', 'Handles technical and product issues'),
    ('Sales',            'sales',     'Handles sales inquiries and conversions'),
    ('Billing',          'billing',   'Handles billing and payment issues')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Agents (safe upsert by email) ────────────────────────
INSERT INTO agents (
    name, email, role_title, department_id,
    is_online,
    performance_score, csat_score,
    tickets_solved_total, tickets_solved_trend,
    fcr_rate, fcr_trend,
    avg_handle_time, open_tickets
)
SELECT
    a.name, a.email, a.role_title,
    d.id,
    a.is_online,
    a.perf, a.csat,
    a.solved, a.solved_trend,
    a.fcr, a.fcr_trend,
    a.handle_time, a.open_tickets
FROM (VALUES
    ('Alex Johnson',    'alex.johnson@callcenter.ai',    'Senior Support Agent',   'support',   true,  88.5, 91.2, 342, 12,  78.4, 5,  8.2,  3),
    ('Maria Santos',    'maria.santos@callcenter.ai',    'Technical Specialist',   'technical', true,  92.3, 94.1, 289, 8,   82.1, 3,  7.5,  1),
    ('David Kim',       'david.kim@callcenter.ai',       'Billing Specialist',     'billing',   false, 85.1, 88.7, 421, -3,  75.3, -2, 9.1,  5),
    ('Sarah Williams',  'sarah.williams@callcenter.ai',  'Sales Representative',   'sales',     true,  79.8, 83.5, 198, 6,   71.2, 4,  11.3, 8),
    ('James Cooper',    'james.cooper@callcenter.ai',    'Support Agent',          'support',   false, 76.4, 80.1, 156, -1,  68.9, 0,  10.8, 2),
    ('Priya Patel',     'priya.patel@callcenter.ai',     'Senior Technical Lead',  'technical', true,  95.1, 96.3, 512, 15,  88.2, 7,  6.8,  0),
    ('Marcus Lee',      'marcus.lee@callcenter.ai',      'Sales Specialist',       'sales',     true,  83.7, 86.4, 274, 4,   74.6, 2,  9.7,  4),
    ('Emily Chen',      'emily.chen@callcenter.ai',      'Billing & Accounts',     'billing',   false, 90.2, 92.0, 388, 9,   80.5, 6,  7.9,  2)
) AS a(name, email, role_title, dept_code, is_online, perf, csat, solved, solved_trend, fcr, fcr_trend, handle_time, open_tickets)
JOIN departments d ON d.code = a.dept_code
ON CONFLICT (email) DO UPDATE SET
    performance_score     = EXCLUDED.performance_score,
    csat_score            = EXCLUDED.csat_score,
    tickets_solved_total  = EXCLUDED.tickets_solved_total,
    tickets_solved_trend  = EXCLUDED.tickets_solved_trend,
    fcr_rate              = EXCLUDED.fcr_rate,
    fcr_trend             = EXCLUDED.fcr_trend,
    avg_handle_time       = EXCLUDED.avg_handle_time,
    open_tickets          = EXCLUDED.open_tickets,
    is_online             = EXCLUDED.is_online,
    updated_at            = NOW();

-- ── 3. Badges (optional — adds flair to top agents) ─────────
INSERT INTO agent_badges (agent_id, badge, label)
SELECT a.id, 'top_performer', '🏆 Top Performer'
FROM agents a WHERE a.email = 'priya.patel@callcenter.ai'
ON CONFLICT DO NOTHING;

INSERT INTO agent_badges (agent_id, badge, label)
SELECT a.id, 'high_csat', '⭐ High CSAT'
FROM agents a WHERE a.email IN ('priya.patel@callcenter.ai','maria.santos@callcenter.ai')
ON CONFLICT DO NOTHING;

INSERT INTO agent_badges (agent_id, badge, label)
SELECT a.id, 'fast_responder', '⚡ Fast Responder'
FROM agents a WHERE a.email IN ('maria.santos@callcenter.ai','alex.johnson@callcenter.ai')
ON CONFLICT DO NOTHING;

-- ── 4. Verify ────────────────────────────────────────────────
SELECT 'Departments' AS table_name, COUNT(*) AS rows FROM departments
UNION ALL
SELECT 'Agents',  COUNT(*) FROM agents
UNION ALL
SELECT 'Badges',  COUNT(*) FROM agent_badges;
