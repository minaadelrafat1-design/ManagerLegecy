/**
 * Tactical Influence Layer
 * ======================
 * Modifies match engine decision weights based on player tactical roles and instructions.
 *
 * Does NOT change deterministic match outcomes or force player behavior.
 * Instead, modifies probability weights to make certain actions more/less likely based on:
 * - Player role (e.g., Poacher vs False Nine)
 * - Player instructions (e.g., "Get In Behind", "Stay Back")
 * - Player attributes (e.g., high pace favors aggressive runs)
 * - Tactical familiarity (lower familiarity = less effective instruction execution)
 */

import type { SimPlayer } from "./match-engine";

/** Instruction modifier values. Applied as multiplicative factors to decision weights. */
export interface TacticalModifiers {
  /** Affects likelihood of being selected for attacking runs/shots (GET IN BEHIND) */
  attackingRunWeight: number;
  /** Affects likelihood of being selected to provide passing option (COME SHORT) */
  passingAvailabilityWeight: number;
  /** Affects likelihood of event selecting this player for action (general availability) */
  generalActivityWeight: number;
  /** Affects likelihood of being selected for aggressive pressing (PRESS) */
  pressingWeight: number;
  /** Affects likelihood of committing fouls (PRESS increases, HOLD POSITION reduces) */
  foulTendency: number;
  /** Affects preference for wide vs central positioning (STAY WIDE vs CUT INSIDE) */
  widthPreference: number; // <1 = more central, >1 = more wide
  /** Affects likelihood of taking shots (related to attacking instructions) */
  shootingWeight: number;
  /** Affects involvement in build-up play and possession retention */
  buildUpInvolvementWeight?: number;
}

/**
 * Calculate tactical modifiers for a player based on their role and instructions.
 *
 * All modifiers start at 1.0 (neutral). Instructions and role behaviors adjust them.
 * Familiarity factor reduces effect of instructions if player is unfamiliar with role (0.5 = 50% familiarity).
 */
export function calculateTacticalModifiers(
  player: SimPlayer,
  instructions: string[],
  roleFamiliarity: number = 50,
): TacticalModifiers {
  // Base modifiers (all 1.0 = neutral effect)
  const mods: TacticalModifiers = {
    attackingRunWeight: 1.0,
    passingAvailabilityWeight: 1.0,
    generalActivityWeight: 1.0,
    pressingWeight: 1.0,
    foulTendency: 1.0,
    widthPreference: 1.0,
    shootingWeight: 1.0,
    buildUpInvolvementWeight: 1.0,
  };

  // Familiarity factor: ranges from 0.5 (0% familiarity) to 1.1 (100% familiarity)
  // At 50% familiarity: factor = 1.0 (full effect)
  // At <50% familiarity: factor reduces effect (0.5x at 0%)
  // At >50% familiarity: factor slightly boosts effect (1.1x at 100%)
  const familiarityFactor = 0.5 + (roleFamiliarity / 100) * 0.6; // range [0.5, 1.1]

  // Helper function to match instruction names (case-insensitive, handles hyphens/spaces)
  function matchesInstruction(instr: string, ...patterns: string[]): boolean {
    const normalized = instr.toLowerCase().replace(/[-_\s]/g, "");
    return patterns.some((pattern) =>
      normalized.includes(pattern.toLowerCase().replace(/[-_\s]/g, "")),
    );
  }

  // Apply instruction modifiers
  for (const instr of instructions) {
    // ATTACKING INSTRUCTIONS
    if (matchesInstruction(instr, "getbehind", "get-in-behind")) {
      // Increase likelihood of being selected for attacking runs into space
      mods.attackingRunWeight *= 1.25 * familiarityFactor;
      mods.shootingWeight *= 1.15 * familiarityFactor;
      mods.generalActivityWeight *= 1.1 * familiarityFactor;
    }

    if (matchesInstruction(instr, "comeshort", "come-short")) {
      // Increase availability as passing option
      mods.passingAvailabilityWeight *= 1.3 * familiarityFactor;
      mods.generalActivityWeight *= 1.15 * familiarityFactor;
    }

    // POSITIONING INSTRUCTIONS
    if (matchesInstruction(instr, "staywide", "stay-wide")) {
      // Prefer wide positioning
      mods.widthPreference *= 1.35 * familiarityFactor; // >1 = wider
      mods.generalActivityWeight *= 1.08 * familiarityFactor;
    }

    if (matchesInstruction(instr, "cutinside", "cut-inside")) {
      // Prefer central/inside positioning
      mods.widthPreference *= 0.75 * (2 - familiarityFactor); // <1 = more central
      mods.shootingWeight *= 1.12 * familiarityFactor;
      mods.generalActivityWeight *= 1.08 * familiarityFactor;
    }

    // FULLBACK-SPECIFIC INSTRUCTIONS
    if (matchesInstruction(instr, "overlap")) {
      // Support wide attacker with overlapping runs
      mods.attackingRunWeight *= 1.25 * familiarityFactor;
      mods.generalActivityWeight *= 1.18 * familiarityFactor;
      mods.passingAvailabilityWeight *= 1.15 * familiarityFactor;
    }

    if (matchesInstruction(instr, "invert")) {
      // Move inside to link midfield play
      mods.widthPreference *= 0.65 * familiarityFactor; // more central
      mods.passingAvailabilityWeight *= 1.2 * familiarityFactor;
      mods.buildUpInvolvementWeight! *= 1.2 * familiarityFactor;
    }

    // DEFENSIVE/BACK INSTRUCTIONS
    if (matchesInstruction(instr, "stayback", "stay-back")) {
      // Reduce attacking involvement
      mods.attackingRunWeight *= 0.65 * familiarityFactor;
      mods.shootingWeight *= 0.7 * familiarityFactor;
      mods.generalActivityWeight *= 0.85 * familiarityFactor;
      // Reduce aggressive pressing - stay back means cover, not press
      mods.pressingWeight *= 0.8 * familiarityFactor;
      mods.foulTendency *= 0.8 * familiarityFactor; // Stay disciplined
    }

    if (matchesInstruction(instr, "stepup")) {
      // Push higher to play offside trap
      mods.attackingRunWeight *= 1.15 * familiarityFactor;
      mods.generalActivityWeight *= 1.08 * familiarityFactor;
    }

    if (matchesInstruction(instr, "aggressivepress", "aggressive-press")) {
      // Increase pressing intensity, risk fouls
      mods.pressingWeight *= 1.45 * familiarityFactor;
      mods.foulTendency *= 1.3 * familiarityFactor;
      mods.generalActivityWeight *= 1.15 * familiarityFactor;
    }

    if (matchesInstruction(instr, "joinattack", "join-attack")) {
      // Increase attacking involvement
      mods.attackingRunWeight *= 1.35 * familiarityFactor;
      mods.generalActivityWeight *= 1.2 * familiarityFactor;
      mods.shootingWeight *= 1.2 * familiarityFactor;
      mods.passingAvailabilityWeight *= 1.15 * familiarityFactor;
    }

    // MIDFIELDER-SPECIFIC INSTRUCTIONS
    if (matchesInstruction(instr, "getforward", "get-forward")) {
      // More aggressive forward runs and box entries
      mods.attackingRunWeight *= 1.28 * familiarityFactor;
      mods.shootingWeight *= 1.15 * familiarityFactor;
      mods.generalActivityWeight *= 1.12 * familiarityFactor;
    }

    if (matchesInstruction(instr, "covercentre", "cover-centre", "covercenter", "cover-center")) {
      // Focus on protecting central area
      mods.widthPreference *= 0.8 * familiarityFactor; // stay more central
      mods.pressingWeight *= 1.15 * familiarityFactor;
      mods.generalActivityWeight *= 1.05 * familiarityFactor;
    }

    if (matchesInstruction(instr, "coverwing", "cover-wing")) {
      // Support fullbacks on the wing, reduce centre focus
      mods.widthPreference *= 1.3 * familiarityFactor; // move wider
      mods.pressingWeight *= 1.1 * familiarityFactor;
      mods.generalActivityWeight *= 1.1 * familiarityFactor;
    }

    // WINGER-SPECIFIC INSTRUCTIONS
    if (matchesInstruction(instr, "trackback", "track-back")) {
      // Defensive support for fullbacks
      mods.pressingWeight *= 1.25 * familiarityFactor;
      mods.attackingRunWeight *= 0.75 * familiarityFactor;
      mods.generalActivityWeight *= 0.9 * familiarityFactor;
    }

    // STRIKER-SPECIFIC INSTRUCTIONS
    if (matchesInstruction(instr, "staycentral", "stay-central")) {
      // Maintain central position, fewer wide drifts
      mods.widthPreference *= 0.85 * familiarityFactor;
      mods.shootingWeight *= 1.1 * familiarityFactor;
      mods.generalActivityWeight *= 1.05 * familiarityFactor;
    }

    if (matchesInstruction(instr, "driftwide", "drift-wide")) {
      // Move to wings to create space centrally
      mods.widthPreference *= 1.4 * familiarityFactor;
      mods.generalActivityWeight *= 1.15 * familiarityFactor;
      mods.passingAvailabilityWeight *= 1.1 * familiarityFactor;
    }

    if (matchesInstruction(instr, "targetman", "target-forward")) {
      // Hold ball up, focus on possession retention and link-up play
      mods.passingAvailabilityWeight *= 1.35 * familiarityFactor;
      mods.generalActivityWeight *= 1.1 * familiarityFactor;
      mods.shootingWeight *= 0.9 * familiarityFactor;
    }

    // MOVEMENT INSTRUCTIONS
    if (matchesInstruction(instr, "holdposition", "hold-position")) {
      // Reduce unnecessary movement away from tactical area
      mods.generalActivityWeight *= 0.9 * familiarityFactor;
      mods.pressingWeight *= 0.85 * familiarityFactor; // Less aggressive pressing
    }

    if (matchesInstruction(instr, "roam") && !matchesInstruction(instr, "roaming")) {
      // Increase contextual movement and availability (box-to-box, mezzala tendencies)
      mods.generalActivityWeight *= 1.25 * familiarityFactor;
      mods.passingAvailabilityWeight *= 1.2 * familiarityFactor;
      mods.pressingWeight *= 1.15 * familiarityFactor;
      mods.shootingWeight *= 1.1 * familiarityFactor;
    }

    // PRESSING/DEFENSIVE INSTRUCTIONS
    if (matchesInstruction(instr, "press") && !matchesInstruction(instr, "noppress")) {
      // Increase willingness to close down opponents
      mods.pressingWeight *= 1.4 * familiarityFactor;
      mods.foulTendency *= 1.25 * familiarityFactor; // More aggressive = more fouls
      mods.generalActivityWeight *= 1.15 * familiarityFactor;
    }

    // PLAYMAKER INSTRUCTION
    if (matchesInstruction(instr, "playmaker")) {
      // Increase availability for the ball and passing option weighting
      mods.passingAvailabilityWeight *= 1.45 * familiarityFactor;
      mods.generalActivityWeight *= 1.2 * familiarityFactor;
      // Slightly favor playmaking over finishing
      mods.shootingWeight *= 0.95 * familiarityFactor;
    }
  }

  return mods;
}

/**
 * Apply tactical modifiers to an attack weight before using it in a weighted player selection.
 *
 * Example:
 *   const baseAttackWeight = ATTACK_WEIGHT[player.pos];
 *   const tacticalWeight = applyTacticalModifier(
 *     baseAttackWeight,
 *     player,
 *     instructions,
 *     roleFamiliarity,
 *     "attackingRun"
 *   );
 */
export function applyTacticalModifier(
  baseWeight: number,
  player: SimPlayer,
  instructions: string[],
  roleFamiliarity: number = 50,
  modifierType: keyof TacticalModifiers,
): number {
  const mods = calculateTacticalModifiers(player, instructions, roleFamiliarity);
  const multiplier = mods[modifierType] ?? 1;
  return Math.max(0.01, baseWeight * multiplier);
}

/**
 * Calculate an overall "player activity weight" that affects how often a player
 * is selected for action in general (shots, passes, fouls, etc.).
 *
 * Used when we want tactical instructions to make a player more/less prominent
 * across multiple decision types.
 */
export function calculatePlayerActivityWeight(
  baseWeight: number,
  player: SimPlayer,
  instructions: string[],
  roleFamiliarity: number = 50,
): number {
  const mods = calculateTacticalModifiers(player, instructions, roleFamiliarity);
  return Math.max(0.01, baseWeight * mods.generalActivityWeight);
}

/**
 * Calculate pressing tendency modifier based on player instructions and attributes.
 *
 * Used in foul resolution to make players with PRESS instructions more likely to
 * commit fouls, while STAY BACK reduces it.
 */
export function calculatePressingTendency(
  baseDiscplinePenalty: number, // typically (100 - player.discipline)
  player: SimPlayer,
  instructions: string[],
  roleFamiliarity: number = 50,
): number {
  const mods = calculateTacticalModifiers(player, instructions, roleFamiliarity);
  // foulTendency modifies how much the discipline penalty applies
  return baseDiscplinePenalty * mods.foulTendency;
}

/**
 * Determine event probability adjustments based on tactical instructions.
 *
 * Used in simulateMinute() to weight the choice between shot/chance/corner/foul.
 *
 * Returns adjustments to apply to event type selection weights:
 * - "shot" weight (for STAY WIDE, CUT INSIDE)
 * - "corner" weight (for STAY WIDE)
 * - "foul" weight (for PRESS)
 */
export function calculateEventTypeAdjustments(
  squad: SimPlayer[],
  instructions: Record<string, string[]>, // player ID -> instructions[]
  roleFamiliarities: Record<string, number>, // player ID -> familiarity
): {
  shotWeight: number;
  cornerWeight: number;
  foulWeight: number;
} {
  let shotMod = 1.0;
  let cornerMod = 1.0;
  let foulMod = 1.0;
  let count = 0;

  for (const player of squad) {
    const instrs = instructions[player.id] ?? [];
    const fam = roleFamiliarities[player.id] ?? 50;
    const mods = calculateTacticalModifiers(player, instrs, fam);

    // Players with CUT INSIDE or playmaker roles prefer shots
    if (instrs.some((i) => i.toLowerCase().includes("cut-inside"))) {
      shotMod += 0.08;
    }
    // Players with PRESS prefer fouls (more aggressive = more contact)
    if (instrs.some((i) => i.toLowerCase().includes("press"))) {
      foulMod += 0.05;
    }
    // Players with STAY WIDE prefer corners (more crossing)
    if (instrs.some((i) => i.toLowerCase().includes("stay-wide"))) {
      cornerMod += 0.06;
    }

    count += 1;
  }

  // Average over squad size to avoid runaway values
  const avgFactor = Math.max(1, count) / 11; // normalize for smaller/larger squads
  return {
    shotWeight: Math.max(0.7, Math.min(1.3, shotMod / avgFactor)),
    cornerWeight: Math.max(0.7, Math.min(1.3, cornerMod / avgFactor)),
    foulWeight: Math.max(0.7, Math.min(1.3, foulMod / avgFactor)),
  };
}

/**
 * Calculate width preference effect for event selection.
 *
 * STAY WIDE instructions make the team prefer wide play (more corners/crosses).
 * CUT INSIDE instructions make the team prefer central play (more shots).
 */
export function calculateTeamWidthEffect(
  squad: SimPlayer[],
  instructions: Record<string, string[]>, // player ID -> instructions[]
  roleFamiliarities: Record<string, number>, // player ID -> familiarity
): number {
  // Returns a multiplier for width-based event selection (1.0 = neutral)
  let widthSum = 0;
  let count = 0;

  for (const player of squad) {
    const instrs = instructions[player.id] ?? [];
    const fam = roleFamiliarities[player.id] ?? 50;
    const mods = calculateTacticalModifiers(player, instrs, fam);
    widthSum += mods.widthPreference;
    count += 1;
  }

  return Math.max(0.8, Math.min(1.2, widthSum / Math.max(1, count)));
}

/**
 * Example: How to integrate into match engine
 *
 * In match-engine.ts, when selecting an attacker for a shot:
 *
 *   const attacker = weightedPlayerPick(
 *     rng,
 *     attackingSide.onPitch.filter((p) => !p.isGK),
 *     (p) => {
 *       const baseWeight = ATTACK_WEIGHT[p.pos] * p.attack;
 *       const instrs = playerInstructions[p.id] ?? [];
 *       const fam = playerRoleFamiliarities[p.id] ?? 50;
 *       // Apply tactical modifiers for attacking runs
 *       return applyTacticalModifier(
 *         baseWeight,
 *         p,
 *         instrs,
 *         fam,
 *         "attackingRunWeight"
 *       );
 *     }
 *   );
 */
