import { useEffect, useMemo, useState } from 'react'

const PIPELINES = [
  {
    label: 'RAG Fusion (Recommended)', value: 'rag_fusion',
    desc: 'Generates multiple query variants, retrieves for each independently, then merges all results using Reciprocal Rank Fusion (RRF) for robust, diverse ranking.',
  },
  {
    label: 'HyDE', value: 'hyde',
    desc: 'Hypothetical Document Embeddings — generates a plausible fake answer first, then retrieves real corpus chunks by embedding similarity to that hypothetical answer.',
  },
  {
    label: 'CRAG', value: 'crag',
    desc: 'Corrective RAG — judges retrieval quality as CORRECT / AMBIGUOUS / INCORRECT and falls back to model internal knowledge when retrieval confidence is low. Cites sources in IEEE style.',
  },
  {
    label: 'Graph RAG', value: 'graph_rag',
    desc: 'Seeds retrieval with vector search, then expands the result set by traversing keyword-based entity links across the full CRAG corpus.',
  },
]

const DATASET_DOMAINS = [
  { name: 'Finance', count: 35, color: '#e67f44', icon: '📈' },
  { name: 'Movie', count: 31, color: '#7b5ea7', icon: '🎬' },
  { name: 'Sports', count: 28, color: '#2a9d8f', icon: '🏆' },
  { name: 'Open', count: 26, color: '#457b9d', icon: '🌍' },
  { name: 'Music', count: 16, color: '#e63946', icon: '🎵' },
]

const RECOMMENDED = [
  {
    domain: 'Sports', icon: '🏆',
    questions: [
      'How many grand slams has Novak Djokovic won on clay courts?',
      'Which sport is the most watched in the US, football or basketball?',
      'By how many points did the Tennessee Titans beat the St. Louis Rams in the 2000 Super Bowl?',
    ],
  },
  {
    domain: 'Movies', icon: '🎬',
    questions: [
      'Who directed Deadpool 2?',
      'Which movie has a higher number of Academy Awards, The Godfather or Pulp Fiction?',
      'Which Academy Awards category did The Color Purple win?',
    ],
  },
  {
    domain: 'Music', icon: '🎵',
    questions: [
      'What iconic band released "Stairway to Heaven" in 1971?',
      'How many Grammys has Beyoncé won throughout her career?',
      'How many times has Taylor Swift won the Grammy Award for Album of the Year?',
    ],
  },
]

export default function App() {
  const [query, setQuery] = useState('')
  const [pipeline, setPipeline] = useState('rag_fusion')
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/sample-queries?limit=10')
      .then((r) => r.json())
      .then((data) => {
        setSamples(Array.isArray(data.samples) ? data.samples : [])
      })
      .catch(() => {
        setSamples([])
      })
  }, [])

  const canRun = useMemo(() => query.trim().length > 0 && !loading, [query, loading])

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
      if (!res.ok) {
        throw new Error(data.error || 'Request failed')
      }
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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = result.answer
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={styles.page}>
      <style>{globalStyles}</style>
      <div style={styles.bgGlow} />

      {/* ── Sidebar toggle button ── */}
      <button
        style={styles.sidebarToggle}
        onClick={() => setSidebarOpen(true)}
        title="Dataset Info & Recommended Questions"
      >
        <span style={{ fontSize: '1.2rem' }}>📋</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em' }}>DATASET</span>
      </button>

      {/* ── Sidebar overlay ── */}
      {sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar panel ── */}
      <aside style={{ ...styles.sidebar, transform: sidebarOpen ? 'translateX(0)' : 'translateX(105%)' }}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Dataset Guide</h2>
          <button style={styles.closeBtn} onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <div style={styles.sidebarSection}>
          <div style={styles.sidebarSectionTitle}>Overview</div>
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <span style={styles.statNum}>136</span>
              <span style={styles.statLabel}>Total Records</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statNum}>5</span>
              <span style={styles.statLabel}>Domains</span>
            </div>
          </div>
          <p style={styles.sidebarDesc}>
            CRAG Task 1 & 2 dev set — web-search grounded QA with real retrieved snippets from sources like Britannica, Wikipedia, and financial sites.
          </p>
        </div>

        <div style={styles.sidebarSection}>
          <div style={styles.sidebarSectionTitle}>Recommended Queries</div>
          {RECOMMENDED.map((group) => (
            <div key={group.domain} style={{ marginBottom: '16px' }}>
              <div style={styles.recGroupLabel}>{group.icon} {group.domain}</div>
              {group.questions.map((q) => (
                <button
                  key={q}
                  className="rec-btn"
                  style={styles.recQuestion}
                  onClick={() => { setQuery(q); setSidebarOpen(false) }}
                >
                  {q}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main style={styles.container}>
        <header style={styles.header}>
          <div style={styles.badge}>Phase 2 Implementation</div>
          <h1 style={styles.title}>RAG Evaluation Lab</h1>
          <p style={styles.subtitle}>
            Test and compare advanced retrieval strategies (RAG Fusion, HyDE, CRAG, Graph RAG) against a noisy web corpus.
          </p>
        </header>

        <section style={styles.queryPanel}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Enter your question</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Who directed Inception?"
              style={styles.textarea}
            />
          </div>

          <div style={styles.controlsRow}>
            <div style={styles.controlBlock}>
              <label style={styles.label}>Select Pipeline</label>
              <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} style={styles.select}>
                {PIPELINES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {PIPELINES.find(p => p.value === pipeline)?.desc && (
                <p style={styles.pipelineDesc}>
                  <span style={{ color: '#4f46e5', fontWeight: 700 }}>ℹ</span>{' '}
                  {PIPELINES.find(p => p.value === pipeline).desc}
                </p>
              )}
            </div>

            <button style={{...styles.button, opacity: canRun ? 1 : 0.6}} disabled={!canRun} onClick={runQuery}>
              {loading ? (
                <span><span className="spinner">↻</span> Processing...</span>
              ) : 'Run Pipeline'}
            </button>
          </div>

          {samples.length > 0 && (
            <div style={styles.samplesWrap}>
              <span style={styles.label}>Quick Tests:</span>
              <div style={styles.chips}>
                {samples.map((s, idx) => (
                  <button key={idx} className="chip-btn" style={styles.chip} onClick={() => setQuery(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {error && <div style={styles.error}><strong>Error:</strong> {error}</div>}

        {!result && !error && !loading && (
          <section style={styles.emptyState}>
            <div style={styles.emptyIcon}>🔍</div>
            <h3 style={styles.emptyTitle}>Ready to explore</h3>
            <p style={styles.emptyText}>
              Type a question above and select a pipeline to compare retrieval strategies across the CRAG corpus.
            </p>
          </section>
        )}

        {result && (
          <section style={styles.resultsArea}>
            {/* Primary Answer Card */}
            <div style={styles.answerCard}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitleWrap}>
                  <span style={styles.icon}>✨</span>
                  <h2 style={styles.cardTitle}>Generated Answer</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {result.confidence && (
                    <div style={styles.confidenceBadge}>
                      CRAG Assessment: <strong>{result.confidence.toUpperCase()}</strong>
                    </div>
                  )}
                  <button
                    className="copy-btn"
                    style={{ ...styles.copyBtn, ...(copied ? styles.copiedBtn : {}) }}
                    onClick={copyAnswer}
                    title="Copy answer to clipboard"
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div style={styles.answerContent}>
                {result.answer || "The model could not generate an answer."}
              </div>
            </div>

            {/* Retrieved Chunks Grid */}
            <div style={styles.chunksHeader}>
              <h3 style={styles.chunksTitle}>Retrieved Context</h3>
              <span style={styles.sourceBadge}>
                {result.retrieved?.length || 0} Sources Found
              </span>
            </div>

            <div style={styles.retrievalGrid}>
              {(result.retrieved || []).map((chunk, idx) => {
                const score = chunk.score != null ? Number(chunk.score).toFixed(4) : 'N/A';
                return (
                  <article key={idx} style={styles.chunkCard}>
                    <div style={styles.chunkHead}>
                      <span style={styles.chunkId}>Source [{idx + 1}]</span>
                      <span style={styles.scorePill}>Score: {score}</span>
                    </div>
                    <p style={styles.chunkText}>"{chunk.text}"</p>
                    {chunk.source && (
                      <div style={styles.chunkFooter}>
                        <a href={chunk.source} target="_blank" rel="noreferrer" style={styles.link}>
                          View Source ↗
                        </a>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  
  * { box-sizing: border-box; }
  body { 
    margin: 0; 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
    background-color: #f4f4f5;
    color: #18181b;
  }
  
  .rec-btn:hover { background: #f4f4f5 !important; border-color: #d4d4d8 !important; }
  .chip-btn:hover { background: #e0e7ff !important; border-color: #c7d2fe !important; color: #4338ca !important;}
  
  .spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
    margin-right: 8px;
  }
  @keyframes spin { 100% { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  
  .copy-btn:hover { background: #e4e4e7 !important; }
`

const styles = {
  page: {
    minHeight: '100vh',
    position: 'relative',
    overflowX: 'hidden',
    padding: '40px 24px',
  },
  bgGlow: {
    position: 'absolute',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    height: '600px',
    background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, rgba(255,255,255,0) 70%)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  container: {
    position: 'relative',
    zIndex: 2,
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  badge: {
    background: '#e0e7ff',
    color: '#4338ca',
    padding: '6px 14px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: '#09090b',
  },
  subtitle: {
    margin: 0,
    fontSize: '1.05rem',
    color: '#52525b',
    maxWidth: '600px',
    lineHeight: 1.5,
  },
  queryPanel: {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#3f3f46',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    borderRadius: '12px',
    border: '1px solid #d4d4d8',
    padding: '16px',
    fontFamily: 'inherit',
    fontSize: '1rem',
    background: '#fafafa',
    resize: 'vertical',
    transition: 'border-color 0.2s',
    outline: 'none',
  },
  controlsRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  controlBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '200px',
  },
  select: {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid #d4d4d8',
    padding: '12px 16px',
    fontSize: '0.95rem',
    background: '#fafafa',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  },
  button: {
    background: '#18181b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 28px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
    minWidth: '160px',
    height: '46px',
  },
  samplesWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  chips: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  chip: {
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    border: '1px solid #e4e4e7',
    borderRadius: '999px',
    padding: '6px 12px',
    background: '#ffffff',
    color: '#52525b',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: '16px',
    borderRadius: '12px',
    fontSize: '0.95rem',
  },
  resultsArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    animation: 'fadeIn 0.5s ease-out',
  },
  answerCard: {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f4f4f5',
  },
  cardTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  icon: {
    fontSize: '1.5rem',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#18181b',
  },
  confidenceBadge: {
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontFamily: "'JetBrains Mono', monospace",
  },
  answerContent: {
    fontSize: '1.05rem',
    lineHeight: 1.7,
    color: '#3f3f46',
    whiteSpace: 'pre-wrap',
  },
  chunksHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: '0 8px',
  },
  chunksTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#18181b',
  },
  chunksMeta: {
    fontSize: '0.85rem',
    color: '#71717a',
  },
  retrievalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  chunkCard: {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'box-shadow 0.2s, transform 0.2s',
  },
  chunkHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chunkId: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#71717a',
    textTransform: 'uppercase',
  },
  scorePill: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.75rem',
    background: '#f4f4f5',
    color: '#52525b',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #e4e4e7',
  },
  chunkText: {
    margin: 0,
    fontSize: '0.9rem',
    lineHeight: 1.6,
    color: '#3f3f46',
    flex: 1,
  },
  chunkFooter: {
    marginTop: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #f4f4f5',
  },
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  // Sidebar styling remains largely structurally the same, just updated colors
  sidebarToggle: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    borderRadius: '999px',
    padding: '10px 20px',
    cursor: 'pointer',
    color: '#18181b',
    transition: 'all 0.2s',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(9, 9, 11, 0.4)',
    zIndex: 200,
    backdropFilter: 'blur(3px)',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100vh',
    width: '380px',
    maxWidth: '100vw',
    background: '#ffffff',
    borderLeft: '1px solid #e4e4e7',
    zIndex: 300,
    overflowY: 'auto',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid #e4e4e7',
    position: 'sticky',
    top: 0,
    background: '#ffffff',
    zIndex: 1,
  },
  sidebarTitle: { margin: 0, fontSize: '1.2rem', fontWeight: 600 },
  closeBtn: {
    background: '#f4f4f5',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#52525b',
  },
  sidebarSection: { padding: '24px', borderBottom: '1px solid #f4f4f5' },
  sidebarSectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#71717a',
    marginBottom: '16px',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  statBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statNum: { fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', fontFamily: "'JetBrains Mono', monospace" },
  statLabel: { fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: '4px' },
  sidebarDesc: { fontSize: '0.9rem', color: '#52525b', lineHeight: 1.6, marginTop: '16px' },
  recGroupLabel: { fontSize: '0.9rem', fontWeight: 600, color: '#3f3f46', marginBottom: '10px' },
  recQuestion: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    lineHeight: 1.4,
    color: '#3f3f46',
    transition: 'all 0.2s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '16px',
    textAlign: 'center',
    animation: 'fadeIn 0.4s ease-out',
  },
  emptyIcon: {
    fontSize: '3.5rem',
    marginBottom: '16px',
  },
  emptyTitle: {
    margin: '0 0 10px',
    fontSize: '1.3rem',
    fontWeight: 600,
    color: '#18181b',
  },
  emptyText: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#71717a',
    maxWidth: '440px',
    lineHeight: 1.6,
  },
  copyBtn: {
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    fontWeight: 600,
    background: '#f4f4f5',
    color: '#3f3f46',
    border: '1px solid #e4e4e7',
    borderRadius: '8px',
    padding: '6px 14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  copiedBtn: {
    background: '#f0fdf4',
    color: '#166534',
    borderColor: '#bbf7d0',
  },
  pipelineDesc: {
    margin: '8px 0 0',
    fontSize: '0.8rem',
    color: '#52525b',
    lineHeight: 1.5,
    background: '#f8f8ff',
    border: '1px solid #e0e7ff',
    borderRadius: '8px',
    padding: '8px 12px',
  },
  sourceBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.75rem',
    fontWeight: 600,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    padding: '4px 12px',
    borderRadius: '999px',
  },
}