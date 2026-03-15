import { useEffect, useMemo, useState } from 'react'

const PIPELINES = [
  {
    label: 'RAG Fusion',
    tag: 'Recommended',
    value: 'rag_fusion',
    desc: 'Generates multiple query variants, retrieves for each independently, then merges all results using Reciprocal Rank Fusion (RRF) for robust, diverse ranking.',
    icon: '⚡',
  },
  {
    label: 'HyDE',
    tag: 'Hypothetical',
    value: 'hyde',
    desc: 'Hypothetical Document Embeddings — generates a plausible fake answer first, then retrieves real corpus chunks by embedding similarity to that hypothetical answer.',
    icon: '💡',
  },
  {
    label: 'CRAG',
    tag: 'Corrective',
    value: 'crag',
    desc: 'Corrective RAG — judges retrieval quality as CORRECT / AMBIGUOUS / INCORRECT and falls back to model internal knowledge when retrieval confidence is low. Cites sources in IEEE style.',
    icon: '🛡',
  },
  {
    label: 'Graph RAG',
    tag: 'Entity Graph',
    value: 'graph_rag',
    desc: 'Seeds retrieval with vector search, then expands the result set by traversing keyword-based entity links across the full CRAG corpus.',
    icon: '🕸',
  },
]

const DATASET_DOMAINS = [
  { name: 'Finance', count: 35, color: '#f97316', pct: 26 },
  { name: 'Movie', count: 31, color: '#a855f7', pct: 23 },
  { name: 'Sports', count: 28, color: '#2dd4bf', pct: 21 },
  { name: 'Open', count: 26, color: '#3b82f6', pct: 19 },
  { name: 'Music', count: 16, color: '#f43f5e', pct: 12 },
]

const RECOMMENDED = [
  {
    domain: 'Sports',
    icon: '🏆',
    color: '#2dd4bf',
    questions: [
      'How many grand slams has Novak Djokovic won on clay courts?',
      'Which sport is the most watched in the US, football or basketball?',
      'By how many points did the Tennessee Titans beat the St. Louis Rams in the 2000 Super Bowl?',
    ],
  },
  {
    domain: 'Movies',
    icon: '🎬',
    color: '#a855f7',
    questions: [
      'Who directed Deadpool 2?',
      'Which movie has a higher number of Academy Awards, The Godfather or Pulp Fiction?',
      'Which Academy Awards category did The Color Purple win?',
    ],
  },
  {
    domain: 'Music',
    icon: '🎵',
    color: '#f43f5e',
    questions: [
      'What iconic band released "Stairway to Heaven" in 1971?',
      'How many Grammys has Beyoncé won throughout her career?',
      'How many times has Taylor Swift won the Grammy Award for Album of the Year?',
    ],
  },
]

const LLM_PROVIDER = 'Gemini 1.5 Flash'
const LLM_STATUS = 'operational'

function ConfidenceBar({ score }) {
  const pct = Math.min(100, Math.max(0, Math.round(score * 100)))
  const color = pct >= 75 ? '#2dd4bf' : pct >= 50 ? '#f97316' : '#f43f5e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '5px', background: '#1e293b', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: '99px',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 6px ${color}88`,
        }} />
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color, minWidth: '38px' }}>
        {pct}%
      </span>
    </div>
  )
}

function Skeleton({ height = 18, width = '100%', style = {} }) {
  return (
    <div style={{
      height, width, borderRadius: 6,
      background: 'linear-gradient(90deg, #1e293b 25%, #263548 50%, #1e293b 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: '#0f172a', border: '1px solid #1e2d3d', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={14} width="35%" />
        <Skeleton height={18} />
        <Skeleton height={18} width="90%" />
        <Skeleton height={18} width="80%" />
        <Skeleton height={18} width="60%" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: '#0f172a', border: '1px solid #1e2d3d', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={12} width="40%" />
            <Skeleton height={5} />
            <Skeleton height={14} />
            <Skeleton height={14} width="85%" />
            <Skeleton height={14} width="70%" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [pipeline, setPipeline] = useState('rag_fusion')
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [openAccordion, setOpenAccordion] = useState(null)
  const [chipHover, setChipHover] = useState(null)
  const [recHover, setRecHover] = useState(null)
  const [searchRec, setSearchRec] = useState('')

  useEffect(() => {
    fetch('/api/sample-queries?limit=10')
      .then(r => r.json())
      .then(data => setSamples(Array.isArray(data.samples) ? data.samples : []))
      .catch(() => setSamples([]))
  }, [])

  const canRun = useMemo(() => query.trim().length > 0 && !loading, [query, loading])
  const activePipeline = PIPELINES.find(p => p.value === pipeline)
  const s = baseStyles

  const filteredRec = useMemo(() => {
    if (!searchRec.trim()) return RECOMMENDED
    const q = searchRec.toLowerCase()
    return RECOMMENDED.map(group => ({
      ...group,
      questions: group.questions.filter(qs => qs.toLowerCase().includes(q)),
    })).filter(g => g.questions.length > 0)
  }, [searchRec])

  const runQuery = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, pipeline }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setResult(data)
    } catch (e) {
      setError(e.message || 'Error connecting to the backend. Is it running?')
    } finally {
      setLoading(false)
    }
  }

  const copyAnswer = () => {
    if (!result?.answer) return
    navigator.clipboard.writeText(result.answer).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = result.answer
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={s.page}>
      <style>{css}</style>

      {/* Ambient background */}
      <div style={s.ambient1} />
      <div style={s.ambient2} />

      {/* Sidebar toggle */}
      <button
        className="sidebar-toggle-btn"
        style={s.sidebarToggle}
        onClick={() => setSidebarOpen(true)}
        title="Dataset Info & Recommended Questions"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 9h3M15 15h3"/>
        </svg>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' }}>DATASET</span>
      </button>

      {/* Overlay */}
      {sidebarOpen && <div style={s.overlay} onClick={() => setSidebarOpen(false)} />}

      {/* ─── SIDEBAR ─── */}
      <aside style={{ ...s.sidebar, transform: sidebarOpen ? 'translateX(0)' : 'translateX(105%)' }}>
        {/* Header */}
        <div style={s.sidebarHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={s.sidebarLogo}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
            <span style={s.sidebarTitle}>Dataset Guide</span>
          </div>
          <button style={s.closeBtn} onClick={() => setSidebarOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* System Status */}
        <div style={s.sidebarSection}>
          <div style={s.sectionLabel}>System Status</div>
          <div style={s.statusCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={s.statusDot} />
              <span style={s.statusText}>All systems operational</span>
            </div>
            <div style={s.statusProvider}>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Active LLM</span>
              <span style={s.providerBadge}>{LLM_PROVIDER}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={s.sidebarSection}>
          <div style={s.sectionLabel}>Corpus Overview</div>
          <div style={s.statsRow}>
            <div style={s.infoCard}>
              <span style={s.infoNum}>136</span>
              <span style={s.infoLabel}>Total Records</span>
              <div style={s.infoAccent} />
            </div>
            <div style={s.infoCard}>
              <span style={s.infoNum}>5</span>
              <span style={s.infoLabel}>Domains</span>
              <div style={s.infoAccent} />
            </div>
          </div>

          {/* Domain breakdown */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DATASET_DOMAINS.map(d => (
              <div key={d.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>{d.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: d.color }}>{d.count}</span>
                </div>
                <div style={{ height: 4, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${d.pct}%`, background: d.color, borderRadius: 99, boxShadow: `0 0 6px ${d.color}66` }} />
                </div>
              </div>
            ))}
          </div>
          <p style={s.sidebarDesc}>
            CRAG Task 1 &amp; 2 dev set — web-search grounded QA with real retrieved snippets from Britannica, Wikipedia, and financial sites.
          </p>
        </div>

        {/* Recommended queries */}
        <div style={s.sidebarSection}>
          <div style={s.sectionLabel}>Recommended Queries</div>
          <div style={s.recSearch}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              style={s.recSearchInput}
              placeholder="Filter questions…"
              value={searchRec}
              onChange={e => setSearchRec(e.target.value)}
            />
          </div>
          {filteredRec.map(group => (
            <div key={group.domain} style={{ marginBottom: 6 }}>
              <button
                style={{ ...s.accordionHead, ...(openAccordion === group.domain ? s.accordionHeadOpen : {}) }}
                onClick={() => setOpenAccordion(openAccordion === group.domain ? null : group.domain)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{group.icon}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>{group.domain}</span>
                  <span style={{ fontSize: '0.74rem', background: '#0f2035', color: '#94a3b8', borderRadius: 99, padding: '1px 7px' }}>
                    {group.questions.length}
                  </span>
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: openAccordion === group.domain ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {openAccordion === group.domain && (
                <div style={s.accordionBody}>
                  {group.questions.map((q, qi) => (
                    <button
                      key={qi}
                      style={{
                        ...s.recQuestion,
                        ...(recHover === `${group.domain}-${qi}` ? s.recQuestionHover : {}),
                        borderLeft: `2px solid ${group.color}`,
                      }}
                      onMouseEnter={() => setRecHover(`${group.domain}-${qi}`)}
                      onMouseLeave={() => setRecHover(null)}
                      onClick={() => { setQuery(q); setSidebarOpen(false) }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filteredRec.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>No questions match.</p>
          )}
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main style={s.container}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.badge}>
            <span style={s.badgeDot} />
            Phase 2 Implementation
          </div>
          <h1 style={s.title}>RAG Evaluation <span style={s.titleAccent}>Lab</span></h1>
          <p style={s.subtitle}>
            Test and compare advanced retrieval strategies against a noisy web corpus.
          </p>
        </header>

        {/* Pipeline selector cards */}
        <div style={s.pipelineGrid}>
          {PIPELINES.map(p => (
            <button
              key={p.value}
              style={{
                ...s.pipelineCard,
                ...(pipeline === p.value ? s.pipelineCardActive : {}),
              }}
              onClick={() => setPipeline(p.value)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                {p.tag && (
                  <span style={{
                    ...s.pipelineTag,
                    ...(pipeline === p.value ? s.pipelineTagActive : {}),
                  }}>{p.tag}</span>
                )}
              </div>
              <span style={{ ...s.pipelineName, ...(pipeline === p.value ? { color: '#2dd4bf' } : {}) }}>{p.label}</span>
              {pipeline === p.value && (
                <p style={s.pipelineDesc}>{p.desc}</p>
              )}
            </button>
          ))}
        </div>

        {/* Query panel */}
        <section style={s.queryPanel}>
          <div style={s.inputGroup}>
            <label style={s.label}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight: 6 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              Query
            </label>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g., Who directed Inception?"
              style={s.textarea}
              className="rag-textarea"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canRun) runQuery() }}
            />
            <span style={s.textareaHint}>⌘ Enter to run</span>
          </div>

          <div style={s.runRow}>
            <button
              className="run-btn"
              style={{ ...s.button, opacity: canRun ? 1 : 0.45 }}
              disabled={!canRun}
              onClick={runQuery}
            >
              {loading ? (
                <>
                  <span className="spin-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  </span>
                  Processing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Run Pipeline
                </>
              )}
            </button>
          </div>

          {samples.length > 0 && (
            <div style={s.samplesWrap}>
              <span style={s.samplesLabel}>Quick tests</span>
              <div style={s.chips}>
                {samples.map((sample, idx) => (
                  <button
                    key={idx}
                    style={{
                      ...s.chip,
                      ...(chipHover === idx ? s.chipHover : {}),
                    }}
                    onMouseEnter={() => setChipHover(idx)}
                    onMouseLeave={() => setChipHover(null)}
                    onClick={() => setQuery(sample)}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Error */}
        {error && (
          <div style={s.errorBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            <span><strong>Error:</strong> {error}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <LoadingSkeleton />}

        {/* Empty state */}
        {!result && !error && !loading && (
          <section style={s.emptyState}>
            <div style={s.emptyGlyph}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <h3 style={s.emptyTitle}>Ready to explore</h3>
            <p style={s.emptyText}>
              Type a question above, choose a pipeline, and run to compare retrieval strategies across the CRAG corpus.
            </p>
          </section>
        )}

        {/* Results */}
        {result && !loading && (
          <section style={s.resultsArea}>
            {/* Answer card */}
            <div style={s.answerCard}>
              <div style={s.answerCardBar} />
              <div style={s.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={s.answerIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <h2 style={s.cardTitle}>Generated Answer</h2>
                  <span style={s.pipelinePill}>
                    {PIPELINES.find(p => p.value === pipeline)?.icon} {PIPELINES.find(p => p.value === pipeline)?.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.confidence && (
                    <span style={{
                      ...s.confBadge,
                      background: result.confidence === 'correct' ? '#0d2e1a' : result.confidence === 'ambiguous' ? '#1e1707' : '#200d0d',
                      color: result.confidence === 'correct' ? '#34d399' : result.confidence === 'ambiguous' ? '#fbbf24' : '#f87171',
                      border: `1px solid ${result.confidence === 'correct' ? '#065f46' : result.confidence === 'ambiguous' ? '#78350f' : '#7f1d1d'}`,
                    }}>
                      CRAG: {result.confidence.toUpperCase()}
                    </span>
                  )}
                  <button
                    style={{ ...s.copyBtn, ...(copied ? s.copiedBtn : {}) }}
                    onClick={copyAnswer}
                    className="copy-action-btn"
                  >
                    {copied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p style={s.answerText}>{result.answer || 'The model could not generate an answer.'}</p>
            </div>

            {/* Retrieved chunks */}
            {(result.retrieved?.length ?? 0) > 0 && (
              <>
                <div style={s.chunksHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={s.chunksTitle}>Retrieved Context</h3>
                  </div>
                  <span style={s.sourcesCount}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {result.retrieved.length} sources
                  </span>
                </div>

                <div style={s.chunkGrid}>
                  {result.retrieved.map((chunk, idx) => {
                    const rawScore = chunk.score != null ? Number(chunk.score) : null
                    const displayScore = rawScore != null ? rawScore.toFixed(4) : 'N/A'
                    return (
                      <article key={idx} style={s.chunkCard} className="chunk-card">
                        <div style={s.chunkTop}>
                          <span style={s.chunkIndex}>Source [{idx + 1}]</span>
                          <span style={s.chunkScorePill}>{displayScore}</span>
                        </div>
                        {rawScore != null && <ConfidenceBar score={rawScore} />}
                        <p style={s.chunkText}>"{chunk.text}"</p>
                        {chunk.source && (
                          <div style={s.chunkFooter}>
                            <a href={chunk.source} target="_blank" rel="noreferrer" style={s.chunkLink}>
                              View Source
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 4 }}>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </a>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

/* ─────────────────────────────── CSS ─────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Sora:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #020b18;
    color: #e2e8f0;
    -webkit-font-smoothing: antialiased;
    transition: background 0.25s ease, color 0.25s ease;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(45,212,191,0.3); }
    50%       { box-shadow: 0 0 0 6px rgba(45,212,191,0); }
  }
  @keyframes dotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .spin-icon svg { animation: spin 0.9s linear infinite; }

  .rag-textarea:focus {
    border-color: #2dd4bf !important;
    box-shadow: 0 0 0 3px rgba(45,212,191,0.12) !important;
  }

  .run-btn:hover:not(:disabled) {
    background: #0d9488 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 8px 24px rgba(45,212,191,0.25) !important;
  }
  .run-btn:active:not(:disabled) { transform: translateY(0) !important; }

  .sidebar-toggle-btn:hover {
    background: #0f1f33 !important;
    border-color: #2dd4bf !important;
    color: #2dd4bf !important;
  }

  .copy-action-btn:hover {
    background: #1e293b !important;
    color: #e2e8f0 !important;
  }

  .chunk-card:hover {
    border-color: #1e3a4a !important;
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.4) !important;
  }
`

/* ─────────────────────────────── STYLES ─────────────────────────────── */
const baseStyles = {
  page: {
    minHeight: '100vh',
    position: 'relative',
    overflowX: 'hidden',
    padding: '48px 24px 80px',
  },
  ambient1: {
    position: 'fixed', top: '-15%', left: '30%',
    width: 600, height: 600,
    background: 'radial-gradient(circle, rgba(45,212,191,0.06) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  ambient2: {
    position: 'fixed', bottom: '10%', right: '-10%',
    width: 500, height: 500,
    background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },

  /* ── Sidebar toggle ── */
  sidebarToggle: {
    position: 'fixed', top: 24, right: 24, zIndex: 100,
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#0a1628',
    border: '1px solid #1e2d3d',
    borderRadius: 999,
    padding: '10px 18px',
    cursor: 'pointer',
    color: '#cbd5e1',
    fontSize: '0.8rem',
    transition: 'all 0.2s',
    backdropFilter: 'blur(12px)',
  },

  /* ── Overlay ── */
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(2,11,24,0.75)',
    zIndex: 200,
    backdropFilter: 'blur(4px)',
  },

  /* ── Sidebar ── */
  sidebar: {
    position: 'fixed', top: 0, right: 0,
    height: '100vh', width: 400, maxWidth: '100vw',
    background: '#080f1e',
    borderLeft: '1px solid #0f2035',
    zIndex: 300,
    overflowY: 'auto',
    transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
  },
  sidebarHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #0f2035',
    position: 'sticky', top: 0,
    background: '#080f1e',
    zIndex: 1,
  },
  sidebarLogo: {
    width: 28, height: 28,
    background: '#0a1f1e',
    border: '1px solid #134040',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sidebarTitle: { fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' },
  closeBtn: {
    background: '#0f1f33', border: '1px solid #1e2d3d',
    borderRadius: 8, width: 30, height: 30,
    cursor: 'pointer', color: '#94a3b8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  },
  sidebarSection: { padding: '20px 24px', borderBottom: '1px solid #0a1628' },
  sectionLabel: {
    fontSize: '0.74rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: '#64748b', marginBottom: 14,
  },

  /* Status card */
  statusCard: {
    background: '#0a1628',
    border: '1px solid #0f2035',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  statusDot: {
    width: 7, height: 7,
    borderRadius: '50%',
    background: '#2dd4bf',
    animation: 'dotPulse 2s ease-in-out infinite',
  },
  statusText: { fontSize: '0.86rem', color: '#cbd5e1', fontWeight: 500 },
  statusProvider: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  providerBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.7rem', fontWeight: 500,
    background: '#0a1f1e', color: '#2dd4bf',
    border: '1px solid #134040',
    borderRadius: 6, padding: '3px 10px',
  },

  /* Info cards */
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  infoCard: {
    background: '#0a1628',
    border: '1px solid #0f2035',
    borderRadius: 12, padding: '16px 14px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    position: 'relative', overflow: 'hidden', gap: 4,
  },
  infoNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '1.75rem', fontWeight: 700, color: '#2dd4bf',
    lineHeight: 1,
  },
  infoLabel: { fontSize: '0.7rem', color: '#475569', fontWeight: 500 },
  infoAccent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, background: 'linear-gradient(90deg, #2dd4bf44, transparent)',
  },

  sidebarDesc: {
    fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.65, marginTop: 16,
  },

  /* Recommended search */
  recSearch: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#0a1628', border: '1px solid #0f2035',
    borderRadius: 8, padding: '8px 12px', marginBottom: 12,
  },
  recSearchInput: {
    flex: 1, background: 'transparent', border: 'none',
    outline: 'none', fontSize: '0.85rem', color: '#cbd5e1',
    fontFamily: "'Sora', sans-serif",
  },

  /* Accordion */
  accordionHead: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#0a1628', border: '1px solid #0f2035',
    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
    transition: 'border-color 0.2s', marginBottom: 4,
  },
  accordionHeadOpen: {
    borderColor: '#134040', borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
  },
  accordionBody: { background: '#060d1a', border: '1px solid #0f2035', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden', marginBottom: 4 },
  recQuestion: {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'transparent', border: 'none', borderBottom: '1px solid #0a1628',
    padding: '11px 14px', cursor: 'pointer',
    fontSize: '0.86rem', lineHeight: 1.5, color: '#94a3b8',
    transition: 'all 0.15s',
  },
  recQuestionHover: { background: '#0a1f1e', color: '#e2e8f0' },

  /* ── Main container ── */
  container: {
    position: 'relative', zIndex: 2,
    maxWidth: 900, margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: 28,
  },

  /* Header */
  header: {
    textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    animation: 'fadeUp 0.5s ease-out',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: '#0a1f1e', border: '1px solid #134040',
    color: '#2dd4bf',
    padding: '5px 14px', borderRadius: 999,
    fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  badgeDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#2dd4bf',
    animation: 'pulseGlow 2s ease-in-out infinite',
  },
  title: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: '#f1f5f9',
    lineHeight: 1.1,
  },
  titleAccent: { color: '#2dd4bf' },
  subtitle: {
    fontSize: '1.06rem', color: '#94a3b8', maxWidth: 520, lineHeight: 1.6,
  },

  /* Pipeline grid */
  pipelineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 10,
  },
  pipelineCard: {
    background: '#080f1e', border: '1px solid #0f2035',
    borderRadius: 12, padding: '16px',
    cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.2s',
    outline: 'none',
  },
  pipelineCardActive: {
    background: '#0a1f1e', border: '1px solid #1a4a47',
    boxShadow: '0 0 0 1px #1a4a47, inset 0 0 20px rgba(45,212,191,0.04)',
  },
  pipelineTag: {
    fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase',
    background: '#0f2035', color: '#94a3b8',
    borderRadius: 99, padding: '2px 8px',
    border: '1px solid #1e2d3d',
  },
  pipelineTagActive: { background: '#0a2e2b', color: '#2dd4bf', border: '1px solid #134040' },
  pipelineName: {
    display: 'block',
    fontSize: '0.94rem', fontWeight: 600, color: '#cbd5e1',
    marginTop: 4,
  },
  pipelineDesc: {
    marginTop: 8,
    fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.55,
    animation: 'fadeUp 0.2s ease-out',
  },

  /* Query panel */
  queryPanel: {
    background: '#080f1e',
    border: '1px solid #0f2035',
    borderRadius: 16, padding: '24px',
    display: 'flex', flexDirection: 'column', gap: 18,
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: {
    display: 'flex', alignItems: 'center',
    fontSize: '0.8rem', fontWeight: 600,
    color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  textarea: {
    width: '100%', minHeight: 96,
    background: '#060d1a',
    border: '1px solid #0f2035',
    borderRadius: 10, padding: '14px 16px',
    fontFamily: "'Sora', sans-serif",
    fontSize: '1rem', color: '#e2e8f0',
    resize: 'vertical', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    lineHeight: 1.6,
  },
  textareaHint: { fontSize: '0.74rem', color: '#94a3b8', alignSelf: 'flex-end' },
  runRow: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' },
  button: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: '#0d9488', color: '#fff',
    border: 'none', borderRadius: 10,
    padding: '12px 28px',
    fontSize: '0.92rem', fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Sora', sans-serif",
    letterSpacing: '0.02em',
  },

  samplesWrap: {
    display: 'flex', flexDirection: 'column', gap: 10,
    paddingTop: 4, borderTop: '1px solid #0a1628',
  },
  samplesLabel: { fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '0.8rem',
    border: '1px solid #0f2035',
    borderRadius: 999, padding: '6px 14px',
    background: '#060d1a', color: '#94a3b8',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  chipHover: { background: '#0a1f1e', borderColor: '#134040', color: '#2dd4bf' },

  /* Error */
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#200d0d', border: '1px solid #3f1515',
    color: '#fca5a5', padding: '14px 18px',
    borderRadius: 10, fontSize: '0.92rem',
  },

  /* Empty state */
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '72px 24px',
    background: '#080f1e', border: '1px solid #0f2035',
    borderRadius: 16, textAlign: 'center',
    animation: 'fadeUp 0.4s ease-out',
  },
  emptyGlyph: {
    width: 64, height: 64,
    background: '#0a1f1e', border: '1px solid #134040',
    borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: '1.25rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 10 },
  emptyText: { fontSize: '0.95rem', color: '#94a3b8', maxWidth: 440, lineHeight: 1.65 },

  /* Results */
  resultsArea: { display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp 0.4s ease-out' },

  /* Answer card */
  answerCard: {
    background: '#080f1e',
    border: '1px solid #1a4a47',
    borderRadius: 16, padding: '28px 32px',
    position: 'relative', overflow: 'hidden',
    boxShadow: '0 0 40px rgba(45,212,191,0.06)',
  },
  answerCardBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 2,
    background: 'linear-gradient(90deg, #2dd4bf, #0ea5e9)',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingBottom: 16,
    borderBottom: '1px solid #0a1628',
  },
  answerIcon: {
    width: 30, height: 30,
    background: '#0a1f1e', border: '1px solid #134040',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: '1.08rem', fontWeight: 600, color: '#f1f5f9' },
  pipelinePill: {
    fontSize: '0.75rem', fontWeight: 600,
    background: '#0a1628', color: '#cbd5e1',
    border: '1px solid #0f2035',
    borderRadius: 99, padding: '3px 10px',
    marginLeft: 8,
  },
  confBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.7rem', fontWeight: 600,
    borderRadius: 6, padding: '4px 10px',
  },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: "'Sora', sans-serif",
    fontSize: '0.8rem', fontWeight: 600,
    background: '#0f2035', color: '#cbd5e1',
    border: '1px solid #0f2035',
    borderRadius: 8, padding: '6px 14px',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  copiedBtn: {
    background: '#0a2e1a', color: '#34d399',
    border: '1px solid #065f46',
  },
  answerText: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: '1.16rem', lineHeight: 1.82,
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    letterSpacing: '0.01em',
  },

  /* Chunks */
  chunksHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 4px',
  },
  chunksTitle: { fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  sourcesCount: {
    display: 'inline-flex', alignItems: 'center',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    background: '#0a1628', color: '#cbd5e1',
    border: '1px solid #0f2035',
    borderRadius: 99, padding: '4px 12px',
  },
  chunkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
    gap: 14,
  },
  chunkCard: {
    background: '#080f1e', border: '1px solid #0f2035',
    borderRadius: 12, padding: '20px',
    display: 'flex', flexDirection: 'column', gap: 12,
    transition: 'all 0.2s', cursor: 'default',
  },
  chunkTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chunkIndex: {
    fontSize: '0.72rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8',
  },
  chunkScorePill: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    background: '#060d1a', color: '#cbd5e1',
    border: '1px solid #0f2035',
    borderRadius: 6, padding: '3px 8px',
  },
  chunkText: {
    fontSize: '0.9rem', lineHeight: 1.68, color: '#cbd5e1', flex: 1,
    fontStyle: 'italic',
  },
  chunkFooter: { paddingTop: 10, borderTop: '1px solid #0a1628' },
  chunkLink: {
    display: 'inline-flex', alignItems: 'center',
    color: '#2dd4bf', fontSize: '0.8rem', fontWeight: 600,
    textDecoration: 'none', transition: 'opacity 0.15s',
  },
}
