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
  const runsPerSetting = 12;

  console.log(
    "Tactical audit: varying mentality x tempo — averaging over",
    runsPerSetting,
    "seeds",
  );

  for (const mentality of mentalities) {
    for (const tempo of tempos) {
      let accGoalsHome = 0;
      let accGoalsAway = 0;
      let accShotsHome = 0;
      let accShotsOnTargetHome = 0;
      let accPossHome = 0;
      for (let s = 0; s < runsPerSetting; s++) {
        const seed = 10000 + mentality * 100 + tempo * 10 + s;
        const hInput = buildSimTeamInput("home", home, players, true);
        const aInput = buildSimTeamInput("away", away, players, false);
        // override tactics for home side under test
        hInput.tactics = { ...hInput.tactics, mentality, tempo } as any;
        const sim = simulateMatch(hInput, aInput, seed);
        const last = sim.snapshots[sim.snapshots.length - 1];
        const fh = sim.finalScore.home;
        const fa = sim.finalScore.away;
        accGoalsHome += fh;
        accGoalsAway += fa;
        accShotsHome += last.home.shots;
        accShotsOnTargetHome += last.home.shotsOnTarget;
        accPossHome += last.possessionHome;
      }
      const n = runsPerSetting;
      console.log(
        `mentality=${mentality} tempo=${tempo} -> goalsHome=${(accGoalsHome / n).toFixed(2)} goalsAway=${(accGoalsAway / n).toFixed(2)} shotsHome=${(accShotsHome / n).toFixed(1)} sOT=${(accShotsOnTargetHome / n).toFixed(1)} possHome=${(accPossHome / n).toFixed(1)}%`,
      );
    }
  }
  console.log("Tactical audit complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
