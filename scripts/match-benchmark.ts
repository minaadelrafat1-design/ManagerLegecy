import { simulateMatch, DEFAULT_HOME_TACTICS } from "../src/lib/match-engine";

type Stats = {
  goals: number[];
  homeWins: number;
  draws: number;
  awayWins: number;
  shots: number[];
  shotsOnTarget: number[];
  possessionHome: number[];
  yellows: number[];
  reds: number[];
  cleanSheets: number;
  scorelines: Map<string, number>;
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
  // GK
  xi.push(
    makePlayer(`${side}-GK`, "GK", Math.max(20, strength - 10), Math.max(40, strength + 10), 40),
  );
  // Defenders
  for (let i = 0; i < 4; i++)
    xi.push(
      makePlayer(`${side}-D${i}`, "CB", Math.max(30, strength - 8), Math.max(40, strength + 8), 45),
    );
  // Midfield
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
  // Attack
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

function addScoreline(map: Map<string, number>, a: number, b: number) {
  const k = `${a}-${b}`;
  map.set(k, (map.get(k) ?? 0) + 1);
}

function collectMatch(result: any, stats: Stats) {
  const goals = result.finalScore.home + result.finalScore.away;
  stats.goals.push(goals);
  if (result.finalScore.home > result.finalScore.away) stats.homeWins += 1;
  else if (result.finalScore.home < result.finalScore.away) stats.awayWins += 1;
  else stats.draws += 1;

  // aggregate shots/ontarget from last snapshot
  const snap = result.snapshots[result.snapshots.length - 1];
  stats.shots.push(snap.home.shots + snap.away.shots);
  stats.shotsOnTarget.push(snap.home.shotsOnTarget + snap.away.shotsOnTarget);
  stats.possessionHome.push(snap.possessionHome);
  stats.yellows.push(snap.home.yellow + snap.away.yellow);
  stats.reds.push(snap.home.red + snap.away.red);
  if (result.finalScore.home === 0) stats.cleanSheets += 1;
  if (result.finalScore.away === 0) stats.cleanSheets += 1;
  addScoreline(stats.scorelines, result.finalScore.home, result.finalScore.away);
}

function summarize(stats: Stats, runs: number) {
  const avg = (arr: number[]) =>
    Math.round((arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length)) * 100) / 100;
  console.log("Runs:", runs);
  console.log("Goals per match (avg):", avg(stats.goals));
  console.log("Home wins:", stats.homeWins, "Draws:", stats.draws, "Away wins:", stats.awayWins);
  console.log("Shots per match (avg):", avg(stats.shots));
  console.log("Shots on target (avg):", avg(stats.shotsOnTarget));
  console.log("Avg home possession:", avg(stats.possessionHome));
  console.log("Avg yellows per match:", avg(stats.yellows));
  console.log("Avg reds per match:", avg(stats.reds));
  console.log("Clean sheets total:", stats.cleanSheets);
  console.log("Top scorelines:");
  const sorted = Array.from(stats.scorelines.entries()).sort((a, b) => b[1] - a[1]);
  console.log(sorted.slice(0, 12));
}

async function run() {
  const runs = parseInt(process.env.MATCH_RUNS ?? "2000", 10);
  const stats: Stats = {
    goals: [],
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    shots: [],
    shotsOnTarget: [],
    possessionHome: [],
    yellows: [],
    reds: [],
    cleanSheets: 0,
    scorelines: new Map(),
  };

  for (let i = 0; i < runs; i++) {
    const seed = 1 + i;
    const home = makeTeam("home", 72);
    const away = makeTeam("away", 71);
    const res = simulateMatch(home, away, seed);
    collectMatch(res, stats);
  }

  summarize(stats, runs);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
