import { buildInitialState } from "../src/state/seed";
import { generateLeagueFixtures } from "../src/state/season";
import { simulateAiFixtureViaEngine, applyAiFixtureResults } from "../src/lib/ai-match-adapter";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const state = buildInitialState();
  const beforeCount = (state.fixtures ?? []).length;
  const withFixtures = generateLeagueFixtures(state);
  const generated = (withFixtures.fixtures ?? []).length - beforeCount;
  console.log(`Generated fixtures: ${generated}`);
  assert(generated > 0, "No fixtures were generated");

  const scheduledCount = (withFixtures.fixtures ?? []).filter(
    (f) => f.status === "scheduled",
  ).length;
  console.log(`Scheduled fixtures: ${scheduledCount}`);
  assert(scheduledCount > 0, "No scheduled fixtures after generation");

  // simulate each scheduled AI fixture via engine and apply results
  const scheduled = (withFixtures.fixtures ?? []).filter((f) => f.status === "scheduled");
  const results = scheduled.map((f) =>
    simulateAiFixtureViaEngine(f as any, withFixtures.clubs, withFixtures.players),
  );
  const after = applyAiFixtureResults(withFixtures as any, results, withFixtures.time.date);
  const stillScheduled = (after.fixtures ?? []).filter((f) => f.status === "scheduled").length;
  const played = (after.fixtures ?? []).filter((f) => f.status === "played").length;
  console.log(`After simulation — played: ${played}, scheduled: ${stillScheduled}`);
  assert(played > 0, "No fixtures were played by engine");

  console.log("Fixture validation passed");
}

async function main() {
  run();
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
