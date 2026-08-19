import { describe, expect, it } from "vitest";
import { buildInitialState } from "@/state/seed";
import { buildTransferMarketRows, createTransferOfferForListing } from "@/routes/transfers";
import { createDefaultFilters, getFilteredTransferMarketRows } from "@/lib/transfer-market-filter";

describe("transfer market screen data layer", () => {
  it("builds rows from real transfer listings with name normalization", () => {
    const state = buildInitialState();
    const rows = buildTransferMarketRows(state);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.name).toBeTruthy();
    expect(rows[0]?.listing).toBeDefined();
  });

  it("includes all world players in the transfer market, not just explicit transfer listings", () => {
    const state = buildInitialState();
    const rows = buildTransferMarketRows(state);

    expect(rows.length).toBeGreaterThan(state.transfers.length);
    expect(rows.some((row) => row.playerId && row.playerId === Object.keys(state.players)[0])).toBe(
      true,
    );
  });

  it("returns rows when searching accented names without diacritics", () => {
    const state = buildInitialState();
    const matching = getFilteredTransferMarketRows(state, {
      ...createDefaultFilters(),
      searchQuery: "milos",
    });

    expect(matching.length).toBeGreaterThan(0);
    expect(matching[0]?.name).toContain("Miloš");
  });

  it("parses transfer values from listing data even when no player record is linked", () => {
    const state = buildInitialState();
    const rows = buildTransferMarketRows(state);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.marketValue > 0)).toBe(true);
    expect(rows.some((row) => row.valueFormatted.includes("M"))).toBe(true);
  });

  it("creates a valid negotiation offer from listing market data", () => {
    const state = buildInitialState();
    const listing = state.transfers[0];
    const offer = createTransferOfferForListing(state, listing, state.currentClub.id);

    expect(offer.fee).toBeGreaterThan(0);
    expect(offer.salaryWeekly).toBeGreaterThan(0);
    expect(offer.years).toBeGreaterThan(0);
  });
});
