import { simulateMatch, DEFAULT_HOME_TACTICS } from "../src/lib/match-engine";

const DEFAULT_RANGES = {
  goalsPerMatch: { min: 1.5, max: 3.5 },
  homeWinPct: { min: 0.32, max: 0.55 },
  drawPct: { min: 0.12, max: 0.4 },
  shotsPerMatch: { min: 6, max: 22 },
  shotsOnTarget: { min: 2, max: 9 },
  yellowsPerMatch: { min: 1, max: 6 },
  redsPerMatch: { min: 0.0, max: 0.6 },
};

function makePlayer(id: string, pos: any, attack = 60, defend = 60, playmaking = 60) {
  return {
    id,
    shortName: id,
    number: 10,
    pos,
    role: undefined,
    x: 50,
    y: 50,
    baseFitness: 100,
    overall: Math.round((attack + defend + playmaking) / 3),
    attack,
    defend,
    playmaking,
    discipline: 60,
    isGK: pos === "GK",
    tacticalFamiliarity: 60,
  } as any;
}

function makeTeam(side: "home" | "away", strength = 70) {
  const xi = [] as any[];
  xi.push(
    makePlayer(`${side}-GK`, "GK", Math.max(20, strength - 10), Math.max(40, strength + 10), 40),
  );
  for (let i = 0; i < 4; i++)
    xi.push(
      makePlayer(`${side}-D${i}`, "CB", Math.max(30, strength - 8), Math.max(40, strength + 8), 45),
    );
  for (let i = 0; i < 3; i++)
    xi.push(
      makePlayer(
        `${side}-M${i}`,
        "CM",
        Math.max(40, strength - 5),
        Math.max(35, strength - 2),
        Math.max(40, strength + 5),
      ),
    );
  xi.push(
    makePlayer(`${side}-ST1`, "ST", Math.max(50, strength + 5), Math.max(30, strength - 5), 50),
  );
  xi.push(
    makePlayer(`${side}-ST2`, "ST", Math.max(48, strength + 3), Math.max(30, strength - 6), 48),
  );

  const bench = [] as any[];
  for (let i = 0; i < 7; i++)
    bench.push(makePlayer(`${side}-B${i}`, "CM", strength - 4, strength - 4, strength - 4));

  return {
    id: side,
    name: `${side} team`,
    xi,
    bench,
    formation: "4-3-2",
    tactics: { ...DEFAULT_HOME_TACTICS, chemistry: 60 },
    homeAdvantage: side === "home",
  } as any;
}

function avg(arr: number[]) {
  return arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
}

async function run() {
  const runs = parseInt(process.env.MATCH_RUNS ?? "2000", 10);
  const ranges = DEFAULT_RANGES;
  const goals: number[] = [];
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  const shotsArr: number[] = [];
  const sOT: number[] = [];
  const poss: number[] = [];
  const yellows: number[] = [];
  const reds: number[] = [];

  for (let i = 0; i < runs; i++) {
    const seed = i + 2000;
    const home = makeTeam("home", 72);
    const away = makeTeam("away", 71);
    const res = simulateMatch(home, away, seed);
    goals.push(res.finalScore.home + res.finalScore.away);
    if (res.finalScore.home > res.finalScore.away) homeWins++;
    else if (res.finalScore.home < res.finalScore.away) awayWins++;
    else draws++;
    const snap = res.snapshots[res.snapshots.length - 1];
    shotsArr.push(snap.home.shots + snap.away.shots);
    sOT.push(snap.home.shotsOnTarget + snap.away.shotsOnTarget);
    poss.push(snap.possessionHome);
    yellows.push(snap.home.yellow + snap.away.yellow);
    reds.push(snap.home.red + snap.away.red);
  }

  const goalsAvg = avg(goals);
  const homePct = homeWins / runs;
  const drawPct = draws / runs;
  const shotsAvg = avg(shotsArr);
  const sOTAvg = avg(sOT);
  const yellowsAvg = avg(yellows);
  const redsAvg = avg(reds);

  console.log("Validation results:");
  console.log({ runs, goalsAvg, homePct, drawPct, shotsAvg, sOTAvg, yellowsAvg, redsAvg });

  const flags: string[] = [];
  if (goalsAvg < ranges.goalsPerMatch.min || goalsAvg > ranges.goalsPerMatch.max)
    flags.push(
      `goalsPerMatch out of range (${ranges.goalsPerMatch.min}-${ranges.goalsPerMatch.max})`,
    );
  if (homePct < ranges.homeWinPct.min || homePct > ranges.homeWinPct.max)
    flags.push(`homeWinPct out of range (${ranges.homeWinPct.min}-${ranges.homeWinPct.max})`);
  if (drawPct < ranges.drawPct.min || drawPct > ranges.drawPct.max)
    flags.push(`drawPct out of range (${ranges.drawPct.min}-${ranges.drawPct.max})`);
  if (shotsAvg < ranges.shotsPerMatch.min || shotsAvg > ranges.shotsPerMatch.max)
    flags.push(
      `shotsPerMatch out of range (${ranges.shotsPerMatch.min}-${ranges.shotsPerMatch.max})`,
    );
  if (sOTAvg < ranges.shotsOnTarget.min || sOTAvg > ranges.shotsOnTarget.max)
    flags.push(
      `shotsOnTarget out of range (${ranges.shotsOnTarget.min}-${ranges.shotsOnTarget.max})`,
    );
  if (yellowsAvg < ranges.yellowsPerMatch.min || yellowsAvg > ranges.yellowsPerMatch.max)
    flags.push(
      `yellowsPerMatch out of range (${ranges.yellowsPerMatch.min}-${ranges.yellowsPerMatch.max})`,
    );
  if (redsAvg < ranges.redsPerMatch.min || redsAvg > ranges.redsPerMatch.max)
    flags.push(`redsPerMatch out of range (${ranges.redsPerMatch.min}-${ranges.redsPerMatch.max})`);

  if (flags.length === 0) {
    console.log("All metrics within configured ranges.");
  } else {
    console.log("Flags:");
    flags.forEach((f) => console.log(" - ", f));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
