import { buildInitialState } from "../src/state/seed";
import { runEnhancedTransferWindow } from "../src/state/transfers-enhanced";

function main() {
  let state = buildInitialState();
  const before = (state.events ?? []).filter((e: any) => e.type === "transfer").length;
  state = runEnhancedTransferWindow(state as any) as any;
  const after = (state.events ?? []).filter((e: any) => e.type === "transfer").length;
  console.log(`transfer events before=${before} after=${after}`);
  console.log(
    JSON.stringify(
      (state.events ?? []).filter((e: any) => e.type === "transfer"),
      null,
      2,
    ),
  );
}

main();
