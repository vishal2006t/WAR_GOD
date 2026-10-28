export interface MassBalanceInput {
  inputWeightKg: number;
  recoveredWeightsKg: number[];
  residualWasteKg: number;
  documentedLossKg: number;
  toleranceKg?: number; // optional small threshold for precision rounding (default: 0.01kg)
}

export interface MassBalanceResult {
  isValid: boolean;
  totalRecoveredKg: number;
  totalAccountedKg: number;
  discrepancyKg: number;
  recoveryYieldPercentage: number;
  lossPercentage: number;
  residualPercentage: number;
  message: string;
}

export function validateMassBalance(params: MassBalanceInput): MassBalanceResult {
  const tolerance = params.toleranceKg ?? 0.01;
  const totalRecoveredKg = Number(
    params.recoveredWeightsKg.reduce((acc, curr) => acc + curr, 0).toFixed(3)
  );

  const totalAccountedKg = Number(
    (totalRecoveredKg + params.residualWasteKg + params.documentedLossKg).toFixed(3)
  );

  const discrepancyKg = Number(Math.abs(params.inputWeightKg - totalAccountedKg).toFixed(3));
  const isValid = discrepancyKg <= tolerance;

  const recoveryYieldPercentage = params.inputWeightKg > 0
    ? Number(((totalRecoveredKg / params.inputWeightKg) * 100).toFixed(2))
    : 0;

  const lossPercentage = params.inputWeightKg > 0
    ? Number(((params.documentedLossKg / params.inputWeightKg) * 100).toFixed(2))
    : 0;

  const residualPercentage = params.inputWeightKg > 0
    ? Number(((params.residualWasteKg / params.inputWeightKg) * 100).toFixed(2))
    : 0;

  const message = isValid
    ? `Mass balance reconciled successfully. Total input: ${params.inputWeightKg}kg = ${totalAccountedKg}kg accounted (${recoveryYieldPercentage}% recovery yield).`
    : `Mass balance validation failed! Input weight (${params.inputWeightKg}kg) does not equal total accounted (${totalAccountedKg}kg). Discrepancy: ${discrepancyKg}kg unexplained.`;

  return {
    isValid,
    totalRecoveredKg,
    totalAccountedKg,
    discrepancyKg,
    recoveryYieldPercentage,
    lossPercentage,
    residualPercentage,
    message,
  };
}
