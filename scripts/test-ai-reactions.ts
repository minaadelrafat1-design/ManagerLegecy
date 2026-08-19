import { buildInitialState } from "../src/state/seed";
import { gameReducer } from "../src/state/reducer";

function check(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
  return cond;
}

function run() {
  const base = buildInitialState();
  const clubIds = Object.keys(base.clubs).filter(
    (id) => (base.clubs[id].playerIds?.length ?? 0) > 0,
  );
  if (clubIds.length < 2) {
    console.error("Not enough clubs");
    process.exit(2);
  }

  // Scenario 1: Wealthy, high-expectation club signs a star (big fee)
  const wealthy = clubIds[0];
  const sW = JSON.parse(JSON.stringify(base));
  sW.clubs[wealthy].aiManager = {
    ...(sW.clubs[wealthy].aiManager ?? {}),
    financialTendency: "spender",
    youthPreference: 20,
    id: "am-w",
  };
  sW.finances.transferBudget = "€80.0M";
  sW.clubs[wealthy].reputation = 85;
  sW.currentClub = sW.clubs[wealthy];

  let stateW: any = sW;
  stateW = gameReducer(stateW, {
    type: "RECORD_TRANSFER",
    fee: 15_000_000,
    wageWeeklyDelta: 20000,
    description: "Signed star",
  } as any);

  const fansAfterW = stateW.fans?.approval ?? 0;
  const boardAfterW = stateW.board?.confidence ?? 0;
  console.log("wealthy before board=", base.board?.confidence, "after=", boardAfterW);
  const newsHasStarW = (stateW.news ?? []).some(
    (n: any) => n.tag === "transfer" && /major|star|big/i.test(n.text),
  );

  // wealthy club should see fans rise and news about major signing; board shouldn't crash
  if (!check("Wealthy fans rose on big signing", fansAfterW > (base.fans?.approval ?? 0)))
    process.exit(1);
  if (!check("Wealthy board remains positive", boardAfterW >= (base.board?.confidence ?? 0) - 10))
    process.exit(1);
  if (!check("News mentions major signing", newsHasStarW)) process.exit(1);

  // Scenario 2: Small, frugal club signs a 'star' that strains finances
  const small = clubIds[1];
  const sS = JSON.parse(JSON.stringify(base));
  sS.clubs[small].aiManager = {
    ...(sS.clubs[small].aiManager ?? {}),
    financialTendency: "frugal",
    youthPreference: 80,
    id: "am-s",
  };
  sS.finances.transferBudget = "€500K";
  sS.clubs[small].reputation = 35;
  sS.currentClub = sS.clubs[small];

  let stateS: any = sS;
  stateS = gameReducer(stateS, {
    type: "RECORD_TRANSFER",
    fee: 5_000_000,
    wageWeeklyDelta: 15000,
    description: "Shock signing",
  } as any);

  const fansAfterS = stateS.fans?.approval ?? 0;
  const boardAfterS = stateS.board?.confidence ?? 0;
  const newsHasFiscalS = (stateS.news ?? []).some(
    (n: any) => n.tag === "transfer" && /tight finances|amid tight finances|fiscal/i.test(n.text),
  );

  // small club: fans may be happy, but board confidence likely drops and news highlights fiscal strain
  console.log("small before board=", base.board?.confidence, "after=", boardAfterS);
  if (!check("Small fans rose on signing", fansAfterS > (base.fans?.approval ?? 0)))
    process.exit(1);
  if (!check("Small board confidence fell", boardAfterS < (base.board?.confidence ?? 0)))
    process.exit(1);
  if (!check("News mentions fiscal strain", newsHasFiscalS)) process.exit(1);

  console.log("PASS — contextual signing reactions differ as expected");
}

run();
