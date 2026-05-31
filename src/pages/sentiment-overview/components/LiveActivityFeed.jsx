import React from 'react';
import Icon from '../../../components/AppIcon';
import { useNavigate } from 'react-router-dom';

const SENTIMENT_BADGES = {
  satisfied: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: 'Smile',       dot: 'bg-emerald-500' },
  neutral:   { bg: 'bg-slate-500/10',   text: 'text-slate-500',   icon: 'Minus',        dot: 'bg-slate-400'   },
  frustrated:{ bg: 'bg-amber-500/10',   text: 'text-amber-600',   icon: 'Frown',        dot: 'bg-amber-500'   },
  angry:     { bg: 'bg-rose-500/10',    text: 'text-rose-600',    icon: 'AlertCircle',  dot: 'bg-rose-500'    },
};

const INTERACTION_LABELS = {
  support_call:       'Support',
  sales_call:         'Sales',
  feedback_session:   'Feedback',
  onboarding_call:    'Onboarding',
  follow_up:          'Follow-up',
};

const LiveActivityFeed = ({ activities }) => {
  const navigate = useNavigate();

  const getSentimentBadge = (sentiment, confidence) => {
    const badge = SENTIMENT_BADGES[sentiment] ?? SENTIMENT_BADGES.neutral;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badge.bg}`}>
          <Icon name={badge.icon} size={13} className={badge.text} />
          <span className={`text-xs font-medium ${badge.text} capitalize`}>{sentiment}</span>
        </div>
        {confidence != null && (
          <span className="text-xs text-muted-foreground">{confidence}% conf.</span>
        )}
      </div>
    );
  };

  const getStatusBadge = (status) => {
    if (status === 'processing') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10">
          <Icon name="Loader" size={13} className="text-blue-500 animate-spin" />
          <span className="text-xs font-medium text-blue-600">Processing</span>
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10">
          <Icon name="XCircle" size={13} className="text-rose-500" />
          <span className="text-xs font-medium text-rose-600">Failed</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10">
        <Icon name="CheckCircle2" size={13} className="text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600">Completed</span>
      </div>
    );
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '—';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const isEmpty = !activities || activities.length === 0;

  return (
    <div className="bg-card border-2 border-border rounded-lg p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recently Processed Queue</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Latest completed &amp; processing calls</p>
        </div>
        {!isEmpty && (
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
            {activities.length} calls
          </span>
        )}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center py-10">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Icon name="PhoneCall" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No recent activity</p>
          <p className="text-xs text-muted-foreground max-w-[180px]">
            Processed calls will appear here in real time
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar flex-grow">
          {activities.map((activity) => (
            <div
              key={activity?.id}
              onClick={() => navigate(`/call-details/${activity?.id}`)}
              className="p-4 bg-muted/20 border border-border rounded-lg hover:border-primary/50 hover:bg-muted/40 transition-all duration-150 cursor-pointer group"
            >
              {/* Top row: customer + time */}
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon name="User" size={16} color="var(--color-primary)" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {activity?.customer}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity?.customerId}
                      {activity?.callRef && (
                        <span className="ml-1.5 text-primary/60">{activity.callRef}</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 mt-0.5">
                  {getTimeAgo(activity?.timestamp)}
                </span>
              </div>

              {/* Status + Sentiment */}
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                {getStatusBadge(activity?.status)}
                {activity?.sentiment && getSentimentBadge(activity?.sentiment, activity?.confidence)}
              </div>

              {/* Transcript snippet */}
              {activity?.transcript && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed">
                  {activity.transcript}
                </p>
              )}

              {/* Footer: duration + interaction type */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Icon name="Clock" size={12} />
                  <span>{activity?.duration ?? '—'}</span>
                </div>
                {activity?.interactionType && (
                  <span className="bg-muted/60 px-2 py-0.5 rounded-md capitalize">
                    {INTERACTION_LABELS[activity.interactionType] ?? activity.interactionType}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveActivityFeed;