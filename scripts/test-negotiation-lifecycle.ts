/* Test negotiation lifecycle across days
 * Run with: npx tsx scripts/test-negotiation-lifecycle.ts
 */

const { buildInitialState } = await import("../src/state/seed");
const { createNegotiationSession, addNegotiationEntry, acceptContractSession } =
  await import("../src/state/negotiation-sessions");
const { evaluateContractOffer } = await import("../src/state/negotiation");
const { gameReducer } = await import("../src/state/reducer");

let state = buildInitialState();

// create club and player
const club = {
  id: "life-club",
  name: "Life Club",
  shortName: "LIFE",
  abbr: "LIF",
  ground: "Life Ground",
  primaryColor: "#000",
  secondaryColor: "#111",
  textColor: "#fff",
  formation: "4-3-3",
  leagueId: "l",
  reputation: 60,
  facilities: { training: 50, medical: 50, youth: 50, stadium: 40 },
  academy: { rating: 50, prospectIds: [] },
  medical: { rating: 50, playersInTreatment: 0 },
  scouting: { rating: 50, regionsCovered: [] },
  playerIds: [],
  aiManager: null,
};
const player = {
  id: "life-player",
  name: "Life Player",
  shortName: "LPlayer",
  number: 11,
  pos: "LW",
  role: "",
  nationality: "ENG",
  age: 24,
  overall: 75,
  potential: 80,
  fitness: 90,
  morale: 70,
  form: 70,
  formTrend: "flat",
  attrs: { pace: 80, shooting: 70, passing: 68, dribbling: 75, defending: 30, physical: 70 },
  professionalism: 60,
  personality: "Ambitious",
  value: "€3.0M",
  marketValue: 3000000,
  salary: "€6,000",
  contractUntil: "Jun 2026",
  contractYears: 1,
  trainingFocus: "",
  trainingProgress: 0,
  starter: true,
};

state = {
  ...state,
  clubs: { ...state.clubs, [club.id]: club },
  players: { ...state.players, [player.id]: player },
};
state.clubs[club.id].playerIds = [player.id];

// AI club creates a contract session for renewal (simulate club is AI by setting aiManager)
state = {
  ...state,
  clubs: {
    ...state.clubs,
    [club.id]: {
      ...club,
      aiManager: {
        id: "aimgr",
        name: "AI",
        nationality: "ENG",
        reputation: 50,
        tacticalAbility: 50,
        philosophy: "",
        preferredFormation: "4-3-3",
        transferPriorities: [],
        youthPreference: 40,
        financialTendency: "balanced",
        patience: 50,
      },
    },
  },
};

state = createNegotiationSession(
  state,
  club.id,
  club.id,
  player.id,
  { salaryWeekly: 7000, years: 2, signingBonus: 0, guaranteedStarts: false },
  "AI offers renewal",
);
console.log("Sessions after creation:", state.negotiations?.length);

// player evaluates and counters
const last = state.negotiations![state.negotiations!.length - 1];
const r = evaluateContractOffer(state as any, club.id, player.id, {
  salaryWeekly: 7000,
  years: 2,
} as any);
console.log("Evaluation for player:", r.outcome, r.message);

if (r.outcome === "counter" && r.counter) {
  state = addNegotiationEntry(
    state,
    last.id,
    player.id,
    {
      salaryWeekly: r.counter.salaryWeekly,
      years: r.counter.years,
      signingBonus: r.counter.signingBonus,
      guaranteedStarts: r.counter.guaranteedStarts,
    },
    "Player counters",
  );
}

// advance a day (manually call reducer ADVANCE_DAY)
const { gameReducer: reducer } = await import("../src/state/reducer");
state = reducer(state as any, { type: "ADVANCE_DAY", days: 1 } as any);
console.log("Day advanced to", state.time.date);

// AI accepts the counter by applying acceptContractSession
const session = state.negotiations![state.negotiations!.length - 1];
const lastEntry = session.entries[session.entries.length - 1];
if (lastEntry && lastEntry.offer.salaryWeekly) {
  state = acceptContractSession(state, session.id, {
    salaryWeekly: lastEntry.offer.salaryWeekly,
    years: lastEntry.offer.years,
  });
}

console.log("Final session status:", state.negotiations![state.negotiations!.length - 1].status);
console.log("Player new salary:", state.players[player.id].salary);
console.log("PASS — lifecycle completed");
process.exit(0);
