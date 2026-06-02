import React from 'react';
import Icon from '../../../components/AppIcon';

// ─── Sentiment color for CSAT bar ─────────────────────────────────────────────
const getBarColor = (score) => {
  if (score >= 80) return 'from-emerald-500 to-emerald-400';
  if (score >= 60) return 'from-blue-500 to-blue-400';
  if (score >= 40) return 'from-amber-500 to-amber-400';
  return 'from-rose-500 to-rose-400';
};

const getTrendIcon = (trend) => {
  if (trend > 0) return { name: 'TrendingUp',   color: 'rgb(16 185 129)' };
  if (trend < 0) return { name: 'TrendingDown',  color: 'rgb(239 68 68)' };
  return              { name: 'Minus',           color: 'rgb(148 163 184)' };
};

const getTrendClass = (trend) => {
  if (trend > 0) return 'text-emerald-500';
  if (trend < 0) return 'text-rose-500';
  return 'text-slate-400';
};

// ─── Badge chip ───────────────────────────────────────────────────────────────
const BADGE_COLORS = {
  top_performer:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  fast_responder:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  high_csat:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  mentor:          'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

const BadgeChip = ({ badge, label }) => (
  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${BADGE_COLORS[badge] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
    {label}
  </span>
);

// ─── Format last seen ─────────────────────────────────────────────────────────
const formatLastSeen = (ts) => {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Main Card ────────────────────────────────────────────────────────────────
const AgentCard = ({ agent }) => {
  const initials = agent?.name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?';
  const csat     = Number(agent?.csatScore ?? 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 flex flex-col gap-4">

      {/* ── Header: Avatar + Name + Status ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {agent?.avatarUrl ? (
              <img
                src={agent.avatarUrl}
                alt={agent.name}
                className="w-12 h-12 rounded-full object-cover shadow-md border-2 border-border"
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div
              className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-md"
              style={{ display: agent?.avatarUrl ? 'none' : 'flex' }}
            >
              <span className="text-base font-bold text-white">{initials}</span>
            </div>
            {/* Online indicator */}
            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card ${agent?.isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{agent?.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{agent?.role}</p>
            {agent?.department && (
              <span className="text-[10px] text-primary/70 font-medium">{agent.department}</span>
            )}
          </div>
        </div>

        {/* Online / Offline pill */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${
          agent?.isOnline
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'bg-slate-500/10 text-slate-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${agent?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          {agent?.isOnline ? 'Online' : (agent?.lastSeen ? formatLastSeen(agent.lastSeen) : 'Offline')}
        </div>
      </div>

      {/* ── Badges ── */}
      {agent?.badges?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.badges.map((b, i) => <BadgeChip key={i} badge={b.badge} label={b.label} />)}
        </div>
      )}

      {/* ── Metrics Grid (1×2) ── */}
      <div className="grid grid-cols-2 gap-2">

        {/* Calls Handled */}
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Phone" size={12} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Calls Handled</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-foreground">{agent?.callsHandled ?? '—'}</span>
            {agent?.callsTrend !== undefined && agent?.callsTrend !== 0 && (
              <div className="flex items-center gap-0.5">
                <Icon {...getTrendIcon(agent.callsTrend)} size={11} />
                <span className={`text-[10px] ${getTrendClass(agent.callsTrend)}`}>
                  {agent.callsTrend > 0 ? '+' : ''}{agent.callsTrend}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Avg Handle Time */}
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Clock" size={12} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Avg Handle</span>
          </div>
          <span className="text-base font-bold text-foreground">
            {agent?.avgHandleTime ? `${agent.avgHandleTime}m` : '—'}
          </span>
        </div>
      </div>

      {/* ── CSAT mini-bar ── */}
      <div className="pt-1 border-t border-border">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Customer Satisfaction</span>
          <span className="font-semibold text-foreground">{csat}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getBarColor(csat)} rounded-full`}
            style={{ width: `${csat}%` }}
          />
        </div>
      </div>

    </div>
  );
};

export default AgentCard;