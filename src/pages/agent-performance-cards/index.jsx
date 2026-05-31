import React, { useState, useEffect, useMemo } from 'react';
import Header from '../../components/ui/Header';
import AgentCard from './components/AgentCard';
import Icon from '../../components/AppIcon';
import Input from '../../components/ui/Input';
import {
  fetchAgents,
  fetchAgentStats,
  fetchDepartments,
} from '../../services/agentPerformanceService';

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon name={icon} size={22} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const AgentPerformanceCards = () => {
  const [searchTerm,         setSearchTerm]         = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [agents,             setAgents]             = useState([]);
  const [stats,              setStats]              = useState(null);
  const [departments,        setDepartments]        = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [lastUpdated,        setLastUpdated]        = useState(null);
  const [refreshing,         setRefreshing]         = useState(false);

  const loadData = (dept, isRefresh = false) => {
    let cancelled = false;
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);

    Promise.allSettled([
      fetchAgents({ department: dept }),
      fetchAgentStats(),
      fetchDepartments(),
    ]).then(([agentsRes, statsRes, depsRes]) => {
      if (cancelled) return;

      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value);
      else { console.warn('[AgentPerf] agents error:', agentsRes.reason); setError(agentsRes.reason?.message); }

      if (statsRes.status === 'fulfilled')  setStats(statsRes.value);
      else console.warn('[AgentPerf] stats error:', statsRes.reason);

      if (depsRes.status === 'fulfilled')   setDepartments(depsRes.value);
      else console.warn('[AgentPerf] departments error:', depsRes.reason);

      setLastUpdated(new Date());
    }).finally(() => {
      if (!cancelled) { setLoading(false); setRefreshing(false); }
    });

    return () => { cancelled = true; };
  };

  useEffect(() => {
    const cleanup = loadData(selectedDepartment);
    return cleanup;
  }, [selectedDepartment]);

  // Client-side search
  const filteredAgents = useMemo(() => {
    if (!searchTerm.trim()) return agents;
    const q = searchTerm.toLowerCase();
    return agents.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.role?.toLowerCase().includes(q) ||
      a.department?.toLowerCase().includes(q)
    );
  }, [agents, searchTerm]);

  const handleReset = () => {
    setSearchTerm('');
    setSelectedDepartment('all');
  };

  const formatTime = d => d?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Stat cards definition — only show data we actually have
  const STAT_CARDS = [
    { label: 'Total Agents',        value: stats?.totalAgents,                            icon: 'Users',       color: 'bg-blue-600'   },
    { label: 'Online Now',          value: stats?.onlineAgents,                           icon: 'UserCheck',   color: 'bg-emerald-600' },
    { label: 'Avg Performance',     value: stats?.avgPerformance != null ? `${stats.avgPerformance}%` : '—', icon: 'TrendingUp', color: 'bg-violet-600' },
    { label: 'Calls Handled Total', value: stats?.totalCallsHandled?.toLocaleString(),    icon: 'Phone',       color: 'bg-amber-600'  },
  ];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-[1600px]">

          {/* ── Page Header ── */}
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Agent Performance</h1>
              <p className="text-muted-foreground text-sm">Live metrics for every agent — sourced directly from the database</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground hidden sm:block">Updated {formatTime(lastUpdated)}</span>
              )}
              {loading && !refreshing && (
                <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
              )}
              {error && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <Icon name="AlertTriangle" size={13} />{error}
                </span>
              )}
              <button
                onClick={() => loadData(selectedDepartment, true)}
                disabled={loading || refreshing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <Icon name="RefreshCw" size={13} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {STAT_CARDS.map((card, i) => (
              <StatCard key={i} {...card} />
            ))}
          </div>

          {/* ── Filters ── */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search agents by name or role…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Department filter */}
            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.code ?? d.name}>{d.name}</option>
              ))}
            </select>

            {/* Reset */}
            {(searchTerm || selectedDepartment !== 'all') && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors"
              >
                <Icon name="RotateCcw" size={13} />
                Reset
              </button>
            )}

            {/* Count */}
            <span className="text-xs text-muted-foreground ml-auto">
              {loading ? 'Loading…' : `${filteredAgents.length} of ${agents.length} agents`}
            </span>
          </div>

          {/* ── Agent Cards Grid ── */}
          {loading && !refreshing ? (
            // Skeleton loaders
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded mb-4" />
                  <div className="grid grid-cols-2 gap-2">
                    {[...Array(4)].map((_, j) => <div key={j} className="h-14 bg-muted rounded-lg" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredAgents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Icon name="Users" size={28} className="text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium mb-1">No agents found</p>
              <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or department filter</p>
              <button onClick={handleReset} className="text-xs text-primary hover:underline">Clear filters</button>
            </div>
          )}

        </div>
      </main>
    </>
  );
};

export default AgentPerformanceCards;