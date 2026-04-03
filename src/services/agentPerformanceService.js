import { supabase } from '../lib/supabase';

// ─── Agent Performance Cards ──────────────────────────────────────────────────
export async function fetchAgents({ department, search } = {}) {
  let query = supabase.from('vw_agent_performance').select('*');

  if (department && department !== 'all') {
    query = query.eq('department_code', department);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,role_title.ilike.%${search}%`);
  }

  const { data, error } = await query.order('performance_score', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Agent Performance History (sparkline) ────────────────────────────────────
export async function fetchAgentHistory(agentId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('agent_performance_history')
    .select('*')
    .eq('agent_id', agentId)
    .gte('period_date', since)
    .order('period_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Departments list for FilterBar ──────────────────────────────────────────
export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code')
    .order('name');

  if (error) throw error;
  return data ?? [];
}

// ─── Overall stats summary ────────────────────────────────────────────────────
export async function fetchAgentStats() {
  const { data, error } = await supabase
    .from('agents')
    .select('id, is_online, performance_score, tickets_solved_total');

  if (error) throw error;

  const agents = data ?? [];
  return {
    totalAgents:    agents.length,
    onlineAgents:   agents.filter((a) => a.is_online).length,
    avgPerformance: agents.length
      ? Math.round(agents.reduce((s, a) => s + (a.performance_score ?? 0), 0) / agents.length)
      : 0,
    totalTickets: agents.reduce((s, a) => s + (a.tickets_solved_total ?? 0), 0),
  };
}
