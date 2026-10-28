import React from "react";
import { CheckCircle2, AlertTriangle, Scale, ArrowRight } from "lucide-react";

interface MassBalanceProps {
  inputWeightKg: number;
  recoveredTotalKg: number;
  residualWasteKg: number;
  documentedLossKg: number;
}

export const MassBalanceCalculator: React.FC<MassBalanceProps> = ({
  inputWeightKg,
  recoveredTotalKg,
  residualWasteKg,
  documentedLossKg,
}) => {
  const totalAccountedKg = Number((recoveredTotalKg + residualWasteKg + documentedLossKg).toFixed(2));
  const discrepancy = Number(Math.abs(inputWeightKg - totalAccountedKg).toFixed(2));
  const isBalanced = discrepancy <= 0.05 && inputWeightKg > 0;

  const recoveryYield = inputWeightKg > 0 ? ((recoveredTotalKg / inputWeightKg) * 100).toFixed(1) : "0.0";
  const residualPercent = inputWeightKg > 0 ? ((residualWasteKg / inputWeightKg) * 100).toFixed(1) : "0.0";
  const lossPercent = inputWeightKg > 0 ? ((documentedLossKg / inputWeightKg) * 100).toFixed(1) : "0.0";

  return (
    <div className="glass-panel p-5 rounded-xl border border-slate-700/80">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-white">Mass-Balance Reconciliation Engine</h4>
        </div>
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Reconciled (100% Balanced)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unbalanced ({discrepancy} kg discrepancy)
            </span>
          )}
        </div>
      </div>

      {/* Visual Balance Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-mono">
          <span>Input: {inputWeightKg.toFixed(2)} kg</span>
          <span>Accounted: {totalAccountedKg.toFixed(2)} kg</span>
        </div>
        <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
          <div
            style={{ width: `${Math.min(100, Number(recoveryYield))}%` }}
            className="bg-emerald-500 h-full rounded-l-full transition-all duration-300"
            title={`Recovered Output: ${recoveredTotalKg}kg (${recoveryYield}%)`}
          />
          <div
            style={{ width: `${Math.min(100, Number(residualPercent))}%` }}
            className="bg-amber-500 h-full transition-all duration-300"
            title={`Residual Waste: ${residualWasteKg}kg (${residualPercent}%)`}
          />
          <div
            style={{ width: `${Math.min(100, Number(lossPercent))}%` }}
            className="bg-rose-500 h-full rounded-r-full transition-all duration-300"
            title={`Documented Loss: ${documentedLossKg}kg (${lossPercent}%)`}
          />
        </div>
      </div>

      {/* Breakdown Metrics */}
      <div className="grid grid-cols-4 gap-3 mt-4 text-center">
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-medium">Input Waste</p>
          <p className="text-sm font-bold text-white mt-1">{inputWeightKg} kg</p>
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
          <p className="text-[10px] text-emerald-400 uppercase font-medium">Recovered Yield</p>
          <p className="text-sm font-bold text-emerald-300 mt-1">{recoveredTotalKg} kg ({recoveryYield}%)</p>
        </div>
        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/20">
          <p className="text-[10px] text-amber-400 uppercase font-medium">Residual Waste</p>
          <p className="text-sm font-bold text-amber-300 mt-1">{residualWasteKg} kg ({residualPercent}%)</p>
        </div>
        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/20">
          <p className="text-[10px] text-rose-400 uppercase font-medium">Documented Loss</p>
          <p className="text-sm font-bold text-rose-300 mt-1">{documentedLossKg} kg ({lossPercent}%)</p>
        </div>
      </div>
    </div>
  );
};
