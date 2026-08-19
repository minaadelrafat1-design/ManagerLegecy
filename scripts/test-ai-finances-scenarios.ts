import { buildInitialState, HOME_CLUB_ID } from "../src/state/seed";
import runAiActions from "../src/state/ai-actions";
import computeClubFinancials from "../src/state/club-finance";

function printSummary(state: any, clubId: string) {
  const fin = computeClubFinancials(state, clubId);
  console.log(
    `Club ${clubId} -> tier=${fin.healthTier} balance=${fin.balance} transfer=${fin.transferBudget} wageBudget=${fin.wageBudgetWeekly}`,
  );
}

function cloneState(state: any) {
  return JSON.parse(JSON.stringify(state));
}

async function main() {
  const base = buildInitialState();

  // Scenario 1: poor club
  const poor = cloneState(base);
  poor.clubs[HOME_CLUB_ID].reputation = 20;
  poor.finances.balance = "€100K";
  poor.clubs[HOME_CLUB_ID].facilities = { training: 20, medical: 20, youth: 20, stadium: 10 };
  poor.meta = poor.meta || {};
  let out = runAiActions(poor);
  printSummary(out, HOME_CLUB_ID);

  // Scenario 2: rich club
  const rich = cloneState(base);
  rich.finances.balance = "€500.0M";
  rich.clubs[HOME_CLUB_ID].reputation = 90;
  rich.clubs[HOME_CLUB_ID].identity.transferBudgetFactor = 2;
  out = runAiActions(rich);
  printSummary(out, HOME_CLUB_ID);

  // Scenario 3: youth-focused
  const youth = cloneState(base);
  youth.clubs[HOME_CLUB_ID].identity.academyFocus = 90;
  youth.clubs[HOME_CLUB_ID].academy = { rating: 85, prospectIds: [] };
  out = runAiActions(youth);
  printSummary(out, HOME_CLUB_ID);

  // Scenario 4: promotion challenger (higher reputation, aggressive)
  const promo = cloneState(base);
  promo.clubs[HOME_CLUB_ID].reputation = 75;
  promo.clubs[HOME_CLUB_ID].identity.expectations = "promotion";
  out = runAiActions(promo);
  printSummary(out, HOME_CLUB_ID);

  // Scenario 5: financially distressed
  const distressed = cloneState(base);
  distressed.finances.balance = "€-2.5M";
  out = runAiActions(distressed);
  printSummary(out, HOME_CLUB_ID);

  // Scenario 6: aging squad
  const aged = cloneState(base);
  for (const pid of aged.clubs[HOME_CLUB_ID].playerIds) {
    aged.players[pid].age += 6;
  }
  out = runAiActions(aged);
  printSummary(out, HOME_CLUB_ID);

  // Scenario 7: rebuilding
  const rebuild = cloneState(base);
  rebuild.clubs[HOME_CLUB_ID].identity.academyFocus = 80;
  rebuild.clubs[HOME_CLUB_ID].reputation = 40;
  out = runAiActions(rebuild);
  printSummary(out, HOME_CLUB_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
