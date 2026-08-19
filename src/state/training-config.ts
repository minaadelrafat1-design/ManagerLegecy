// Configurable training intensity and fatigue presets.
export const TRAINING_INTENSITIES = {
  low: {
    developmentPct: 0.6, // 60% development effectiveness
    fatiguePct: 0.25, // contributes 25% of full-day fatigue
    injuryRisk: 0.5, // relative multiplier
  },
  medium: {
    developmentPct: 1.0,
    fatiguePct: 0.5,
    injuryRisk: 1.0,
  },
  high: {
    developmentPct: 1.25,
    fatiguePct: 0.85,
    injuryRisk: 1.6,
  },
} as const;

// Fatigue bands and their textual labels. These ranges are used by the
// game logic (selectors, match engine) to influence performance — do not
// hard-code UI strings elsewhere.
export const FATIGUE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Fresh", min: 0, max: 20 },
  { label: "Normal", min: 21, max: 40 },
  { label: "Tired", min: 41, max: 60 },
  { label: "Very tired", min: 61, max: 80 },
  { label: "Exhausted", min: 81, max: 100 },
];

// Base daily fatigue accumulation (0-100 scale) before intensity multipliers
export const BASE_DAILY_FATIGUE = 6; // baseline per training day

// Base daily recovery when resting (not training) — fatigue points reduced per day
export const BASE_DAILY_RECOVERY = 8;

// Base injury probability per day (very small), multiplied by intensity/injuryRisk/fatigue factor
export const BASE_DAILY_INJURY_PROB = 0.0005; // 0.05% per day

export {};
