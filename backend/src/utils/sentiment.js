// Transparent lexicon-based news sentiment (-1..+1) with recency decay.
// Mirrors the AI engine's proven Python scorer (data_collector.py) so results
// are consistent, but runs entirely in Node — no API keys, works forever.

const POS_WORDS = [
  'rise', 'rises', 'rising', 'gain', 'gains', 'gained', 'profit', 'profits', 'profitable',
  'growth', 'growing', 'bull', 'bullish', 'upward', 'surge', 'surges', 'soars', 'soar',
  'rally', 'rallies', 'boost', 'boosted', 'strong', 'stronger', 'beat', 'beats',
  'positive', 'rebound', 'rebounds', 'jump', 'jumps', 'record', 'records',
  'improve', 'improves', 'improved', 'increase', 'increases', 'increased', 'upgrade',
  'upgrades', 'surpass', 'turnaround', 'recover', 'recovers', 'recovery', 'expansion',
  'outperform', 'approval', 'approved', 'approves', 'dividend', 'bonus', 'bonus share',
  'buyback', 'high', 'higher', 'highest', 'peak', 'milestone', 'strong demand',
  'gross profit', 'operating profit', 'net profit', 'profit rises', 'profit jumps',
  'earnings grow', 'earnings rise', 'exceeds', 'exceeded', 'exceed', 'solid',
  'excellent', 'breakthrough', 'nairam', 'nairamma', 'nafa', 'labh', 'daam', 'badhi',
  'booms', 'booming', 'stable', 'stability', 'resilient', 'steady', 'flourish',
  'attract', 'attracts', 'attracted', 'investment surge', 'record high', 'outlook positive',
];

const NEG_WORDS = [
  'fall', 'falls', 'falling', 'drop', 'drops', 'dropped', 'loss', 'losses', 'losing',
  'bear', 'bearish', 'decline', 'declines', 'declining', 'down', 'lower', 'low',
  'risk', 'risky', 'crisis', 'plunge', 'plunges', 'slump', 'slumps', 'weaken',
  'weak', 'weaker', 'miss', 'misses', 'negative', 'debt', 'default', 'defaults',
  'sell', 'selling', 'reduce', 'reduces', 'reduced', 'cut', 'cuts', 'cutting',
  'worry', 'worries', 'crash', 'warning', 'warns', 'fraud', 'scam', 'penalty',
  'fine', 'penalized', 'decrease', 'decreases', 'decreased', 'downgrade', 'downgrades',
  'underperform', 'concern', 'concerns', 'suspension', 'suspended', 'halt', 'halts',
  'impairment', 'non-performing', 'bad debt', 'npl', 'npls', 'loss making',
  'loss-making', 'bankrupt', 'insolvency', 'liquidation', 'delisted', 'delisting',
  'probe', 'investigation', 'fired', 'resign', 'resignation', 'scandal', 'collapse',
  'collapsed', 'unrest', 'protest', 'strike', 'slowdown', 'slows', 'hike', 'hiked',
  'ghata', 'ghataa', 'jala', 'bajaar', 'daru', 'sastaima', 'baahira',
  'failure', 'fail', 'fails', 'failing', 'tough', 'struggle', 'struggles', 'struggling',
  'volatile', 'volatility', 'unstable', 'threat', 'threatens', 'worsen', 'worsens',
  'worsening', 'bleak', 'unemployment', 'inflation', 'layoff', 'layoffs', 'tariff',
  'conflict', 'shortage', 'shortages', 'insufficient', 'stagnant', 'stagnation',
  'turbulence', 'selloff', 'sell-off', 'deteriorate', 'deteriorating', 'deficit',
];

const POS_PHRASES = [
  'reports profit', 'reported profit', 'profit rises', 'profit jumps', 'profit grows',
  'earnings rise', 'exceeds expectation', 'exceeds expectations', 'above expectation',
  'dividend approved', 'bonus approved', 'record profit', 'positive outlook',
  'outperform expectation', 'turnaround profit', 'approves dividend', 'approves bonus',
  'strong earnings', 'naira profit', 'boosted by', 'surges on', 'no loss', 'no decline',
  'not affected', 'no impact', 'no losses', 'profit making', 'in profit',
];

const NEG_PHRASES = [
  'loss widens', 'net loss', 'profit warning', 'earnings miss', 'misses estimates',
  'below expectation', 'below expectations', 'default risk', 'risk of default',
  'fraud investigation', 'suspension of trading', 'rights issue', 'rights share',
  'more losses', 'deeper losses', 'shares slump', 'higher failure rate', 'failure rate',
  'record high failure', 'rising inflation', 'soaring prices', 'price surge hurts',
];

const INTENSIFY = new Set(['record', 'huge', 'massive', 'sharp', 'strong', 'strongly', 'significant', 'surge', 'soar', 'plunge', 'crash', 'plummet', 'rocket', 'stellar', 'exceptional', 'dramatic', 'heavy']);
const DAMPEN = new Set(['slight', 'slightly', 'mild', 'modest', 'minor', 'small', 'gradual']);
const NEGATORS = ['no ', 'not ', 'never ', 'denies ', 'denied ', 'refuses ', 'failed to ', 'fails to ', 'unable to ', 'without ', 'less ', 'lower '];

const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function scoreTitleSentiment(title) {
  if (!title) return 0;
  const lower = String(title).toLowerCase();
  let score = 0;
  const seen = new Set();

  const addHits = (words, base, sign) => {
    for (const w of words) {
      if (seen.has(w)) continue;
      const re = new RegExp(`\\b${esc(w)}\\b`, 'g');
      let m;
      while ((m = re.exec(lower)) !== null) {
        seen.add(w);
        const start = Math.max(0, m.index - 6);
        const ctx = lower.slice(start, m.index + w.length);
        let mult = 1.0;
        for (const mod of INTENSIFY) {
          if (ctx.includes(mod)) { mult = 1.5; break; }
        }
        for (const mod of DAMPEN) {
          if (new RegExp(`\\b${esc(mod)}\\b`).test(ctx)) { mult = 0.5; break; }
        }
        const negated = NEGATORS.some(n => ctx.includes(n));
        score += base * mult * (negated ? -sign : sign);
        break; // count each word once
      }
    }
  };

  addHits(POS_WORDS, 0.22, 1);
  addHits(NEG_WORDS, 0.22, -1);

  for (const p of POS_PHRASES) if (lower.includes(p)) score += 0.3;
  for (const p of NEG_PHRASES) if (lower.includes(p)) score -= 0.35;

  if (lower.includes('!')) score += score >= 0 ? 0.1 : -0.1;

  return Math.round(clamp(score, -1, 1) * 100) / 100;
}

// ── Recency decay ────────────────────────────────────────────────────────────
// A headline's influence on price fades as it ages. We model this with a
// half-life: after 3 days the news retains only half its original weight.
const HALF_LIFE_HOURS = 72;
const SENTIMENT_WEIGHT = 1.5; // |sentiment| * this → base impact (saturates at 1)

function moodFor(sentiment) {
  if (sentiment > 0.1) return 'BULLISH';
  if (sentiment < -0.1) return 'BEARISH';
  return 'NEUTRAL';
}

function impactFor(publishedAt, sentiment) {
  const abs = Math.abs(sentiment || 0);
  const base = Math.min(1, abs * SENTIMENT_WEIGHT);
  if (!publishedAt) return Math.round(base * 100) / 100;
  let ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3600000;
  if (ageHours < 0) ageHours = 0;
  return Math.round(base * Math.pow(0.5, ageHours / HALF_LIFE_HOURS) * 100) / 100;
}

// Decayed impact used when weighting headlines — never grows, always decays.
function applyRecency(items) {
  const now = Date.now();
  return items.map(n => {
    const sentiment = typeof n.sentiment === 'number' ? n.sentiment : scoreTitleSentiment(n.title);
    const impact = impactFor(n.publishedAt, sentiment);
    const ageHours = n.publishedAt
      ? Math.max(0, (now - new Date(n.publishedAt).getTime()) / 3600000)
      : null;
    return {
      ...n,
      sentiment,
      mood: moodFor(sentiment),
      impact,
      ageHours: ageHours == null ? null : Math.round(ageHours * 10) / 10,
    };
  });
}

// ── Market-wide aggregation ──────────────────────────────────────────────────
// Market/Business headlines are far more relevant to stock prices than general
// news, so they get a higher relevance weight inside the aggregate.
function relevanceOf(n) {
  if (n.category === 'Market') return 2.0;
  if (n.category === 'Business') return 1.5;
  return 0.5;
}

function aggregateSentiment(items) {
  const tagged = applyRecency(items);

  const counts = { positive: 0, neutral: 0, negative: 0 };
  tagged.forEach(n => {
    if (n.sentiment > 0.1) counts.positive += 1;
    else if (n.sentiment < -0.1) counts.negative += 1;
    else counts.neutral += 1;
  });

  // Only meaningfully-sentimented items that are still fresh enough count,
  // weighted by how relevant the source category is to the market.
  const meaningful = tagged
    .filter(n => Math.abs(n.sentiment) >= 0.1 && n.impact > 0.02)
    .map(n => ({ ...n, weight: n.impact * relevanceOf(n) }))
    .filter(n => n.weight > 0.03);

  const totalWeight = meaningful.reduce((s, n) => s + n.weight, 0);
  const score = totalWeight > 0
    ? meaningful.reduce((s, n) => s + n.sentiment * n.weight, 0) / totalWeight
    : 0;

  const mood = score > 0.15 ? 'BULLISH' : score < -0.15 ? 'BEARISH' : 'NEUTRAL';

  const bullish = meaningful.filter(n => n.sentiment > 0.1).sort((a, b) => b.weight - a.weight).slice(0, 3);
  const bearish = meaningful.filter(n => n.sentiment < -0.1).sort((a, b) => b.weight - a.weight).slice(0, 3);

  return {
    mood,
    score: Math.round(score * 100) / 100,
    strength: meaningful.length ? Math.round((totalWeight / meaningful.length) * 100) / 100 : 0,
    counts,
    coverage: meaningful.length,
    considered: tagged.length,
    bullish: bullish.map(pickTop),
    bearish: bearish.map(pickTop),
  };
}

function pickTop(n) {
  return {
    id: n.id,
    title: n.title,
    link: n.link,
    source: n.source,
    sourceId: n.sourceId,
    publishedAt: n.publishedAt,
    sentiment: n.sentiment,
    mood: n.mood,
    impact: n.impact,
  };
}

module.exports = {
  scoreTitleSentiment,
  moodFor,
  impactFor,
  applyRecency,
  aggregateSentiment,
};
