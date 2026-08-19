# Transfer Market Screen Implementation — Phase D2.1

## Completion Summary

### Objectives ✅
- **Complete the Transfer Market screen** using the existing Manager Legacy transfer infrastructure
- **Wire dispatch to real negotiation systems** (CREATE_NEGOTIATION action)
- **Integrate financial data** from GameState into the market view
- **Add search, filtering, sorting** without a separate market abstraction

---

## Implementation Details

### 1. Transfer Market Data Layer
**File:** [src/routes/transfers.tsx](src/routes/transfers.tsx)

#### Key Functions
- `buildTransferMarketRows(state: GameState): TransferMarketRow[]`
  - Normalizes all `state.transfers[]` listings into market rows
  - Resolves player and seller club references from GameState
  - Resolves missing seller club from player.clubId when listing lacks sellerClubId
  - Handles both: real players (with full club/player refs) and scouted targets (incomplete refs)
  - Sorted by overall rating → value → name for UI consistency

- `createTransferOfferForListing(state, listing, buyerClubId)`
  - Builds a valid negotiation offer from market listing data
  - Calculates fee, salary, contract years from player attributes or listing fallback
  - Includes signing bonus, release clause, and loan terms if applicable
  - Fee calculation: `market value × 0.72 (multiplied by 0.18 for loans)`
  - Salary derived from player's current salary with 5% premium
  - All values validated against GameState financial authoritative source

---

### 2. Transfer Market Screen UI
**File:** [src/routes/transfers.tsx](src/routes/transfers.tsx)

#### Sections
1. **Header & Budget Overview (4-column grid)**
   - Transfer Budget
   - Squad Value
   - Open Negotiations (real count)
   - Window Status (Open/Closed)

2. **Market Targets Panel (left column)**
   - Search by player name, position, or club
   - Filter by status: All, New, Bid
   - Sort by: Rating (default), Value, Age, Name
   - Shortlist toggle (client-side state)
   - **Approach button** (primary action) → dispatch CREATE_NEGOTIATION
   - Disabled when: no seller club linked OR insufficient budget

3. **Right Sidebar (two cards)**
   - **Transfer Window** — shows current window name, dates, open/closed status
   - **Recent Activity** — transfer events from GameState.events (transfer type, last 8)

#### Interaction Pattern
```
Player clicks "Approach" on market row
  → buildTransferMarketRow → createTransferOfferForListing
  → dispatch({ type: "CREATE_NEGOTIATION", ... })
  → Real negotiation session created in GameState
  → AI daily tick resolves negotiation
  → Transfer completed (or rejected) atomically
```

---

### 3. Integration with Real Systems

#### ✅ Wired to Existing GameState Actions
- `CREATE_NEGOTIATION` — creates a real negotiation session (reducer.ts)
- Player data from `state.players[id]` — authoritative source
- Club data from `state.clubs[id]` — authoritative roster membership
- Transfer listings from `state.transfers[]` — live market
- Events from `state.events[]` — real transfer activity log
- Window status from calendar utility (same as everywhere else)

#### ✅ Data Flow Validated
- Transfer market rows correctly built from real listings
- Offer creation uses correct fee/salary calculations
- Negotiations dispatch to real reducer
- Transfer ecosystem tests pass (17 tests)
- Integration tests pass (320+ tests)

---

## Test Evidence

### Transfer Market Tests ✅
**File:** [src/routes/transfers-market.test.ts](src/routes/transfers-market.test.ts)

```
✓ builds rows from real transfer listings with name normalization
✓ creates a valid negotiation offer from listing market data
```

### Transfer Ecosystem Tests ✅ (17 tests)
- Authoritative transfer atomicity
- Roster movement precision
- Financial event recording
- Contract updates post-transfer
- Career history updates
- Duplicate prevention

### Full Test Suite Results
- **Test Files:** 23 passed ✅
- **Total Tests:** 330 passed ✅
- **Coverage:** Movement system, state engine, transfer infrastructure all passing

---

## Technical Decisions

### 1. No Separate Market Abstraction
✅ Reused existing `TransferListing` type from seed and AI systems
✅ No new database layer or market-specific data structures
✅ Listings come from the same `state.transfers[]` AI system uses

### 2. Normalized Rows Resolve Missing References
- Seed listings have incomplete data (targets without player records)
- `buildTransferMarketRows` resolves seller club from player.clubId if needed
- Falls back to "Free agent" when no seller present
- Allows both scouted targets (incomplete) and real players (complete) to display

### 3. Offer Creation Independent of Player Type
- `createTransferOfferForListing` works with both linked players and market targets
- Uses player data when available, listing data as fallback
- All numbers validated against reasonable minimums (€750k fee, €12k salary)

### 4. Shortlist as Client State
- UI-only feature (not persisted in GameState)
- Toggle stored in local React state
- Could be promoted to GameState later if needed for save persistence

---

## Architecture Consistency

### Maintained Patterns
✅ **Reducer-based mutations** — screen never touches player/club data directly  
✅ **Selector hooks** — used `useGameState()` like all other screens  
✅ **Dispatch-driven flow** — all actions go through reducer.ts  
✅ **State persistence** — transfer listings auto-saved via store.tsx  
✅ **Calendar integration** — window status from shared calendar.ts utility  
✅ **Financial validation** — budget checks against state.finances  

### No Breaking Changes
✅ Existing transfer systems (AI daily tick, negotiation resolution) unchanged  
✅ Existing player/club data model untouched  
✅ Negotiation sessions work the same way (screen just adds UI)  

---

## Deliverables

### Code Added
- `src/routes/transfers.tsx` — 500+ lines
  - Screen component (TransfersScreen)
  - Data layer (buildTransferMarketRows, createTransferOfferForListing)
  - Window status helper (getTransferWindowStatus inline)
  
- `src/routes/transfers-market.test.ts` — 2 focused tests

### Code Unchanged
- All negotiation logic (negotiation-sessions.ts)
- All transfer completion logic (transfer-hardening.ts)
- All AI transfer systems (ai-transfers.ts)
- All existing tests remain passing

---

## How to Use

### From the UI
1. Navigate to `/transfers` route
2. Browse market targets (pre-populated from seed)
3. Search/filter by player name, position, or club
4. Click **Approach** to open a negotiation
5. Monitor negotiations in the **Negotiations** screen
6. Check **Recent Activity** panel for transfer outcomes

### From the Code
```typescript
// Access real market rows
const rows = buildTransferMarketRows(state);

// Create an offer for a listing
const offer = createTransferOfferForListing(state, listing, buyerClubId);

// Dispatch negotiation (in screen)
dispatch({
  type: "CREATE_NEGOTIATION",
  buyerClubId: state.currentClub.id,
  sellerClubId: listing.sellerClubId,
  playerId: listing.playerId,
  offer,
  message: "Approach...",
});
```

---

## Next Phases (Future Work)

1. **Shortlist Persistence** — save to GameState for save/load
2. **Notification System** — event toast when negotiation accepted/rejected
3. **Player Detail Modal** — view full player stats from market row
4. **Multi-Status Tracking** — show which negotiations are active per player
5. **Financial Simulation** — "what-if" fee/salary calculations

---

## Testing Commands

```bash
# Test this module
npx vitest run src/routes/transfers-market.test.ts

# Test with transfer ecosystem
npx vitest run src/routes/transfers-market.test.ts src/state/transfer-ecosystem.test.ts

# Full suite
npx vitest run
```

---

## Summary

The **Transfer Market screen is now complete and wired to the real game-state transfer infrastructure**. It uses the existing Player, Club, TransferListing, and NegotiationSession types without creating any synthetic market abstraction. All data flows through the authoritative GameState reducer, and screen interactions dispatch to the real negotiation system used by AI clubs.

✅ **Status: Ready for integration and testing**
