import assert from "assert";

const { buildInitialState } = await import("../src/state/seed.ts");
const { simulateSeasonQuick } = await import("../src/state/season.ts");

// run 7 seasons deterministically and assert that clubs evolve over time
let state = buildInitialState();
const seasons = Number(process.env.SEASONS ?? 7);

const snapshot = {
  reputations: Object.fromEntries(Object.entries(state.clubs).map(([id, c]) => [id, c.reputation])),
  facilitySums: Object.fromEntries(
    Object.entries(state.clubs).map(([id, c]) => [
      id,
      c.facilities.training + c.facilities.youth + c.facilities.medical + c.facilities.stadium,
    ]),
  ),
  managerIds: Object.fromEntries(
    Object.entries(state.clubs).map(([id, c]) => [id, c.aiManager?.id ?? null]),
  ),
};

console.log(`Starting evolution test: ${seasons} seasons`);

for (let s = 0; s < seasons; s++) {
  console.log(`Season ${s + 1}`);
  state = simulateSeasonQuick(state as any) as any;
}

// verify at least some reputations changed
let repChanged = false;
for (const [id, c] of Object.entries(state.clubs)) {
  const before = snapshot.reputations[id] ?? 0;
  if (Math.abs((c.reputation ?? 0) - before) >= 3) repChanged = true;
}

// verify at least one facility sum changed
let facChanged = false;
for (const [id, c] of Object.entries(state.clubs)) {
  const before = snapshot.facilitySums[id] ?? 0;
  const now =
    c.facilities.training + c.facilities.youth + c.facilities.medical + c.facilities.stadium;
  if (Math.abs(now - before) >= 3) facChanged = true;
}

// verify some manager churn
let managerMoved = false;
for (const [id, c] of Object.entries(state.clubs)) {
  const before = snapshot.managerIds[id] ?? null;
  const now = c.aiManager?.id ?? null;
  if (before !== now) managerMoved = true;
}

// verify at least one retirement occurred
const retired = Object.values(state.players).some((p: any) => p.status === "retired");

console.log({ repChanged, facChanged, managerMoved, retired });

assert(
  repChanged || facChanged || managerMoved || retired,
  "World did not evolve: no reputations, facilities, manager changes, or retirements detected",
);

console.log("PASS — evolution smoke test");
process.exit(0);
