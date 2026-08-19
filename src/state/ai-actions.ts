import type {
  GameState,
  GameStateMeta,
  TransferListing,
  ContractOffer,
  EventLogEntry,
} from "./types";
import type { Offer } from "./negotiation";
import {
  buildClubDecisionContext,
  evaluateClubPriorities,
  recommendBudgetAllocation,
  identifyTransferTargets,
  selectStartingXI,
  recommendTrainingDecision,
  determineSellCandidatesForClub,
  evaluateContractRenewalPriorities,
} from "./ai-decisions";
import { createNegotiationSession, addNegotiationEntry } from "./negotiation-sessions";
import { evaluateOffer, evaluateContractOffer } from "./negotiation";
import { buildTransferOffer, canBuyerAfford, deductAiLedgerForOffer } from "./ai-transfers";
import {
  ensureAiLedgerFromClub,
  allocateAiWageCommitment,
  upgradeFacilityForClub,
} from "./club-finance";
import { evaluateClubStrategy } from "./ai-strategy";
import { addClubMemory, getClubMemory } from "./ai-memory";
import { completeTransferAtomically, verifyTransferConsistency } from "./transfer-hardening";
import { canSignPlayer } from "./transfer-rules";

function parseMoney(display: string | number): number {
  const s = typeof display === "number" ? String(display) : String(display);
  const cleaned = s.replace(/[€$£,]/g, "").trim();
  const match = /^(-?[\d.]+)\s*([MK])?/i.exec(cleaned);
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

export function runAiActions(state: GameState, eligibleClubIds?: ReadonlySet<string>): GameState {
  let next = { ...state };
  const initialMeta: GameStateMeta = {
    ...(state.meta ?? {}),
    aiLedgers: state.meta?.aiLedgers ?? {},
  };
  next = { ...next, meta: initialMeta };

  // Performance optimization: only process relevant clubs, not all 1700+
  // - Always process the manager's club
  // - Process clubs with fixtures in the next 7-14 days against the manager
  // - Skip other clubs for now (they'll get processed in other game loops)
  const managedClubId = next.currentClub.id;
  const nextWeekDate = new Date(next.time.date);
  nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 14);
  const nextWeekDateISO = nextWeekDate.toISOString().slice(0, 10);

  const recentFixtures = next.fixtures.filter(
    (f) =>
      f.calendarDate >= next.time.date &&
      f.calendarDate <= nextWeekDateISO &&
      (f.homeClubId === managedClubId || f.awayClubId === managedClubId),
  );

  const relevantClubIds = eligibleClubIds
    ? new Set(eligibleClubIds)
    : new Set<string>([
        managedClubId, // manager's own club
        ...recentFixtures.flatMap((f) => [f.homeClubId, f.awayClubId]), // upcoming opponents
      ]);

  for (const clubId of relevantClubIds) {
    const club = next.clubs[clubId];
    if (!club || !club.aiManager) continue; // only AI clubs

    // 1) Observe: build a compact decision context
    const context = buildClubDecisionContext(next, club.id);

    // 2) Strategic objective: evaluate multi-season strategy plan
    const strategyPlan = evaluateClubStrategy(next, club.id);
    // persist strategy to bounded club memory only when it changes
    const lastMemory = club.aiMemory?.items?.slice(-1)[0];
    if (
      !lastMemory ||
      lastMemory.kind !== "strategy" ||
      lastMemory.summary !== strategyPlan.strategy
    ) {
      next = addClubMemory(next, club.id, {
        kind: "strategy",
        summary: strategyPlan.strategy,
        meta: { plan: strategyPlan },
        relevance: 70,
      });
    }

    // 3) Priorities & budget allocation (short-horizon)
    const priorities = evaluateClubPriorities(context, { randomness: 3, seedSalt: next.time.date });
    const allocation = recommendBudgetAllocation(context, { randomness: 0 });

    // ensure ledger exists seeded from authoritative club financials
    next = ensureAiLedgerFromClub(next, club.id);
    const currentMeta = next.meta ?? { aiLedgers: {} };
    const ledger = currentMeta.aiLedgers?.[club.id];
    if (ledger) {
      // apply allocation as conservative adjustments rather than wholesale overwrite
      const adjusted = {
        ...ledger,
        transferBudget: Math.max(
          0,
          Math.round(ledger.transferBudget * (0.5 + allocation.transfer / 60)),
        ),
        wageBudgetWeekly: Math.max(
          ledger.currentWageCommitment ?? 0,
          Math.round(ledger.wageBudgetWeekly * (0.5 + allocation.wages / 60)),
        ),
      };
      next = {
        ...next,
        meta: {
          ...(next.meta ?? {}),
          aiLedgers: { ...(next.meta?.aiLedgers ?? {}), [club.id]: adjusted },
        },
      };
    }

    // Selling: if finances weak, list a sell candidate
    if (context.finances.tier === "crisis" || priorities.topPriority === "balance-books") {
      const sells = determineSellCandidatesForClub(next, club.id, 2);
      if (sells.length > 0) {
        const cand = sells[0];
        if (cand?.playerId && !next.transfers.find((t) => t.playerId === cand.playerId)) {
          const player = next.players[cand.playerId];
          if (player) {
            const listing: TransferListing = {
              id: `listing-${next.transfers.length + 1}`,
              playerId: cand.playerId,
              sellerClubId: club.id,
              loan: false,
              releaseClause: null,
              name: player.name,
              position: player.pos,
              rating: player.overall,
              nationality: player.nationality,
              age: player.age,
              value: player.value ?? "€0",
              status: "new",
            };
            const ev: EventLogEntry = {
              id: `event-transfer-${next.events.length + 1}`,
              date: next.time.date,
              type: "transfer",
              description: `${club.name} listed ${listing.name}`,
            };
            next = {
              ...next,
              transfers: [...next.transfers, listing],
              events: [...next.events, ev],
            };
          }
        }
      }
    }

    // Transfer targets & bids
    const targets = identifyTransferTargets(next, club.id, 3);
    if (targets.length > 0) {
      const top = targets[0]!;
      const listing = next.transfers.find((t) => t.id === top.listingId);
      if (listing && listing.playerId && listing.sellerClubId && listing.sellerClubId !== club.id) {
        const playerId = listing.playerId;
        const signCheck = canSignPlayer(next, playerId, club.id);
        if (!signCheck.allowed) {
          continue;
        }
        const offer = buildTransferOffer(next, club, listing);
        const affordability = canBuyerAfford(next, club, offer);
        next = affordability.state;
        if (affordability.canAfford) {
          const result = evaluateOffer(next, club.id, listing.sellerClubId, playerId, offer);
          if (result.outcome === "accepted") {
            const transferResult = completeTransferAtomically(
              next,
              playerId,
              listing.sellerClubId,
              club.id,
              offer.fee,
              offer.salaryWeekly,
            );
            if (transferResult.success) {
              next = transferResult.state;
              next = deductAiLedgerForOffer(next, club.id, offer);
              const buyerCheck = verifyTransferConsistency(next, playerId, club.id);
              if (!buyerCheck.consistent) {
                next = {
                  ...next,
                  meta: {
                    ...(next.meta ?? {}),
                    ["transferAudit"]: {
                      ...(next.meta?.["transferAudit"] ?? {}),
                      [playerId]: buyerCheck.violations,
                    },
                  },
                };
              }
            }
            next = {
              ...next,
              transfers: next.transfers.filter((t) => t.playerId !== playerId),
            };
          } else if (result.outcome === "counter" && result.offer) {
            next = createNegotiationSession(
              next,
              club.id,
              listing.sellerClubId,
              playerId,
              result.offer,
              "AI initial offer",
              "transfer",
            );
          }
        }
      }
    }

    // Contract renewals: attempt renewals for high-priority players
    const renewals = evaluateContractRenewalPriorities(next, club.id, 3);
    for (const r of renewals.filter((x) => x.priority === "high")) {
      const playerId = r.playerId;
      const player = next.players[playerId];
      if (!player) continue;

      const desiredSalary = Math.round((player.marketValue ?? 500_000) * 0.001);
      const offer: ContractOffer = {
        salaryWeekly: desiredSalary,
        years: 2,
        signingBonus: 0,
        guaranteedStarts: false,
      };
      const res = evaluateContractOffer(next, club.id, playerId, offer);
      if (res.outcome === "accepted") {
        const weekly = offer.salaryWeekly ?? 0;
        const maybe = allocateAiWageCommitment(next, club.id, weekly);
        if (maybe !== next) {
          // FIXED: Update contract directly for renewals (player stays at same club)
          const salaryStr = `€${Math.round(weekly).toLocaleString("en-US")} / wk`;
          next = {
            ...maybe,
            players: {
              ...maybe.players,
              [playerId]: {
                ...maybe.players[playerId]!,
                salary: salaryStr,
                contractYears: offer.years,
                contractUntil: `Jun ${Number(String(maybe.time.season).split("/")[0]) + Number(offer.years)}`,
                morale: Math.min(100, (maybe.players[playerId]?.morale ?? 50) + 10),
              },
            },
            contracts: [
              ...(maybe.contracts ?? []),
              { playerId, clubId: club.id, status: "active" },
            ],
          };
        }
      } else if (res.outcome === "counter" && res.counter) {
        // create contract negotiation session
        next = createNegotiationSession(
          next,
          club.id,
          club.id,
          playerId,
          res.counter,
          "Contract counter",
          "contract",
        );
      }
    }

    // Starting XI and formations
    const xi = selectStartingXI(next, club.id);
    if (xi.length > 0) {
      const updatedPlayers = { ...next.players };
      for (const pid of club.playerIds) {
        const p = updatedPlayers[pid];
        if (!p) continue;
        updatedPlayers[pid] = { ...p, starter: xi.includes(pid) };
      }
      next = { ...next, players: updatedPlayers };
    }

    // Training
    let training = recommendTrainingDecision(next, club.id);
    // bias training focus from multi-season strategy when clear
    const youthPriority = strategyPlan.priorities.find((p) => p.priority === "develop-youth");
    const strengthenPriority = strategyPlan.priorities.find(
      (p) => p.priority === "strengthen-squad",
    );
    if (youthPriority && (youthPriority.weight ?? 0) > 40) {
      training = { ...training, focus: "youth" } as any;
    } else if (strengthenPriority && (strengthenPriority.weight ?? 0) > 40) {
      training = { ...training, focus: "first-team" } as any;
    }
    const plan = {
      id: `ai-train-${club.id}`,
      name: `${club.name} training`,
      focus: training.focus,
      intensity: training.intensity,
      assignedPlayerIds: club.playerIds,
    };
    const otherPlans = next.training.filter((t) => t.id !== plan.id);
    next = { ...next, training: [...otherPlans, plan] };

    // Apply simple player development effects from training
    const playersUpdate = { ...next.players };
    for (const pid of club.playerIds) {
      const p = playersUpdate[pid];
      if (!p) continue;
      // youth players gain a bit if training target includes youth
      if (training.target === "youth" && p.age <= 23) {
        playersUpdate[pid] = {
          ...p,
          development: {
            ...p.development,
            growthRate: Math.min(100, (p.development?.growthRate ?? 0) + 1),
          },
        };
      }
    }
    next = { ...next, players: playersUpdate };

    // Facilities: choose strategically by scoring marginal benefit
    const clubLedger = next.meta?.aiLedgers?.[club.id];
    const facilityKeys = ["training", "youth", "medical", "scouting"] as const;
    function avgSquadAgeSimple(s: GameState, cid: string) {
      const c = s.clubs[cid];
      if (!c) return 28;
      const ages = c.playerIds.map((pid) => s.players[pid]?.age ?? 28).filter(Boolean);
      if (ages.length === 0) return 28;
      return Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
    }
    if (clubLedger && clubLedger.transferBudget > 100_000) {
      const scores: Record<string, number> = {};
      for (const key of facilityKeys) {
        const currentLevel = club.facilityLevels?.[key] ?? 1;
        if (currentLevel >= 5) {
          scores[key] = 0;
          continue;
        }
        // benefit components
        const strategyWeight = strategyPlan.priorities.reduce((s, p) => {
          if (p.priority === "develop-youth") return s + p.weight;
          if (p.priority === "strengthen-squad") return s + p.weight * 0.6;
          return s;
        }, 0);
        const needAgeFactor = Math.max(0, 30 - avgSquadAgeSimple(next, club.id));
        const baseValue = key === "youth" ? strategyWeight * 1.2 : strategyWeight * 0.6;
        const levelDelta = 6 - currentLevel; // marginal room
        const financeFactor = Math.min(1, clubLedger.transferBudget / 5_000_000);
        scores[key] = Math.round(baseValue * levelDelta * (1 + needAgeFactor / 40) * financeFactor);
      }
      const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > 0) {
        next = upgradeFacilityForClub(next, club.id, best[0] as any);
      }
    }

    // Manager pressure: record as memory and let dedicated job-security flow act
    const philosPressure = priorities.signals?.philosophyPressure ?? 0;
    if (philosPressure > 75) {
      next = addClubMemory(next, club.id, {
        kind: "board",
        summary: "Philosophy pressure rising",
        meta: { philosophyPressure: philosPressure },
        relevance: 60,
      });
    }
  }

  return next;
}

export default runAiActions;
