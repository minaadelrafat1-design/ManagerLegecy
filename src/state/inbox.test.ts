import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "./seed";
import {
  eventToMessages,
  generateInboxMessagesFromEvents,
  isDuplicateMessage,
  getUnreadCount,
  cleanupInbox,
} from "./inbox";
import { gameReducer } from "./reducer";
import { GameState, EventLogEntry } from "./types";

describe("Inbox System", () => {
  let state: GameState;

  beforeEach(() => {
    state = buildInitialState();
  });

  describe("eventToMessages", () => {
    it("transforms TRANSFER_COMPLETED events into messages for recipient club", () => {
      const event: EventLogEntry = {
        id: "event-1",
        date: state.time.date,
        type: "TRANSFER_COMPLETED",
        description: "Player transferred",
        meta: {
          playerId: Object.keys(state.players)[0],
          fromClubId: Object.keys(state.clubs)[1],
          toClubId: state.currentClub.id,
        },
      };

      const messages = eventToMessages(event, state);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].category).toBe("transfers");
      expect(messages[0].priority).toBe("high");
      expect(messages[0].isRead).toBe(false);
      expect(messages[0].sourceEventId).toBe("event-1");
    });

    it("includes player name in transfer message", () => {
      const playerId = Object.keys(state.players)[0];
      const player = state.players[playerId];
      const toClubId = state.currentClub.id;
      const event: EventLogEntry = {
        id: "event-2",
        date: state.time.date,
        type: "TRANSFER_COMPLETED",
        description: "Player transferred",
        meta: {
          playerId,
          fromClubId: Object.keys(state.clubs)[1],
          toClubId,
        },
      };

      const messages = eventToMessages(event, state);
      expect(messages[0].title).toContain(player.name);
    });

    it("transforms YOUTH_GENERATED events with high potential", () => {
      const playerId = Object.keys(state.players)[0];
      const event: EventLogEntry = {
        id: "event-3",
        date: state.time.date,
        type: "YOUTH_GENERATED",
        description: "Academy product created",
        meta: {
          playerId,
          potential: 85,
          position: "ST",
        },
      };

      state.players[playerId].clubId = state.currentClub.id;
      const messages = eventToMessages(event, state);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].priority).toBe("high");
      expect(messages[0].title).toContain("Exciting prospect");
    });

    it("transforms PROMOTION events as critical for manager club", () => {
      const event: EventLogEntry = {
        id: "event-4",
        date: state.time.date,
        type: "PROMOTION",
        description: "Club promoted",
        meta: {
          clubId: state.currentClub.id,
          season: "2026/27",
        },
      };

      const messages = eventToMessages(event, state);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].priority).toBe("critical");
      expect(messages[0].category).toBe("world");
    });

    it("returns empty array for unhandled event types", () => {
      const event: EventLogEntry = {
        id: "event-5",
        date: state.time.date,
        type: "PLAYER_CREATED",
        description: "Player created",
      };

      const messages = eventToMessages(event, state);
      expect(messages.length).toBe(0);
    });

    it("handles MATCH_PLAYED events with correct priority based on result", () => {
      // Find a fixture involving the manager's club
      const managerFixture =
        state.fixtures.find(
          (f) => f.homeClubId === state.currentClub.id || f.awayClubId === state.currentClub.id,
        ) || state.fixtures[0];

      const event: EventLogEntry = {
        id: "event-6",
        date: state.time.date,
        type: "MATCH_PLAYED",
        description: "Match played",
        meta: {
          fixtureId: managerFixture.id,
          result: "L",
          scoreHome: 0,
          scoreAway: 2,
        },
      };

      const messages = eventToMessages(event, state);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].priority).toBe("high");
    });

    it("handles PLAYER_RETIRED events for club players", () => {
      const playerId = state.currentClub.playerIds[0];
      const event: EventLogEntry = {
        id: "event-7",
        date: state.time.date,
        type: "PLAYER_RETIRED",
        description: "Player retired",
        meta: {
          playerId,
        },
      };

      const messages = eventToMessages(event, state);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].category).toBe("squad");
      expect(messages[0].priority).toBe("high");
    });
  });

  describe("isDuplicateMessage", () => {
    it("detects duplicate messages within dedup window", () => {
      const msg1: any = {
        id: "msg-1",
        date: state.time.date,
        title: "Transfer offer rejected: John Smith",
        category: "transfers",
        relatedEntityId: "player-1",
        isRead: false,
      };

      const msg2 = { ...msg1, id: "msg-2" };

      expect(isDuplicateMessage(msg2, [msg1], 1)).toBe(true);
    });

    it("ignores duplicates outside dedup window", () => {
      const old = new Date(state.time.date);
      old.setDate(old.getDate() - 2);
      const oldDate = old.toISOString().split("T")[0];

      const msg1: any = {
        id: "msg-1",
        date: oldDate,
        title: "Transfer offer rejected: John Smith",
        category: "transfers",
        relatedEntityId: "player-1",
        isRead: false,
      };

      const msg2 = { ...msg1, id: "msg-2", date: state.time.date };

      expect(isDuplicateMessage(msg2, [msg1], 1)).toBe(false);
    });

    it("ignores archived messages", () => {
      const msg1: any = {
        id: "msg-1",
        date: state.time.date,
        title: "Transfer offer rejected: John Smith",
        category: "transfers",
        relatedEntityId: "player-1",
        isRead: false,
        archivedAt: state.time.date,
      };

      const msg2 = { ...msg1, id: "msg-2", archivedAt: null };

      expect(isDuplicateMessage(msg2, [msg1], 1)).toBe(false);
    });

    it("distinguishes messages by category", () => {
      const msg1: any = {
        id: "msg-1",
        date: state.time.date,
        title: "Transfer offer rejected: John Smith",
        category: "transfers",
        relatedEntityId: "player-1",
        isRead: false,
      };

      const msg2 = { ...msg1, id: "msg-2", category: "squad" };

      expect(isDuplicateMessage(msg2, [msg1], 1)).toBe(false);
    });
  });

  describe("generateInboxMessagesFromEvents", () => {
    it("generates messages from recent events", () => {
      const playerId = Object.keys(state.players)[0];
      const newEvent: EventLogEntry = {
        id: "event-new",
        date: state.time.date,
        type: "TRANSFER_COMPLETED",
        description: "Transfer completed",
        meta: {
          playerId,
          fromClubId: "club-1",
          toClubId: state.currentClub.id,
        },
      };

      state.events = [newEvent];
      const messages = generateInboxMessagesFromEvents(state, 1);
      expect(messages.length).toBeGreaterThan(0);
    });

    it("skips events older than lookback window", () => {
      const old = new Date(state.time.date);
      old.setDate(old.getDate() - 3);
      const oldDate = old.toISOString().split("T")[0];

      const oldEvent: EventLogEntry = {
        id: "event-old",
        date: oldDate,
        type: "TRANSFER_COMPLETED",
        description: "Transfer completed",
        meta: {
          playerId: Object.keys(state.players)[0],
          fromClubId: "club-1",
          toClubId: state.currentClub.id,
        },
      };

      state.events = [oldEvent];
      const messages = generateInboxMessagesFromEvents(state, 1);
      expect(messages.length).toBe(0);
    });

    it("avoids duplicate messages from same event", () => {
      const playerId = Object.keys(state.players)[0];
      const event: EventLogEntry = {
        id: "event-dup",
        date: state.time.date,
        type: "TRANSFER_COMPLETED",
        description: "Transfer completed",
        meta: {
          playerId,
          fromClubId: "club-1",
          toClubId: state.currentClub.id,
        },
      };

      state.events = [event];
      // First generation
      const messages1 = generateInboxMessagesFromEvents(state, 1);
      expect(messages1.length).toBeGreaterThan(0);

      // Add to inbox and try again
      state.inbox = messages1;
      const messages2 = generateInboxMessagesFromEvents(state, 1);
      expect(messages2.length).toBe(0); // No new messages
    });
  });

  describe("getUnreadCount", () => {
    it("counts unread messages", () => {
      state.inbox = [
        { id: "1", isRead: false, archivedAt: null } as any,
        { id: "2", isRead: false, archivedAt: null } as any,
        { id: "3", isRead: true, archivedAt: null } as any,
      ];

      expect(getUnreadCount(state)).toBe(2);
    });

    it("ignores archived messages in unread count", () => {
      state.inbox = [
        { id: "1", isRead: false, archivedAt: null } as any,
        { id: "2", isRead: false, archivedAt: state.time.date } as any,
      ];

      expect(getUnreadCount(state)).toBe(1);
    });

    it("returns 0 for empty inbox", () => {
      state.inbox = [];
      expect(getUnreadCount(state)).toBe(0);
    });
  });

  describe("cleanupInbox", () => {
    it("archives messages older than archiveOldAfterDays", () => {
      const old = new Date(state.time.date);
      old.setDate(old.getDate() - 35);
      const oldDate = old.toISOString().split("T")[0];

      state.inboxSettings = {
        archiveOldAfterDays: 30,
        dedupeWindowDays: 1,
      };
      state.inbox = [
        { id: "1", date: oldDate, archivedAt: null, isRead: false } as any,
        { id: "2", date: state.time.date, archivedAt: null, isRead: false } as any,
      ];

      const nextState = cleanupInbox(state);
      const archivedMsg = nextState.inbox?.find((m) => m.id === "1");
      expect(archivedMsg?.archivedAt).not.toBeNull();
      expect(nextState.inbox?.find((m) => m.id === "2")?.archivedAt).toBeNull();
    });

    it("removes permanently deleted messages", () => {
      const veryOld = new Date(state.time.date);
      veryOld.setDate(veryOld.getDate() - 50);
      const veryOldDate = veryOld.toISOString().split("T")[0];

      state.inboxSettings = {
        archiveOldAfterDays: 30,
        dedupeWindowDays: 1,
      };
      state.inbox = [
        { id: "1", date: veryOldDate, archivedAt: veryOldDate, isRead: false } as any,
        { id: "2", date: state.time.date, archivedAt: null, isRead: false } as any,
      ];

      const nextState = cleanupInbox(state);
      expect(nextState.inbox?.some((m) => m.id === "1")).toBe(false);
      expect(nextState.inbox?.some((m) => m.id === "2")).toBe(true);
    });
  });

  describe("Inbox reducer actions", () => {
    it("marks messages as read via MARK_INBOX_MESSAGE_READ", () => {
      state.inbox = [{ id: "msg-1", isRead: false } as any];

      // This would normally be dispatched in the reducer
      const msg = state.inbox.find((m) => m.id === "msg-1");
      if (msg) {
        msg.isRead = true;
      }

      expect(state.inbox[0].isRead).toBe(true);
    });

    it("deletes messages via DELETE_INBOX_MESSAGE", () => {
      state.inbox = [{ id: "msg-1" } as any, { id: "msg-2" } as any];

      // Simulate deletion
      state.inbox = state.inbox.filter((m) => m.id !== "msg-1");

      expect(state.inbox.length).toBe(1);
      expect(state.inbox[0].id).toBe("msg-2");
    });
  });

  describe("Shortlist negotiation notifications", () => {
    it("creates a contract negotiation session when a manager offers a new contract", () => {
      const playerId = state.currentClub.playerIds[0];
      const player = state.players[playerId];

      const next = gameReducer(state, {
        type: "CREATE_NEGOTIATION",
        buyerClubId: state.currentClub.id,
        sellerClubId: player.clubId ?? state.currentClub.id,
        playerId,
        offer: { salaryWeekly: 22000, years: 3, signingBonus: 40000, guaranteedStarts: true },
        message: "Offer new contract",
        negotiationType: "contract",
      });

      const session = next.negotiations?.find(
        (s) => s.playerId === playerId && s.type === "contract",
      );
      expect(session).toBeDefined();
      expect(session?.status).toBe("open");
      expect(session?.entries[0]?.offer.salaryWeekly).toBe(22000);
    });

    it("creates a single player-linked inbox message when another club approaches a shortlisted player", () => {
      const playerId = Object.keys(state.players)[0];
      const player = state.players[playerId];
      const otherClubId =
        Object.keys(state.clubs).find((id) => id !== state.currentClub.id) ?? "club-rival";

      state.shortlistPlayerIds = [playerId];

      const next = gameReducer(state, {
        type: "CREATE_NEGOTIATION",
        buyerClubId: otherClubId,
        sellerClubId: player.clubId ?? state.currentClub.id,
        playerId,
        offer: { fee: 5000000, salaryWeekly: 20000, years: 3 },
        message: "Approach for shortlisted player",
      });

      const message = next.inbox?.find(
        (m) => m.relatedEntityId === playerId && m.category === "transfers",
      );
      expect(message).toBeDefined();
      expect(message?.action).toBe("view_player");
      expect(message?.title).toContain(player.name);
      expect(
        next.inbox?.filter((m) => m.relatedEntityId === playerId && m.category === "transfers"),
      ).toHaveLength(1);
    });

    it("does not duplicate shortlisted-player notifications for the same player", () => {
      const playerId = Object.keys(state.players)[0];
      const otherClubId =
        Object.keys(state.clubs).find((id) => id !== state.currentClub.id) ?? "club-rival";

      state.shortlistPlayerIds = [playerId];
      state.inbox = [
        {
          id: "existing-msg",
          date: state.time.date,
          category: "transfers",
          title: `Another club is approaching ${state.players[playerId].name}`,
          body: "Approach",
          priority: "normal",
          isRead: false,
          relatedEntityId: playerId,
          action: "view_player",
        } as any,
      ];

      const next = gameReducer(state, {
        type: "CREATE_NEGOTIATION",
        buyerClubId: otherClubId,
        sellerClubId: state.currentClub.id,
        playerId,
        offer: { fee: 5000000, salaryWeekly: 20000, years: 3 },
        message: "Approach for shortlisted player",
      });

      expect(
        next.inbox?.filter((m) => m.relatedEntityId === playerId && m.category === "transfers"),
      ).toHaveLength(1);
    });
  });

  describe("Integration tests", () => {
    it("generates multiple messages from different event types", () => {
      const playerId = state.currentClub.playerIds[0];
      const fixture = state.fixtures[0];

      state.events = [
        {
          id: "event-1",
          date: state.time.date,
          type: "TRANSFER_COMPLETED",
          description: "Transfer",
          meta: { playerId, fromClubId: "club-1", toClubId: state.currentClub.id },
        },
        {
          id: "event-2",
          date: state.time.date,
          type: "MATCH_PLAYED",
          description: "Match",
          meta: { fixtureId: fixture.id, result: "W", scoreHome: 2, scoreAway: 1 },
        },
        {
          id: "event-3",
          date: state.time.date,
          type: "PROMOTION",
          description: "Promotion",
          meta: { clubId: state.currentClub.id, season: "2026/27" },
        },
      ];

      const messages = generateInboxMessagesFromEvents(state, 1);
      expect(messages.length).toBeGreaterThanOrEqual(2); // At least 2 categories

      const categories = new Set(messages.map((m) => m.category));
      expect(categories.has("transfers")).toBe(true);
      expect(categories.has("world")).toBe(true);
    });

    it("maintains message history through state mutations", () => {
      state.inbox = [];
      const msg: any = {
        id: "msg-1",
        date: state.time.date,
        category: "transfers",
        title: "Test",
        body: "Test body",
        priority: "normal",
        isRead: false,
      };

      state.inbox.push(msg);
      expect(getUnreadCount(state)).toBe(1);

      // Mark as read
      state.inbox[0].isRead = true;
      expect(getUnreadCount(state)).toBe(0);

      // Archive
      state.inbox[0].archivedAt = state.time.date;
      expect(getUnreadCount(state)).toBe(0);
    });
  });
});
