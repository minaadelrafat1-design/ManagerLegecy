# Positional System Enhancement Report

## 1. Existing positioning system audited

The current match simulation already tracks players with shared x/y coordinates on a 0-100 pitch scale, but the logic was effectively fixed-formation and mostly dependent on author-defined starting positions.

Key findings from the existing system:

- `SimPlayer` stores `x`, `y`, `pos`, and optional tactical config in `src/lib/match-engine.ts`.
- Match data brings a side’s roster into a normalized runtime shape via `playerToSim()`.
- Existing formation positions are mostly static and hand-authored; the engine does not yet produce contextual target positions.
- The tactical layer influences decision-making (shot, pass, press, etc.) but not the player’s actual spatial target.
- This is why players could feel repetitive or loop-like in simple fixed-position layouts.

The important constraint was preserved: no engine rebuild was attempted, no advanced animation layer was introduced, and no random wandering behavior was added.

## 2. New positional target logic

A new positional target layer was introduced in `src/lib/positional-targeting.ts`.

The system produces a contextual target object with:

- `targetX`, `targetY`
- `currentX`, `currentY`
- `urgency`
- `reason`

This gives a clean interface for future position smoothing or UI layer usage without forcing a rewrite of the match engine.

The logic uses formation-aware nominal positions and then adjusts them based on:

- ball position
- possession status
- phase (attacking vs defending)
- player role and tactical zone
- instruction-driven behavior
- nearby teammate/opponent spacing
- pitch boundary constraints

## 3. Tactical influences

The target generator responds to both tactical role and instruction context.

Examples:

- Wingers with `Cut Inside` move more central.
- Wingers with `Stay Wide` stay on the outside lane.
- Fullbacks with `Overlap` push high.
- Fullbacks with `Invert` move inside.
- Strikers with `Get In Behind` push high and narrow the line.
- Strikers with `Press` move toward an opponent when defending.

These are applied without replacing the existing tactical modifier system. The system is additive and contextual rather than a separate engine.

## 4. Safeguards implemented

The positional system includes safeguards to stop obvious bad behavior:

- anti-ball-chasing logic for players who should hold shape
- anti-clustering logic to spread players apart when overcrowded
- tactical zone enforcement to keep GK/CB/ST/LW/RW in appropriate area bands
- pitch boundary enforcement
- target stability checks to avoid rapid target switching from one frame to the next

These safeguards are included in the `calculatePositionalTarget()` flow and in supporting functions like `isTargetStable()`.

## 5. Tests

A dedicated test suite was added in `src/test/positional-targeting.test.ts`.

Coverage includes:

- formation base positions
- phase and possession adjustments
- instruction-driven adjustments
- zone enforcement
- clustering safeguards
- boundary safeguards
- target stability
- squad-level calculations
- urgency checks

Validation evidence:

- `npm test -- positional-targeting.test.ts` passed
- Result: 36 tests passed, 0 failed

## 6. Current status

- Positional target system created and tested.
- No match-engine rebuild was performed.
- No animation layer was added.
- No random wandering logic was introduced.
- Core enhancement goal is met: players now calculate contextual positional targets instead of relying on repetitive fixed-position behavior.

## 7. Notes on broader repo tests

The targeted positional suite passes cleanly. The wider repository test run still includes unrelated existing failures in other areas (season flow and training trade-off tests), which were not caused by this positional change.
