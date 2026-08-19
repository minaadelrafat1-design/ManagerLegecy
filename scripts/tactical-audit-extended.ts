import fs from "fs";
import { buildSimTeamInput } from "../src/lib/ai-match-adapter";
import { simulateMatch } from "../src/lib/match-engine";

function makeClub(id: string, name: string, abbr: string, formation = "4-3-3", reputation = 55) {
  return {
    id,
    name,
    abbr,
    formation,
    reputation,
    playerIds: [],
    academy: { rating: 50 },
    facilities: { training: 50, medical: 50, youth: 50, stadium: 50 },
  } as any;
}

async function run() {
  const home = makeClub("home-club", "Home Club", "HCL", "4-3-3", 60);
  const away = makeClub("away-club", "Away Club", "ACL", "4-4-2", 50);
  const players: Record<string, any> = {};

  const mentalities = [30, 50, 70];
  const tempos = [40, 60, 80];
  const widths = [30, 50, 70];
  const pressings = [30, 50, 70];
  const runsPerSetting = 6;

  const results: any[] = [];
  for (const mentality of mentalities) {
    for (const tempo of tempos) {
      for (const width of widths) {
        for (const pressing of pressings) {
          let accGoalsHome = 0;
          let accGoalsAway = 0;
          let accShotsHome = 0;
          let accSOT = 0;
          let accPoss = 0;
          for (let s = 0; s < runsPerSetting; s++) {
            const seed = 20000 + mentality * 1000 + tempo * 100 + width * 10 + pressing + s;
            const hInput = buildSimTeamInput("home", home, players, true);
            const aInput = buildSimTeamInput("away", away, players, false);
            hInput.tactics = { ...hInput.tactics, mentality, tempo, width, pressing } as any;
            const sim = simulateMatch(hInput, aInput, seed);
            const last = sim.snapshots[sim.snapshots.length - 1];
            accGoalsHome += sim.finalScore.home;
            accGoalsAway += sim.finalScore.away;
            accShotsHome += last.home.shots;
            accSOT += last.home.shotsOnTarget;
            accPoss += last.possessionHome;
          }
          const n = runsPerSetting;
          results.push({
            mentality,
            tempo,
            width,
            pressing,
            goalsHome: accGoalsHome / n,
            goalsAway: accGoalsAway / n,
            shotsHome: accShotsHome / n,
            sOT: accSOT / n,
            poss: accPoss / n,
          });
        }
      }
    }
  }
  if (!fs.existsSync("out")) fs.mkdirSync("out");
  const outPath = "out/tactical-extended.json";
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`Wrote ${outPath} with ${results.length} rows.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
