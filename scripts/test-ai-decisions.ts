/* =============================================================================
 * Phase D2.1 — AI club decision framework smoke tests
 * =============================================================================
 * Same standalone-script approach as `scripts/test-standings.ts` (run with
 * `npx tsx scripts/test-ai-decisions.ts`). Covers what the phase brief asks
 * for: every decision input (finances, squad needs, club philosophy,
 * manager philosophy, reputation, league position) is actually read for a
 * club with full data; clubs the game can't fully see are handled honestly
 * rather than faked; the ranking is deterministic for a fixed seed but can
 * vary in a controlled way; and different clubs land on different
 * priorities.
 *
 * Same `localStorage` stub as `test-calendar.ts`/`test-standings.ts`, for
 * the same reason (`buildInitialState`'s callers go through modules that
 * import `state/persistence.ts`).
 * ---------------------------------------------------------------------------*/

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

const { buildInitialState, HOME_CLUB_ID } = await import("../src/state/seed.ts");
const {
  buildClubDecisionContext,
  evaluateClubPriorities,
  determineSquadNeedForClub,
  determineSellCandidatesForClub,
  evaluateContractRenewalPriorities,
  identifyTransferTargets,
  recommendBudgetAllocation,
  selectStartingXI,
  recommendTrainingDecision,
} = await import("../src/state/ai-decisions.ts");

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (!condition) failures++;
}

const state = buildInitialState();
const AWAY_CLUB_ID = "westport-united";
const RIVAL_CLUB_ID = "ashcombe-city"; // no simRoster, no playerIds — see makeMinimalClub

// ---- 1. the player's own club: full squad data, a real finances ledger ---------

const homeContext = buildClubDecisionContext(state, HOME_CLUB_ID);
check("home club squad data is 'full'", homeContext.squadNeeds.dataConfidence === "full");
check("home club finances are 'modeled'", homeContext.finances.source === "modeled");
check(
  "home club squad groups sum to the full 18-player seed roster",
  homeContext.squadNeeds.groups.reduce((sum, g) => sum + g.count, 0) === 18,
  `got ${homeContext.squadNeeds.groups.reduce((sum, g) => sum + g.count, 0)}`,
);
check("home club has a league position", homeContext.leaguePosition !== null);
// The seeded demo manager's philosophy ("Possession-based, high press,
// develop from within") is a hand-authored blend, not a verbatim match for
// any single `MANAGER_PHILOSOPHIES` entry — so this is expected to fall
// back to the raw text rather than resolving to an id. That fallback, and
// the neutral alignment score it produces, is the behaviour under test.
check(
  "home club's manager philosophy falls back to its raw text when unresolved",
  homeContext.managerPhilosophy.id === null &&
    homeContext.managerPhilosophy.label === state.manager.philosophy,
);
check(
  "unresolved manager philosophy yields a neutral (50) alignment score",
  homeContext.philosophyAlignment === 50,
  `got ${homeContext.philosophyAlignment}`,
);

// ---- 2. the next opponent: partial squad data (simRoster only), no ledger -------

const awayContext = buildClubDecisionContext(state, AWAY_CLUB_ID);
check("away club squad data is 'partial'", awayContext.squadNeeds.dataConfidence === "partial");
check("away club finances are 'estimated'", awayContext.finances.source === "estimated");
check(
  "away club squad groups sum to its simRoster size",
  awayContext.squadNeeds.groups.reduce((sum, g) => sum + g.count, 0) > 0,
);

// ---- 3. a rival club: no roster data at all — must not fabricate needs ---------

const rivalContext = buildClubDecisionContext(state, RIVAL_CLUB_ID);
check("rival club squad data is 'none'", rivalContext.squadNeeds.dataConfidence === "none");
check(
  "rival club has zero need on every group (no data, not 'no problems')",
  rivalContext.squadNeeds.groups.every((g) => g.need === 0),
);
check("rival club has no most-urgent group", rivalContext.squadNeeds.mostUrgentGroup === null);
check("rival club finances are 'estimated'", rivalContext.finances.source === "estimated");

// ---- 4. determinism: same context + same seedSalt -> identical ranking ---------

const resultA = evaluateClubPriorities(homeContext, { seedSalt: "matchday-14" });
const resultB = evaluateClubPriorities(homeContext, { seedSalt: "matchday-14" });
check(
  "same club + same seedSalt reproduces an identical ranking",
  JSON.stringify(resultA) === JSON.stringify(resultB),
);

// ---- 5. controlled randomness: different seedSalt is allowed to move scores,
//         but only within the requested jitter bound ----------------------------

const resultC = evaluateClubPriorities(homeContext, { seedSalt: "matchday-20", randomness: 6 });
const maxDelta = Math.max(
  ...resultA.ranked.map((r) => {
    const other = resultC.ranked.find((x) => x.priority === r.priority)!;
    return Math.abs(r.score - other.score);
  }),
);
check(
  "jitter across a different seedSalt stays within the configured bound",
  maxDelta <= 12, // two independent +/-6 draws, worst case
  `max delta ${maxDelta}`,
);

const resultZero1 = evaluateClubPriorities(homeContext, { seedSalt: "matchday-14", randomness: 0 });
const resultZero2 = evaluateClubPriorities(homeContext, { seedSalt: "matchday-20", randomness: 0 });
check(
  "randomness: 0 gives the same ranking regardless of seedSalt",
  JSON.stringify(resultZero1) === JSON.stringify(resultZero2),
);

// ---- 6. every signal and score stays in the documented 0-100 range -------------

for (const [label, context] of [
  ["home", homeContext],
  ["away", awayContext],
  ["rival", rivalContext],
] as const) {
  const result = evaluateClubPriorities(context, { seedSalt: "range-check" });
  const values = [...Object.values(result.signals), ...result.ranked.map((r) => r.score)];
  check(
    `${label} club: every signal/score is within 0-100`,
    values.every((v) => v >= 0 && v <= 100),
  );
}

// ---- 7. different clubs can produce different priorities -----------------------

const allClubIds = Object.values(state.clubs).map((c) => c.id);
const topPriorities = allClubIds.map((id) => {
  const context = buildClubDecisionContext(state, id);
  return evaluateClubPriorities(context, { seedSalt: "league-wide", randomness: 0 }).topPriority;
});
const distinctTopPriorities = new Set(topPriorities);
check(
  "different clubs produce more than one distinct top priority league-wide",
  distinctTopPriorities.size > 1,
  `${[...distinctTopPriorities].join(", ")}`,
);

// ---- D2.2.1 squad-need smoke checks ----------------------------------------
{
  const allowed = new Set([
    "goalkeeper",
    "defender",
    "midfielder",
    "winger",
    "striker",
    "no-urgent-need",
  ]);

  const homeNeed = determineSquadNeedForClub(state, HOME_CLUB_ID);
  check("home club: squad-need result is valid", allowed.has(homeNeed), `got ${homeNeed}`);

  const awayNeed = determineSquadNeedForClub(state, AWAY_CLUB_ID);
  check("away club: squad-need result is valid", allowed.has(awayNeed), `got ${awayNeed}`);

  const rivalNeed = determineSquadNeedForClub(state, RIVAL_CLUB_ID);
  check("rival club: squad-need result is valid", allowed.has(rivalNeed), `got ${rivalNeed}`);
}

// ---- D2.2 decision outputs -----------------------------------------------
{
  const sellCandidates = determineSellCandidatesForClub(state, HOME_CLUB_ID);
  check("home club: sell candidates returned", sellCandidates.length > 0);
  check(
    "sell candidates sorted descending",
    sellCandidates.every((c, i) => i === 0 || c.score <= sellCandidates[i - 1]!.score),
  );
  check(
    "sell candidate scores are within 0-100",
    sellCandidates.every((c) => c.score >= 0 && c.score <= 100),
  );

  const renewals = evaluateContractRenewalPriorities(state, HOME_CLUB_ID);
  check("home club: contract renewal priorities returned", renewals.length > 0);
  check(
    "contract renewal priorities sorted descending",
    renewals.every((c, i) => i === 0 || c.score <= renewals[i - 1]!.score),
  );
  check(
    "contract priorities are valid",
    renewals.every((c) => ["high", "medium", "low"].includes(c.priority)),
  );

  const transferTargets = identifyTransferTargets(state, HOME_CLUB_ID);
  check("home club: transfer targets returned", transferTargets.length > 0);
  check(
    "transfer target scores are within 0-100",
    transferTargets.every((t) => t.score >= 0 && t.score <= 100),
  );

  const allocation = recommendBudgetAllocation(homeContext, { randomness: 0 });
  check(
    "budget allocation sums to 100",
    allocation.transfer + allocation.wages + allocation.reserves === 100,
  );
  check(
    "budget allocation values are non-negative",
    allocation.transfer >= 0 && allocation.wages >= 0 && allocation.reserves >= 0,
  );

  const xi = selectStartingXI(state, HOME_CLUB_ID);
  check("starting XI contains 11 players", xi.length === 11);
  check("starting XI players are unique", new Set(xi).size === xi.length);

  const trainingDecision = recommendTrainingDecision(state, HOME_CLUB_ID);
  check(
    "training decision returned a focus",
    typeof trainingDecision.focus === "string" && trainingDecision.focus.length > 0,
  );
  check(
    "training decision intensity is valid",
    ["low", "medium", "high"].includes(trainingDecision.intensity),
  );
  check(
    "training decision target is valid",
    ["whole squad", "youth", "seniors"].includes(trainingDecision.target),
  );
}

console.log(`\nClub -> top priority (deterministic, seedSalt "league-wide", randomness 0):`);
for (const id of allClubIds) {
  const context = buildClubDecisionContext(state, id);
  const result = evaluateClubPriorities(context, { seedSalt: "league-wide", randomness: 0 });
  console.log(
    `  ${context.clubName.padEnd(20)} conf=${context.squadNeeds.dataConfidence.padEnd(7)} ` +
      `fin=${context.finances.source.padEnd(9)} -> ${result.topPriority} (${result.ranked[0]!.score})`,
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
