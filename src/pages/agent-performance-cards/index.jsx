import React, { useState, useEffect, useMemo } from 'react';
import Header from '../../components/ui/Header';
import FilterBar from './components/FilterBar';
import AgentCard from './components/AgentCard';
import Icon from '../../components/AppIcon';
import {
  fetchAgents,
  fetchAgentStats,
  fetchDepartments,
} from '../../services/agentPerformanceService';

const AgentPerformanceCards = () => {
  const [searchTerm,         setSearchTerm]         = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedDateRange,  setSelectedDateRange]  = useState('7d');
  const [agents,             setAgents]             = useState([]);
  const [stats,              setStats]              = useState({ totalAgents: 0, onlineAgents: 0, avgPerformance: 0, totalTickets: 0 });
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);

  // Load agents & stats
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchAgents({ department: selectedDepartment }), // search handled client-side
      fetchAgentStats(),
    ])
      .then(([agentList, agentStats]) => {
        if (cancelled) return;
        setAgents(agentList);
        setStats(agentStats);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selectedDepartment]); // ← removed searchTerm: search is client-side only

  // Client-side search filter on top of DB data
  const filteredAgents = useMemo(() => {
    if (!searchTerm) return agents;
    const q = searchTerm.toLowerCase();
    return agents.filter(a =>
      a.name?.toLowerCase().includes(q) || a.role_title?.toLowerCase().includes(q)
    );
  }, [agents, searchTerm]);

  const handleReset = () => {
    setSearchTerm('');
    setSelectedDepartment('all');
    setSelectedDateRange('7d');
  };

  const handleViewDetails = (agent) => console.log('View details for agent:', agent?.name);

  const STAT_CARDS = [
    { label: 'Total Agents',        value: stats.totalAgents,    icon: 'Users',       color: 'blue-600' },
    { label: 'Online Now',          value: stats.onlineAgents,   icon: 'UserCheck',   color: 'emerald-500' },
    { label: 'Avg Performance',     value: `${stats.avgPerformance}%`, icon: 'TrendingUp', color: 'blue-600' },
    { label: 'Total Tickets Solved', value: stats.totalTickets,  icon: 'CheckCircle2', color: 'emerald-500' },
  ];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-[1600px]">

          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 font-['Inter']">Agent Performance Cards</h1>
              <p className="text-muted-foreground font-['Inter']">Comprehensive agent performance metrics and individual statistics dashboard</p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {loading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
              {error   && <span className="text-xs text-destructive">⚠ {error}</span>}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {STAT_CARDS.map((card, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex items-center justify-center w-10 h-10 bg-${card.color}/10 rounded-lg`}>
                    <Icon name={card.icon} size={20} color={`rgb(${card.color === 'blue-600' ? '37 99 235' : '16 185 129'})`} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-['Inter']">{card.label}</p>
                    <p className="text-card-foreground text-2xl font-bold font-['Inter']">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <FilterBar
            onSearch={setSearchTerm}
            onDepartmentChange={setSelectedDepartment}
            onDateRangeChange={setSelectedDateRange}
            onReset={handleReset}
          />

          {/* Agent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAgents.length > 0 ? (
              filteredAgents.map(agent => (
                <AgentCard key={agent.id} agent={agent} onViewDetails={handleViewDetails} />
              ))
            ) : !loading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12">
                <Icon name="Search" size={48} color="rgb(148 163 184)" />
                <p className="text-slate-400 mt-4 font-['Inter']">No agents found matching your filters</p>
              </div>
            ) : null}
          </div>

        </div>
      </main>
    </>
  );
};

export default AgentPerformanceCards;