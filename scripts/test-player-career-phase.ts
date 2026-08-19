import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const {
  runMonthlyPlayerDevelopment,
  runSeasonalPlayerLifecycle,
  evaluateCareerPattern,
  recordPlayerTransfer,
  recordPlayerLoan,
  simulateLongTermCareers,
} = await import("../src/state/player-development.ts");

const base = buildInitialState();
const sampleId = Object.keys(base.players)[0];
const player = base.players[sampleId];

const development = evaluateCareerPattern({
  ...player,
  age: 18,
  overall: 55,
  potential: 82,
  professionalism: 80,
  morale: 72,
  fit: 78,
} as any);
assert(
  ["early-breakthrough", "steady-development", "elite-development", "late-bloomer"].includes(
    development,
  ),
  `Expected a development pattern for a young prospect, got ${development}`,
);

const decline = evaluateCareerPattern({
  ...player,
  age: 34,
  overall: 69,
  potential: 70,
  professionalism: 52,
  morale: 35,
  fitness: 48,
  injury: { type: "tired", severity: "moderate", returnDate: null },
} as any);
assert(
  ["decline", "veteran-longevity", "injury-shortened-career"].includes(decline),
  `Expected an ageing pattern, got ${decline}`,
);

const retirementState = {
  ...base,
  time: {
    ...base.time,
    date: "2027-08-01",
    season: "2027/28",
  },
  players: {
    ...base.players,
    testRetire: {
      ...player,
      id: "testRetire",
      name: "Retirement Test",
      age: 38,
      overall: 60,
      potential: 60,
      fitness: 42,
      morale: 30,
      professionalism: 40,
      status: "available",
      clubId: base.currentClub.id,
      careerHistory: [],
      career: {
        clubHistory: [base.currentClub.id],
        appearances: 220,
        goals: 28,
        assists: 15,
        trophies: 0,
        transfers: 1,
        loans: 0,
        awards: [],
        reputation: 48,
        careerPath: "decline",
      },
    },
  },
  clubs: {
    ...base.clubs,
    [base.currentClub.id]: {
      ...base.clubs[base.currentClub.id],
      playerIds: [...base.clubs[base.currentClub.id].playerIds, "testRetire"],
    },
  },
};

const retired = runSeasonalPlayerLifecycle(retirementState as any) as any;
assert(retired.players.testRetire.status === "retired", "A deteriorating veteran should retire");
assert(
  Array.isArray(retired.players.testRetire.careerHistory),
  "Retired players keep a career history",
);

const transferState = recordPlayerTransfer(
  base as any,
  sampleId,
  base.currentClub.id,
  "rival-club-1",
  "2027-07-01",
);
assert(
  transferState.players[sampleId].careerHistory.length > 0,
  "Transfers should add player career events",
);
assert(
  transferState.players[sampleId].career?.clubHistory.includes("rival-club-1"),
  "Player club history should include the new club",
);

const loanState = recordPlayerLoan(
  base as any,
  sampleId,
  "loan-club-1",
  "2028-01-15",
  "2028-06-30",
);
assert(
  loanState.players[sampleId].loanHistory?.length === 1,
  "Loan records should be saved on the player",
);

const devState = {
  ...base,
  players: {
    ...base.players,
    testDev: {
      ...player,
      id: "testDev",
      name: "Development Test",
      age: 18,
      overall: 54,
      potential: 82,
      professionalism: 84,
      morale: 74,
      fitness: 76,
      injury: null,
      clubId: base.currentClub.id,
      careerHistory: [],
      career: {
        clubHistory: [base.currentClub.id],
        appearances: 0,
        goals: 0,
        assists: 0,
        trophies: 0,
        transfers: 0,
        loans: 0,
        awards: [],
        reputation: 50,
        careerPath: "steady-development",
      },
    },
  },
  clubs: {
    ...base.clubs,
    [base.currentClub.id]: {
      ...base.clubs[base.currentClub.id],
      playerIds: [...base.clubs[base.currentClub.id].playerIds, "testDev"],
    },
  },
};

const afterDev = runMonthlyPlayerDevelopment(devState as any) as any;
assert(
  afterDev.players.testDev.overall >= 54,
  "Development should not regress a young prospect before a season cycle",
);
assert(
  Array.isArray(afterDev.players.testDev.careerHistory),
  "Career history should be present during development",
);

const longTerm = simulateLongTermCareers(base as any, 10);
assert(
  longTerm.averageCareerLength > 0,
  "Long-term simulation should produce an average career length",
);
assert(
  longTerm.developmentDistribution && Object.keys(longTerm.developmentDistribution).length > 0,
  "Career patterns should be distributed",
);
assert(
  longTerm.retirementDistribution && Object.keys(longTerm.retirementDistribution).length > 0,
  "Retirement stages should be reported",
);

console.log("PASS — player career development and long-term lifecycle checks");
console.log("long-term sample", JSON.stringify(longTerm.summary, null, 2));
process.exit(0);
