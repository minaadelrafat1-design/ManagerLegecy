import type { GameState, Player, EventLogEntry, NegotiationSession, TransferListing, Contract } from "./types";

export interface TransactionDraft {
  setPlayer: (playerId: string, nextPlayer: Player) => void;
  setClub: (clubId: string, nextClub: GameState["clubs"][string]) => void;
  setPlayers: (nextPlayers: GameState["players"]) => void;
  setClubs: (nextClubs: GameState["clubs"]) => void;
  setEvents: (nextEvents: EventLogEntry[]) => void;
  pushEvent: (event: EventLogEntry) => void;
  setNegotiations: (nextNegotiations: NegotiationSession[]) => void;
  setTransfers: (nextTransfers: TransferListing[]) => void;
  setContracts: (nextContracts: Contract[]) => void;
  commit: () => GameState;
}

export function createTransactionDraft(baseState: GameState): TransactionDraft {
  let playersDraft: GameState["players"] | undefined;
  let clubsDraft: GameState["clubs"] | undefined;
  let eventsDraft: EventLogEntry[] | undefined;
  let negotiationsDraft: NegotiationSession[] | undefined;
  let transfersDraft: TransferListing[] | undefined;
  let contractsDraft: Contract[] | undefined;

  const ensurePlayers = () => {
    if (!playersDraft) {
      playersDraft = { ...baseState.players };
    }
    return playersDraft;
  };

  const ensureClubs = () => {
    if (!clubsDraft) {
      clubsDraft = { ...baseState.clubs };
    }
    return clubsDraft;
  };

  const ensureEvents = () => {
    if (!eventsDraft) {
      eventsDraft = [...(baseState.events ?? [])];
    }
    return eventsDraft;
  };

  const ensureNegotiations = () => {
    if (!negotiationsDraft) {
      negotiationsDraft = [...(baseState.negotiations ?? [])];
    }
    return negotiationsDraft;
  };

  const ensureTransfers = () => {
    if (!transfersDraft) {
      transfersDraft = [...(baseState.transfers ?? [])];
    }
    return transfersDraft;
  };

  const ensureContracts = () => {
    if (!contractsDraft) {
      contractsDraft = [...(baseState.contracts ?? [])];
    }
    return contractsDraft;
  };

  const commit = (): GameState => {
    let next: GameState = baseState;

    if (playersDraft) {
      next = { ...next, players: playersDraft };
    }
    if (clubsDraft) {
      next = { ...next, clubs: clubsDraft };
    }
    if (eventsDraft) {
      next = { ...next, events: eventsDraft };
    }
    if (negotiationsDraft) {
      next = { ...next, negotiations: negotiationsDraft };
    }
    if (transfersDraft) {
      next = { ...next, transfers: transfersDraft };
    }
    if (contractsDraft) {
      next = { ...next, contracts: contractsDraft };
    }

    return next;
  };

  return {
    setPlayer: (playerId, nextPlayer) => {
      ensurePlayers()[playerId] = nextPlayer;
    },
    setClub: (clubId, nextClub) => {
      ensureClubs()[clubId] = nextClub;
    },
    setPlayers: (nextPlayers) => {
      playersDraft = { ...nextPlayers };
    },
    setClubs: (nextClubs) => {
      clubsDraft = { ...nextClubs };
    },
    setEvents: (nextEvents) => {
      eventsDraft = [...nextEvents];
    },
    pushEvent: (event) => {
      ensureEvents().push(event);
    },
    setNegotiations: (nextNegotiations) => {
      negotiationsDraft = [...nextNegotiations];
    },
    setTransfers: (nextTransfers) => {
      transfersDraft = [...nextTransfers];
    },
    setContracts: (nextContracts) => {
      contractsDraft = [...nextContracts];
    },
    commit,
  };
}
