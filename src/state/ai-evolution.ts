import { registerDailyHook } from "./calendar";
import { computeClubStanding } from "./standings";
import { generateAIManager } from "./ai-manager";
import type { GameState } from "./types";
import { runMonthlyPlayerDevelopment, runSeasonalPlayerLifecycle } from "./player-development";
import { runSeasonalYouthGeneration, promoteProspectToSenior } from "./academy";
import { runSeasonalStaffLifecycle } from "./staff";
import { generateJobOffers, evaluateJobSecurity } from "./jobs";
import { seededUnit } from "./utils";

export function generateReplacementManager(state: GameState, club: GameState["clubs"][string]) {
  const current = club?.aiManager;
  if (!current) return undefined;
  return generateAIManager(
    {
      id: club.id,
      name: club.name,
      formation: club.formation,
      reputation: club.reputation,
      facilities: club.facilities,
    },
    {
      worldSeed: state.gameSeed ?? state.meta?.["worldSeed"] ?? "0",
      generation: (current.generation ?? 0) + 1,
    },
  );
}

/** Simple D2.3 evolution tick.
 * Runs on the `development` daily hook (called every day) but only performs
 * work once every ~30 days to simulate monthly evolution. Conservative
 * changes: tweak formations, small player development, youth promotion,
 * manager reputation adjustments and occasional manager replacement.
 */
function evolutionTick(state: GameState): GameState {
  const day = state.time.day;
  const isMonthly = day % 30 === 0;
  const isSeasonOpening = state.time.date.endsWith("-08-01");
  const isYearOpening = state.time.date.endsWith("-01-01");

  if (!isMonthly && !isSeasonOpening && !isYearOpening) return state;

  let next = state;

  if (isMonthly) {
    for (const club of Object.values(state.clubs)) {
      // 1) formation tweaks: AI clubs may adopt their manager's preferred
      // formation if tactical ability is adequate.
      const mgr = club.aiManager;
      if (mgr) {
        if (
          mgr.preferredFormation &&
          club.formation !== mgr.preferredFormation &&
          mgr.tacticalAbility >= 45
        ) {
          const oldFormation = club.formation;
          const newFormation = mgr.preferredFormation;
          const updated = { ...club, formation: newFormation };
          next = {
            ...next,
            clubs: { ...next.clubs, [club.id]: updated },
            events: [
              ...next.events,
              {
                id: `event-formation-${next.events.length + 1}`,
                date: next.time.date,
                type: "news" as const,
                description: `${club.name} switched formation from ${oldFormation} to ${newFormation}`,
                meta: { clubId: club.id, formation: newFormation, previousFormation: oldFormation },
              },
            ],
          };
        }

        // 2) league performance affects manager reputation slightly
        const standing = computeClubStanding(next, club.leagueId, club.id);
        if (standing) {
          const totalClubs = Math.max(standing.position, 1);
          const pos = standing.position;
          // simple rule: drop reputation if bottom half, gain if top third
          if (pos > Math.ceil(totalClubs / 2)) {
            // drop a little
            const delta = -Math.max(1, Math.floor((pos / totalClubs) * 2));
            const updatedMgr = {
              ...mgr,
              reputation: Math.max(0, Math.min(100, mgr.reputation + delta)),
            };
            const updatedClub = { ...club, aiManager: updatedMgr };
            next = { ...next, clubs: { ...next.clubs, [club.id]: updatedClub } };
          } else if (pos <= Math.ceil(totalClubs / 3)) {
            const delta = 1;
            const updatedMgr = {
              ...mgr,
              reputation: Math.max(0, Math.min(100, mgr.reputation + delta)),
            };
            const updatedClub = { ...club, aiManager: updatedMgr };
            next = { ...next, clubs: { ...next.clubs, [club.id]: updatedClub } };
          }

          // 3) manager replacement: if manager patience is low and reputation is tiny
          // OR if patience continues to decline (indicates loss of faith from board)
          const shouldReplace =
            (mgr.patience < 30 && mgr.reputation < 20) || // original condition
            mgr.patience < 15; // patience worn out

          if (shouldReplace) {
            const oldMgrName = mgr.name || "Unknown";
            const newMgr = generateReplacementManager(next, club);
            if (!newMgr) continue;
            const updatedClub = { ...club, aiManager: newMgr };
            next = {
              ...next,
              clubs: { ...next.clubs, [club.id]: updatedClub },
              events: [
                ...next.events,
                {
                  id: `event-mgr-sacked-${next.events.length + 1}`,
                  date: next.time.date,
                  type: "manager" as const,
                  description: `${club.name} sacked manager ${oldMgrName}`,
                  meta: { clubId: club.id, managerName: oldMgrName, action: "sacked" },
                },
                {
                  id: `event-mgr-appointed-${next.events.length + 2}`,
                  date: next.time.date,
                  type: "manager" as const,
                  description: `${club.name} appointed ${newMgr.name} as manager`,
                  meta: { clubId: club.id, managerName: newMgr.name, action: "appointed" },
                },
              ],
            };
          }
        }
      }

      // 4) player development: handled by the dedicated engine
      // defer to player-development for realistic monthly growth/decline
      // (runs once per month inside runMonthlyPlayerDevelopment)
      // no-op here — handled after the for/clubs loop to avoid double reads

      // 5) youth promotion at season start (approx): promote one prospect
      if (club.academy?.prospectIds?.length) {
        // promotion chance influenced by academy focus and manager youth preference
        const academyFocus = club.identity?.academyFocus ?? club.academy?.rating ?? 50;
        const youthPref = club.aiManager?.youthPreference ?? 40;
        const shouldPromote =
          seededUnit(`${club.id}:${next.time.date}:promote-prospect`, 17) <
          Math.min(0.5, 0.02 + academyFocus / 1000 + youthPref / 200);
        if (shouldPromote) {
          const prospectId = club.academy.prospectIds[0];
          if (!prospectId) continue;
          next = promoteProspectToSenior(next, next.clubs[club.id] ?? club, prospectId);
          next = {
            ...next,
            events: [
              ...next.events,
              {
                id: `event-prom-${next.events.length + 1}`,
                date: next.time.date,
                type: "match" as const,
                description: `${club.name} promoted ${prospectId}`,
              },
            ],
          };
        }
      }
    }
  }

  const final = isMonthly ? runMonthlyPlayerDevelopment(next) : next;
  const scheduledLifecycle = isSeasonOpening || isYearOpening;
  const lifecycleState = scheduledLifecycle ? runSeasonalPlayerLifecycle(final) : final;
  const withStaff =
    isMonthly || scheduledLifecycle ? runSeasonalStaffLifecycle(lifecycleState) : lifecycleState;
  const withSecurity = evaluateJobSecurity(withStaff);
  const withJobs = generateJobOffers(withSecurity);
  return isSeasonOpening ? runSeasonalYouthGeneration(withJobs) : withJobs;
}

// Compose into the development daily hook
registerDailyHook("development", (state, time) => {
  // OPTIMIZATION: Guard expensive monthly/seasonal work
  // Only run the full evolution tick on days when something actually needs to happen
  const day = state.time.day;
  const isMonthly = day % 30 === 0;
  const isSeasonOpening = state.time.date.endsWith("-08-01");
  const isYearOpening = state.time.date.endsWith("-01-01");

  if (!isMonthly && !isSeasonOpening && !isYearOpening) return state;

  return evolutionTick(state);
});

export {};
