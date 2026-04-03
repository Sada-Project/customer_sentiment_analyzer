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

// ─── Invite / create user via Supabase Auth ───────────────────────────────────
// NOTE: Creating auth users requires the service_role key (server-side only).
// This function should be called from a secure backend endpoint / Supabase Edge Function.
// Using the anon key here will always fail with a "not authorized" error.
export async function inviteUser({ email, full_name, role }) {
  // Throw a descriptive error to surface the limitation clearly in the UI
  throw new Error(
    'إنشاء مستخدمين جدد يتطلب مفتاح service_role ويجب تنفيذه من الـ backend. ' +
    'يرجى إنشاء الحساب يدوياً في Supabase Dashboard ثم تحديث ملف user_profiles.'
  );
}
