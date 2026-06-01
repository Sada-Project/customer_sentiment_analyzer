import { supabase } from '../lib/supabase';

// ─── Fetch all agents with their performance data ─────────────────────────────
export async function fetchAgents({ department } = {}) {
  let query = supabase.from('vw_agent_performance').select('*');
  if (department && department !== 'all') {
    query = query.eq('department_code', department);
  }

  const { data, error } = await query.order('performance_score', { ascending: false });

  if (error) {
    // Fallback to agents table directly
    const fallback = await supabase
      .from('agents')
      .select('id, name, role_title, email, is_online, last_seen, performance_score, csat_score, tickets_solved_total, tickets_solved_trend, fcr_rate, fcr_trend, avg_handle_time, open_tickets')
      .order('performance_score', { ascending: false });
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map(mapAgent);
  }

  return (data ?? []).map(mapAgent);
}

// ─── Map DB row → AgentCard props ─────────────────────────────────────────────
function mapAgent(a) {
  return {
    id:               a.id,
    name:             a.name,
    role:             a.role_title ?? '—',
    department:       a.department ?? null,
    email:            a.email ?? null,
    isOnline:         a.is_online ?? false,
    lastSeen:         a.last_seen ?? null,
    performanceScore: Number(a.performance_score ?? 0).toFixed(0),
    csatScore:        Number(a.csat_score ?? 0).toFixed(0),
    callsHandled:     a.tickets_solved_total ?? 0,
    callsTrend:       a.tickets_solved_trend ?? 0,
    fcrRate:          Number(a.fcr_rate ?? 0).toFixed(0),
    fcrTrend:         a.fcr_trend ?? 0,
    avgHandleTime:    Number(a.avg_handle_time ?? 0).toFixed(1),
    openTickets:      a.open_tickets ?? 0,
    badges:           Array.isArray(a.badges) ? a.badges : [],
  };
}

// ─── Departments list ─────────────────────────────────────────────────────────
export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Summary stats — computed live from vw_agent_performance ──────────────────
// Uses the view so is_online is dynamic (last_login > NOW()-30min), not static.
export async function fetchAgentStats() {
  // Read from the same view the cards use — guarantees is_online is consistent
  const { data: viewRows, error: viewErr } = await supabase
    .from('vw_agent_performance')
    .select('id, is_online, performance_score, csat_score, tickets_solved_total');

  if (viewErr) {
    // Fallback to agents table if view is unavailable
    const { data: agentRows, error: agentErr } = await supabase
      .from('agents')
      .select('id, is_online, performance_score, csat_score, tickets_solved_total');
    if (agentErr) throw new Error(agentErr.message);
    return computeStats(agentRows ?? []);
  }

  return computeStats(viewRows ?? []);
}

function computeStats(rows) {
  const total = rows.length;

  return {
    totalAgents:      total,
    // is_online from vw_agent_performance is computed as last_login > NOW()-30min
    onlineAgents:     rows.filter(a => a.is_online === true).length,
    avgPerformance:   total
      ? Math.round(rows.reduce((s, a) => s + (Number(a.performance_score) || 0), 0) / total)
      : 0,
    avgCsat: total
      ? Math.round(rows.reduce((s, a) => s + (Number(a.csat_score) || 0), 0) / total)
      : 0,
    totalCallsHandled: rows.reduce((s, a) => s + (a.tickets_solved_total ?? 0), 0),
  };
}



// ─── Manually trigger a stat refresh for the current user's agent ─────────────
// Call this after a call completes as a safety net (trigger handles it automatically)
export async function refreshMyAgentStats(userProfileId) {
  if (!userProfileId) return;

  const { data: agentRow } = await supabase
    .from('agents')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .maybeSingle();

  if (!agentRow?.id) return;

  // Call the DB function we created in the trigger migration
  await supabase.rpc('refresh_agent_stats', { p_agent_id: agentRow.id }).catch(() => {
    // Fallback: manual update if RPC not available yet
    console.warn('[agentPerf] refresh_agent_stats RPC not available — trigger will handle it');
  });
}
