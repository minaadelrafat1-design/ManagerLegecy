/**
 * Individual Player Tactical Roles & Instructions System
 *
 * Defines position-appropriate tactical roles and instructions for each player.
 * Roles are stored per-player in GameState and persist through save/load.
 * The match engine consumes this data to inform player behavior.
 *
 * Design principles:
 * - Real football concepts adapted for Manager Legacy
 * - Position-appropriate only (no CB as LW)
 * - Instructions make football sense for the role
 * - Suitability based on player attributes
 * - Clean, reusable type system
 */

import type { Pos } from "@/data/squad";

/**
 * Behavioral attributes that describe how a role plays.
 * Used by match engine to adjust player positioning, decision-making, etc.
 * Range: 0-100 unless noted
 */
export interface RoleBehavior {
  /** How much freedom to join attacks (0 = stay back, 100 = always get forward) */
  attackingFreedom: number;
  /** Defensive responsibility (0 = none, 100 = constant) */
  defensiveResponsibility: number;
  /** Horizontal position bias (0 = far left, 50 = central, 100 = far right) */
  preferredWidth: number;
  /** Tendency to stay central vs drift wide (0 = always drift, 100 = always central) */
  tendencyStayCentral: number;
  /** Tendency to make forward runs (0 = passive, 100 = aggressive) */
  tendencyForwardRuns: number;
  /** Pressing intensity when opponent has ball (0 = lazy, 100 = aggressive) */
  pressingIntensity: number;
  /** How close to provide support to teammates (0 = far, 100 = close) */
  supportDistance: number;
  /** Involvement in build-up play (0 = avoid possession, 100 = seek ball) */
  buildUpInvolvement: number;
  /** Risk-taking on the ball (0 = safety first, 100 = creative) */
  riskTaking: number;
  /** Roaming tendency (0 = strict position, 100 = move around) */
  roaming: number;
}

/**
 * Tactical role for a player position.
 * Each position (GK, CB, LB, etc.) has multiple position-appropriate roles.
 */
export interface TacticalRole {
  id: string;
  name: string;
  /** Which position(s) can play this role */
  positions: Pos[];
  /** Description shown in UI */
  description: string;
  /** Behavioral attributes that define this role */
  behavior: RoleBehavior;
}

/**
 * Individual instruction for a player.
 * Instructions are role + position dependent.
 */
export interface PlayerInstruction {
  id: string;
  name: string;
  /** Which position(s) can use this instruction */
  positions: Pos[];
  /** Which role(s) this instruction makes sense for (empty = all roles) */
  rolesContext?: string[];
  description: string;
  /** How this instruction modifies behavior */
  modifier: Partial<RoleBehavior>;
}

/**
 * A player's tactical configuration.
 * Stored on Player, persisted in GameState, passed to match engine.
 */
export interface PlayerTacticalConfig {
  /** Which role the player is assigned (must match position + available roles) */
  roleId: string;
  /** Individual instructions for this player (must be valid for role + position) */
  instructions: string[]; // array of instruction IDs
  /** How familiar the player is with their assigned role (0-100, impacts performance) */
  roleFamiliarity: number;
}

// ============================================================================
// GOALKEEPER ROLES
// ============================================================================

export const GK_ROLES: TacticalRole[] = [
  {
    id: "gk-shot-stopper",
    name: "Shot Stopper",
    positions: ["GK"],
    description: "Traditional keeper focused on shot-stopping and reflexes",
    behavior: {
      attackingFreedom: 5,
      defensiveResponsibility: 95,
      preferredWidth: 50,
      tendencyStayCentral: 95,
      tendencyForwardRuns: 0,
      pressingIntensity: 20,
      supportDistance: 30,
      buildUpInvolvement: 20,
      riskTaking: 20,
      roaming: 10,
    },
  },
  {
    id: "gk-sweeper",
    name: "Sweeper Keeper",
    positions: ["GK"],
    description: "Libero-style keeper who plays off the line and sweeps",
    behavior: {
      attackingFreedom: 15,
      defensiveResponsibility: 90,
      preferredWidth: 50,
      tendencyStayCentral: 80,
      tendencyForwardRuns: 10,
      pressingIntensity: 40,
      supportDistance: 60,
      buildUpInvolvement: 50,
      riskTaking: 40,
      roaming: 50,
    },
  },
];

// ============================================================================
// DEFENDER ROLES (CB, LB, RB, LWB, RWB)
// ============================================================================

export const DEFENDER_ROLES: TacticalRole[] = [
  {
    id: "cb-defender",
    name: "Defender",
    positions: ["CB"],
    description: "Solid, no-nonsense centre-back who marks and clears",
    behavior: {
      attackingFreedom: 15,
      defensiveResponsibility: 90,
      preferredWidth: 50,
      tendencyStayCentral: 85,
      tendencyForwardRuns: 10,
      pressingIntensity: 60,
      supportDistance: 40,
      buildUpInvolvement: 30,
      riskTaking: 25,
      roaming: 20,
    },
  },
  {
    id: "cb-stopper",
    name: "Stopper",
    positions: ["CB"],
    description: "Aggressive defender who breaks up play and wins headers",
    behavior: {
      attackingFreedom: 10,
      defensiveResponsibility: 95,
      preferredWidth: 50,
      tendencyStayCentral: 90,
      tendencyForwardRuns: 5,
      pressingIntensity: 80,
      supportDistance: 30,
      buildUpInvolvement: 15,
      riskTaking: 15,
      roaming: 15,
    },
  },
  {
    id: "cb-playmaker",
    name: "Ball-Playing Defender",
    positions: ["CB"],
    description: "Technically gifted CB who starts attacks from the back",
    behavior: {
      attackingFreedom: 25,
      defensiveResponsibility: 85,
      preferredWidth: 50,
      tendencyStayCentral: 75,
      tendencyForwardRuns: 20,
      pressingIntensity: 50,
      supportDistance: 55,
      buildUpInvolvement: 75,
      riskTaking: 60,
      roaming: 40,
    },
  },
  {
    id: "fb-fullback",
    name: "Fullback",
    positions: ["LB", "RB"],
    description: "Balanced fullback with defensive solidity and limited attacking",
    behavior: {
      attackingFreedom: 40,
      defensiveResponsibility: 80,
      preferredWidth: 85, // 85 = far right for RB, mirrored for LB
      tendencyStayCentral: 30,
      tendencyForwardRuns: 25,
      pressingIntensity: 65,
      supportDistance: 50,
      buildUpInvolvement: 50,
      riskTaking: 35,
      roaming: 40,
    },
  },
  {
    id: "fb-attacking",
    name: "Attacking Fullback",
    positions: ["LB", "RB"],
    description: "Modern fullback who gets forward and creates chances",
    behavior: {
      attackingFreedom: 70,
      defensiveResponsibility: 65,
      preferredWidth: 90,
      tendencyStayCentral: 20,
      tendencyForwardRuns: 65,
      pressingIntensity: 55,
      supportDistance: 60,
      buildUpInvolvement: 60,
      riskTaking: 55,
      roaming: 60,
    },
  },
  {
    id: "fb-inverted",
    name: "Inverted Fullback",
    positions: ["LB", "RB"],
    description: "Fullback who cuts inside to join midfield play (LB on right, RB on left)",
    behavior: {
      attackingFreedom: 60,
      defensiveResponsibility: 70,
      preferredWidth: 45, // tends to move central
      tendencyStayCentral: 65,
      tendencyForwardRuns: 45,
      pressingIntensity: 60,
      supportDistance: 55,
      buildUpInvolvement: 70,
      riskTaking: 50,
      roaming: 70,
    },
  },
  {
    id: "fb-wingback",
    name: "Wingback",
    positions: ["LB", "RB", "LB", "RB"],
    description: "Attack-minded wing-back with wide play and physical presence",
    behavior: {
      attackingFreedom: 85,
      defensiveResponsibility: 55,
      preferredWidth: 95, // play very wide
      tendencyStayCentral: 10,
      tendencyForwardRuns: 80,
      pressingIntensity: 65,
      supportDistance: 65,
      buildUpInvolvement: 50,
      riskTaking: 60,
      roaming: 75,
    },
  },
];

// ============================================================================
// MIDFIELDER ROLES (CM, CDM, CAM, LM, RM)
// ============================================================================

export const MIDFIELDER_ROLES: TacticalRole[] = [
  {
    id: "cm-box-to-box",
    name: "Box-to-Box",
    positions: ["CM"],
    description: "All-action midfielder covering both phases, attacks and defends",
    behavior: {
      attackingFreedom: 60,
      defensiveResponsibility: 70,
      preferredWidth: 50,
      tendencyStayCentral: 70,
      tendencyForwardRuns: 50,
      pressingIntensity: 70,
      supportDistance: 50,
      buildUpInvolvement: 60,
      riskTaking: 45,
      roaming: 55,
    },
  },
  {
    id: "cm-playmaker",
    name: "Playmaker",
    positions: ["CM"],
    description: "Creative midfielder who dictates tempo and creates chances",
    behavior: {
      attackingFreedom: 65,
      defensiveResponsibility: 55,
      preferredWidth: 50,
      tendencyStayCentral: 75,
      tendencyForwardRuns: 40,
      pressingIntensity: 50,
      supportDistance: 60,
      buildUpInvolvement: 85,
      riskTaking: 65,
      roaming: 60,
    },
  },
  {
    id: "cm-mezzala",
    name: "Mezzala (Half-Winger)",
    positions: ["CM"],
    description: "Hybrid midfielder who roams between midfield and wing, sporadic attacking runs",
    behavior: {
      attackingFreedom: 65,
      defensiveResponsibility: 60,
      preferredWidth: 60, // slight bias to wing
      tendencyStayCentral: 45,
      tendencyForwardRuns: 60,
      pressingIntensity: 65,
      supportDistance: 55,
      buildUpInvolvement: 65,
      riskTaking: 55,
      roaming: 75,
    },
  },
  {
    id: "cm-holding",
    name: "Holding Midfielder",
    positions: ["CM"],
    description: "Defensive midfielder focused on shield and pressing",
    behavior: {
      attackingFreedom: 25,
      defensiveResponsibility: 85,
      preferredWidth: 50,
      tendencyStayCentral: 80,
      tendencyForwardRuns: 15,
      pressingIntensity: 80,
      supportDistance: 40,
      buildUpInvolvement: 50,
      riskTaking: 25,
      roaming: 30,
    },
  },
  {
    id: "cdm-dlp",
    name: "Deep-Lying Playmaker",
    positions: ["CDM"],
    description: "Defensive midfielder who plays passes from deep, builds from back",
    behavior: {
      attackingFreedom: 30,
      defensiveResponsibility: 80,
      preferredWidth: 50,
      tendencyStayCentral: 85,
      tendencyForwardRuns: 10,
      pressingIntensity: 60,
      supportDistance: 45,
      buildUpInvolvement: 80,
      riskTaking: 40,
      roaming: 25,
    },
  },
  {
    id: "cdm-anchor",
    name: "Anchor Man",
    positions: ["CDM"],
    description: "Tough, no-nonsense defensive midfielder, breaks up play",
    behavior: {
      attackingFreedom: 15,
      defensiveResponsibility: 90,
      preferredWidth: 50,
      tendencyStayCentral: 85,
      tendencyForwardRuns: 5,
      pressingIntensity: 85,
      supportDistance: 35,
      buildUpInvolvement: 30,
      riskTaking: 20,
      roaming: 20,
    },
  },
];

// ============================================================================
// ATTACKING MIDFIELDER / WINGER ROLES (CAM, LW, RW, LM, RM)
// ============================================================================

export const ATTACKING_ROLES: TacticalRole[] = [
  {
    id: "cam-playmaker",
    name: "Playmaker (CAM)",
    positions: ["CAM"],
    description: "Attacking midfielder who creates chances and dribbles",
    behavior: {
      attackingFreedom: 80,
      defensiveResponsibility: 40,
      preferredWidth: 50,
      tendencyStayCentral: 70,
      tendencyForwardRuns: 60,
      pressingIntensity: 50,
      supportDistance: 60,
      buildUpInvolvement: 70,
      riskTaking: 75,
      roaming: 65,
    },
  },
  {
    id: "cam-shadow-striker",
    name: "Shadow Striker",
    positions: ["CAM"],
    description: "Advanced attacker who lingers in striker area, scores goals",
    behavior: {
      attackingFreedom: 90,
      defensiveResponsibility: 30,
      preferredWidth: 50,
      tendencyStayCentral: 65,
      tendencyForwardRuns: 85,
      pressingIntensity: 40,
      supportDistance: 50,
      buildUpInvolvement: 40,
      riskTaking: 70,
      roaming: 60,
    },
  },
  {
    id: "lw-winger",
    name: "Winger",
    positions: ["LW", "RW"],
    description: "Traditional winger who hugs the touchline and crosses",
    behavior: {
      attackingFreedom: 75,
      defensiveResponsibility: 45,
      preferredWidth: 95, // hug the wing
      tendencyStayCentral: 15,
      tendencyForwardRuns: 70,
      pressingIntensity: 55,
      supportDistance: 55,
      buildUpInvolvement: 50,
      riskTaking: 50,
      roaming: 50,
    },
  },
  {
    id: "lw-inside-forward",
    name: "Inside Forward",
    positions: ["LW", "RW"],
    description: "Winger who cuts inside to shoot (LW on right, RW on left)",
    behavior: {
      attackingFreedom: 85,
      defensiveResponsibility: 40,
      preferredWidth: 55, // cuts inside
      tendencyStayCentral: 60,
      tendencyForwardRuns: 80,
      pressingIntensity: 50,
      supportDistance: 50,
      buildUpInvolvement: 45,
      riskTaking: 70,
      roaming: 65,
    },
  },
  {
    id: "lw-wide-playmaker",
    name: "Wide Playmaker",
    positions: ["LW", "RW"],
    description: "Creative winger who creates through balls and combines",
    behavior: {
      attackingFreedom: 75,
      defensiveResponsibility: 50,
      preferredWidth: 85,
      tendencyStayCentral: 30,
      tendencyForwardRuns: 60,
      pressingIntensity: 50,
      supportDistance: 65,
      buildUpInvolvement: 70,
      riskTaking: 65,
      roaming: 70,
    },
  },
];

// ============================================================================
// STRIKER ROLES (ST, CF)
// ============================================================================

export const STRIKER_ROLES: TacticalRole[] = [
  {
    id: "st-advanced",
    name: "Advanced Forward",
    positions: ["ST", "ST"],
    description: "Aggressive striker making runs in behind, seeks chances",
    behavior: {
      attackingFreedom: 95,
      defensiveResponsibility: 20,
      preferredWidth: 50,
      tendencyStayCentral: 60,
      tendencyForwardRuns: 95,
      pressingIntensity: 60,
      supportDistance: 40,
      buildUpInvolvement: 20,
      riskTaking: 60,
      roaming: 50,
    },
  },
  {
    id: "st-poacher",
    name: "Poacher",
    positions: ["ST", "ST"],
    description: "Finisher who stays high up the pitch, focuses on scoring",
    behavior: {
      attackingFreedom: 90,
      defensiveResponsibility: 15,
      preferredWidth: 50,
      tendencyStayCentral: 75,
      tendencyForwardRuns: 80,
      pressingIntensity: 50,
      supportDistance: 30,
      buildUpInvolvement: 15,
      riskTaking: 50,
      roaming: 35,
    },
  },
  {
    id: "st-target-forward",
    name: "Target Forward",
    positions: ["ST", "ST"],
    description: "Physical striker who holds up play and wins headers",
    behavior: {
      attackingFreedom: 70,
      defensiveResponsibility: 30,
      preferredWidth: 50,
      tendencyStayCentral: 80,
      tendencyForwardRuns: 60,
      pressingIntensity: 70,
      supportDistance: 50,
      buildUpInvolvement: 35,
      riskTaking: 40,
      roaming: 30,
    },
  },
  {
    id: "st-false-nine",
    name: "False Nine",
    positions: ["ST", "ST"],
    description: "Intelligent striker who drops deep to link play",
    behavior: {
      attackingFreedom: 75,
      defensiveResponsibility: 40,
      preferredWidth: 50,
      tendencyStayCentral: 70,
      tendencyForwardRuns: 50,
      pressingIntensity: 55,
      supportDistance: 65,
      buildUpInvolvement: 75,
      riskTaking: 65,
      roaming: 75,
    },
  },
];

// ============================================================================
// PLAYER INSTRUCTIONS
// ============================================================================

export const DEFENDER_INSTRUCTIONS: PlayerInstruction[] = [
  {
    id: "def-stay-back",
    name: "Stay Back",
    positions: ["CB", "LB", "RB", "LB", "RB"],
    rolesContext: ["cb-defender", "cb-stopper", "fb-fullback"],
    description: "Reduce forward runs, focus on defending",
    modifier: {
      attackingFreedom: -20,
      tendencyForwardRuns: -25,
      defensiveResponsibility: +10,
    },
  },
  {
    id: "def-step-up",
    name: "Step Up",
    positions: ["CB", "LB", "RB"],
    description: "Push higher to play offside trap",
    modifier: {
      tendencyForwardRuns: +15,
      buildUpInvolvement: +10,
    },
  },
  {
    id: "def-hold-position",
    name: "Hold Position",
    positions: ["CB", "LB", "RB", "LB", "RB"],
    description: "Maintain station, reduce roaming",
    modifier: {
      roaming: -30,
      defensiveResponsibility: +15,
    },
  },
  {
    id: "def-aggressive-press",
    name: "Aggressive Press",
    positions: ["CB", "LB", "RB"],
    description: "Increase pressing intensity, risk fouls",
    modifier: {
      pressingIntensity: +25,
      riskTaking: +15,
    },
  },
];

export const FULLBACK_INSTRUCTIONS: PlayerInstruction[] = [
  {
    id: "fb-join-attack",
    name: "Join Attack",
    positions: ["LB", "RB", "LB", "RB"],
    rolesContext: ["fb-attacking", "fb-wingback"],
    description: "Encourage forward runs and crossing",
    modifier: {
      attackingFreedom: +30,
      tendencyForwardRuns: +25,
      supportDistance: +15,
    },
  },
  {
    id: "fb-balanced",
    name: "Balanced",
    positions: ["LB", "RB"],
    description: "Natural position, standard attacking/defending balance",
    modifier: {},
  },
  {
    id: "fb-overlap",
    name: "Overlap",
    positions: ["LB", "RB"],
    description: "Support wide attacker with overlapping runs",
    modifier: {
      attackingFreedom: +25,
      tendencyForwardRuns: +20,
      roaming: +20,
    },
  },
  {
    id: "fb-invert",
    name: "Invert",
    positions: ["LB", "RB"],
    rolesContext: ["fb-inverted"],
    description: "Move inside to link midfield play",
    modifier: {
      tendencyStayCentral: +40,
      preferredWidth: -30,
      buildUpInvolvement: +20,
    },
  },
  {
    id: "fb-stay-wide",
    name: "Stay Wide",
    positions: ["LB", "RB", "LB", "RB"],
    rolesContext: ["lw-winger"],
    description: "Maintain wide position, fewer inside cuts",
    modifier: {
      preferredWidth: +15,
      tendencyStayCentral: -20,
    },
  },
];

export const MIDFIELDER_INSTRUCTIONS: PlayerInstruction[] = [
  {
    id: "mid-hold-position",
    name: "Hold Position",
    positions: ["CM", "CDM", "CAM"],
    rolesContext: ["cm-holding", "cdm-anchor"],
    description: "Stay disciplined in position, reduce roaming",
    modifier: {
      roaming: -30,
      tendencyForwardRuns: -20,
      defensiveResponsibility: +15,
    },
  },
  {
    id: "mid-get-forward",
    name: "Get Forward",
    positions: ["CM", "CAM"],
    description: "More aggressive forward runs and box entries",
    modifier: {
      attackingFreedom: +20,
      tendencyForwardRuns: +25,
      supportDistance: +10,
    },
  },
  {
    id: "mid-roam",
    name: "Roam",
    positions: ["CM"],
    rolesContext: ["cm-mezzala"],
    description: "Move freely across midfield, seek possession",
    modifier: {
      roaming: +35,
      buildUpInvolvement: +15,
      riskTaking: +10,
    },
  },
  {
    id: "mid-cover-centre",
    name: "Cover Centre",
    positions: ["CM"],
    description: "Focus on protecting central area",
    modifier: {
      tendencyStayCentral: +20,
      defensiveResponsibility: +15,
    },
  },
  {
    id: "mid-cover-wing",
    name: "Cover Wing",
    positions: ["CM"],
    description: "Support fullbacks on the wing, reduce centre focus",
    modifier: {
      preferredWidth: +25,
      roaming: +15,
      defensiveResponsibility: +10,
    },
  },
  {
    id: "mid-press",
    name: "Press",
    positions: ["CM", "CDM", "CAM"],
    description: "Increase pressing intensity and harrassment",
    modifier: {
      pressingIntensity: +25,
      riskTaking: +10,
    },
  },
];

export const WINGER_INSTRUCTIONS: PlayerInstruction[] = [
  {
    id: "wing-stay-wide",
    name: "Stay Wide",
    positions: ["LW", "RW"],
    rolesContext: ["lw-winger"],
    description: "Hug the touchline, more crossing",
    modifier: {
      preferredWidth: +20,
      tendencyStayCentral: -25,
      riskTaking: +10,
    },
  },
  {
    id: "wing-cut-inside",
    name: "Cut Inside",
    positions: ["LW", "RW"],
    rolesContext: ["lw-inside-forward"],
    description: "Move central to shoot, fewer crosses",
    modifier: {
      tendencyStayCentral: +30,
      preferredWidth: -20,
      riskTaking: +15,
    },
  },
  {
    id: "wing-get-behind",
    name: "Get In Behind",
    positions: ["LW", "RW"],
    description: "Attack space behind defensive line",
    modifier: {
      tendencyForwardRuns: +25,
      attackingFreedom: +20,
      pressingIntensity: -10,
    },
  },
  {
    id: "wing-come-short",
    name: "Come Short",
    positions: ["LW", "RW"],
    description: "Drop back to receive ball, fewer runs",
    modifier: {
      buildUpInvolvement: +25,
      supportDistance: -15,
      tendencyForwardRuns: -20,
    },
  },
  {
    id: "wing-track-back",
    name: "Track Back",
    positions: ["LW", "RW"],
    description: "Defensive support for fullbacks",
    modifier: {
      defensiveResponsibility: +25,
      pressingIntensity: +15,
      attackingFreedom: -20,
    },
  },
];

export const STRIKER_INSTRUCTIONS: PlayerInstruction[] = [
  {
    id: "st-stay-central",
    name: "Stay Central",
    positions: ["ST", "ST"],
    description: "Maintain central position, fewer wide drifts",
    modifier: {
      tendencyStayCentral: +25,
      preferredWidth: 50,
    },
  },
  {
    id: "st-drift-wide",
    name: "Drift Wide",
    positions: ["ST", "ST"],
    description: "Move to wings to create space centrally",
    modifier: {
      preferredWidth: +30,
      tendencyStayCentral: -20,
      roaming: +20,
    },
  },
  {
    id: "st-get-behind",
    name: "Get In Behind",
    positions: ["ST", "ST"],
    description: "Aggressive runs down the channels",
    modifier: {
      tendencyForwardRuns: +30,
      attackingFreedom: +15,
    },
  },
  {
    id: "st-come-short",
    name: "Come Short",
    positions: ["ST", "ST"],
    description: "Link-up play with midfield, fewer runs",
    modifier: {
      buildUpInvolvement: +30,
      supportDistance: -20,
      tendencyForwardRuns: -25,
    },
  },
  {
    id: "st-target-man",
    name: "Target Forward",
    positions: ["ST", "ST"],
    description: "Hold ball up, focus on possession retention",
    modifier: {
      buildUpInvolvement: +25,
      supportDistance: +10,
      tendencyForwardRuns: -10,
    },
  },
  {
    id: "st-press",
    name: "Press",
    positions: ["ST", "ST"],
    description: "High pressing, harrass defenders",
    modifier: {
      pressingIntensity: +30,
      defensiveResponsibility: +20,
    },
  },
];

// ============================================================================
// REGISTRY & HELPERS
// ============================================================================

export const ALL_ROLES: TacticalRole[] = [
  ...GK_ROLES,
  ...DEFENDER_ROLES,
  ...MIDFIELDER_ROLES,
  ...ATTACKING_ROLES,
  ...STRIKER_ROLES,
];

export const ALL_INSTRUCTIONS: PlayerInstruction[] = [
  ...DEFENDER_INSTRUCTIONS,
  ...FULLBACK_INSTRUCTIONS,
  ...MIDFIELDER_INSTRUCTIONS,
  ...WINGER_INSTRUCTIONS,
  ...STRIKER_INSTRUCTIONS,
];

/**
 * Get all roles available for a position
 */
export function getRolesForPosition(pos: Pos): TacticalRole[] {
  return ALL_ROLES.filter((role) => role.positions.includes(pos));
}

/**
 * Get all instructions available for a position
 */
export function getInstructionsForPosition(pos: Pos): PlayerInstruction[] {
  return ALL_INSTRUCTIONS.filter((instr) => instr.positions.includes(pos));
}

/**
 * Get instructions valid for a specific role
 */
export function getInstructionsForRole(roleId: string, pos: Pos): PlayerInstruction[] {
  return getInstructionsForPosition(pos).filter(
    (instr) => !instr.rolesContext || instr.rolesContext.includes(roleId),
  );
}

/**
 * Get role by ID
 */
export function getRoleById(roleId: string): TacticalRole | undefined {
  return ALL_ROLES.find((role) => role.id === roleId);
}

/**
 * Get instruction by ID
 */
export function getInstructionById(instructionId: string): PlayerInstruction | undefined {
  return ALL_INSTRUCTIONS.find((instr) => instr.id === instructionId);
}

/**
 * Default role for a position (first role in list)
 */
export function getDefaultRoleForPosition(pos: Pos): TacticalRole | undefined {
  const roles = getRolesForPosition(pos);
  return roles.length > 0 ? roles[0] : undefined;
}

/**
 * Create empty tactical config for a player
 */
export function createDefaultTacticalConfig(pos: Pos): PlayerTacticalConfig {
  const defaultRole = getDefaultRoleForPosition(pos);
  // Always ensure we have a valid roleId - use the first available role or fallback
  const roleId = defaultRole?.id || (getRolesForPosition(pos)[0]?.id ?? "gk-shot-stopper");
  return {
    roleId,
    instructions: [],
    roleFamiliarity: 65, // neutral
  };
}
