/* Unit tests for negotiation engine (Phase E2)
 * Run with: npx tsx scripts/test-negotiation.ts
 */

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: new MemoryStorage(),
};

const { buildInitialState } = await import("../src/state/seed");
const { evaluateOffer } = await import("../src/state/negotiation");

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL —", msg);
    process.exit(2);
  }
}

let state = buildInitialState();

// Setup: create a seller club with a player, and three buyers varying in wealth
const sellerClub = {
  id: "seller-club",
  name: "Seller Club",
  shortName: "SELL",
  abbr: "SEL",
  ground: "Seller Ground",
  primaryColor: "#000",
  secondaryColor: "#111",
  textColor: "#fff",
  formation: "4-4-2",
  leagueId: "test-league",
  reputation: 60,
  facilities: { training: 50, medical: 50, youth: 50, stadium: 40 },
  academy: { rating: 50, prospectIds: [] },
  medical: { rating: 50, playersInTreatment: 0 },
  scouting: { rating: 50, regionsCovered: [] },
  playerIds: [],
  aiManager: {
    id: "aimgr-seller",
    name: "S Manager",
    nationality: "ENG",
    reputation: 50,
    tacticalAbility: 50,
    philosophy: "",
    preferredFormation: "4-4-2",
    transferPriorities: [],
    youthPreference: 40,
    financialTendency: "balanced",
    patience: 50,
  },
};

const player = {
  id: "test-player",
  name: "Test Player",
  shortName: "Test",
  number: 9,
  pos: "ST",
  role: "",
  nationality: "ENG",
  age: 24,
  overall: 80,
  potential: 86,
  fitness: 90,
  morale: 70,
  form: 70,
  formTrend: "flat",
  attrs: { pace: 80, shooting: 82, passing: 70, dribbling: 75, defending: 30, physical: 75 },
  professionalism: 70,
  personality: "",
  value: "€10.0M",
  marketValue: 10_000_000,
  salary: "€20,000",
  contractUntil: "Jun 2028",
  contractYears: 3,
  trainingFocus: "",
  trainingProgress: 0,
  starter: true,
};

// extend state with seller and player
state = {
  ...state,
  clubs: { ...state.clubs, [sellerClub.id]: sellerClub },
  players: { ...state.players, [player.id]: player } as any,
};
state.clubs[sellerClub.id].playerIds = [player.id];

// Buyer A: poor buyer
const poorBuyer = {
  ...sellerClub,
  id: "poor-buyer",
  name: "Poor Buyer",
  reputation: 30,
  aiManager: { ...sellerClub.aiManager, id: "aimgr-poor" },
};
state.clubs[poorBuyer.id] = poorBuyer;

// Buyer B: reasonable buyer
const reasonableBuyer = {
  ...sellerClub,
  id: "reasonable-buyer",
  name: "Reasonable Buyer",
  reputation: 55,
  aiManager: { ...sellerClub.aiManager, id: "aimgr-reason" },
};
state.clubs[reasonableBuyer.id] = reasonableBuyer;

// Buyer C: wealthy buyer
const wealthyBuyer = {
  ...sellerClub,
  id: "wealthy-buyer",
  name: "Wealthy Buyer",
  reputation: 90,
  aiManager: { ...sellerClub.aiManager, id: "aimgr-wealthy" },
};
// artificially boost identity/transfer factor if supported
(state.clubs as any)[wealthyBuyer.id] = wealthyBuyer;

// 1) Low offer -> reject
const lowOffer = { fee: 300_000, installments: 1, bonuses: 0 };
let res = evaluateOffer(state as any, poorBuyer.id, sellerClub.id, player.id, lowOffer);
console.log("Low offer outcome:", res.outcome, "-", res.message);
assert(
  res.outcome === "rejected" && /too low/i.test(res.message),
  "Low offer should be rejected as too low",
);

// 2) Reasonable offer -> counter (willing to negotiate)
const reasonableOffer = { fee: 5_000_000, installments: 2, bonuses: 0 };
res = evaluateOffer(state as any, reasonableBuyer.id, sellerClub.id, player.id, reasonableOffer);
console.log("Reasonable offer outcome:", res.outcome, "-", res.message);
assert(
  res.outcome === "counter" && /negotiate|willing to negotiate/i.test(res.message),
  "Reasonable offer should lead to a counter with negotiation message",
);

// 3) Wealthy buyer accepts counter: simulate buyer receiving counter then buyer accepts if can afford installments
res = evaluateOffer(state as any, wealthyBuyer.id, sellerClub.id, player.id, reasonableOffer);
console.log("Wealthy initial offer outcome:", res.outcome, "-", res.message);
if (res.outcome === "counter" && res.offer) {
  // wealthy buyer can pay counter fee even if installments; emulate buyer paying full counter fee
  const counter = res.offer;
  // accept if wealthy buyer reputation high
  const final = evaluateOffer(state as any, wealthyBuyer.id, sellerClub.id, player.id, counter);
  console.log("Wealthy buyer makes counter/accept outcome:", final.outcome, final.message);
  assert(
    final.outcome === "accepted" || final.outcome === "counter",
    "Wealthy buyer should be able to reach acceptance or meaningful counter",
  );
} else {
  assert(res.outcome === "accepted", "Wealthy buyer initial offer should be accepted or countered");
}

console.log("PASS — negotiation scenarios behaved as expected");
process.exit(0);
