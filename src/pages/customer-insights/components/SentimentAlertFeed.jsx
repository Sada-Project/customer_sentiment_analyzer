import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

// ── Helpers ───────────────────────────────────────────────────────────────────
const scoreToEmotion = (score) => {
  const s = Number(score ?? 50);
  if (s >= 70) return { label: 'Satisfied',  color: 'text-emerald-500' };
  if (s >= 50) return { label: 'Neutral',    color: 'text-slate-400'   };
  if (s >= 30) return { label: 'Frustrated', color: 'text-amber-500'   };
  return            { label: 'Angry',       color: 'text-rose-500'    };
};

const getStatusConfig = (status) => {
  switch (status) {
    case 'active':      return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Active'      };
    case 'in-progress': return { color: 'text-warning',     bg: 'bg-warning/10',     label: 'In Progress' };
    case 'resolved':    return { color: 'text-success',     bg: 'bg-success/10',     label: 'Resolved'    };
    default:            return { color: 'text-muted-foreground', bg: 'bg-muted',     label: 'Unknown'     };
  }
};

// Normalise a raw DB alert row into the shape used by the card
const normaliseAlert = (raw, idx) => {
  // Supabase alerts table columns (best-guess from existing code):
  // id, severity, customer_name, sentiment_score, interaction_type,
  // created_at, description, recommended_action, acknowledged, source
  const score   = Number(raw.sentiment_score ?? raw.sentiment ?? 35);
  const emotion = raw.emotion ?? scoreToEmotion(score).label;
  return {
    id:                raw.id ?? idx,
    severity:          raw.severity          ?? 'high',
    customer:          raw.customer_name      ?? raw.customer ?? raw.title ?? `Alert ${idx + 1}`,
    sentiment:         Math.round(score),
    interaction:       raw.interaction_type   ?? raw.interaction ?? 'Call',
    timestamp:         raw.created_at         ?? raw.timestamp   ?? new Date().toISOString(),
    issue:             raw.description        ?? raw.issue       ?? '—',
    recommendedAction: raw.recommended_action ?? raw.recommendedAction ?? '—',
    status:            raw.acknowledged ? 'resolved' : (raw.status ?? 'active'),
    emotion,
  };
};

// ── Static fallback (only shown when no DB data available) ────────────────────
const FALLBACK_ALERTS = [
  {
    id: 1, severity: 'critical', customer: 'Acme Corporation',     sentiment: 28,
    interaction: 'Support Call', timestamp: '2025-12-04T09:45:00',
    issue: 'Multiple product failures reported during implementation phase',
    recommendedAction: 'Immediate escalation to senior account manager and technical team',
    status: 'active', emotion: 'Angry',
  },
  {
    id: 2, severity: 'high', customer: 'TechStart Inc.',           sentiment: 35,
    interaction: 'Feedback Session', timestamp: '2025-12-04T09:12:00',
    issue: 'Customer expressed frustration with onboarding process complexity',
    recommendedAction: 'Schedule follow-up call with customer success team within 24 hours',
    status: 'active', emotion: 'Frustrated',
  },
  {
    id: 3, severity: 'medium', customer: 'Global Solutions Ltd.',  sentiment: 42,
    interaction: 'Sales Call', timestamp: '2025-12-04T08:30:00',
    issue: 'Pricing concerns raised during renewal discussion',
    recommendedAction: 'Prepare custom pricing proposal and competitive analysis',
    status: 'in-progress', emotion: 'Frustrated',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
const SentimentAlertFeed = ({ alerts = [], loading = false, onRefresh }) => {
  const rawAlerts   = alerts.length > 0 ? alerts : FALLBACK_ALERTS;
  const isLiveData  = alerts.length > 0;
  const displayList = rawAlerts.map(normaliseAlert);

  return (
    <div className="bg-card rounded-lg p-6 border border-border h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Icon name="Bell" size={20} />
            Emotion-Based Alerts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            High frustration and anger detection
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {loading ? (
            <span className="text-muted-foreground animate-pulse">Loading…</span>
          ) : (
            <span className={`flex items-center gap-1 ${isLiveData ? 'text-emerald-400' : 'text-slate-500'}`}>
              <Icon name="Clock" size={13} />
              {isLiveData ? 'Live' : 'Demo'}
            </span>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div className="divide-y divide-border max-h-[420px] overflow-y-auto flex-1">
        <div className="space-y-3 pr-1">
          {displayList.map((alert) => {
            const statusConfig = getStatusConfig(alert.status);
            const emotion      = scoreToEmotion(alert.sentiment);

            return (
              <div
                key={alert.id}
                className="p-4 rounded-lg border border-primary/30 bg-primary/5 hover:shadow-md transition-all duration-200"
              >
                {/* Emotion tag + status badge */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="Info" size={16} className="text-primary" />
                    <span className={`text-xs font-semibold uppercase ${emotion.color}`}>
                      {alert.emotion} Customer
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>

                {/* Customer name */}
                <h3 className="text-sm font-semibold text-foreground mb-2">{alert.customer}</h3>

                {/* Metrics */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Emotion Score:</span>
                    <span className={`font-medium ${emotion.color}`}>
                      {alert.emotion} ({alert.sentiment}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Interaction:</span>
                    <span className="font-medium text-foreground">{alert.interaction}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium text-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Issue */}
                <div className="mb-3 p-3 bg-background/50 rounded border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Issue:</p>
                  <p className="text-xs text-foreground">{alert.issue}</p>
                </div>

                {/* Recommended action */}
                <div className="mb-3 p-3 bg-primary/5 rounded border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Icon name="Lightbulb" size={12} />
                    Recommended Action:
                  </p>
                  <p className="text-xs text-foreground">{alert.recommendedAction}</p>
                </div>

                <Button variant="default" size="xs" iconName="Eye" fullWidth>
                  View Details
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refresh footer */}
      <div className="mt-4 pt-4 border-t border-border">
        <Button variant="ghost" size="sm" iconName="RefreshCw" fullWidth onClick={onRefresh}>
          Refresh Alerts
        </Button>
      </div>
    </div>
  );
};

export default SentimentAlertFeed;