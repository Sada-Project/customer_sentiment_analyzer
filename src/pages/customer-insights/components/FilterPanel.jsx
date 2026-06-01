import React, { useMemo } from 'react';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const DEFAULTS = { segment: 'all', interactionType: 'all', sentimentThreshold: 'all', period: '30d' };

const FilterPanel = ({ filters, onFilterChange, onResetFilters }) => {
  const segmentOptions = [
    { value: 'all',        label: 'All Customers' },
    { value: 'enterprise', label: 'Enterprise' },
    { value: 'smb',        label: 'Small & Medium Business' },
    { value: 'individual', label: 'Individual' },
    { value: 'trial',      label: 'Trial Users' },
  ];

  const interactionOptions = [
    { value: 'all',        label: 'All Interactions' },
    { value: 'support',    label: 'Support Calls' },
    { value: 'sales',      label: 'Sales Conversations' },
    { value: 'feedback',   label: 'Feedback Sessions' },
    { value: 'onboarding', label: 'Onboarding Calls' },
  ];

  const sentimentOptions = [
    { value: 'all',      label: 'All Sentiments' },
    { value: 'positive', label: 'Positive (≥70%)' },
    { value: 'neutral',  label: 'Neutral (40-69%)' },
    { value: 'negative', label: 'Negative (<40%)' },
  ];

  const periodOptions = [
    { value: '7d',    label: 'Last 7 Days' },
    { value: '30d',   label: 'Last 30 Days' },
    { value: '90d',   label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];

  // ── Active filter count (exclude defaults) ──────────────────────────────────
  const activeCount = useMemo(() =>
    Object.entries(filters).filter(([k, v]) => v !== DEFAULTS[k]).length,
    [filters]
  );

  // ── Active filter tags (for the pill row) ───────────────────────────────────
  const activeTags = useMemo(() => {
    const tags = [];
    const allOptions = { segment: segmentOptions, interactionType: interactionOptions, sentimentThreshold: sentimentOptions, period: periodOptions };
    Object.entries(filters).forEach(([key, value]) => {
      if (value === DEFAULTS[key]) return;
      const opt = allOptions[key]?.find(o => o.value === value);
      if (opt) tags.push({ key, label: opt.label });
    });
    return tags;
  }, [filters]);

  return (
    <div className="bg-card rounded-lg p-6 border border-border mb-6 transition-all duration-200">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Icon name="Filter" size={20} />
          Advanced Filters
          {/* Active count badge */}
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-primary text-primary-foreground animate-in fade-in slide-in-from-left-1">
              {activeCount}
            </span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          iconName="RotateCcw"
          onClick={onResetFilters}
          disabled={activeCount === 0}
        >
          Reset
        </Button>
      </div>

      {/* ── Dropdowns — real-time (onChange fires loadData via parent useEffect) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Select
          label="Customer Segment"
          options={segmentOptions}
          value={filters?.segment}
          onChange={(value) => onFilterChange('segment', value)}
          placeholder="Select segment"
          searchable
        />

        <Select
          label="Interaction Type"
          options={interactionOptions}
          value={filters?.interactionType}
          onChange={(value) => onFilterChange('interactionType', value)}
          placeholder="Select type"
          searchable
        />

        <Select
          label="Sentiment Threshold"
          options={sentimentOptions}
          value={filters?.sentimentThreshold}
          onChange={(value) => onFilterChange('sentimentThreshold', value)}
          placeholder="Select threshold"
        />

        <Select
          label="Time Period"
          options={periodOptions}
          value={filters?.period}
          onChange={(value) => onFilterChange('period', value)}
          placeholder="Select period"
        />
      </div>

      {/* ── Active filter tags ── */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground self-center">Active:</span>
          {activeTags.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onFilterChange(key, DEFAULTS[key])}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors animate-in fade-in slide-in-from-bottom-1"
            >
              {label}
              <Icon name="X" size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;