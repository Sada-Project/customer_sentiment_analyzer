import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Animated counter ───────────────────────────────────────────────────────────
function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

const StatCard = ({ value, suffix = '', label, inView }) => {
  const count = useCounter(value, 2200, inView);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#F8FAFC', marginBottom: '0.4rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
    </div>
  );
};

// ── Main Landing Page ─────────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const [statsRef, statsInView] = useInView(0.3);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ─── palette exactly matching the system's dark theme ─── */
  const C = {
    bg: '#0F172A',   // slate-900  — system --color-background dark
    card: '#1E293B',   // slate-800  — system --color-card dark
    card2: '#0F172A',   // slate-900  — deeper card
    border: '#334155',   // slate-700  — system --color-border dark
    text: '#F8FAFC',   // slate-50   — system --color-foreground dark
    muted: '#94A3B8',   // slate-400  — system --color-muted-foreground dark
    mutedBg: '#334155',   // slate-700
    primary: '#3B82F6',   // blue-500   — system --color-primary
    secondary: '#6366F1',   // indigo-500 — system --color-secondary
    success: '#10B981',   // emerald-500
    warning: '#F59E0B',   // amber-500
    error: '#EF4444',   // red-500
  };

  const btnPrimary = {
    padding: '0.75rem 1.8rem',
    borderRadius: '0.5rem',
    background: C.primary,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: `0 4px 20px ${C.primary}55`,
    transition: 'all 0.2s',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '-0.01em',
  };

  const btnSecondary = {
    padding: '0.75rem 1.8rem',
    borderRadius: '0.5rem',
    background: 'transparent',
    color: C.text,
    fontWeight: 600,
    fontSize: '0.9rem',
    border: `1px solid ${C.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Inter, sans-serif',
  };

  const sectionLabel = {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: C.primary,
    marginBottom: '0.8rem',
    textAlign: 'center',
  };

  const features = [
    { icon: '🧠', title: 'AI Sentiment Detection', desc: 'Gemini AI classifies every call as Satisfied, Neutral, Frustrated, or Angry — in real time with 98% accuracy.', accent: C.secondary },
    { icon: '🎙️', title: 'Voice Analysis', desc: 'Upload any call recording and get instant transcription, sentiment breakdown, and keyword highlights.', accent: C.primary },
    { icon: '📊', title: 'Live Dashboard', desc: 'Real-time overview of CSAT, FCR, emotion distribution, and agent performance — always up to date.', accent: C.success },
    { icon: '👥', title: 'Agent Performance', desc: 'Track every agent\'s CSAT, calls handled, resolution rate, and handle time. Find top performers instantly.', accent: C.warning },
    { icon: '🔍', title: 'Customer Insights', desc: 'Deep dive into individual customer journeys — full call history, emotion patterns, and resolutions.', accent: '#8b5cf6' },
    { icon: '⚡', title: 'Real-Time Alerts', desc: 'Instant notifications when frustration is detected so supervisors can step in before escalation.', accent: C.error },
  ];

  const steps = [
    { n: '01', title: 'Upload a Call Recording', desc: 'Drag and drop any MP3, WAV or M4A file into the system.' },
    { n: '02', title: 'AI Analyzes Instantly', desc: 'Gemini AI transcribes speech and classifies sentiment within seconds.' },
    { n: '03', title: 'View Real-Time Results', desc: 'Dashboard updates live with CSAT scores, emotion tags, and agent stats.' },
    { n: '04', title: 'Act on the Insights', desc: 'Coach agents, export reports, and track improvement over time.' },
  ];

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif', background: C.bg, color: C.text, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.9rem 2rem',
        background: scrolled ? `${C.card}ee` : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
        transition: 'all 0.3s',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', boxShadow: `0 0 16px ${C.primary}55`,
          }}>🎯</div>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>SentimentAI</span>
        </div>

        {/* Nav actions */}
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button style={{ ...btnSecondary, padding: '0.5rem 1.2rem', fontSize: '0.82rem' }}
            onClick={() => navigate('/login-screen')}>Sign In</button>
          <button style={{ ...btnPrimary, padding: '0.5rem 1.2rem', fontSize: '0.82rem' }}
            onClick={() => navigate('/login-screen')}>Get Started →</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        padding: '8rem 1.5rem 5rem',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle background glow blobs */}
        <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: `radial-gradient(ellipse, ${C.primary}18, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: -100, width: 400, height: 400, background: `radial-gradient(ellipse, ${C.secondary}15, transparent 70%)`, pointerEvents: 'none' }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.3rem 1rem',
          borderRadius: 999, background: `${C.primary}18`,
          border: `1px solid ${C.primary}40`,
          fontSize: '0.75rem', fontWeight: 600, color: C.primary,
          marginBottom: '1.8rem', letterSpacing: '0.02em',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary, animation: 'lp-blink 2s infinite' }} />
          AI-Powered · Real-Time · Enterprise Ready
        </div>

        <h1 style={{
          fontSize: 'clamp(2.6rem, 7vw, 5rem)',
          fontWeight: 900,
          lineHeight: 1.07,
          letterSpacing: '-0.03em',
          marginBottom: '1.4rem',
          color: C.text,
        }}>
          Understand Every<br />
          <span style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.secondary} 60%, #8b5cf6 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Customer Emotion
          </span><br />
          Instantly
        </h1>

        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', color: C.muted, maxWidth: 560, lineHeight: 1.75, marginBottom: '2.5rem' }}>
          Transform your call center with AI that reads between the lines.
          Detect sentiment, coach agents, and boost satisfaction — all in real time.
        </p>

        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button style={{ ...btnPrimary, fontSize: '0.95rem', padding: '0.85rem 2rem' }} onClick={() => navigate('/login-screen')}>
            Start Analyzing Calls →
          </button>
          <button style={{ ...btnSecondary, fontSize: '0.95rem', padding: '0.85rem 2rem' }} onClick={() => navigate('/login-screen')}>
            View Demo
          </button>
        </div>

        {/* ── Mini dashboard preview ── */}
        <div style={{ marginTop: '4.5rem', width: '100%', maxWidth: 900, position: 'relative' }}>
          {/* glow under window */}
          <div style={{ position: 'absolute', inset: '-30px', background: `radial-gradient(ellipse at 50% 80%, ${C.primary}18, transparent 65%)`, pointerEvents: 'none' }} />

          <div style={{
            borderRadius: 14, border: `1px solid ${C.border}`,
            background: C.card, overflow: 'hidden',
            boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px ${C.border}`,
          }}>
            {/* Window chrome bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1rem', background: C.card2, borderBottom: `1px solid ${C.border}` }}>
              {['#EF4444', '#F59E0B', '#10B981'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
              <span style={{ fontSize: '0.68rem', color: C.muted, marginLeft: '0.4rem' }}>SentimentAI — Sentiment Overview</span>
            </div>

            {/* KPI cards row */}
            <div style={{ padding: '1.2rem', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.8rem' }}>
              {[
                { label: 'Calls Today', value: '1,284', change: '↑ 12%', changeColor: C.success, fill: 78, fillColor: C.primary },
                { label: 'Avg CSAT', value: '87%', change: '↑ 4%', changeColor: C.success, fill: 87, fillColor: C.secondary },
                { label: 'Satisfied', value: '73%', change: 'Dominant', changeColor: C.primary, fill: 73, fillColor: C.success },
                { label: 'Online Agents', value: '24', change: '● Live', changeColor: C.success, fill: 60, fillColor: C.primary },
              ].map((k, i) => (
                <div key={i} style={{ background: C.card2, borderRadius: 10, padding: '0.9rem', border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: '0.62rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{k.label}</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: C.text }}>{k.value}</div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 600, color: k.changeColor, marginTop: '0.2rem' }}>{k.change}</div>
                  <div style={{ height: 3, borderRadius: 2, background: C.mutedBg, marginTop: '0.5rem' }}>
                    <div style={{ height: '100%', width: `${k.fill}%`, borderRadius: 2, background: k.fillColor }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Chart area mockup */}
            <div style={{ padding: '0 1.2rem 1.2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              {['Sentiment Distribution', 'Agent Performance'].map((title, idx) => (
                <div key={idx} style={{ background: C.card2, borderRadius: 10, padding: '0.9rem', border: `1px solid ${C.border}`, height: 80 }}>
                  <div style={{ fontSize: '0.62rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
                    {[45, 62, 38, 75, 55, 82, 65, 90, 70, 85, 72, 88].map((h, j) => (
                      <div key={j} style={{
                        flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0',
                        background: idx === 0
                          ? [C.success, C.muted, C.warning, C.error][j % 4]
                          : C.primary,
                        opacity: 0.75,
                      }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* ── Features ── */}
      <div style={{ padding: '5.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={sectionLabel}>Capabilities</div>
        <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)', fontWeight: 900, textAlign: 'center', letterSpacing: '-0.03em', marginBottom: '0.8rem' }}>
          Everything Your Call Center Needs
        </h2>
        <p style={{ textAlign: 'center', color: C.muted, maxWidth: 500, margin: '0 auto 3rem', lineHeight: 1.7 }}>
          A complete AI platform that listens, understands, and acts — turning every call into actionable intelligence.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: '1rem' }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '1.5rem',
              transition: 'all 0.25s', cursor: 'default',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = f.accent + '60'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.3)`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10, marginBottom: '1rem',
                background: `${f.accent}20`, border: `1px solid ${f.accent}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
              }}>{f.icon}</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: '0.5rem' }}>{f.title}</h3>
              <p style={{ fontSize: '0.83rem', color: C.muted, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '5.5rem 2rem' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={sectionLabel}>How It Works</div>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, textAlign: 'center', letterSpacing: '-0.03em', marginBottom: '0.8rem' }}>
            From Call to Insight in Seconds
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: '2.5rem', lineHeight: 1.7 }}>
            No complex setup required. Upload a recording and watch the AI work.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {steps.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '1.1rem',
                padding: '1.2rem 1.4rem',
                background: C.card2, border: `1px solid ${C.border}`,
                borderRadius: 10, transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary + '50'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.78rem', color: '#fff',
                  boxShadow: `0 4px 12px ${C.primary}44`,
                }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{s.title}</div>
                  <div style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: '5.5rem 2rem' }}>
        <div style={{
          maxWidth: 820, margin: '0 auto',
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: '4rem 2rem',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: `radial-gradient(ellipse, ${C.primary}15, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={sectionLabel}>Get Started Today</div>
          <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.8rem' }}>
            Ready to Transform Your<br />
            <span style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Call Center?
            </span>
          </h2>
          <p style={{ color: C.muted, marginBottom: '2rem', lineHeight: 1.7 }}>
            Join forward-thinking teams using AI to understand customers at scale.
          </p>
          <div style={{ display: 'flex', gap: '0.9rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={{ ...btnPrimary, fontSize: '0.95rem', padding: '0.85rem 2rem' }} onClick={() => navigate('/login-screen')}>
              Get Started Free →
            </button>
            <button style={{ ...btnSecondary, fontSize: '0.95rem', padding: '0.85rem 2rem' }} onClick={() => navigate('/login-screen')}>
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '1.8rem 2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '0.4rem' }}>
          <span style={{ fontWeight: 700, color: C.primary }}>SentimentAI</span>
          {' '}— Customer Sentiment Analyzer Platform
        </div>
        <div style={{ fontSize: '0.8rem', color: C.muted }}>
          Built with ❤️ using React, Supabase & Gemini AI · Graduation Project 2026
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes lp-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
};

export default LandingPage;
