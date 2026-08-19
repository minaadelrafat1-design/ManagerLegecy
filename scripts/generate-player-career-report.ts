import fs from "fs";
import path from "path";
import { buildInitialState } from "../src/state/seed";
import { simulateLongTermCareers } from "../src/state/player-development";

async function main() {
  const outDir = path.resolve(process.cwd(), "outputs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const state = buildInitialState();
  const seasons = 30;
  const result = simulateLongTermCareers(state, seasons);

  const report = {
    generatedAt: new Date().toISOString(),
    seasons,
    summary: result.summary,
    developmentDistribution: result.developmentDistribution,
    retirementDistribution: result.retirementDistribution,
    samplePlayers: Object.values(state.players)
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        overall: p.overall,
        potential: p.potential,
        careerPath: p.career?.careerPath,
      })),
  };

  const fname = path.join(
    outDir,
    `player-career-report-${new Date().toISOString().slice(0, 10)}.json`,
  );
  fs.writeFileSync(fname, JSON.stringify(report, null, 2), "utf8");
  console.log("Wrote report to", fname);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
