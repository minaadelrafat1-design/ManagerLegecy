/* =============================================================================
 * Starter clubs — New Career club choices
 * =============================================================================
 * A small, hand-authored set of fictional LOW-DIVISION clubs offered to a
 * brand-new manager during the New Career flow (`state/new-career.ts` /
 * `routes/new-career.tsx`). This is deliberately NOT a full job market —
 * just enough realistic, appropriately-modest options for a manager with
 * zero reputation to plausibly be appointed at. No top-flight or elite club
 * appears here on purpose; see `REGIONAL_THIRD_DIVISION_ID` below.
 *
 * These are separate from the clubs in `state/seed.ts` (Northfield United's
 * demo save, National League) — a different fictional division entirely, so
 * the two universes never collide on an id.
 * ---------------------------------------------------------------------------*/

export const REGIONAL_THIRD_DIVISION_ID = "regional-third-division";
export const REGIONAL_TROPHY_ID = "regional-trophy";

export interface StarterClubFacilities {
  training: number; // 0-100
  medical: number; // 0-100
  youth: number; // 0-100
  stadium: number; // 0-100
}

export interface StarterClubFinances {
  transferBudget: string;
  wageBudget: string;
  balance: string;
}

export interface StarterClubObjective {
  title: string;
  progress: number; // 0-100 — always 0 at the start of a new career
  note: string;
}

export interface StarterClub {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  ground: string;
  city: string;
  identity?: {
    boardPatience?: number;
    expectations?: "low" | "normal" | "high";
  };
  /** Human-readable division label shown in the club-choice UI. */
  division: string;
  leagueId: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  formation: string;
  /** 0-100 — deliberately low across the whole list; this is what keeps
   * unrealistic "take over a giant on day one" jobs off the table. */
  reputation: number;
  facilities: StarterClubFacilities;
  finances: StarterClubFinances;
  objectives: StarterClubObjective[];
  /** One line of flavour shown on the club-choice card. */
  blurb: string;
}

/** Six clubs, one small regional division — the whole league a new save's
 * standings/fixtures are generated from. The manager picks one; the other
 * five become lightweight AI-controlled league opponents. */
export const STARTER_CLUBS: StarterClub[] = [
  {
    id: "millbrook-town",
    name: "Millbrook Town",
    shortName: "Millbrook",
    abbr: "MIL",
    ground: "Mill Lane",
    city: "Millbrook",
    division: "Regional Third Division",
    leagueId: REGIONAL_THIRD_DIVISION_ID,
    primaryColor: "#3AA0FF",
    secondaryColor: "#0E2E5C",
    textColor: "#04101F",
    formation: "4-3-3",
    reputation: 34,
    facilities: { training: 38, medical: 40, youth: 34, stadium: 36 },
    finances: {
      transferBudget: "€260K",
      wageBudget: "€14,500 / wk",
      balance: "€480K",
    },
    objectives: [
      { title: "Finish mid-table", progress: 0, note: "Season not yet started" },
      { title: "Keep the wage bill under control", progress: 0, note: "Board priority" },
      { title: "Give one academy prospect first-team minutes", progress: 0, note: "Youth pathway" },
    ],
    blurb: "A steady, well-run club with a decent academy and patient board.",
  },
  {
    id: "sandport-athletic",
    name: "Sandport Athletic",
    shortName: "Sandport",
    abbr: "SAN",
    ground: "Harbour View",
    city: "Sandport",
    division: "Regional Third Division",
    leagueId: REGIONAL_THIRD_DIVISION_ID,
    primaryColor: "#F0C24B",
    secondaryColor: "#5C3E0E",
    textColor: "#1A1103",
    formation: "4-4-2",
    reputation: 30,
    facilities: { training: 32, medical: 34, youth: 28, stadium: 42 },
    finances: {
      transferBudget: "€180K",
      wageBudget: "€11,000 / wk",
      balance: "€310K",
    },
    objectives: [
      { title: "Avoid relegation", progress: 0, note: "Season not yet started" },
      { title: "Improve home form", progress: 0, note: "Fans want a fortress" },
      { title: "Trim the wage bill", progress: 0, note: "Board priority" },
    ],
    blurb: "Passionate home support, a tight budget, and a squad that overachieved last season.",
  },
  {
    id: "elderbridge-fc",
    name: "Elderbridge FC",
    shortName: "Elderbridge",
    abbr: "ELD",
    ground: "Bridge End Park",
    city: "Elderbridge",
    division: "Regional Third Division",
    leagueId: REGIONAL_THIRD_DIVISION_ID,
    primaryColor: "#2FE08A",
    secondaryColor: "#0F5C39",
    textColor: "#03140C",
    formation: "4-3-3",
    reputation: 28,
    facilities: { training: 30, medical: 30, youth: 44, stadium: 26 },
    finances: {
      transferBudget: "€140K",
      wageBudget: "€9,500 / wk",
      balance: "€260K",
    },
    objectives: [
      { title: "Develop young players", progress: 0, note: "Best academy in the division" },
      { title: "Reach mid-table", progress: 0, note: "Season not yet started" },
      { title: "Sell a player for profit", progress: 0, note: "Balance the books" },
    ],
    blurb: "Modest facilities but the best academy in the division — a project club.",
  },
  {
    id: "kirkstone-wanderers",
    name: "Kirkstone Wanderers",
    shortName: "Kirkstone",
    abbr: "KIR",
    ground: "Fellside",
    city: "Kirkstone",
    division: "Regional Third Division",
    leagueId: REGIONAL_THIRD_DIVISION_ID,
    primaryColor: "#FF9F45",
    secondaryColor: "#5C2E0E",
    textColor: "#1A0D03",
    formation: "4-2-3-1",
    reputation: 26,
    facilities: { training: 28, medical: 32, youth: 26, stadium: 30 },
    finances: {
      transferBudget: "€110K",
      wageBudget: "€8,200 / wk",
      balance: "€190K",
    },
    objectives: [
      { title: "Avoid relegation", progress: 0, note: "Board's only real demand" },
      { title: "Stabilise the squad", progress: 0, note: "High turnover last season" },
      { title: "Build for next season", progress: 0, note: "Long-term project" },
    ],
    blurb: "Everyone expects a relegation fight — low pressure, low expectations, room to build.",
  },
  {
    id: "thorncastle-united",
    name: "Thorncastle United",
    shortName: "Thorncastle",
    abbr: "THO",
    ground: "Castle Road",
    city: "Thorncastle",
    division: "Regional Third Division",
    leagueId: REGIONAL_THIRD_DIVISION_ID,
    primaryColor: "#FF5A62",
    secondaryColor: "#5C1216",
    textColor: "#1A0405",
    formation: "4-4-2",
    reputation: 24,
    facilities: { training: 26, medical: 28, youth: 24, stadium: 24 },
    finances: {
      transferBudget: "€90K",
      wageBudget: "€7,000 / wk",
      balance: "€140K",
    },
    objectives: [
      { title: "Avoid finishing bottom", progress: 0, note: "Board realistic about ambitions" },
      { title: "Keep the club solvent", progress: 0, note: "Finances are tight" },
      { title: "Blood a youngster", progress: 0, note: "Cheap way to add quality" },
    ],
    blurb: "Tight budget, small crowds, an honest rebuilding job for a first-time manager.",
  },
  {
    id: "fenwick-rovers",
    name: "Fenwick Rovers",
    shortName: "Fenwick",
    abbr: "FEN",
    ground: "Rovers Park",
    city: "Fenwick",
    division: "Regional Third Division",
    leagueId: REGIONAL_THIRD_DIVISION_ID,
    primaryColor: "#4FDBFF",
    secondaryColor: "#0E3A5C",
    textColor: "#031017",
    formation: "4-3-3",
    reputation: 22,
    facilities: { training: 24, medical: 26, youth: 30, stadium: 22 },
    finances: {
      transferBudget: "€100K",
      wageBudget: "€7,600 / wk",
      balance: "€160K",
    },
    objectives: [
      { title: "Survive the season", progress: 0, note: "Newly promoted" },
      { title: "Establish a settled XI", progress: 0, note: "Squad short on numbers" },
      { title: "Impress the board", progress: 0, note: "First-time manager, first job" },
    ],
    blurb:
      "Newly promoted into the division — everyone expects a battle, nobody expects a miracle.",
  },
];

export function getStarterClub(id: string): StarterClub | undefined {
  return STARTER_CLUBS.find((c) => c.id === id);
}
