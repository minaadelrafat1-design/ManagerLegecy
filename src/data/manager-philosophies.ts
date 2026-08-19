/* =============================================================================
 * Manager philosophies & nationalities — shared identity data
 * =============================================================================
 * Originally part of `state/new-career.ts` (Phase C1); pulled out here in
 * Phase D1 so AI club managers (`state/ai-manager.ts`) can draw from the
 * exact same philosophy vocabulary as the player does in the New Career
 * wizard, rather than inventing a second, parallel list. Pure data, no
 * generation logic — that stays in the two state/ modules that consume it.
 * ---------------------------------------------------------------------------*/

export const MANAGER_NATIONALITIES: string[] = [
  "ENG",
  "IRL",
  "SCO",
  "WAL",
  "FRA",
  "GER",
  "ESP",
  "ITA",
  "POR",
  "NED",
  "BEL",
  "NOR",
  "SWE",
  "DEN",
  "POL",
  "CRO",
  "SRB",
  "BRA",
  "ARG",
  "USA",
  "NGA",
  "GHA",
  "SEN",
  "CIV",
  "JPN",
  "AUS",
];

export type ManagerSkillKey =
  | "tactics"
  | "training"
  | "motivation"
  | "scouting"
  | "negotiation"
  | "manManagement"
  | "playerDevelopment";

export interface ManagerPhilosophy {
  id: string;
  label: string;
  description: string;
  /** The two manager skills this philosophy naturally leans into. */
  focusSkills: [ManagerSkillKey, ManagerSkillKey];
  /** Stored verbatim on `Manager.philosophy` (player) or read by id on
   * `AIManagerProfile.philosophy` (AI clubs). */
  philosophyText: string;
}

export const MANAGER_PHILOSOPHIES: ManagerPhilosophy[] = [
  {
    id: "possession-control",
    label: "Possession & Control",
    description: "Patient build-up play, dictate tempo, control matches through the ball.",
    focusSkills: ["tactics", "training"],
    philosophyText: "Possession-based, patient build-up, control the tempo",
  },
  {
    id: "high-press",
    label: "High-Press Intensity",
    description: "Aggressive pressing high up the pitch, win the ball back early.",
    focusSkills: ["tactics", "motivation"],
    philosophyText: "High-press, aggressive, win the ball back early",
  },
  {
    id: "youth-development",
    label: "Youth Development",
    description: "Build the squad around academy talent and long-term growth.",
    focusSkills: ["playerDevelopment", "scouting"],
    philosophyText: "Youth-focused, develop from within, patient with young talent",
  },
  {
    id: "pragmatic-counter",
    label: "Pragmatic Counter-Attack",
    description: "Stay compact, defend well as a unit, hit teams on the break.",
    focusSkills: ["tactics", "manManagement"],
    philosophyText: "Pragmatic, well-organised, counter-attacking",
  },
  {
    id: "man-management",
    label: "Man-Management First",
    description: "Build the club around trust, morale and dressing-room culture.",
    focusSkills: ["manManagement", "motivation"],
    philosophyText: "Man-management focused, builds trust and squad harmony",
  },
  {
    id: "recruitment-led",
    label: "Recruitment-Led",
    description: "Win through sharp scouting and shrewd dealing in the transfer market.",
    focusSkills: ["scouting", "negotiation"],
    philosophyText: "Recruitment-led, relies on scouting and smart dealing",
  },
];

export function getPhilosophy(id: string): ManagerPhilosophy | undefined {
  return MANAGER_PHILOSOPHIES.find((p) => p.id === id);
}
