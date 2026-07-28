import { useState } from 'react';
import { Bot, Send, Upload, FileText, CheckCircle2, BookOpen, Sparkles, RefreshCw, Key } from 'lucide-react';

export default function RAGAssistant() {
  const [symbol, setSymbol] = useState('NABIL');
  const [query, setQuery] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'assistant',
      text: 'Welcome to NEPSE AI Stock Advisor & Financial RAG Assistant. Ask me which stocks to BUY, request target price advice, or query company balance sheets & annual reports.',
      citations: [],
      recommendations: [
        { symbol: "CHCL", signal: "STRONG BUY", confidence: 78.0, targetPrice: "Rs. 540", peRatio: 22.4, dividendYield: 2.5, reason: "Breakout momentum with expanding clean energy cash flows" },
        { symbol: "NABIL", signal: "BUY", confidence: 72.0, targetPrice: "Rs. 650", peRatio: 16.8, dividendYield: 3.8, reason: "Solid tier-1 capital adequacy with high 14.2% ROE" },
        { symbol: "GBIME", signal: "VALUE BUY", confidence: 66.0, targetPrice: "Rs. 285", peRatio: 14.2, dividendYield: 4.2, reason: "Low P/E ratio with high dividend yield support" }
      ],
      groqPowered: false
    }
  ]);

  const [docTitle, setDocTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const sampleQueries = [
    "Which NEPSE stocks are recommended to BUY right now?",
    "Explain why NABIL is recommended as a BUY",
    "Compare NABIL vs GBIME vs CHCL for investment",
    "Which stocks have low P/E ratio and highest dividend yield?"
  ];

  const handleQuerySubmit = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    const userMsg = query;
    setQuery('');
    setChatHistory(prev => [...prev, { type: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/ai/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, query: userMsg, groqApiKey: groqApiKey.trim() || undefined })
      });
      const data = await res.json();
      setChatHistory(prev => [
        ...prev,
        {
          type: 'assistant',
          text: data.answer,
          citations: data.citations || [],
          recommendations: data.recommendations || [],
          groqPowered: data.groqPowered || false
        }
      ]);
    } catch (err) {
      console.error("Failed to query Groq RAG assistant:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('symbol', symbol);
    formData.append('title', docTitle || file.name);
    formData.append('file', file);

    try {
      await fetch('http://localhost:8000/api/v1/rag/upload', {
        method: 'POST',
        body: formData
      });
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="page">
      {/* ── Page Header ── */}
      <div className="page-header investment-page-header">
        <div className="page-header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Bot size={22} style={{ color: 'var(--accent)' }} />
            AI Stock Advisor & RAG Assistant
          </h1>
          <p className="page-subtitle">
            Get explainable Stock Buy/Hold recommendations grounded in disclosures, technical momentum, and fundamental metrics
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: groqApiKey ? '1px solid var(--green)' : '1px solid var(--border)',
              background: groqApiKey ? 'var(--green-soft, rgba(16,185,129,0.15))' : 'var(--bg-surface)',
              color: groqApiKey ? 'var(--green)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Key size={14} />
            {groqApiKey ? 'Groq Key Active' : 'Set Groq API Key'}
          </button>
        </div>
      </div>

      {showKeyInput && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--bg-surface)' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
            Groq API Key (Optional - enables Llama 3.3-70B real-time synthesis):
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="password"
              placeholder="gsk_..."
              value={groqApiKey}
              onChange={e => setGroqApiKey(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                color: 'var(--text-primary)'
              }}
            />
            <button
              onClick={() => setShowKeyInput(false)}
              style={{ padding: '0.4rem 1rem', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Save Key
            </button>
          </div>
        </div>
      )}

      <div className="page-content investment-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Left: Chat Workspace */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: 540, gridColumn: 'span 2' }}>
            {/* Scrip Selector Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Target Scrip / Focus Symbol:</span>
              <select
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="NABIL">NABIL Bank</option>
                <option value="GBIME">GBIME Bank</option>
                <option value="CHCL">Chilime Hydro</option>
                <option value="SHIVM">Shivam Cements</option>
                <option value="NTC">Nepal Telecom</option>
              </select>
            </div>

            {/* Message Feed */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.4rem' }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.75rem', justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.type === 'assistant' && (
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent-soft, rgba(59,130,246,0.15))', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--accent)' }}>
                      <Sparkles size={16} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '85%',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    background: msg.type === 'user' ? 'var(--accent)' : 'var(--bg-surface)',
                    color: msg.type === 'user' ? '#fff' : 'var(--text-primary)',
                    border: msg.type === 'user' ? 'none' : '1px solid var(--border)'
                  }}>
                    <div style={{ whitespace: 'pre-line', lineHeight: '1.5' }}>{msg.text}</div>

                    {/* Stock Recommendation Cards */}
                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Top AI Stock Recommendations:</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                          {msg.recommendations.map((rec, rIdx) => (
                            <div key={rIdx} style={{ background: 'var(--bg-card)', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{rec.symbol}</strong>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: rec.signal.includes('BUY') ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: rec.signal.includes('BUY') ? 'var(--green)' : 'var(--amber)',
                                  border: rec.signal.includes('BUY') ? '1px solid var(--green)' : '1px solid var(--amber)'
                                }}>
                                  {rec.signal}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                Confidence: <strong style={{ color: 'var(--text-primary)' }}>{rec.confidence}%</strong> · Target: <strong style={{ color: 'var(--green)' }}>{rec.targetPrice}</strong>
                              </div>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                                "{rec.reason}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <BookOpen size={12} style={{ color: 'var(--accent)' }} />
                          Grounded Report Citations:
                        </span>
                        {msg.citations.map((c, i) => (
                          <div key={i} style={{ background: 'var(--bg-card)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{c.source} (Chunk #{c.chunkIndex})</strong>
                            <span style={{ fontStyle: 'italic' }}>{c.snippet}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontSize: '0.8rem' }}>
                  <RefreshCw size={16} className="spin" />
                  Retrieving metrics & synthesizing stock recommendations...
                </div>
              )}
            </div>

            {/* Quick Recommendation Prompts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.75rem 0 0.5rem' }}>
              {sampleQueries.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(sq); }}
                  style={{
                    fontSize: '0.74rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.25rem 0.6rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  "{sq}"
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleQuerySubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder={`Ask financial question about ${symbol}...`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.6rem 0.9rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Send size={15} /> Ask
              </button>
            </form>
          </div>

          {/* Right: Upload Report Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Upload size={16} style={{ color: 'var(--green)' }} /> Upload Annual Report PDF
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Upload financial PDF statements or balance sheet notes to index into the vector vector database for {symbol}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Report 2080"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <label style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <FileText size={28} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Select PDF or TXT File</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Up to 25MB report statements</span>
                <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              {uploading && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <RefreshCw size={14} className="spin" /> Chunking and indexing...
                </div>
              )}

              {uploadSuccess && (
                <div style={{ fontSize: '0.78rem', color: 'var(--green)', background: 'var(--green-soft, rgba(16,185,129,0.15))', padding: '0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={15} /> Document indexed successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
