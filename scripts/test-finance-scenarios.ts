import computeClubFinancials from "../src/state/club-finance";
import { formatMoney } from "../src/state/finance";

type MinimalState = any;

function makePlayers(count: number, salaryBase: number, clubId: string) {
  const players: Record<string, any> = {};
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `${clubId}-p${i + 1}`;
    players[id] = { id, clubId, salary: salaryBase + i * 1000, age: 24 + (i % 10) };
    ids.push(id);
  }
  return { players, ids };
}

function makeStateFor(archetype: string): MinimalState {
  const clubId = `club-${archetype}`;
  let reputation = 50;
  let stadium = 50;
  let facilities = { training: 50, medical: 50, youth: 50, stadium: 50 };
  let playerCount = 20;
  let salaryBase = 1000;

  switch (archetype) {
    case "rich":
      reputation = 90;
      stadium = 80;
      facilities = { training: 80, medical: 75, youth: 70, stadium: 80 };
      playerCount = 30;
      salaryBase = 30_000;
      break;
    case "poor":
      reputation = 20;
      stadium = 30;
      facilities = { training: 30, medical: 30, youth: 25, stadium: 30 };
      playerCount = 18;
      salaryBase = 300;
      break;
    case "rebuilding":
      reputation = 45;
      stadium = 40;
      facilities = { training: 55, medical: 50, youth: 80, stadium: 45 };
      playerCount = 22;
      salaryBase = 1_200;
      break;
    case "promotion":
      reputation = 60;
      stadium = 55;
      facilities = { training: 60, medical: 55, youth: 50, stadium: 55 };
      playerCount = 24;
      salaryBase = 3_000;
      break;
    default:
      break;
  }

  const { players, ids } = makePlayers(playerCount, salaryBase, clubId);

  const clubs = {
    [clubId]: {
      id: clubId,
      name: `Club ${archetype}`,
      reputation,
      facilities,
      medical: { playersInTreatment: 0 },
      facilityLevels: { training: 2, youth: 2, medical: 2, scouting: 2 },
      scouting: { rating: 50 },
      playerIds: ids,
      aiManager: { id: `ai-${clubId}` },
      identity: { archetype: archetype },
    },
  };

  const state: MinimalState = {
    time: { date: new Date().toISOString(), week: 32, season: 2026 },
    clubs,
    players,
    matches: [],
    competitions: [],
    transfers: [],
    staff: [],
    fans: { attendanceAvg: undefined },
    board: { confidence: 50 },
    finances: { balance: "€0", loans: [] },
    meta: {},
    manager: undefined,
    currentClub: undefined,
  };

  return state;
}

async function run() {
  const archetypes = ["rich", "poor", "rebuilding", "promotion"];
  const results: { archetype: string; fin: any }[] = [];

  for (const a of archetypes) {
    const s = makeStateFor(a);
    const clubId = Object.keys(s.clubs)[0];
    const fin = computeClubFinancials(s, clubId);
    results.push({ archetype: a, fin });
    console.log(`-- ${a.toUpperCase()} --`);
    console.log(`Balance: ${formatMoney(fin.balance)}`);
    console.log(`Transfer budget: ${formatMoney(fin.transferBudget)}`);
    console.log(`Wage budget (weekly): ${formatMoney(fin.wageBudgetWeekly)}`);
    console.log(`Health tier: ${fin.healthTier}`);
    console.log();
  }

  // Basic assertions: ordering by transfer budget (expected: promotion >= rebuilding >= poor >= rich)
  const getTB = (a: string) => results.find((r) => r.archetype === a)!.fin.transferBudget;
  const tbPromotion = getTB("promotion");
  const tbRebuilding = getTB("rebuilding");
  const tbPoor = getTB("poor");
  const tbRich = getTB("rich");
  if (!(tbPromotion >= tbRebuilding && tbRebuilding >= tbPoor && tbPoor >= tbRich)) {
    console.error("Assertion failed: transfer budget ordering unexpected", {
      promotion: tbPromotion,
      rebuilding: tbRebuilding,
      poor: tbPoor,
      rich: tbRich,
    });
    process.exit(2);
  }

  // Wage check: promotion wage should be at least rebuilding wage
  const rebuildingWage = results.find((r) => r.archetype === "rebuilding")!.fin.wageBudgetWeekly;
  const promotionWage = results.find((r) => r.archetype === "promotion")!.fin.wageBudgetWeekly;
  if (!(promotionWage >= rebuildingWage)) {
    console.error("Assertion failed: promotion wage should be >= rebuilding wage");
    process.exit(2);
  }

  console.log("All basic scenario assertions passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
