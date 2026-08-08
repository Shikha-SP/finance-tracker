import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Send, BookOpen, Sparkles, RefreshCw } from 'lucide-react';

export default function RAGAssistant() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'assistant',
      text: 'Namaste! Welcome to your NEPSE AI Financial Advisor. I am powered by Groq Llama-3.3 AI.\n\nAsk me anything about the NEPSE market in plain English — for example: "Which stocks should I buy?", "What can you tell me about GBIME or CHCL?", or "How is the market doing today?"',
      citations: [],
      recommendations: [],
      groqPowered: true
    }
  ]);

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
      const res = await fetch('/api/ai/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg })
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

  const markdownComponents = {
    p: ({ children }) => <p style={{ margin: '0 0 0.55rem', lineHeight: '1.6' }}>{children}</p>,
    h1: ({ children }) => <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.6rem 0 0.4rem', lineHeight: '1.4' }}>{children}</h1>,
    h2: ({ children }) => <h2 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.6rem 0 0.4rem', lineHeight: '1.4' }}>{children}</h2>,
    h3: ({ children }) => <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.6rem 0 0.4rem', lineHeight: '1.4' }}>{children}</h3>,
    h4: ({ children }) => <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.5rem 0 0.35rem', lineHeight: '1.4' }}>{children}</h4>,
    strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--accent)' }}>{children}</strong>,
    em: ({ children }) => <em style={{ color: 'var(--text-muted)' }}>{children}</em>,
    ul: ({ children }) => <ul style={{ margin: '0 0 0.55rem', paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ margin: '0 0 0.55rem', paddingLeft: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>{children}</ol>,
    li: ({ children }) => <li style={{ lineHeight: '1.55' }}>{children}</li>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{children}</a>,
    code: ({ children }) => <code style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.78rem', fontFamily: 'monospace' }}>{children}</code>,
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.6rem 0' }} />
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
      </div>

      <div className="page-content investment-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Chat Workspace */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: 540 }}>
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
                    <div style={{ lineHeight: '1.5' }}>
                      <ReactMarkdown components={markdownComponents}>{msg.text || ''}</ReactMarkdown>
                    </div>

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
                                  background: (rec.signal || '').includes('BUY') ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: (rec.signal || '').includes('BUY') ? 'var(--green)' : 'var(--amber)',
                                  border: (rec.signal || '').includes('BUY') ? '1px solid var(--green)' : '1px solid var(--amber)'
                                }}>
                                  {rec.signal}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                Confidence: <strong style={{ color: 'var(--text-primary)' }}>{rec.confidence}%</strong> · Price: <strong style={{ color: 'var(--green)' }}>Rs {rec.price}</strong>
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

                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <BookOpen size={12} style={{ color: 'var(--accent)' }} />
                          Data Sources:
                        </span>
                        {msg.sources.map((s, i) => (
                          <div key={i} style={{ background: 'var(--bg-card)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                            <span style={{ marginLeft: '0.4rem', color: 'var(--green)', fontWeight: 700 }}>{s.publishedAgo}</span>
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
                placeholder="Ask any financial question about NEPSE stocks (e.g. 'Which stocks should I buy?')"
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
        </div>
      </div>
    </main>
  );
}
