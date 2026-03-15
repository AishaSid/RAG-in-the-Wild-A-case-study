import { useEffect, useMemo, useState } from 'react'

const PIPELINES = [
  { label: 'RAG Fusion', value: 'rag_fusion' },
  { label: 'HyDE', value: 'hyde' },
  { label: 'CRAG', value: 'crag' },
  { label: 'Graph RAG', value: 'graph_rag' },
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
      'How many 3-point attempts did Steve Nash average per game in seasons he made the 50-40-90 club?',
    ],
  },
  {
    domain: 'Movies', icon: '🎬',
    questions: [
      'Who directed Deadpool 2?',
      'Which movie has a higher number of Academy Awards, The Godfather or Pulp Fiction?',
      'Which Academy Awards category did The Color Purple win?',
      'Who was the director for Great Moments in Aviation?',
    ],
  },
  {
    domain: 'Music', icon: '🎵',
    questions: [
      'What iconic band released "Stairway to Heaven" in 1971?',
      'How many Grammys has Beyoncé won throughout her career?',
      'How many times has Taylor Swift won the Grammy Award for Album of the Year?',
      'How many members are part of Red Hot Chili Peppers?',
    ],
  },
  {
    domain: 'General', icon: '🌍',
    questions: [
      'What are the countries that are located in Southern Africa?',
      'Which 3 countries have adopted Bitcoin as legal tender?',
      'What kind of tigers are extinct?',
      'Which animal has a longer gestation period, whale or giraffe?',
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

  useEffect(() => {
    fetch('/api/sample-queries?limit=15')
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
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <style>{globalStyles}</style>
      <div style={styles.bgOrbA} />
      <div style={styles.bgOrbB} />

      {/* ── Sidebar toggle button ── */}
      <button
        style={styles.sidebarToggle}
        onClick={() => setSidebarOpen(true)}
        title="Dataset Info & Recommended Questions"
      >
        <span style={{ fontSize: '1.2rem' }}>📋</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em' }}>DATASET</span>
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

        {/* Stats */}
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
          <div style={{ marginTop: '10px', fontSize: '0.82rem', opacity: 0.75, lineHeight: 1.5 }}>
            CRAG Task 1 & 2 dev set — web-search grounded QA with real retrieved snippets from sources like Britannica, Wikipedia, and financial sites.
          </div>
        </div>

        {/* Domain breakdown */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarSectionTitle}>Domains</div>
          {DATASET_DOMAINS.map((d) => (
            <div key={d.name} style={styles.domainRow}>
              <span style={{ fontSize: '1rem' }}>{d.icon}</span>
              <span style={styles.domainName}>{d.name}</span>
              <div style={styles.domainBarWrap}>
                <div style={{ ...styles.domainBar, width: `${(d.count / 35) * 100}%`, background: d.color }} />
              </div>
              <span style={styles.domainCount}>{d.count}</span>
            </div>
          ))}
          <div style={{ marginTop: '8px', fontSize: '0.78rem', opacity: 0.65 }}>
            ⚠️ Finance questions use real-time data from 2024 — answers may be stale. Great for testing CRAG's correction path.
          </div>
        </div>

        {/* Recommended questions */}
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarSectionTitle}>Recommended Questions</div>
          {RECOMMENDED.map((group) => (
            <div key={group.domain} style={{ marginBottom: '14px' }}>
              <div style={styles.recGroupLabel}>{group.icon} {group.domain}</div>
              {group.questions.map((q) => (
                <button
                  key={q}
                  data-rec
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
          <h1 style={styles.title}>RAG in the Wild Lab</h1>
          <p style={styles.subtitle}>Run and compare RAG Fusion, HyDE, CRAG, and Graph RAG on a shared global corpus.</p>
        </header>

        <section style={styles.panel}>
          <label style={styles.label}>Question</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a factual question..."
            style={styles.textarea}
          />

          <div style={styles.controlsRow}>
            <div style={styles.controlBlock}>
              <label style={styles.label}>Pipeline</label>
              <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} style={styles.select}>
                {PIPELINES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <button style={styles.button} disabled={!canRun} onClick={runQuery}>
              {loading ? 'Running...' : 'Run'}
            </button>
          </div>

          {samples.length > 0 && (
            <div style={styles.samplesWrap}>
              <div style={styles.label}>Sample Queries</div>
              <div style={styles.chips}>
                {samples.map((s, idx) => (
                  <button key={`${idx}-${s.slice(0, 16)}`} style={styles.chip} onClick={() => setQuery(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {error && <div style={styles.error}>{error}</div>}

        {result && (
          <section style={styles.results}>
            <div style={styles.answerCard}>
              <div style={styles.cardTop}>
                <h2 style={styles.cardTitle}>Generated Answer</h2>
                <div style={styles.scoreBadge}>Top score: {Number(result.top_score || 0).toFixed(4)}</div>
              </div>
              <p style={styles.answerText}>{result.answer}</p>
              {result.confidence !== null && result.confidence !== undefined && (
                <div style={styles.metric}>CRAG confidence: {Number(result.confidence).toFixed(4)}</div>
              )}
            </div>

            <div style={styles.retrievalGrid}>
              {(result.retrieved || []).map((chunk, idx) => {
                const src = chunk.source || {}
                return (
                  <article key={`${chunk.chunk_id}-${idx}`} style={styles.chunkCard}>
                    <div style={styles.chunkHead}>
                      <strong>Chunk #{idx + 1}</strong>
                      <span>Score: {Number(chunk.score || 0).toFixed(4)}</span>
                    </div>
                    <p style={styles.chunkText}>{chunk.text}</p>
                    <div style={styles.sourceLine}>{src.page_name || 'Unknown source'}</div>
                    <a href={src.page_url || '#'} target="_blank" rel="noreferrer" style={styles.link}>
                      {src.page_url || 'No URL'}
                    </a>
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
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Space Grotesk', sans-serif; }
  button[data-rec]:hover { background: rgba(42,157,143,0.12) !important; border-color: rgba(42,157,143,0.4) !important; }
`

const styles = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 20% 15%, #f2eadf 0%, #f7f2ea 40%, #f3f8f2 100%)',
    color: '#1f2a1f',
    position: 'relative',
    overflow: 'hidden',
    padding: '24px',
  },
  bgOrbA: {
    position: 'absolute',
    width: '420px',
    height: '420px',
    right: '-120px',
    top: '-120px',
    borderRadius: '999px',
    background: 'rgba(42, 157, 143, 0.18)',
    filter: 'blur(30px)',
  },
  bgOrbB: {
    position: 'absolute',
    width: '360px',
    height: '360px',
    left: '-120px',
    bottom: '-100px',
    borderRadius: '999px',
    background: 'rgba(230, 111, 81, 0.16)',
    filter: 'blur(30px)',
  },
  container: {
    position: 'relative',
    zIndex: 2,
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'grid',
    gap: '18px',
  },
  header: {
    display: 'grid',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.8rem, 2.8vw, 2.8rem)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    opacity: 0.85,
    maxWidth: '65ch',
  },
  panel: {
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(31,42,31,0.12)',
    borderRadius: '14px',
    padding: '16px',
    display: 'grid',
    gap: '12px',
    backdropFilter: 'blur(5px)',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  textarea: {
    width: '100%',
    minHeight: '92px',
    borderRadius: '10px',
    border: '1px solid #bccab6',
    padding: '12px',
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: '1rem',
    background: '#fffefb',
    resize: 'vertical',
  },
  controlsRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'end',
  },
  controlBlock: {
    display: 'grid',
    gap: '6px',
    minWidth: '220px',
    flex: 1,
  },
  select: {
    borderRadius: '10px',
    border: '1px solid #bccab6',
    padding: '10px',
    background: '#fffefb',
    fontFamily: 'Space Grotesk, sans-serif',
  },
  button: {
    border: 'none',
    borderRadius: '12px',
    padding: '11px 20px',
    background: 'linear-gradient(120deg, #2a9d8f, #3f7f8c)',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: '130px',
  },
  samplesWrap: {
    display: 'grid',
    gap: '8px',
  },
  chips: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  chip: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '0.75rem',
    border: '1px solid #b4c4ae',
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#f8fbf6',
    cursor: 'pointer',
  },
  error: {
    borderRadius: '10px',
    border: '1px solid #d62828',
    padding: '10px 12px',
    background: '#ffe5e5',
    color: '#7a1212',
  },
  results: {
    display: 'grid',
    gap: '14px',
  },
  answerCard: {
    background: '#fffefb',
    borderRadius: '14px',
    padding: '14px',
    border: '1px solid rgba(31,42,31,0.15)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.1rem',
  },
  scoreBadge: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '0.78rem',
    background: '#eef5ea',
    border: '1px solid #b4c4ae',
    borderRadius: '999px',
    padding: '4px 8px',
  },
  answerText: {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
  },
  metric: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '0.8rem',
  },
  retrievalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '10px',
  },
  chunkCard: {
    border: '1px solid rgba(31,42,31,0.14)',
    borderRadius: '12px',
    background: '#fdfcf8',
    padding: '12px',
    display: 'grid',
    gap: '8px',
  },
  chunkHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '0.75rem',
  },
  chunkText: {
    margin: 0,
    lineHeight: 1.5,
    fontSize: '0.95rem',
  },
  sourceLine: {
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  link: {
    color: '#1f6f65',
    textDecoration: 'none',
    fontSize: '0.8rem',
    wordBreak: 'break-all',
  },
  // ── Sidebar ──
  sidebarToggle: {
    position: 'fixed',
    top: '50%',
    right: 0,
    transform: 'translateY(-50%)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'linear-gradient(160deg, #2a9d8f, #3f7f8c)',
    color: 'white',
    border: 'none',
    borderRadius: '10px 0 0 10px',
    padding: '14px 10px',
    cursor: 'pointer',
    boxShadow: '-3px 0 12px rgba(42,157,143,0.35)',
    writingMode: 'vertical-rl',
    flexDirection: 'row',
    writingMode: 'initial',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 200,
    backdropFilter: 'blur(2px)',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100vh',
    width: '360px',
    maxWidth: '92vw',
    background: '#f8fbf7',
    borderLeft: '1px solid rgba(31,42,31,0.14)',
    zIndex: 300,
    overflowY: 'auto',
    transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '-6px 0 30px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 20px 14px',
    borderBottom: '1px solid rgba(31,42,31,0.10)',
    position: 'sticky',
    top: 0,
    background: '#f8fbf7',
    zIndex: 1,
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '1.15rem',
    letterSpacing: '-0.01em',
  },
  closeBtn: {
    background: 'none',
    border: '1px solid rgba(31,42,31,0.15)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '4px 10px',
    color: '#1f2a1f',
  },
  sidebarSection: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(31,42,31,0.08)',
  },
  sidebarSectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
    opacity: 0.55,
    marginBottom: '10px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  statBox: {
    background: 'rgba(42,157,143,0.10)',
    border: '1px solid rgba(42,157,143,0.25)',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  statNum: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#2a9d8f',
    fontFamily: 'IBM Plex Mono, monospace',
  },
  statLabel: {
    fontSize: '0.72rem',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  domainRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '7px',
  },
  domainName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    minWidth: '56px',
  },
  domainBarWrap: {
    flex: 1,
    height: '8px',
    background: 'rgba(31,42,31,0.08)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  domainBar: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.4s ease',
  },
  domainCount: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '0.78rem',
    opacity: 0.7,
    minWidth: '22px',
    textAlign: 'right',
  },
  recGroupLabel: {
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    opacity: 0.6,
    marginBottom: '6px',
  },
  recQuestion: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'rgba(255,255,255,0.8)',
    border: '1px solid rgba(31,42,31,0.12)',
    borderRadius: '8px',
    padding: '9px 11px',
    marginBottom: '5px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    lineHeight: 1.4,
    fontFamily: 'Space Grotesk, sans-serif',
    transition: 'background 0.15s, border-color 0.15s',
  },
}
