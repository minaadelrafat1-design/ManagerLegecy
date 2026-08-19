import { describe, expect, it } from "vitest";
import { countManagerChanges } from "./event-invariants";

describe("countManagerChanges", () => {
  it("counts manager churn events across all real event types", () => {
    const state = {
      events: [
        {
          id: "1",
          date: "2026-08-01",
          type: "manager",
          description: "Club A appointed New Manager",
          meta: { action: "appointed" },
        },
        {
          id: "2",
          date: "2026-12-01",
          type: "milestone",
          description: "Manager change at Club B",
          meta: { action: "sacked" },
        },
        {
          id: "3",
          date: "2027-02-01",
          type: "board",
          description: "Club C sacked their manager",
          meta: { action: "sacked" },
        },
        {
          id: "4",
          date: "2027-03-01",
          type: "news",
          description: "Regular club news",
        },
      ],
    } as any;

    expect(countManagerChanges(state)).toBe(3);
  });
});
