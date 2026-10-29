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
    <div className="bg-white p-5 rounded-2xl border border-[#D7E5DB] shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-[#075B46]" />
          <h4 className="text-sm font-serif font-bold text-[#173C32]">Mass-Balance Reconciliation Engine</h4>
        </div>
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#075B46]" />
              Reconciled (100% Balanced)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Unbalanced ({discrepancy} kg discrepancy)
            </span>
          )}
        </div>
      </div>

      {/* Visual Balance Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-[#6B7C74] mb-1.5 font-mono">
          <span>Input: {inputWeightKg.toFixed(2)} kg</span>
          <span>Accounted: {totalAccountedKg.toFixed(2)} kg</span>
        </div>
        <div className="h-4 w-full bg-[#EDF7EF] rounded-full overflow-hidden flex p-0.5 border border-[#D7E5DB]">
          <div
            style={{ width: `${Math.min(100, Number(recoveryYield))}%` }}
            className="bg-[#075B46] h-full rounded-l-full transition-all duration-300"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
        <div className="p-3 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB]">
          <p className="text-[10px] text-[#6B7C74] uppercase font-semibold">Input Waste</p>
          <p className="text-sm font-bold text-[#173C32] mt-1">{inputWeightKg} kg</p>
        </div>
        <div className="p-3 rounded-xl bg-[#E5F5EA] border border-[#D7E5DB]">
          <p className="text-[10px] text-[#075B46] uppercase font-semibold">Recovered Yield</p>
          <p className="text-sm font-bold text-[#075B46] mt-1">{recoveredTotalKg} kg ({recoveryYield}%)</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-[10px] text-amber-700 uppercase font-semibold">Residual Waste</p>
          <p className="text-sm font-bold text-amber-800 mt-1">{residualWasteKg} kg ({residualPercent}%)</p>
        </div>
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
          <p className="text-[10px] text-rose-700 uppercase font-semibold">Documented Loss</p>
          <p className="text-sm font-bold text-rose-800 mt-1">{documentedLossKg} kg ({lossPercent}%)</p>
        </div>
      </div>
    </div>
  );
};
