import { supabase } from '../lib/supabase';

// ─── Fetch users (user_profiles) ─────────────────────────────────────────────
export async function fetchUsers({ search, role } = {}) {
  let query = supabase
    .from('user_profiles')
    .select('id, email, username, full_name, role, is_active, created_at, last_login');

  if (role && role !== 'all') {
    query = query.eq('role', role);
  }
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Toggle user active status ────────────────────────────────────────────────
export async function toggleUserStatus(userId, isActive) {
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active: !isActive })
    .eq('id', userId);

  if (error) throw error;
}

// ─── Update user ──────────────────────────────────────────────────────────────
export async function updateUser(userId, updates) {
  const allowed = ['full_name', 'role', 'is_active', 'avatar_url'];
  const payload = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const { error } = await supabase
    .from('user_profiles')
    .update(payload)
    .eq('id', userId);

  if (error) throw error;
}

// ─── Delete user permanently ──────────────────────────────────────────────────
// Requires the "admins_delete_profiles" RLS policy to be present in Supabase.
// If RLS silently blocks the delete (0 rows affected), we throw an error.
export async function deleteUser(userId) {
  const { error, count } = await supabase
    .from('user_profiles')
    .delete({ count: 'exact' })
    .eq('id', userId);

  if (error) throw error;

  // count === 0 means RLS blocked the delete silently — alert the admin
  if (count === 0) {
    throw new Error('لا توجد صلاحية لحذف هذا الحساب. تأكد من إضافة سياسة RLS للحذف في Supabase.');
  }
}

// ─── Invite / create user via Supabase Auth ───────────────────────────────────
// Uses signUp() with anon key — works without service_role.
// The DB trigger `on_auth_user_created` auto-creates the user_profiles row.
// After creation we restore the admin session so the admin stays logged in.
export async function inviteUser({ email, full_name, role, password }) {
  if (!email || !password) {
    throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان.');
  }

  // ── 1. Save current admin session ─────────────────────────────────────────
  const { data: { session: adminSession } } = await supabase.auth.getSession();
  if (!adminSession) throw new Error('لا توجد جلسة نشطة للمسؤول.');

  // ── 2. Sign up the new user ────────────────────────────────────────────────
  // signUp() will create the auth.users row and fire the DB trigger.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name, role }, // passed to raw_user_meta_data → trigger uses this
    },
  });

  if (signUpError) {
    // Already exists in auth
    if (signUpError.message?.includes('already registered')) {
      throw new Error('هذا البريد الإلكتروني مسجّل مسبقاً.');
    }
    throw new Error(signUpError.message);
  }

  const newUserId = signUpData?.user?.id;

  // ── 3. Restore the admin session immediately ───────────────────────────────
  await supabase.auth.setSession({
    access_token: adminSession.access_token,
    refresh_token: adminSession.refresh_token,
  });

  // ── 4. Update user_profiles with correct name & role ──────────────────────
  // The trigger may have already created the row; we upsert to be safe.
  if (newUserId) {
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: newUserId,
        email: email.trim().toLowerCase(),
        username: email.split('@')[0], // Added username to fix DB NOT NULL constraint
        full_name: full_name?.trim() || email.split('@')[0],
        role: role || 'agent',
        is_active: true,
      }, { onConflict: 'id' });

    if (profileError) {
      console.warn('user_profiles upsert warning:', profileError.message);
      // Don't throw — the auth user was created successfully
    }
  }

  return signUpData?.user;
}
