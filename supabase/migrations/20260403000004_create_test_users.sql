-- ============================================================
-- إنشاء مستخدمي الاختبار في Supabase Auth (نسخة مُصلحة)
-- شغّل هذا في: Supabase Dashboard → SQL Editor
-- ============================================================

DO $$
DECLARE
  admin_id UUID;
  agent_id UUID;
BEGIN

  -- ── Admin User ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@company.com') THEN

    admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      is_sso_user, is_anonymous,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change,
      email_change_token_current, phone_change_token, reauthentication_token
    ) VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@company.com',
      crypt('admin123', gen_salt('bf', 10)),
      NOW(),
      '{"full_name": "Admin User", "role": "admin", "username": "admin"}'::jsonb,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      false, false,
      NOW(), NOW(),
      '', '', '', '', '', '', ''
    );

    INSERT INTO public.user_profiles (id, email, username, full_name, role, is_active)
    VALUES (admin_id, 'admin@company.com', 'admin', 'Admin User', 'admin', true)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ Admin user created — id: %', admin_id;
  ELSE
    RAISE NOTICE '⚠ Admin already exists, skipping.';
  END IF;

  -- ── Agent User ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'agent@company.com') THEN

    agent_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      is_sso_user, is_anonymous,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change,
      email_change_token_current, phone_change_token, reauthentication_token
    ) VALUES (
      agent_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'agent@company.com',
      crypt('agent123', gen_salt('bf', 10)),
      NOW(),
      '{"full_name": "Agent User", "role": "agent", "username": "agent"}'::jsonb,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      false, false,
      NOW(), NOW(),
      '', '', '', '', '', '', ''
    );

    INSERT INTO public.user_profiles (id, email, username, full_name, role, is_active)
    VALUES (agent_id, 'agent@company.com', 'agent', 'Agent User', 'agent', true)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ Agent user created — id: %', agent_id;
  ELSE
    RAISE NOTICE '⚠ Agent already exists, skipping.';
  END IF;

END;
$$;

-- التحقق من نجاح الإنشاء
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL AS confirmed,
  p.full_name,
  p.role,
  p.is_active
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE u.email IN ('admin@company.com', 'agent@company.com');
