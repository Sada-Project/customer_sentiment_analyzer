import React, { useState, useEffect, useMemo } from 'react';
import { Wordcloud } from '@visx/wordcloud';
import { scaleLog } from '@visx/scale';
import { Text } from '@visx/text';
import Icon from '../../../components/AppIcon';
import { fetchKeywords } from '../../../services/customerInsightsService';

// ── Sentiment bias → color category ──────────────────────────────────────────
// DB column `sentiment_bias` holds Gemini values:
//   'satisfied' | 'frustrated' | 'angry' | 'neutral'
// We normalise to the three chart categories: positive / neutral / negative
function mapSentiment(bias) {
  if (!bias) return 'neutral';
  const b = String(bias).toLowerCase();
  if (b === 'positive'  || b === 'satisfied') return 'positive';
  if (b === 'negative'  || b === 'frustrated' || b === 'angry') return 'negative';
  if (b === 'pos')  return 'positive';
  if (b === 'neg')  return 'negative';
  // Numeric fallback
  const n = Number(bias);
  if (!isNaN(n)) {
    if (n > 0.2)  return 'positive';
    if (n < -0.2) return 'negative';
  }
  return 'neutral';
}

/**
 * Maps a raw row from fetchKeywords (keywords table) into the shape that
 * @visx/wordcloud expects: { text, value, sentiment }
 *
 * DB shape: { word, frequency, weight, sentiment_bias }
 */
function mapKeywordRow(row) {
  return {
    text:      row.word ?? '',
    value:     Number(row.frequency ?? row.weight ?? 1),
    sentiment: mapSentiment(row.sentiment_bias),
  };
}

// ── Static fallback shown when backend returns no data ───────────────────────
const FALLBACK_KEYWORDS = [
  { text: 'Cancel',       value: 145, sentiment: 'negative' },
  { text: 'Slow',         value: 132, sentiment: 'negative' },
  { text: 'Expensive',    value:  98, sentiment: 'negative' },
  { text: 'Broken',       value:  87, sentiment: 'negative' },
  { text: 'Disappointed', value:  76, sentiment: 'negative' },
  { text: 'Frustrated',   value:  65, sentiment: 'negative' },
  { text: 'Error',        value:  54, sentiment: 'negative' },
  { text: 'Problem',      value:  48, sentiment: 'negative' },
  { text: 'Confused',     value:  42, sentiment: 'negative' },
  { text: 'Unresponsive', value:  38, sentiment: 'negative' },
  { text: 'Difficult',    value:  35, sentiment: 'negative' },
  { text: 'Complicated',  value:  32, sentiment: 'negative' },
  { text: 'Helpful',      value: 156, sentiment: 'positive' },
  { text: 'Fast',         value: 143, sentiment: 'positive' },
  { text: 'Thanks',       value: 129, sentiment: 'positive' },
  { text: 'Excellent',    value: 112, sentiment: 'positive' },
  { text: 'Amazing',      value:  98, sentiment: 'positive' },
  { text: 'Perfect',      value:  87, sentiment: 'positive' },
  { text: 'Great',        value:  78, sentiment: 'positive' },
  { text: 'Love',         value:  72, sentiment: 'positive' },
  { text: 'Appreciate',   value:  65, sentiment: 'positive' },
  { text: 'Wonderful',    value:  58, sentiment: 'positive' },
  { text: 'Satisfied',    value:  52, sentiment: 'positive' },
  { text: 'Happy',        value:  48, sentiment: 'positive' },
  { text: 'Support',      value: 189, sentiment: 'neutral'  },
  { text: 'Account',      value: 167, sentiment: 'neutral'  },
  { text: 'Update',       value: 154, sentiment: 'neutral'  },
  { text: 'Feature',      value: 142, sentiment: 'neutral'  },
  { text: 'Question',     value: 128, sentiment: 'neutral'  },
  { text: 'Need',         value: 115, sentiment: 'neutral'  },
  { text: 'Please',       value: 103, sentiment: 'neutral'  },
  { text: 'Help',         value:  95, sentiment: 'neutral'  },
  { text: 'Check',        value:  82, sentiment: 'neutral'  },
  { text: 'Request',      value:  76, sentiment: 'neutral'  },
  { text: 'Information',  value:  68, sentiment: 'neutral'  },
  { text: 'Service',      value:  62, sentiment: 'neutral'  },
  { text: 'Contact',      value:  55, sentiment: 'neutral'  },
  { text: 'Process',      value:  48, sentiment: 'neutral'  },
  { text: 'System',       value:  42, sentiment: 'neutral'  },
  { text: 'Status',       value:  38, sentiment: 'neutral'  },
];

// ─────────────────────────────────────────────────────────────────────────────

const KeywordWordCloud = () => {
  const [rawKeywords, setRawKeywords] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    fetchKeywords(50)
      .then(data  => setRawKeywords(data))
      .catch(err  => setError(err.message ?? 'Failed to load keywords'))
      .finally(() => setLoading(false));
  }, []);

  // Map backend rows → word cloud words; fall back to static data when empty
  const keywords = useMemo(() => {
    if (rawKeywords.length > 0) return rawKeywords.map(mapKeywordRow);
    return FALLBACK_KEYWORDS;
  }, [rawKeywords]);

  const isLive = rawKeywords.length > 0;

  const getWordColor = (word) => {
    if (word?.sentiment === 'negative') return '#ef4444';
    if (word?.sentiment === 'positive') return '#10b981';
    return '#64748b';
  };

  const fontScale = useMemo(() =>
    scaleLog({
      domain: [Math.min(...keywords?.map(w => w?.value) || [0]), Math.max(...keywords?.map(w => w?.value) || [0])],
      range: [14, 60],
    }),
    [keywords]
  );

  const fontSizeSetter = (datum) => fontScale(datum?.value);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Keyword Frequency Analysis</h3>
          <p className="text-slate-400 text-sm">Top 50 recurring words from calls in the last 24 hours</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Loading spinner */}
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 animate-pulse">
              <Icon name="Loader2" size={14} className="animate-spin" />
              Loading…
            </span>
          )}
          {/* Live / Demo badge */}
          {!loading && isLive && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live Data
            </span>
          )}
          {!loading && !isLive && (
            <span className="text-xs text-slate-500">Demo Data</span>
          )}
          <Icon name="MessageSquare" size={20} className="text-purple-400" />
          <span className="text-xs text-slate-400">Word Cloud</span>
        </div>
      </div>

      {/* Error banner — non-blocking */}
      {error && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <Icon name="AlertTriangle" size={14} className="text-rose-400 flex-shrink-0" />
          <p className="text-xs text-rose-400">{error} — showing demo data instead.</p>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-slate-400">Positive Keywords</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-slate-500"></div>
          <span className="text-slate-400">Neutral Keywords</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
          <span className="text-slate-400">Negative Keywords</span>
        </div>
      </div>

      {/* Word Cloud */}
      <div className="bg-slate-900/30 rounded-lg p-4" style={{ height: '400px' }}>
        <svg width="100%" height="100%">
          <Wordcloud
            words={keywords}
            width={800}
            height={400}
            fontSize={fontSizeSetter}
            font="Inter, sans-serif"
            padding={2}
            spiral="archimedean"
            rotate={0}
            random={() => 0.5}
          >
            {(cloudWords) =>
              cloudWords?.map((w, i) => (
                <Text
                  key={w?.text}
                  fill={getWordColor(w)}
                  textAnchor="middle"
                  transform={`translate(${w?.x}, ${w?.y}) rotate(${w?.rotate})`}
                  fontSize={w?.size}
                  fontFamily={w?.font}
                  fontWeight="bold"
                  style={{ cursor: 'pointer' }}
                  onClick={() => console.log('Word clicked:', w)}
                >
                  {w?.text}
                </Text>
              ))
            }
          </Wordcloud>
        </svg>
      </div>

      {/* Stats footer */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="TrendingUp" size={16} className="text-emerald-400" />
            <span className="text-emerald-400 text-xs font-semibold">Positive</span>
          </div>
          <p className="text-white text-2xl font-bold">
            {keywords?.filter(k => k?.sentiment === 'positive')?.length}
          </p>
          <p className="text-slate-400 text-xs">keywords</p>
        </div>

        <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Minus" size={16} className="text-slate-400" />
            <span className="text-slate-400 text-xs font-semibold">Neutral</span>
          </div>
          <p className="text-white text-2xl font-bold">
            {keywords?.filter(k => k?.sentiment === 'neutral')?.length}
          </p>
          <p className="text-slate-400 text-xs">keywords</p>
        </div>

        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="TrendingDown" size={16} className="text-rose-400" />
            <span className="text-rose-400 text-xs font-semibold">Negative</span>
          </div>
          <p className="text-white text-2xl font-bold">
            {keywords?.filter(k => k?.sentiment === 'negative')?.length}
          </p>
          <p className="text-slate-400 text-xs">keywords</p>
        </div>
      </div>
    </div>
  );
};

export default KeywordWordCloud;