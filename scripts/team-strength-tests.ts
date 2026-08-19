import { simulateMatch } from "../src/lib/match-engine";

async function runMatchup(strHome: number, strAway: number, runs = 1000) {
  const results = { home: 0, draw: 0, away: 0 };
  for (let i = 0; i < runs; i++) {
    const seed = i + 1000 + Math.round(Math.random() * 10000);
    const makeTeam = (side: string, strength: number) => {
      const players = [] as any[];
      players.push({
        id: `${side}-GK`,
        shortName: "GK",
        number: 1,
        pos: "GK",
        attack: 30,
        defend: strength + 5,
        playmaking: 30,
        baseFitness: 100,
        overall: strength,
      });
      for (let p = 0; p < 10; p++)
        players.push({
          id: `${side}-P${p}`,
          shortName: `P${p}`,
          number: p + 2,
          pos: "CM",
          attack: strength,
          defend: strength,
          playmaking: strength,
          baseFitness: 100,
          overall: strength,
        });
      return {
        id: side,
        name: side,
        xi: players.slice(0, 11),
        bench: players.slice(11),
        tactics: {
          tempo: 60,
          pressing: 55,
          directness: 50,
          mentality: 55,
          width: 55,
          depth: 50,
          chemistry: 60,
        },
        formation: "4-3-3",
        homeAdvantage: side === "home",
      } as any;
    };
    const home = makeTeam("home", strHome);
    const away = makeTeam("away", strAway);
    const res = simulateMatch(home, away, seed);
    if (res.finalScore.home > res.finalScore.away) results.home += 1;
    else if (res.finalScore.home < res.finalScore.away) results.away += 1;
    else results.draw += 1;
  }
  return { runs, results };
}

async function run() {
  const pairs = [
    [70, 70],
    [70, 75],
    [70, 80],
    [70, 85],
    [70, 90],
  ];
  for (const [h, a] of pairs) {
    console.log(`Testing ${h} vs ${a}`);
    const out = await runMatchup(h, a, 500);
    console.log(out);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
