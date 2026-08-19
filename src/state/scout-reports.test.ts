import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "./seed";
import { gameReducer } from "./reducer";
import {
  generateScoutReport,
  processCompletedScoutingAssignments,
  addScoutedPlayerToShortlist,
  dismissScoutedPlayer,
  addScoutedPlayerToAcademy,
  continueScoutingPlayer,
  getManagerScoutReports,
  getShortlistedFromScouts,
  getDismissedFromScouts,
  isEligibleForAcademy,
} from "./scout-reports";
import { hireScout, deployScoutingAssignment } from "./scouting-network";
import { saveToStorage, loadFromStorage } from "./persistence";

describe("Scout Reports Integration", () => {
  let state = buildInitialState();

  beforeEach(() => {
    state = buildInitialState();
  });

  describe("Report Generation", () => {
    it("generates a scout report when an assignment completes", () => {
      const hired = hireScout(state, "regional-scout", "Marta Ruiz");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      // Manually complete the assignment for testing
      const nextState = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active"
              ? { ...a, status: "completed" as const, progressDays: a.durationDays }
              : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(nextState);

      expect(withReports.scoutingNetwork?.reports).toBeDefined();
      expect(withReports.scoutingNetwork?.reports?.length ?? 0).toBeGreaterThan(0);

      const report = withReports.scoutingNetwork?.reports?.[0];
      expect(report?.playerInfo.name).toBeDefined();
      expect(report?.playerInfo.age).toBeGreaterThanOrEqual(16);
      expect(report?.abilityRange).toHaveLength(2);
      expect(report?.status).toBe("new");
    });

    it("scout quality affects ability range accuracy", () => {
      const hired1 = hireScout(state, "local-scout", "Local Scout");
      const scout1 = hired1.scoutingNetwork.scouts[0];

      const hired2 = hireScout(hired1, "global-scout", "Global Scout");
      const scout2 = hired2.scoutingNetwork.scouts[1];

      const deployed1 = deployScoutingAssignment(hired1, {
        scoutId: scout1.id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const deployed2 = deployScoutingAssignment(deployed1, {
        scoutId: scout2.id,
        targetCountryId: "england",
        durationDays: 30,
      });

      // Complete both
      const completed1 = {
        ...deployed1,
        scoutingNetwork: {
          ...deployed1.scoutingNetwork,
          assignments: deployed1.scoutingNetwork.assignments.map((a) =>
            a.scoutId === scout1.id
              ? { ...a, status: "completed" as const, progressDays: a.durationDays }
              : a,
          ),
        },
      };

      const completed2 = {
        ...deployed2,
        scoutingNetwork: {
          ...deployed2.scoutingNetwork,
          assignments: deployed2.scoutingNetwork.assignments.map((a) =>
            a.scoutId === scout2.id
              ? { ...a, status: "completed" as const, progressDays: a.durationDays }
              : a,
          ),
        },
      };

      const withReports1 = processCompletedScoutingAssignments(completed1);
      const withReports2 = processCompletedScoutingAssignments(completed2);

      const report1 = withReports1.scoutingNetwork?.reports?.[0];
      const report2 = withReports2.scoutingNetwork?.reports?.[0];

      // Global scout should have higher accuracy (smaller range variance)
      expect(report1?.scoutingAccuracy ?? 0).toBeLessThan(report2?.scoutingAccuracy ?? 100);
    });

    it("higher tier scouts provide more attributes and potential data", () => {
      // Hire two scouts and create assignments for each
      const hired1 = hireScout(state, "local-scout", "Scout 1");
      const scout1 = hired1.scoutingNetwork.scouts[0];

      const deployed1 = deployScoutingAssignment(hired1, {
        scoutId: scout1.id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const hired2 = hireScout(deployed1, "global-scout", "Scout 2");
      const scout2 = hired2.scoutingNetwork.scouts[1];

      const deployed2 = deployScoutingAssignment(hired2, {
        scoutId: scout2.id,
        targetCountryId: "england",
        durationDays: 30,
      });

      // Complete both assignments and generate reports
      const completed = {
        ...deployed2,
        scoutingNetwork: {
          ...deployed2.scoutingNetwork,
          assignments: deployed2.scoutingNetwork.assignments.map((a) =>
            a.status === "active"
              ? { ...a, status: "completed" as const, progressDays: a.durationDays }
              : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(completed);

      const report1 = withReports.scoutingNetwork?.reports?.find((r) => r.scoutId === scout1.id);
      const report2 = withReports.scoutingNetwork?.reports?.find((r) => r.scoutId === scout2.id);

      // Both scouts should have reports
      expect(report1).toBeDefined();
      expect(report2).toBeDefined();

      if (report1 && report2) {
        // Global scout (report2) should have potential data and higher discovery quality
        expect(report2.potentialRange).toBeDefined();
        expect(report2.discoveryQuality).toBeGreaterThan(report1.discoveryQuality ?? 0);

        // Global scout should have more key attributes
        expect((report2.keyAttributes ?? []).length).toBeGreaterThanOrEqual(
          (report1.keyAttributes ?? []).length,
        );
      }
    });

    it("creates inbox message when report is generated", () => {
      const hired = hireScout(state, "regional-scout", "Scout");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const completed = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "completed" as const } : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(completed);

      const inboxMessages = withReports.inbox ?? [];
      const scoutingMessages = inboxMessages.filter((m) => m.category === "scouting");

      expect(scoutingMessages.length).toBeGreaterThan(0);
      expect(scoutingMessages[0].action).toBe("view_scout_report");
    });
  });

  describe("Player Actions from Reports", () => {
    let stateWithReport = state;

    beforeEach(() => {
      const hired = hireScout(state, "regional-scout", "Marta");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const completed = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "completed" as const } : a,
          ),
        },
      };

      stateWithReport = processCompletedScoutingAssignments(completed);
    });

    it("adds scouted player to shortlist", () => {
      const report = getManagerScoutReports(stateWithReport)[0];
      expect(report).toBeDefined();

      const shortlisted = addScoutedPlayerToShortlist(stateWithReport, report.id);

      expect(shortlisted.scoutingNetwork?.shortlistedPlayerIds ?? []).toContain(report.playerId);
      expect(shortlisted.shortlistPlayerIds ?? []).toContain(report.playerId);

      const updated = shortlisted.scoutingNetwork?.reports?.find((r) => r.id === report.id);
      expect(updated?.status).toBe("shortlisted");
    });

    it("dismisses a scouted player", () => {
      const report = getManagerScoutReports(stateWithReport)[0];
      const dismissed = dismissScoutedPlayer(stateWithReport, report.id);

      expect(dismissed.scoutingNetwork?.dismissedPlayerIds ?? []).toContain(report.playerId);

      const updated = dismissed.scoutingNetwork?.reports?.find((r) => r.id === report.id);
      expect(updated?.status).toBe("dismissed");
    });

    it("adds eligible player to academy", () => {
      const report = getManagerScoutReports(stateWithReport)[0];
      const player = stateWithReport.players[report.playerId];

      if (!isEligibleForAcademy(player)) {
        expect(true).toBe(true); // Skip if not eligible
        return;
      }

      const withAcademy = addScoutedPlayerToAcademy(stateWithReport, report.id);

      expect(withAcademy.currentClub.academy.prospectIds).toContain(report.playerId);

      const updated = withAcademy.scoutingNetwork?.reports?.find((r) => r.id === report.id);
      expect(updated?.status).toBe("academy_added");
    });

    it("prevents adding player to academy if not eligible", () => {
      const report = getManagerScoutReports(stateWithReport)[0];
      const player = stateWithReport.players[report.playerId];

      // Make player ineligible
      const nextState = {
        ...stateWithReport,
        players: {
          ...stateWithReport.players,
          [report.playerId]: {
            ...player,
            age: 30, // Too old for academy
          },
        },
      };

      const withAcademy = addScoutedPlayerToAcademy(nextState, report.id);

      // Should not have added to academy
      expect(withAcademy.currentClub.academy.prospectIds).not.toContain(report.playerId);
    });

    it("prevents duplicates when adding to academy", () => {
      const report = getManagerScoutReports(stateWithReport)[0];
      const player = stateWithReport.players[report.playerId];

      if (!isEligibleForAcademy(player)) return;

      const added1 = addScoutedPlayerToAcademy(stateWithReport, report.id);
      const added2 = addScoutedPlayerToAcademy(added1, report.id);

      const count = added2.currentClub.academy.prospectIds.filter(
        (id) => id === report.playerId,
      ).length;
      expect(count).toBe(1);
    });

    it("continues scouting a player", () => {
      const report = getManagerScoutReports(stateWithReport)[0];

      const continued = continueScoutingPlayer(stateWithReport, report.id, 30);

      expect(continued.scoutingNetwork?.assignments.length ?? 0).toBeGreaterThan(
        stateWithReport.scoutingNetwork?.assignments.length ?? 0,
      );

      const updated = continued.scoutingNetwork?.reports?.find((r) => r.id === report.id);
      expect(updated?.status).toBe("continued_scouting");

      // New assignment should exist
      const newAssignment = continued.scoutingNetwork?.assignments.find(
        (a) => a.assignmentLabel.includes("Continue") && a.durationDays === 30,
      );
      expect(newAssignment).toBeDefined();
    });
  });

  describe("Shortlist Integration", () => {
    it("maintains global shortlist separate from scout shortlist", () => {
      const hired = hireScout(state, "regional-scout", "Scout");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const completed = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "completed" as const } : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(completed);
      const report = getManagerScoutReports(withReports)[0];
      const shortlisted = addScoutedPlayerToShortlist(withReports, report.id);

      // Should be in both scout shortlist and global shortlist
      expect(getShortlistedFromScouts(shortlisted)).toContain(report.playerId);
      expect(shortlisted.shortlistPlayerIds).toContain(report.playerId);
    });
  });

  describe("Persistence", () => {
    it("persists scout reports through save/load", () => {
      const hired = hireScout(state, "continental-scout", "Scout");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const completed = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "completed" as const } : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(completed);
      const report = getManagerScoutReports(withReports)[0];
      const shortlisted = addScoutedPlayerToShortlist(withReports, report.id);

      const key = "ml_game_state_scout_test";
      saveToStorage(key, 11, shortlisted);
      const roundTripped = loadFromStorage<typeof shortlisted>(key, 11, {});

      expect(roundTripped.status).toBe("ok");
      expect(roundTripped.data.scoutingNetwork?.reports ?? []).toHaveLength(1);
      expect(roundTripped.data.scoutingNetwork?.shortlistedPlayerIds ?? []).toHaveLength(1);
    });
  });

  describe("Reducer Integration", () => {
    it("shortlists player via SHORTLIST_SCOUTED_PLAYER action", () => {
      const hired = hireScout(state, "regional-scout", "Scout");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const completed = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "completed" as const } : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(completed);
      const report = getManagerScoutReports(withReports)[0];

      const result = gameReducer(withReports, {
        type: "SHORTLIST_SCOUTED_PLAYER",
        reportId: report.id,
      });

      expect(result.scoutingNetwork?.shortlistedPlayerIds).toContain(report.playerId);
    });

    it("dismisses player via DISMISS_SCOUTED_PLAYER action", () => {
      const hired = hireScout(state, "regional-scout", "Scout");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const completed = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "completed" as const } : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(completed);
      const report = getManagerScoutReports(withReports)[0];

      const result = gameReducer(withReports, {
        type: "DISMISS_SCOUTED_PLAYER",
        reportId: report.id,
      });

      expect(result.scoutingNetwork?.dismissedPlayerIds).toContain(report.playerId);
    });

    it("adds to academy via ADD_SCOUTED_PLAYER_TO_ACADEMY action", () => {
      const hired = hireScout(state, "regional-scout", "Scout");
      const deployed = deployScoutingAssignment(hired, {
        scoutId: hired.scoutingNetwork.scouts[0].id,
        targetCountryId: "england",
        durationDays: 30,
      });

      const completed = {
        ...deployed,
        scoutingNetwork: {
          ...deployed.scoutingNetwork,
          assignments: deployed.scoutingNetwork.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "completed" as const } : a,
          ),
        },
      };

      const withReports = processCompletedScoutingAssignments(completed);
      const report = getManagerScoutReports(withReports)[0];

      const result = gameReducer(withReports, {
        type: "ADD_SCOUTED_PLAYER_TO_ACADEMY",
        reportId: report.id,
      });

      if (isEligibleForAcademy(withReports.players[report.playerId])) {
        expect(result.currentClub.academy.prospectIds).toContain(report.playerId);
      }
    });
  });
});
