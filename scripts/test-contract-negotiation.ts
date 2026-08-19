/* Unit tests for contract negotiation (Phase E3)
 * Run with: npx tsx scripts/test-contract-negotiation.ts
 */

const { buildInitialState } = await import("../src/state/seed");
const { evaluateContractOffer, applyAcceptedContract } = await import("../src/state/negotiation");

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL —", msg);
    process.exit(2);
  }
}

let state = buildInitialState();

// Create simple club & player
const club = {
  id: "club-ct",
  name: "Contract Town",
  shortName: "CT",
  abbr: "CTN",
  ground: "CT Arena",
  primaryColor: "#123",
  secondaryColor: "#456",
  textColor: "#fff",
  formation: "4-3-3",
  leagueId: "test-league",
  reputation: 70,
  facilities: { training: 60, medical: 60, youth: 50, stadium: 50 },
  academy: { rating: 50, prospectIds: [] },
  medical: { rating: 50, playersInTreatment: 0 },
  scouting: { rating: 50, regionsCovered: [] },
  playerIds: [],
  aiManager: {
    id: "aimgr-ct",
    name: "CT Manager",
    nationality: "ENG",
    reputation: 60,
    tacticalAbility: 50,
    philosophy: "",
    preferredFormation: "4-3-3",
    transferPriorities: [],
    youthPreference: 40,
    financialTendency: "balanced",
    patience: 50,
  },
};

const player = {
  id: "ct-player",
  name: "Contract Player",
  shortName: "CPlayer",
  number: 7,
  pos: "RW",
  role: "",
  nationality: "ENG",
  age: 25,
  overall: 78,
  potential: 82,
  fitness: 90,
  morale: 70,
  form: 70,
  formTrend: "flat",
  attrs: { pace: 82, shooting: 74, passing: 72, dribbling: 78, defending: 40, physical: 70 },
  professionalism: 65,
  personality: "Ambitious",
  value: "€6.0M",
  marketValue: 6_000_000,
  salary: "€8,000",
  contractUntil: "Jun 2026",
  contractYears: 1,
  trainingFocus: "",
  trainingProgress: 0,
  starter: false,
};

state = {
  ...state,
  clubs: { ...state.clubs, [club.id]: club },
  players: { ...state.players, [player.id]: player } as any,
};
state.clubs[club.id].playerIds = [player.id];

// 1) Offer below current salary for an ambitious player -> player loses interest
const lowContractOffer = { salaryWeekly: 4000, years: 1, signingBonus: 0, guaranteedStarts: false };
let cres = evaluateContractOffer(state as any, club.id, player.id, lowContractOffer as any);
console.log("Low contract offer outcome:", cres.outcome, "-", cres.message);
assert(
  cres.outcome === "player-lost-interest",
  "Ambitious player should lose interest in a very low offer",
);

// 2) Fair raise offer -> counter
const fairOffer = { salaryWeekly: 10_000, years: 2, signingBonus: 0, guaranteedStarts: true };
cres = evaluateContractOffer(state as any, club.id, player.id, fairOffer as any);
console.log("Fair offer outcome:", cres.outcome, "-", cres.message);
assert(
  cres.outcome === "counter" || cres.outcome === "accepted",
  "Fair offer should produce counter or acceptance",
);

// 3) Apply accepted contract and verify player updated
const acceptedOffer = {
  salaryWeekly: 12_000,
  years: 3,
  signingBonus: 5_000,
  guaranteedStarts: true,
};
const next = applyAcceptedContract(state as any, club.id, player.id, acceptedOffer as any);
console.log(
  "Applied contract. New salary:",
  next.players[player.id].salary,
  "ContractUntil:",
  next.players[player.id].contractUntil,
);
assert(
  next.players[player.id].salary.includes("€12,000"),
  "Player salary should be updated to accepted amount",
);
assert(
  next.contracts.some(
    (c: any) => c.playerId === player.id && c.clubId === club.id && c.status === "active",
  ),
  "Contract entry should be added",
);

console.log("PASS — contract negotiation scenarios behaved as expected");
process.exit(0);
