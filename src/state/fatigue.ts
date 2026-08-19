export function fatigueBandLabel(fatigue: number) {
  if (fatigue <= 20) return "Fresh";
  if (fatigue <= 40) return "Normal";
  if (fatigue <= 60) return "Tired";
  if (fatigue <= 80) return "Very tired";
  return "Exhausted";
}

export function fatigueTrainingMultiplier(fatigue: number) {
  if (fatigue <= 20) return 1.0;
  if (fatigue <= 40) return 0.98;
  if (fatigue <= 60) return 0.9;
  if (fatigue <= 80) return 0.75;
  return 0.5;
}

export function fatigueMatchModifier(fatigue: number) {
  if (fatigue <= 20) return 1.0;
  if (fatigue <= 40) return 0.99;
  if (fatigue <= 60) return 0.95;
  if (fatigue <= 80) return 0.85;
  return 0.6;
}

export function fatigueRecoveryMultiplier(fatigue: number) {
  if (fatigue <= 20) return 1.2;
  if (fatigue <= 40) return 1.0;
  if (fatigue <= 60) return 0.9;
  if (fatigue <= 80) return 0.7;
  return 0.5;
}

/** Form band describes current player playing condition (30-100 scale).
 * Affected by recent matches, morale, injuries, playing time.
 * Used to modify match performance independently of fitness/fatigue. */
export function formBandLabel(form: number) {
  if (form >= 80) return "Red hot";
  if (form >= 65) return "Excellent";
  if (form >= 50) return "Good";
  if (form >= 35) return "Poor";
  return "Terrible";
}

/** Form modifier for match performance. Range: 0.7 (terrible form) to 1.2 (red hot).
 * Independent of fatigue — a fresh but out-of-form player still struggles. */
export function formMatchModifier(form: number): number {
  const clamped = Math.max(30, Math.min(100, form));
  // Map 30-100 range to 0.7-1.2 multiplier
  return 0.7 + ((clamped - 30) / 70) * 0.5;
}

/** Squad morale affects overall team cohesion and performance (0-100 scale).
 * Low morale creates team-wide underperformance; high morale boosts collective effort.
 * Applied as a team multiplier on all players' ratings in a match.
 * Range: 0.85 (very low morale: 0-20) to 1.1 (very high morale: 80-100) */
export function squadMoraleMatchModifier(squadMorale: number): number {
  const clamped = Math.max(0, Math.min(100, squadMorale));
  // Map 0-100 to 0.85-1.1 multiplier
  // At 50 morale, multiplier = 0.975 (nearly neutral)
  // At 0 morale, multiplier = 0.85 (15% reduction)
  // At 100 morale, multiplier = 1.1 (10% boost)
  return 0.85 + (clamped / 100) * 0.25;
}

/** Form impacts training gains — discourage practicing with very low form
 * to represent lack of sharpness and motivation. */
export function formTrainingMultiplier(form: number): number {
  const clamped = Math.max(30, Math.min(100, form));
  if (clamped >= 70) return 1.1; // hot form absorbs training well
  if (clamped >= 50) return 1.0;
  if (clamped >= 35) return 0.85; // low form, less receptive
  return 0.65; // terrible form, very resistant
}

export {};
