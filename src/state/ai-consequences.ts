import type { GameState, TransferListing, Fixture } from "./types";

// Deterministic unit helper based on clubId+seed
function seededUnit(seedStr: string, salt = 1): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 1000) / 1000;
}

export function applyTransferStatusConsequences(
  state: GameState,
  listing: TransferListing,
  status: TransferListing["status"],
) {
  if (!listing || status !== "agreed") return state;
  const seller = listing.sellerClubId;
  const playerId = listing.playerId;
  const buyer = state.currentClub?.id === seller ? undefined : state.currentClub?.id; // best-effort

  let next = { ...state } as GameState;

  // If listing meta marks the player as a captain, stronger reactions
  const wasCaptain = (listing as any).meta?.wasCaptain ?? false;

  if (seller) {
    // squad morale and form drop for seller
    const moraleDelta = wasCaptain ? -18 : -6;
    const formDelta = wasCaptain ? -12 : -4; // losing key player affects squad form
    for (const pid of next.clubs[seller]?.playerIds ?? []) {
      const p = next.players[pid];
      if (!p) continue;
      next.players = {
        ...next.players,
        [pid]: {
          ...p,
          morale: Math.max(0, Math.min(100, (p.morale ?? 50) + moraleDelta)),
          form: Math.max(30, Math.min(100, (p.form ?? 50) + formDelta)), // form affected by squad disruption
        },
      };
    }

    // fans reaction
    const fanDelta = wasCaptain ? -12 : -4;
    next = {
      ...next,
      fans: {
        ...next.fans,
        approval: Math.max(0, Math.min(100, (next.fans?.approval ?? 50) + fanDelta)),
      },
    };

    // board reaction: reduce confidence slightly when losing key player if finances poor
    const financeHealth = (() => {
      const tb = parseInt((next.finances?.transferBudget ?? "€0").replace(/[^0-9]/g, ""), 10) || 0;
      return tb >= 50_000_00 ? "good" : tb >= 5_000_00 ? "ok" : "poor";
    })();
    const boardDelta = wasCaptain ? -6 : financeHealth === "poor" ? -4 : -1;
    next = {
      ...next,
      board: {
        ...next.board,
        confidence: Math.max(0, Math.min(100, (next.board?.confidence ?? 50) + boardDelta)),
      },
    };

    // reputation nudges
    const repDelta = wasCaptain ? -3 : -1;
    if (next.clubs[seller])
      next.clubs = {
        ...next.clubs,
        [seller]: {
          ...next.clubs[seller],
          reputation: Math.max(0, Math.min(100, (next.clubs[seller].reputation ?? 50) + repDelta)),
        },
      };

    // news item
    const nid = `news-transfer-${(next.news?.length ?? 0) + 1}`;
    const summary = wasCaptain
      ? `${next.clubs[seller]?.name ?? seller} sold their captain ${listing.name}`
      : `${next.clubs[seller]?.name ?? seller} completed a transfer`;
    next = {
      ...next,
      news: [
        ...(next.news ?? []),
        { id: nid, tag: "transfer", time: next.time.date, text: summary },
      ],
    };
  }

  if (buyer) {
    // buyer squad morale and form increase with new signing
    const moraleBuyerDelta = wasCaptain ? 12 : 4;
    const formBuyerDelta = wasCaptain ? 8 : 2;
    for (const pid of next.clubs[buyer]?.playerIds ?? []) {
      const p = next.players[pid];
      if (p && pid !== playerId) {
        // other squad members get morale/form boost
        next.players = {
          ...next.players,
          [pid]: {
            ...p,
            morale: Math.max(0, Math.min(100, (p.morale ?? 50) + moraleBuyerDelta)),
            form: Math.max(30, Math.min(100, (p.form ?? 50) + formBuyerDelta)),
          },
        };
      }
    }

    // buyer fans boost
    const fanDelta = wasCaptain ? 8 : 3;
    next = {
      ...next,
      fans: {
        ...next.fans,
        approval: Math.max(0, Math.min(100, (next.fans?.approval ?? 50) + fanDelta)),
      },
    };

    if (playerId) {
      // new player gets morale boost and form boost from transfer excitement
      const p = next.players[playerId];
      if (p) {
        next.players = {
          ...next.players,
          [playerId]: {
            ...p,
            morale: Math.max(0, Math.min(100, (p.morale ?? 50) + 15)),
            form: Math.max(30, Math.min(100, (p.form ?? 50) + 8)), // new signings start in good form (excited)
          },
        };
      }
    }

    // add news
    const nid = `news-transfer-${(next.news?.length ?? 0) + 1}`;
    next = {
      ...next,
      news: [
        ...(next.news ?? []),
        {
          id: nid,
          tag: "transfer",
          time: next.time.date,
          text: `${next.clubs[buyer]?.name ?? buyer} signed ${listing.name}`,
        },
      ],
    };
  }

  return next;
}

export function applyMatchResultConsequences(
  state: GameState,
  fixture: Fixture,
  scoreHome: number,
  scoreAway: number,
) {
  let next = { ...state } as GameState;
  const home = fixture.homeClubId;
  const away = fixture.awayClubId;

  const homeWin = scoreHome > scoreAway;
  const awayWin = scoreAway > scoreHome;

  // fans: home fans respond to result
  const homeDelta = homeWin ? 3 : scoreHome === scoreAway ? 0 : -4;
  const awayDelta = awayWin ? 3 : scoreHome === scoreAway ? 0 : -4;
  next = {
    ...next,
    fans: {
      ...next.fans,
      approval: Math.max(
        0,
        Math.min(100, (next.fans?.approval ?? 50) + (homeDelta + awayDelta) / 2),
      ),
    },
  };

  // board confidence nudges for both clubs depending on result
  const adjustClub = (clubId: string, delta: number) => {
    const club = next.clubs[clubId];
    if (!club) return;
    next.clubs = {
      ...next.clubs,
      [clubId]: {
        ...club,
        reputation: Math.max(0, Math.min(100, (club.reputation ?? 50) + delta)),
      },
    };
  };

  if (homeWin) {
    adjustClub(home, 1);
    adjustClub(away, -1);
  } else if (awayWin) {
    adjustClub(away, 1);
    adjustClub(home, -1);
  }

  // media news for big wins/losses
  const goalDiff = Math.abs(scoreHome - scoreAway);
  if (goalDiff >= 3) {
    const nid = `news-match-${(next.news?.length ?? 0) + 1}`;
    next = {
      ...next,
      news: [
        ...(next.news ?? []),
        {
          id: nid,
          tag: "match",
          time: next.time.date,
          text: `${fixture.homeClubId} ${scoreHome}-${scoreAway} ${fixture.awayClubId}`,
        },
      ],
    };
  }

  return next;
}

export function applyMatchResultConsequencesToDraft(
  draft: GameState,
  fixture: Fixture,
  scoreHome: number,
  scoreAway: number,
): void {
  const homeWin = scoreHome > scoreAway;
  const awayWin = scoreAway > scoreHome;
  const homeDelta = homeWin ? 3 : scoreHome === scoreAway ? 0 : -4;
  const awayDelta = awayWin ? 3 : scoreHome === scoreAway ? 0 : -4;

  draft.fans = {
    ...draft.fans,
    approval: Math.max(
      0,
      Math.min(100, (draft.fans?.approval ?? 50) + (homeDelta + awayDelta) / 2),
    ),
  };

  const adjustClub = (clubId: string, delta: number) => {
    const club = draft.clubs[clubId];
    if (!club) return;
    draft.clubs[clubId] = {
      ...club,
      reputation: Math.max(0, Math.min(100, (club.reputation ?? 50) + delta)),
    };
  };

  if (homeWin) {
    adjustClub(fixture.homeClubId, 1);
    adjustClub(fixture.awayClubId, -1);
  } else if (awayWin) {
    adjustClub(fixture.awayClubId, 1);
    adjustClub(fixture.homeClubId, -1);
  }

  if (Math.abs(scoreHome - scoreAway) >= 3) {
    draft.news.push({
      id: `news-match-${draft.news.length + 1}`,
      tag: "match",
      time: draft.time.date,
      text: `${fixture.homeClubId} ${scoreHome}-${scoreAway} ${fixture.awayClubId}`,
    });
  }
}

export function applyInjuryConsequences(state: GameState, playerId: string, injury: any) {
  let next = { ...state } as GameState;
  const player = next.players[playerId];
  if (!player) return next;
  const clubId = player.clubId ?? next.currentClub?.id;
  if (!clubId) return next;

  const severity = injury?.severity === "severe" ? 12 : injury?.severity === "moderate" ? 6 : 2;
  // lower morale and form for squad when key player injured
  for (const pid of next.clubs[clubId]?.playerIds ?? []) {
    const p = next.players[pid];
    if (!p) continue;
    const moraleDelta = -Math.round(severity * 0.8);
    const formDelta = -Math.round(severity * 0.5); // form also affected by squad disruption
    next.players = {
      ...next.players,
      [pid]: {
        ...p,
        morale: Math.max(0, Math.min(100, (p.morale ?? 50) + moraleDelta)),
        form: Math.max(30, Math.min(100, (p.form ?? 50) + formDelta)),
      },
    };
  }

  // injured player loses form as they can't play/train normally
  next.players = {
    ...next.players,
    [playerId]: {
      ...player,
      form: Math.max(30, Math.min(100, (player.form ?? 50) - Math.round(severity * 1.2))),
    },
  };

  // news
  const nid = `news-injury-${(next.news?.length ?? 0) + 1}`;
  next = {
    ...next,
    news: [
      ...(next.news ?? []),
      {
        id: nid,
        tag: "injury",
        time: next.time.date,
        text: `${player.name} injured (${injury?.type ?? "unknown"})`,
      },
    ],
  };

  return next;
}

// (default exported at bottom once all handlers defined)

// ---- Major event consequences -------------------------------------------
export function applySeasonOutcomeConsequences(state: GameState, clubId: string, tier: string) {
  let next = { ...state } as GameState;
  const club = next.clubs[clubId];
  if (!club) return next;

  // promotion or relegation detection by tier label
  const promoted = tier === "great" || (tier === "good" && club.reputation > 60);
  const relegated = tier === "terrible" || (tier === "bad" && club.reputation < 40);

  if (promoted) {
    // fans ecstatic, board pleased, manager credit up, news
    next = {
      ...next,
      fans: { ...next.fans, approval: Math.min(100, (next.fans?.approval ?? 50) + 10) },
    };
    next = {
      ...next,
      board: { ...next.board, confidence: Math.min(100, (next.board?.confidence ?? 50) + 8) },
    };
    next = {
      ...next,
      manager: { ...next.manager, credit: (next.manager?.credit ?? 50) + 5 },
    } as any;
    next.news = [
      ...(next.news ?? []),
      {
        id: `news-promo-${(next.news?.length ?? 0) + 1}`,
        tag: "season",
        time: next.time.date,
        text: `${club.name} celebrated promotion/strong season`,
      },
    ];
  }

  if (relegated) {
    // fans angry, board confidence collapses, manager credit down, possible sack risk
    next = {
      ...next,
      fans: { ...next.fans, approval: Math.max(0, (next.fans?.approval ?? 50) - 15) },
    };
    next = {
      ...next,
      board: { ...next.board, confidence: Math.max(0, (next.board?.confidence ?? 50) - 20) },
    };
    next = {
      ...next,
      manager: { ...next.manager, credit: Math.max(0, (next.manager?.credit ?? 50) - 10) },
    } as any;
    next.news = [
      ...(next.news ?? []),
      {
        id: `news-releg-${(next.news?.length ?? 0) + 1}`,
        tag: "season",
        time: next.time.date,
        text: `${club.name} suffered a disastrous season`,
      },
    ];
  }

  return next;
}

export function applyRecordTransferConsequences(
  state: GameState,
  fee: number,
  wageWeeklyDelta: number,
  description?: string,
) {
  let next = { ...state } as GameState;
  // currentClub is the one performing the transfer in RECORD_TRANSFER
  const clubId = state.currentClub?.id;
  if (!clubId) return next;

  const club = next.clubs[clubId];
  if (!club) return next;

  // classify as signing a star if fee large relative to transferBudget and club reputation
  const budget = parseInt((next.finances?.transferBudget ?? "€0").replace(/[^0-9]/g, ""), 10) || 0;
  const isBigSpend = fee > Math.max(1_000_000, budget * 0.5);

  if (isBigSpend) {
    // signing star: fans up, manager credit up, board cautious if finances weak
    next = {
      ...next,
      fans: { ...next.fans, approval: Math.min(100, (next.fans?.approval ?? 50) + 8) },
    };
    next = {
      ...next,
      manager: { ...next.manager, credit: (next.manager?.credit ?? 50) + 4 },
    } as any;
    const financeHealth = budget > fee ? "ok" : "strained";
    if (financeHealth === "strained") {
      next = {
        ...next,
        board: { ...next.board, confidence: Math.max(0, (next.board?.confidence ?? 50) - 6) },
      };
      next.news = [
        ...(next.news ?? []),
        {
          id: `news-transfer-fiscal-${(next.news?.length ?? 0) + 1}`,
          tag: "transfer",
          time: next.time.date,
          text: `${club.name} made a big signing amid tight finances`,
        },
      ];
    } else {
      next.news = [
        ...(next.news ?? []),
        {
          id: `news-transfer-${(next.news?.length ?? 0) + 1}`,
          tag: "transfer",
          time: next.time.date,
          text: `${club.name} signed a major player`,
        },
      ];
    }
  } else {
    // routine transfer: small fans bump and news
    next = {
      ...next,
      fans: { ...next.fans, approval: Math.min(100, (next.fans?.approval ?? 50) + 2) },
    };
    next.news = [
      ...(next.news ?? []),
      {
        id: `news-transfer-${(next.news?.length ?? 0) + 1}`,
        tag: "transfer",
        time: next.time.date,
        text: description ?? `${club.name} completed a transfer`,
      },
    ];
  }

  // price tag improves finances, reduce board concern
  if (fee > 0) {
    next = {
      ...next,
      finances: {
        ...next.finances,
        balance: next.finances?.balance
          ? `${parseInt((next.finances.balance as string).replace(/[^0-9]/g, ""), 10) + fee}`
          : `${fee}`,
      },
    } as any;
  }

  return next;
}

export function applyManagerJobOfferConsequences(state: GameState, offeredClubId: string) {
  let next = { ...state } as GameState;
  // publicised job offer: fans jittery, board confidence drops slightly, news
  next = {
    ...next,
    fans: { ...next.fans, approval: Math.max(0, (next.fans?.approval ?? 50) - 6) },
  };
  next = {
    ...next,
    board: { ...next.board, confidence: Math.max(0, (next.board?.confidence ?? 50) - 4) },
  };
  next.news = [
    ...(next.news ?? []),
    {
      id: `news-job-${(next.news?.length ?? 0) + 1}`,
      tag: "manager",
      time: next.time.date,
      text: `${next.manager?.name ?? "Manager"} linked with job at ${offeredClubId}`,
    },
  ];
  return next;
}

export default {
  applyTransferStatusConsequences,
  applyMatchResultConsequences,
  applyInjuryConsequences,
  applySeasonOutcomeConsequences,
  applyRecordTransferConsequences,
  applyManagerJobOfferConsequences,
};
