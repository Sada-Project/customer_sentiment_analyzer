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
export async function inviteUser({ email, full_name, role }) {
  // Uses admin API — requires service_role key on backend
  // For now we insert directly into user_profiles after auth signup
  // This is a placeholder; real invite uses supabase.auth.admin.inviteUserByEmail()
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: { full_name, role },
      shouldCreateUser: true,
    },
  });

  if (error) throw error;
  return data;
}
