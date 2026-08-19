
====================================================================================================
GAME STATE SIZE INVESTIGATION REPORT
====================================================================================================

OBJECTIVE:
Measure the actual serialized size of GameState components to understand
persistence overhead and identify growth patterns.

KEY FINDINGS FROM CODE INSPECTION:

1. PERSISTENCE MECHANISM:
   - Location: src/state/persistence.ts
   - Method: localStorage with JSON serialization
   - Frequency: Every 250ms (debounced) + on page hide/unload
   - Wrapper: SaveEnvelope { version, savedAt, data }
   - Current estimate from code: ~45MB per full state

2. STATE STRUCTURE:
   Location: src/state/types.ts
   Root Collections:
   - manager: Manager (single object)
   - currentClub: Club (single object)
   - clubs: Record<string, Club> (many clubs with nested arrays)
   - players: Record<string, Player> (many players with extensive fields)
   - staff: StaffMember[] (array)
   - leagues: Record<string, League>
   - competitions: Competition[]
   - fixtures: Fixture[] (grows with every season)
   - matches: MatchRecord[] (completed fixtures, persistent)
   - transfers: TransferListing[]
   - contracts: Contract[]
   - training: TrainingPlan[]
   - finances: Finances (single object with nested revenue/expenses)
   - board: Board (single object)
   - fans: Fans (single object)
   - events: EventLogEntry[] (GROWS UNBOUNDED)
   - news: NewsItem[] (GROWS UNBOUNDED)
   - inbox: InboxMessage[] (GROWS UNBOUNDED with archival)
   - calendar: CalendarEntry[]
   - careerHistory: CareerEvent[]
   - seasonReport: SeasonReport (per season)
   - seasonReports: SeasonReport[] (accumulates)
   - tactics: TacticsSettings (single object)
   - history: WorldHistory (MAJOR: clubRecords, playerRecords, managerRecords)
   - meta: GameStateMeta (with aiLedgers, europeanQualifications, etc)
   - negotiations: NegotiationSession[] (GROWS during transfer windows)
   - scoutingNetwork: ScoutingNetwork (with reports array)
   - financialTransactions: FinancialTransaction[] (GROWS UNBOUNDED)
   - relationships: RelationshipEntry[]
   - history (WorldHistory): clubRecords, playerRecords, managerRecords

3. KNOWN GROWTH PATTERNS:

   Collections that grow INDEFINITELY:
   - events: Every game action (transfer offer, injury, news) creates entry
   - news: New items added throughout the day
   - inbox: Messages for squad, transfers, training, board, injuries
   - financialTransactions: Every transaction is logged
   - matches: Every completed fixture creates a MatchRecord
   - fixtures: New fixtures added at season start
   - seasonReports: One per completed season
   - worldHistory: Accumulates records indefinitely

   Collections bounded by game design:
   - players: Mostly fixed (starting squad + generated youth)
   - clubs: Fixed world size
   - transfers: Limited by transfer window activity
   - negotiations: Active during transfer windows
   - scout reports: Limited by number of scouts + assignment frequency

4. ADVANCE DAY SYSTEM:
   Location: src/state/calendar.ts
   Daily Hook Order:
   1. fixtures     - Match scheduling and results
   2. training     - Player training simulation
   3. recovery     - Fatigue/injury recovery
   4. injuries     - New injuries and recoveries
   5. development  - Player growth/potential changes
   6. ai           - AI manager decisions (transfers, contracts)
   7. scouting     - Scout report generation
   8. finances     - Financial transactions (weekly on week boundary)
   9. events       - Event log entries (state growth)
  10. news         - News generation (state growth)

   Weekly Hooks (runs when time.week changes):
   - applyWeeklyFinanceTick: Weekly finances
   - syncAiLedgers: AI finance tracking

5. CRITICAL PERFORMANCE RISKS:

   UNBOUNDED STATE GROWTH:
   - events array: Each daily hook can add multiple entries
     Estimated: 10-100 entries per day × 365 days/season × 30 seasons = 100K-3M entries
   - news array: Similar growth pattern
   - financialTransactions: Weekly entries minimum, daily possible
   - inbox: Multiple messages per day, archival doesn't always clean up
   - worldHistory: Records accumulate without cleanup

   EXPENSIVE ADVANCE DAY OPERATIONS:
   - AI transfers (ai hook): Likely scans all players/clubs/transfer listings
   - Events generation (events hook): Processes multiple subsystems
   - Fixture scheduling: May scan all fixtures
   - Financial transactions: Multiple transactions per day

   SERIALIZATION OVERHEAD:
   - 45MB state × 250ms save interval = 180MB/sec write pressure
   - Even with debouncing, localStorage quota is 5-10MB typical
   - Mature saves may be near or exceeding quota

6. NEXT INVESTIGATION STEPS NEEDED:

   [ ] Create actual game state and measure component sizes with JSON.stringify
   [ ] Run 1-year career and measure:
       - Final state size
       - Events array length
       - News array length
       - FinancialTransactions array length
       - WorldHistory sizes
   [ ] Profile advance day execution times per hook
   [ ] Check for O(n²) operations in daily hooks
   [ ] Verify no duplicate hook registrations
   [ ] Check if AI decisions process entire state each day
   [ ] Measure localStorage quota usage in realistic saves

7. SAVE MECHANISM DETAILS:

   Current Behavior (from code review):
   - Save triggers: Every 250ms OR on page hide/unload
   - What gets saved: Entire GameState object
   - No incremental saves: Full serialization every time
   - Storage: window.localStorage
   - Quota: Browser dependent (typically 5-10MB)
   - Failure handling: Logged as warning, doesn't break gameplay
   - Migrations: Version 14 with migration map for old saves

   Risks:
   - localStorage quota exceeded on mature saves
   - Serialization time may spike for 45MB state
   - UI thread blocked during 45MB JSON.stringify
   - No write-ahead logging if tab crashes

8. COLLECTION SIZING ESTIMATES:

   Typical Item Sizes (estimated):
   - Player: 2-5 KB (name, stats, history, relationships)
   - Club: 5-10 KB (facilities, stadium, academy, scouting, playerIds)
   - Fixture: 500 bytes
   - EventLogEntry: 200-500 bytes
   - NewsItem: 300-800 bytes
   - InboxMessage: 300-600 bytes
   - FinancialTransaction: 200-300 bytes
   - HistoricalClubRecord: 300-500 bytes
   - HistoricalPlayerRecord: 300-500 bytes
   - MatchRecord: 300-500 bytes
   - NegotiationSession with entries: 1-2 KB
   - ScoutReport: 1-2 KB

   30-Year Career Estimate (rough):
   - Players: 400 × 3 KB = 1.2 MB
   - Clubs: 400 × 7 KB = 2.8 MB
   - Fixtures: 1,200-2,000 × 500B = 0.6-1 MB
   - MatchRecords: 1,000 × 400B = 0.4 MB
   - Events: 100K-1M × 300B = 30-300 MB (MAJOR)
   - News: 50K-500K × 500B = 25-250 MB (MAJOR)
   - FinancialTransactions: 50K-200K × 250B = 12-50 MB (MAJOR)
   - Inbox: 10K-100K × 400B = 4-40 MB
   - WorldHistory records: 10K-100K × 400B = 4-40 MB
   - Other (meta, tactics, board, fans, etc): ~5 MB

   TOTAL: Likely 80-720 MB depending on play style and duration
          Current ~45MB is probably 1-2 years in

====================================================================================================
END INVESTIGATION SNAPSHOT
====================================================================================================


====================================================================================================
DAILY HOOK INVESTIGATION
====================================================================================================

Hook Registration Pattern (from calendar.ts):

Daily hooks are registered dynamically through registerDailyHook()
and run in fixed order: fixtures, training, recovery, injuries, development,
ai, scouting, finances, events, news

Files that register hooks (grep needed to confirm all):
