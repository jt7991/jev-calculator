// Provisional acceptance policy; keep measuring it with live evals.
export function assessChoice(
  choice: string,
  probabilities: Record<string, number>,
) {
  const probability = probabilities[choice];
  let runnerUp = 0;
  let valid =
    Number.isFinite(probability) && probability >= 0 && probability <= 1;
  for (const option of Object.keys(probabilities)) {
    const value = probabilities[option];
    if (!Number.isFinite(value) || value < 0 || value > 1) valid = false;
    if (option !== choice) runnerUp = Math.max(runnerUp, value);
  }
  const margin = probability - runnerUp;
  return {
    probability,
    runnerUp,
    margin,
    accepted: valid && probability >= 0.5 && margin >= 0.2,
  };
}
