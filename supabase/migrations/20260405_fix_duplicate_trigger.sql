-- ============================================================
-- FIX: "Database error saving new user"
-- المشكلة: يوجد triggeran على auth.users يتعارضان مع بعض.
-- الـ trigger القديم (handle_new_user) يُدرج بدون username الذي هو NOT NULL.
-- الحل: نحذف الـ trigger القديم، ونبقي الجديد فقط (trg_on_auth_user_created).
-- ============================================================

-- الخطوة 1: احذف الـ trigger القديم المسبب للمشكلة
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- الخطوة 2: احذف الدالة القديمة أيضاً (لم تعد ضرورية)
DROP FUNCTION IF EXISTS public.handle_new_user();

-- الخطوة 3: تأكد من أن الـ trigger الجديد يعمل بشكل صحيح
-- (يُنشئ user_profiles بـ username = full_name المدخل)
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO user_profiles (id, email, username, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        -- username = full_name إذا مُرِّر، وإلا الجزء الأول من الإيميل مع رقم عشوائي لتفادي التعارض
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
            split_part(NEW.email, '@', 1) || '_' || floor(random() * 9000 + 1000)::text
        ),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent'::user_role),
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- التحقق من النتيجة
SELECT tgname, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname LIKE '%auth_user%';
