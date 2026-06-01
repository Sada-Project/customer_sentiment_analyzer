import { supabase } from '../lib/supabase';

// ─── Fetch users (user_profiles) ─────────────────────────────────────────────
export async function fetchUsers({ search, role } = {}) {
  let query = supabase
    .from('user_profiles')
    .select(`
      id, email, username, full_name, role, is_active, created_at, last_login, avatar_url,
      agents ( id, role_title, department_id, departments ( code, name ) )
    `);

  if (role && role !== 'all') query = query.eq('role', role);
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  // Flatten agent fields onto user object
  return (data ?? []).map(u => {
    const ag = Array.isArray(u.agents) ? u.agents[0] : u.agents;
    return {
      ...u,
      agent_id:        ag?.id ?? null,
      role_title:      ag?.role_title ?? null,
      department_code: ag?.departments?.code ?? null,
      department_name: ag?.departments?.name ?? null,
    };
  });
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
  // 1. Update user_profiles (name + system role)
  const profileFields = ['full_name', 'role', 'is_active', 'avatar_url'];
  const profilePayload = Object.fromEntries(
    Object.entries(updates).filter(([k]) => profileFields.includes(k))
  );
  if (Object.keys(profilePayload).length > 0) {
    const { error } = await supabase
      .from('user_profiles')
      .update(profilePayload)
      .eq('id', userId);
    if (error) throw error;
  }

  // 2. Update agents table (role_title and/or department)
  const { role_title, department_code } = updates;
  const hasAgentUpdate = role_title !== undefined || department_code !== undefined;

  if (hasAgentUpdate) {
    // Find this user's agent row
    const { data: agentRow } = await supabase
      .from('agents')
      .select('id')
      .eq('user_profile_id', userId)
      .maybeSingle();

    if (agentRow?.id) {
      const agentPayload = {};
      if (role_title      !== undefined) agentPayload.role_title    = role_title;
      if (department_code !== undefined && department_code) {
        // Resolve department_code → department_id
        const { data: dept } = await supabase
          .from('departments')
          .select('id')
          .eq('code', department_code)
          .maybeSingle();
        if (dept?.id) agentPayload.department_id = dept.id;
      } else if (department_code === '' || department_code === null) {
        agentPayload.department_id = null;
      }

      if (Object.keys(agentPayload).length > 0) {
        agentPayload.updated_at = new Date().toISOString();
        const { error: agentError } = await supabase
          .from('agents')
          .update(agentPayload)
          .eq('id', agentRow.id);
        if (agentError) throw agentError;
      }
    }
  }
}

// ─── Delete user permanently ──────────────────────────────────────────────────
// Requires the "admins_delete_profiles" RLS policy to be present in Supabase.
// If RLS silently blocks the delete (0 rows affected), we throw an error.
export async function deleteUser(userId) {
  // 1. Delete the linked agent row first (user_profile_id → agent)
  //    Without this the agent card stays on the Agent Performance page.
  await supabase
    .from('agents')
    .delete()
    .eq('user_profile_id', userId)
    .then(({ error }) => {
      if (error) console.warn('agent delete warning:', error.message);
    });

  // 2. Delete the user_profile row
  const { error, count } = await supabase
    .from('user_profiles')
    .delete({ count: 'exact' })
    .eq('id', userId);

  if (error) throw error;

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
        id:        newUserId,
        email:     email.trim().toLowerCase(),
        username:  email.split('@')[0],
        full_name: full_name?.trim() || email.split('@')[0],
        role:      role || 'agent',
        is_active: true,
      }, { onConflict: 'id' });

    if (profileError) {
      console.warn('user_profiles upsert warning:', profileError.message);
    }

    // ── 5. Create the agent row so the user appears in Agent Performance ──────
    // Look up the default "support" department to assign by default.
    const { data: defaultDept } = await supabase
      .from('departments')
      .select('id')
      .eq('code', 'support')
      .maybeSingle();

    const { error: agentError } = await supabase
      .from('agents')
      .insert({
        user_profile_id:     newUserId,
        name:                full_name?.trim() || email.split('@')[0],
        email:               email.trim().toLowerCase(),
        role_title:          role === 'admin' ? 'Team Lead' : 'Support Agent',
        department_id:       defaultDept?.id ?? null,
        is_online:           false,
        performance_score:   0,
        csat_score:          0,
        tickets_solved_total: 0,
        fcr_rate:            0,
        avg_handle_time:     0,
        open_tickets:        0,
      })
      .select('id')
      .single();

    if (agentError && !agentError.message?.includes('duplicate')) {
      console.warn('agent row creation warning:', agentError.message);
      // Don't throw — user was created successfully
    }
  }

  return signUpData?.user;
}

