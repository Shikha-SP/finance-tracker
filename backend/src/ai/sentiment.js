// Port of the AI engine's nlp.py (SentimentAnalyzer) to plain JS.

const STRONG_PHRASES = [
  'all-time high', 'record high', 'surge', 'soar', 'soars', 'surges', 'rally', 'rallies',
  'breakout', 'break through', 'exceed', 'outperform', 'beat estimates', 'beats',
  'strong demand', 'strong buy', 'buy', 'bullish', 'uptrend', 'momentum',
  'profit jumps', 'profit soars', 'profit record', 'dividend declared', 'bonus shares',
  'right shares', 'book closure', 'turnover soared', 'turnover surges', 'bull market',
  'accumulate', 'top pick', 'outperform', 'multibagger', 'growth story', 'earnings beat',
  'upside', 'positive outlook', 'optimistic', 'confidence', 'recovering', 'rebound',
  'rebounds', 'recovery', 'revival', 'improvement', 'improves', 'jump', 'jumps',
  'gain', 'gains', 'boost', 'boosts', 'boosting', 'surge in', 'skyrocket', 'skyrockets',
  'record profit', 'record revenue', 'strong earnings', 'strong fundamentals',
  'positive', 'good', 'better', 'great', 'excellent', 'impressive', 'solid',
];

const MODERATE_PHRASES = [
  'steady', 'stabilize', 'stabilizes', 'stable', 'held', 'holds', 'hold', 'maintains',
  'slightly up', 'slightly higher', 'modest', 'moderate gain', 'mild', 'mildly positive',
  'unchanged', 'flat', 'sideways', 'rangebound', 'consolidate', 'consolidation',
  'mixed', 'fair', 'decent', 'reasonable', 'ok', 'average',
];

const NEGATORS = [
  'not', 'no', 'never', 'neither', 'nor', 'without', 'hardly', 'rarely', 'seldom',
  'lack', 'lacks', 'unable', 'unlikely', 'falls', 'fell', 'debt', 'defaul', 'delay',
  'declin', 'fall', 'overvalued', 'shed', 'loss', 'loses', 'lower', 'lowest', 'drop',
  'drops', 'down', 'below', 'under', 'miss', 'missed', 'worst', 'worse', 'weak',
  'stagn', 'plunge', 'plunges', 'plummet', 'crisis', 'crash', 'fraud', 'scandal',
  'bankruptcy', 'issue', 'investigation', 'dispute', 'sharp', 'downgrade', 'downgraded',
  'review', 'negative', 'negatively', 'worries', 'concern', 'trouble', 'troubles',
  'uncertain', 'risk', 'risks', 'collapse', 'broken', 'hurt', 'damage', 'damaged',
  'suffer', 'bad', 'poor', 'dark', 'bleak', 'gloom', 'fallout', 'blow', 'fails',
  'failure', 'halt', 'suspended', 'shutdown', 'violation', 'penalty', 'breach',
  'short', 'low', 'severe', 'suspension', 'liquidation', 'default', 'erosion',
  'pressure', 'stressed', 'overdue', 'nonperforming', 'delinquent', 'terminate',
  'termination', 'disruption', 'disrupted', 'settlement', 'fraudulent', 'inflation',
  'inflationary', 'ratehike', 'tax', 'mismanagement', 'insolvent', 'insolvency',
  'fire', 'recession', 'downturn', 'slowdown', 'cut', 'cuts', 'reduce', 'reduces',
  'reduced', 'layoff', 'layoffs', 'strike', 'conflict', 'war', 'instability',
  'political', 'volatility',
];

const NUDGE_NEGATIVES = {
  'price fell': 2, 'price drops': 2, 'price dropped': 2, 'price decline': 2,
  'price falls': 2, 'price slumps': 2, 'price tumbled': 2, 'price tumbles': 2,
  'price slide': 2, 'price slipped': 2, 'price drops to': 2, 'price hits low': 3,
  'price near low': 2, 'price at low': 2, 'price falls to': 2, 'price plunged': 3,
  'share price fell': 2, 'share price drops': 2, 'price correction': 2,
  'price down': 2, 'price below': 2, 'price under': 2, 'price weak': 2,
  'price closed lower': 2, 'price closed down': 2, 'price slips': 2, 'price erodes': 3,
  'price eroded': 3, 'price crashes': 3, 'price crash': 3, 'price near support': 1,
};

const NUDGE_POSITIVES = {
  'price rose': 2, 'price rises': 2, 'price rises to': 2, 'price up': 1.5,
  'price gains': 2, 'price gained': 2, 'price climbed': 2, 'price climbs': 2,
  'price rallies': 2, 'price rallied': 2, 'price surges': 3, 'price surged': 3,
  'price jumps': 2, 'price jumped': 2, 'price soared': 3, 'price soars': 3,
  'price near high': 2, 'price at high': 2, 'price hits high': 3, 'price hits 52-week high': 4,
  'price above': 2, 'price over': 1.5, 'price firm': 1.5, 'price stronger': 2,
  'price stronger than': 2, 'price closed higher': 2, 'price closed up': 2,
  'price bounces': 2, 'price bounced': 2, 'price rebound': 2, 'price recovered': 2,
  'price recovers': 2, 'price tops': 2, 'price breakout': 2, 'price breakthrough': 3,
  'share price rose': 2, 'share price rises': 2, 'price near resistance': 1,
};

const VERBS = [
  'surge', 'soar', 'rally', 'jump', 'gain', 'climb', 'rise', 'rise', 'leap',
  'advance', 'outperform', 'breakout', 'recover', 'rebound', 'strengthen', 'soar',
  'skyrocket', 'accumulate', 'buoy', 'boost', 'spur', 'propel', 'accelerate',
];

const NUMBERS = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'dozen': 12, 'half': 0.5, 'few': 2, 'several': 5, 'many': 10,
  'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'million': 1000000,
  'crore': 10000000, 'billion': 1000000000,
};

class SentimentAnalyzer {
  constructor() {
    this.phrases = { strong: STRONG_PHRASES, moderate: MODERATE_PHRASES };
    this.negators = NEGATORS;
    this.nudge_negatives = NUDGE_NEGATIVES;
    this.nudge_positives = NUDGE_POSITIVES;
    this.verbs = VERBS;
    this.numbers = NUMBERS;
  }

  _tokenize(text) {
    return String(text).replace(/[(),./-]/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
  }

  _countKeyword(key, text) {
    const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    return (String(text).match(re) || []).length;
  }

  _parseNumber(token) {
    if (token == null) return null;
    if (this.numbers[token] != null) return this.numbers[token];
    const cleaned = token.replace(/,/g, '');
    const val = parseFloat(cleaned);
    if (!isNaN(val)) return val;
    if (token.endsWith('k') || token.endsWith('K')) return parseFloat(cleaned) * 1000;
    if (token.endsWith('m') || token.endsWith('M')) return parseFloat(cleaned) * 1000000;
    if (token.endsWith('lakh')) return parseFloat(cleaned) * 100000;
    if (token.endsWith('crore')) return parseFloat(cleaned) * 10000000;
    return null;
  }

  _getPriceWord(text) {
    const tokens = this._tokenize(text);
    for (const t of tokens) {
      if (/^\d/.test(t) || this.numbers[t] != null || t.endsWith('k') || t.endsWith('K') || t.endsWith('lakh') || t.endsWith('crore')) {
        const v = this._parseNumber(t);
        if (v != null) return v;
      }
    }
    return null;
  }

  _closest(key, tokens) {
    const idx = tokens.findIndex(t => t.includes(key));
    if (idx === -1) return null;
    for (let i = 1; i <= 2; i++) {
      for (const off of [i, -i]) {
        const t = tokens[idx + off];
        const v = this._parseNumber(t);
        if (v != null) return v;
      }
    }
    return null;
  }

  _analyzeText(title) {
    const text = String(title);
    const tokens = this._tokenize(text);

    const strongPhraseHits = this.phrases.strong.filter(p => text.toLowerCase().includes(p)).length;
    const moderatePhraseHits = this.phrases.moderate.filter(p => text.toLowerCase().includes(p)).length;
    const positiveHits = strongPhraseHits * 3 + moderatePhraseHits * 2;

    let negativeHits = 0;
    const negatorKeys = [];
    for (const key of this.negators) {
      const c = this._countKeyword(key, text);
      if (c > 0) { negativeHits += c; negatorKeys.push(key); }
    }

    const raw = positiveHits - negativeHits;
    const score = raw >= 0
      ? Math.round((raw / (raw + 5)) * 100 * 10) / 10
      : Math.round((raw / (raw - 5)) * 100 * 10) / 10;

    const label = score >= 15 ? 'POSITIVE' : score <= -15 ? 'NEGATIVE' : 'NEUTRAL';

    let priceNudge = 0;
    const price = this._getPriceWord(text);
    if (price != null) {
      for (const [k, v] of Object.entries(NUDGE_NEGATIVES)) {
        if (text.toLowerCase().includes(k)) priceNudge -= v;
      }
      for (const [k, v] of Object.entries(NUDGE_POSITIVES)) {
        if (text.toLowerCase().includes(k)) priceNudge += v;
      }
    }

    const volumeMention = /shares|volume|traded|turnover|trading volume/i.test(text);

    const phrases = [
      ...this.phrases.strong.filter(p => text.toLowerCase().includes(p)),
      ...this.phrases.moderate.filter(p => text.toLowerCase().includes(p)),
      ...negatorKeys,
    ];

    return {
      score: Math.max(-100, Math.min(100, score + priceNudge + (volumeMention ? 1.5 : 0))),
      positiveHits,
      negativeHits,
      label: score + priceNudge + (volumeMention ? 1.5 : 0) >= 15 ? 'POSITIVE' : score + priceNudge + (volumeMention ? 1.5 : 0) <= -15 ? 'NEGATIVE' : 'NEUTRAL',
      phrases,
      priceMention: price,
      priceNudge,
      volumeMention,
    };
  }

  // [{date, title}] → headline-level sentiment
  analyzeNews(items) {
    if (!items || !items.length) {
      return { score: 0, label: 'NEUTRAL', count: 0, breakdown: [], keywordSummary: {}, priceMentions: [], available: false };
    }
    const breakdown = [];
    const keywordSummary = { positive: 0, negative: 0 };
    const priceMentions = [];
    let total = 0;
    for (const it of items) {
      const r = this._analyzeText(it.title || '');
      breakdown.push({ date: it.date || null, title: it.title || '', score: r.score, label: r.label });
      total += r.score;
      if (r.label === 'POSITIVE') keywordSummary.positive++;
      if (r.label === 'NEGATIVE') keywordSummary.negative++;
      if (r.priceMention != null) priceMentions.push({ value: r.priceMention, nudge: r.priceNudge, title: it.title });
    }
    const avg = Math.round((total / breakdown.length) * 10) / 10;
    return {
      score: avg,
      label: avg >= 15 ? 'POSITIVE' : avg <= -15 ? 'NEGATIVE' : 'NEUTRAL',
      count: breakdown.length,
      breakdown,
      keywordSummary,
      priceMentions,
      available: true,
    };
  }

  // Batch average sentiment for a list of title strings
  analyze(texts) {
    if (!texts || !texts.length) return { score: 0, label: 'NEUTRAL', count: 0, available: false };
    let sum = 0, priceImpact = 0, volumeImpact = 0, priceCount = 0, volumeCount = 0;
    for (const t of texts) {
      const r = this._analyzeText(t);
      sum += r.score;
      if (r.priceMention != null) { priceImpact += r.priceNudge; priceCount++; }
      if (r.volumeMention) volumeImpact += 1.5, volumeCount++;
    }
    const avg = Math.round((sum / texts.length) * 10) / 10;
    return {
      score: Math.round(Math.max(-100, Math.min(100, avg + (priceCount ? priceImpact / priceCount : 0) * 0.5)) * 10) / 10,
      label: avg >= 15 ? 'POSITIVE' : avg <= -15 ? 'NEGATIVE' : 'NEUTRAL',
      count: texts.length,
      averageScore: avg,
      priceMentionImpact: priceCount ? Math.round((priceImpact / priceCount) * 10) / 10 : 0,
      volumeMentionImpact: volumeCount ? Math.round((volumeImpact / volumeCount) * 10) / 10 : 0,
      available: true,
    };
  }
}

module.exports = { SentimentAnalyzer };
