import { supabase } from '../lib/supabase';

// ─── Fetch all agents with their performance data ─────────────────────────────
// Maps vw_agent_performance (snake_case) → camelCase shape for AgentCard
export async function fetchAgents({ department } = {}) {
  let query = supabase.from('vw_agent_performance').select('*');

  if (department && department !== 'all') {
    query = query.eq('department_code', department);
  }

  const { data, error } = await query.order('performance_score', { ascending: false });
  if (error) {
    // Fallback: query agents table directly
    const fallback = await supabase
      .from('agents')
      .select('id, name, role_title, email, is_online, performance_score, csat_score, tickets_solved_total, tickets_solved_trend, fcr_rate, fcr_trend, avg_handle_time, open_tickets, last_seen')
      .order('performance_score', { ascending: false });
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map(mapAgent);
  }

  return (data ?? []).map(mapAgent);
}

// ─── Map DB row → AgentCard prop shape ───────────────────────────────────────
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

// ─── Departments for FilterBar ────────────────────────────────────────────────
export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Overall summary stats ────────────────────────────────────────────────────
export async function fetchAgentStats() {
  const { data, error } = await supabase
    .from('agents')
    .select('id, is_online, performance_score, tickets_solved_total, csat_score');

  if (error) throw new Error(error.message);

  const agents = data ?? [];
  const total  = agents.length;
  return {
    totalAgents:    total,
    onlineAgents:   agents.filter(a => a.is_online).length,
    avgPerformance: total
      ? Math.round(agents.reduce((s, a) => s + (Number(a.performance_score) || 0), 0) / total)
      : 0,
    avgCsat: total
      ? Math.round(agents.reduce((s, a) => s + (Number(a.csat_score) || 0), 0) / total)
      : 0,
    totalCallsHandled: agents.reduce((s, a) => s + (a.tickets_solved_total ?? 0), 0),
  };
}
