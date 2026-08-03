import { ShieldCheck, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

export default function AIExplanationCard({ prediction, explainableAI, symbol }) {
  if (!prediction) return null;

  const { bullishProb = 50, neutralProb = 30, bearishProb = 20, signal = 'NEUTRAL', confidenceScore = 60 } = prediction;
  const { positiveReasons = [], negativeReasons = [] } = explainableAI || {};

  const getSignalBadge = () => {
    if (signal === 'BULLISH') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <TrendingUp className="w-4 h-4" />
          BULLISH SIGNAL ({bullishProb}%)
        </span>
      );
    }
    if (signal === 'BEARISH') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <TrendingDown className="w-4 h-4" />
          BEARISH SIGNAL ({bearishProb}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Minus className="w-4 h-4" />
        NEUTRAL MOVEMENT ({neutralProb}%)
      </span>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md">
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Explainable AI Intelligence
              <span className="text-xs text-slate-400 font-normal">({symbol})</span>
            </h3>
            <p className="text-xs text-slate-400">Directional movement probability & SHAP feature attribution</p>
          </div>
        </div>
        {getSignalBadge()}
      </div>

      {/* Probability bars */}
      <div className="mb-5">
        <div className="flex justify-between items-center text-xs text-slate-300 font-medium mb-1.5">
          <span>Directional Movement Probabilities</span>
          <span className="text-slate-400">Model Confidence: <strong className="text-slate-200">{confidenceScore}%</strong></span>
        </div>
        
        <div className="h-3.5 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
          <div
            style={{ width: `${bullishProb}%` }}
            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-l-full transition-all duration-500"
            title={`Bullish Probability: ${bullishProb}%`}
          />
          <div
            style={{ width: `${neutralProb}%` }}
            className="bg-slate-600 h-full transition-all duration-500"
            title={`Neutral Probability: ${neutralProb}%`}
          />
          <div
            style={{ width: `${bearishProb}%` }}
            className="bg-gradient-to-r from-rose-500 to-rose-700 h-full rounded-r-full transition-all duration-500"
            title={`Bearish Probability: ${bearishProb}%`}
          />
        </div>

        <div className="flex justify-between text-[11px] text-slate-400 mt-2 px-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/> Bullish: {bullishProb}%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block"/> Neutral: {neutralProb}%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"/> Bearish: {bearishProb}%</span>
        </div>
      </div>

      {/* Explainability Driver Reasons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Positive Bullish Drivers */}
        <div className="bg-slate-950/60 border border-emerald-900/30 rounded-lg p-3.5">
          <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Positive Catalysts & Drivers
          </h4>
          <ul className="space-y-1.5">
            {positiveReasons.map((reason, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">+</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Negative Risk Factors */}
        <div className="bg-slate-950/60 border border-rose-900/30 rounded-lg p-3.5">
          <h4 className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Risk Factors & Deterrents
          </h4>
          <ul className="space-y-1.5">
            {negativeReasons.map((reason, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-rose-400 font-bold mt-0.5">-</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center gap-1">
        <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span>Probability output derived from multi-factor technical indicators, volume momentum, and market sentiment. Not guaranteed financial advice.</span>
      </div>
    </div>
  );
}
