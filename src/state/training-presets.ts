import type {
  TrainingDrill,
  TrainingDrillCategory,
  GameState,
  Player,
  TrainingPreset,
} from "./types";

/**
 * Generate a unique ID for presets and training plans.
 */
function generateId(name: string): string {
  return `preset-${name.toLowerCase().replace(/\s+/g, "-")}`;
}

/**
 * Complete drill library organized by category.
 * Each drill maps to specific player attributes and has workload/injury trade-offs.
 */
export const TRAINING_DRILLS: Record<TrainingDrillCategory, TrainingDrill[]> = {
  shooting: [
    {
      id: "drill_finishing",
      name: "Finishing Practice",
      category: "shooting",
      attributeFocus: "shooting",
      affectedAttributes: ["shooting"],
      workloadCoefficient: 1.0,
      injuryRiskCoefficient: 0.8,
    },
    {
      id: "drill_shotpower",
      name: "Shot Power Development",
      category: "shooting",
      attributeFocus: "power",
      affectedAttributes: ["shooting", "physical"],
      workloadCoefficient: 1.3,
      injuryRiskCoefficient: 1.1,
    },
    {
      id: "drill_longshots",
      name: "Long-Range Shooting",
      category: "shooting",
      attributeFocus: "shooting",
      affectedAttributes: ["shooting"],
      workloadCoefficient: 0.9,
      injuryRiskCoefficient: 0.7,
    },
  ],

  passing: [
    {
      id: "drill_shortpass",
      name: "Short Passing Accuracy",
      category: "passing",
      attributeFocus: "passing",
      affectedAttributes: ["passing"],
      workloadCoefficient: 0.7,
      injuryRiskCoefficient: 0.5,
    },
    {
      id: "drill_longpass",
      name: "Long Pass Development",
      category: "passing",
      attributeFocus: "passing",
      affectedAttributes: ["passing"],
      workloadCoefficient: 0.8,
      injuryRiskCoefficient: 0.6,
    },
    {
      id: "drill_vision",
      name: "Vision & Positioning",
      category: "passing",
      attributeFocus: "vision",
      affectedAttributes: ["passing"],
      workloadCoefficient: 0.6,
      injuryRiskCoefficient: 0.4,
    },
  ],

  dribbling: [
    {
      id: "drill_ballcontrol",
      name: "Ball Control Drills",
      category: "dribbling",
      attributeFocus: "dribbling",
      affectedAttributes: ["dribbling"],
      workloadCoefficient: 0.8,
      injuryRiskCoefficient: 0.6,
    },
    {
      id: "drill_dribbling",
      name: "Dribbling Technique",
      category: "dribbling",
      attributeFocus: "dribbling",
      affectedAttributes: ["dribbling"],
      workloadCoefficient: 0.9,
      injuryRiskCoefficient: 0.7,
    },
    {
      id: "drill_agility",
      name: "Agility & Movement",
      category: "dribbling",
      attributeFocus: "agility",
      affectedAttributes: ["dribbling", "pace"],
      workloadCoefficient: 1.1,
      injuryRiskCoefficient: 0.9,
    },
  ],

  physical: [
    {
      id: "drill_pace",
      name: "Pace Development",
      category: "physical",
      attributeFocus: "pace",
      affectedAttributes: ["pace"],
      workloadCoefficient: 1.2,
      injuryRiskCoefficient: 1.0,
    },
    {
      id: "drill_acceleration",
      name: "Acceleration Training",
      category: "physical",
      attributeFocus: "pace",
      affectedAttributes: ["pace"],
      workloadCoefficient: 1.3,
      injuryRiskCoefficient: 1.2,
    },
    {
      id: "drill_stamina",
      name: "Stamina & Fitness",
      category: "physical",
      attributeFocus: "stamina",
      affectedAttributes: ["physical"],
      workloadCoefficient: 1.0,
      injuryRiskCoefficient: 0.7,
    },
    {
      id: "drill_strength",
      name: "Strength Training",
      category: "physical",
      attributeFocus: "strength",
      affectedAttributes: ["physical"],
      workloadCoefficient: 1.2,
      injuryRiskCoefficient: 1.0,
    },
  ],

  defending: [
    {
      id: "drill_tackling",
      name: "Tackling Technique",
      category: "defending",
      attributeFocus: "defending",
      affectedAttributes: ["defending"],
      workloadCoefficient: 1.1,
      injuryRiskCoefficient: 1.3,
    },
    {
      id: "drill_marking",
      name: "Marking & Positioning",
      category: "defending",
      attributeFocus: "defending",
      affectedAttributes: ["defending"],
      workloadCoefficient: 0.8,
      injuryRiskCoefficient: 0.6,
    },
    {
      id: "drill_interceptions",
      name: "Interception Drills",
      category: "defending",
      attributeFocus: "defending",
      affectedAttributes: ["defending"],
      workloadCoefficient: 0.9,
      injuryRiskCoefficient: 0.8,
    },
    {
      id: "drill_positioning",
      name: "Defensive Positioning",
      category: "defending",
      attributeFocus: "positioning",
      affectedAttributes: ["defending"],
      workloadCoefficient: 0.7,
      injuryRiskCoefficient: 0.5,
    },
  ],

  mental: [
    {
      id: "drill_decisions",
      name: "Decision-Making Drills",
      category: "mental",
      attributeFocus: "decisions",
      affectedAttributes: ["passing"],
      workloadCoefficient: 0.5,
      injuryRiskCoefficient: 0.2,
    },
    {
      id: "drill_anticipation",
      name: "Anticipation Training",
      category: "mental",
      attributeFocus: "anticipation",
      affectedAttributes: ["defending", "passing"],
      workloadCoefficient: 0.6,
      injuryRiskCoefficient: 0.3,
    },
    {
      id: "drill_composure",
      name: "Composure Under Pressure",
      category: "mental",
      attributeFocus: "composure",
      affectedAttributes: ["shooting", "passing"],
      workloadCoefficient: 0.5,
      injuryRiskCoefficient: 0.2,
    },
    {
      id: "drill_tactics",
      name: "Tactical Positioning",
      category: "mental",
      attributeFocus: "positioning",
      affectedAttributes: ["defending", "passing"],
      workloadCoefficient: 0.5,
      injuryRiskCoefficient: 0.3,
    },
  ],
};

/** Get all drills across all categories. */
export function getAllDrills(): TrainingDrill[] {
  return Object.values(TRAINING_DRILLS).flat();
}

/** Get drill by ID. */
export function getDrillById(drillId: string): TrainingDrill | undefined {
  return getAllDrills().find((d) => d.id === drillId);
}

/** Get all drills in a category. */
export function getDrillsByCategory(category: TrainingDrillCategory): TrainingDrill[] {
  return TRAINING_DRILLS[category] || [];
}

/**
 * Validate that a player can perform the selected drills.
 * Returns error message if validation fails, undefined if OK.
 */
export function validatePlayerForDrills(player: Player, drillIds: string[]): string | undefined {
  // Example validation: young players shouldn't do extreme strength training
  if ((player.age ?? 30) < 18 && drillIds.includes("drill_strength")) {
    return "Young players should not do intensive strength training";
  }

  // Injured players should avoid high-impact drills
  if (
    (player.injury || (player as Player & { injured?: boolean }).injured) &&
    drillIds.some((id) => id === "drill_acceleration" || id === "drill_tackling")
  ) {
    return "Injured players should avoid high-impact drills";
  }

  return undefined;
}

/**
 * Calculate total workload impact for a set of drills.
 */
export function calculateDrillWorkload(drillIds: string[]): number {
  let total = 0;
  for (const drillId of drillIds) {
    const drill = getDrillById(drillId);
    if (drill) total += drill.workloadCoefficient;
  }
  return total;
}

/**
 * Calculate injury risk impact for a set of drills.
 */
export function calculateDrillInjuryRisk(drillIds: string[]): number {
  let total = 0;
  for (const drillId of drillIds) {
    const drill = getDrillById(drillId);
    if (drill) total += drill.injuryRiskCoefficient;
  }
  return total / (drillIds.length || 1); // Average
}

/**
 * Build initial 3 training presets (empty by default).
 */
export function buildInitialTrainingPresets(): TrainingPreset[] {
  return [
    {
      id: generateId("Preset 1"),
      name: "Preset 1",
      drills: [],
      intensity: "medium",
      frequencyDays: 1,
      selectedPlayerIds: [],
    },
    {
      id: generateId("Preset 2"),
      name: "Preset 2",
      drills: [],
      intensity: "medium",
      frequencyDays: 1,
      selectedPlayerIds: [],
    },
    {
      id: generateId("Preset 3"),
      name: "Preset 3",
      drills: [],
      intensity: "medium",
      frequencyDays: 1,
      selectedPlayerIds: [],
    },
  ];
}

/**
 * Apply a preset to selected players by creating a training plan.
 * Does not modify the preset itself, just creates a one-time training plan.
 */
export function applyPresetAsTrainingPlan(
  preset: TrainingPreset,
  state: GameState,
): { error?: string; planId?: string } {
  if (preset.selectedPlayerIds.length === 0) {
    return { error: "Preset has no selected players" };
  }

  if (preset.drills.length === 0) {
    return { error: "Preset has no selected drills" };
  }

  // Validate all selected players exist and can do the drills
  for (const playerId of preset.selectedPlayerIds) {
    const player = state.players[playerId];
    if (!player) {
      return { error: `Player ${playerId} not found` };
    }

    const validationError = validatePlayerForDrills(player, preset.drills);
    if (validationError) {
      return { error: `${player.name}: ${validationError}` };
    }
  }

  // Create focus string from selected drills
  const drillNames = preset.drills
    .map((id) => getDrillById(id)?.name)
    .filter((n) => n)
    .join(", ");

  return { planId: "temp-plan-id" }; // Actual plan creation handled in reducer
}

/**
 * Get attributes affected by a set of drills.
 */
export function getAffectedAttributes(drillIds: string[]): string[] {
  const attrs = new Set<string>();
  for (const drillId of drillIds) {
    const drill = getDrillById(drillId);
    if (drill) {
      drill.affectedAttributes.forEach((attr) => attrs.add(attr));
    }
  }
  return Array.from(attrs);
}
