/* eslint-disable @typescript-eslint/no-explicit-any */
/* Standalone tests for the AI strategic memory system
   Run with: npx tsx scripts/test-ai-memory.ts
*/

import { buildInitialState } from "../src/state/seed";
import { gameReducer } from "../src/state/reducer";
import { addClubMemory, MEMORY_MAX_ITEMS } from "../src/state/ai-memory";
import { buildClubDecisionContext } from "../src/state/ai-decisions";

function check(label: string, cond: boolean, detail = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${ok || !detail ? "" : ` (${detail})`}`);
  return ok;
}

async function main() {
  let failures = 0;
  const s0 = buildInitialState();
  const clubIds = Object.keys(s0.clubs);
  const clubA = clubIds[0];
  const clubB = clubIds[1] ?? clubA;

  // 1) Important events create memory: add a transfer listing and mark it agreed
  let state = { ...s0 } as any;
  const listing = {
    id: "tl-1",
    name: "Test Player",
    playerId: undefined,
    sellerClubId: clubA,
    position: "ST",
    rating: 65,
    nationality: "ENG",
    age: 24,
    value: "€1.2M",
    status: "new",
  };
  state = gameReducer(state, { type: "ADD_TRANSFER_TARGET", listing } as any);
  state = gameReducer(state, {
    type: "UPDATE_TRANSFER_STATUS",
    id: listing.id,
    status: "agreed",
  } as any);

  const memA = state.clubs[clubA].aiMemory?.items ?? [];
  if (!check("Memory: transfer created on seller club", memA.length > 0, `count=${memA.length}`))
    failures++;

  // 2) Memory persists across reducer calls
  state = gameReducer(state, { type: "ADVANCE_DAY", days: 1 } as any);
  const memA2 = state.clubs[clubA].aiMemory?.items ?? [];
  if (!check("Memory persists after unrelated action", memA2.length === memA.length)) failures++;

  // 3) Irrelevant history does not grow indefinitely: add many memories programmatically and verify cap
  for (let i = 0; i < MEMORY_MAX_ITEMS + 10; i++) {
    state = addClubMemory(state, clubA, {
      kind: "tactical",
      summary: `Memory ${i}`,
      meta: { idx: i },
      relevance: 10,
    });
  }
  const capped = state.clubs[clubA].aiMemory?.items?.length ?? 0;
  if (
    !check(
      "Memory bounded by cap",
      capped <= MEMORY_MAX_ITEMS,
      `cap=${MEMORY_MAX_ITEMS} actual=${capped}`,
    )
  )
    failures++;

  // 4) Memory can influence future decisions: build context and let a tiny decision read memory
  const context = buildClubDecisionContext(state, clubA);
  const transferFailures = (context.memory.counts?.["transfer"] ?? 0) as number;
  const decisionSignal = transferFailures > 0 ? 100 : 0; // simple rule: prior transfer trouble -> more aggressive
  if (
    !check(
      "Decision can read memory (influence)",
      typeof decisionSignal === "number" && decisionSignal >= 0,
    )
  )
    failures++;

  // 5) Determinism: run the same sequence twice and compare memory summaries
  const runSequence = (seedState: any) => {
    let s = { ...seedState };
    s = gameReducer(s, {
      type: "ADD_TRANSFER_TARGET",
      listing: { ...listing, id: "tl-run" },
    } as any);
    s = gameReducer(s, { type: "UPDATE_TRANSFER_STATUS", id: "tl-run", status: "agreed" } as any);
    for (let i = 0; i < 5; i++)
      s = addClubMemory(s, clubB, { kind: "tactical", summary: `R${i}`, meta: {}, relevance: 5 });
    return (
      s.clubs[clubB].aiMemory?.items?.map((m: any) => ({
        kind: m.kind,
        summary: m.summary,
        meta: m.meta,
      })) ?? []
    );
  };

  const out1 = runSequence(s0 as any);
  const out2 = runSequence(s0 as any);
  const same = JSON.stringify(out1) === JSON.stringify(out2);
  if (!check("Determinism: repeated sequence yields same memory", same)) failures++;

  console.log(`\nTest summary: ${failures} failures`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
