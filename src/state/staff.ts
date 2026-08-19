import type { GameState, StaffMember } from "./types";
import { parseMoney, formatMoney } from "./finance";
import { seededUnit } from "./utils";

/** Hire a staff member for the current club. Deducts a one-off signing cost
 * (approx. 8 weeks' wages) from the club balance and adds the staff member
 * to `state.staff`. Returns the new state. */
export function hireStaff(state: GameState, member: StaffMember): GameState {
  const clubId = state.currentClub?.id;
  if (!clubId) return state;
  const nextStaff = [...(state.staff ?? []), member];
  const baseWeekly = 1_000;
  const signingCost = Math.round(baseWeekly * 8 + (member.rating - 50) * 40);
  const balance = parseMoney(state.finances?.balance);
  const nextBalance = Math.max(0, balance - signingCost);

  const previousExpenses = state.finances?.expenses ?? {
    playerSalaries: 0,
    staff: 0,
    transfers: 0,
    facilities: 0,
    scouting: 0,
    medical: 0,
    operations: 0,
    total: 0,
  };

  return {
    ...state,
    staff: nextStaff,
    finances: {
      ...state.finances,
      balance: formatMoney(nextBalance),
      expenses: {
        ...previousExpenses,
        staff: previousExpenses.staff + signingCost,
        total: previousExpenses.total + signingCost,
      },
    },
  };
}

export function fireStaff(state: GameState, staffId: string): GameState {
  const clubId = state.currentClub?.id;
  if (!clubId) return state;
  const nextStaff = (state.staff ?? []).filter((s) => s.id !== staffId);
  // small severance payout
  const severance = 12_000;
  const balance = parseMoney(state.finances?.balance);
  const nextBalance = Math.max(0, balance - severance);
  const previousExpenses = state.finances?.expenses ?? {
    playerSalaries: 0,
    staff: 0,
    transfers: 0,
    facilities: 0,
    scouting: 0,
    medical: 0,
    operations: 0,
    total: 0,
  };

  return {
    ...state,
    staff: nextStaff,
    finances: {
      ...state.finances,
      balance: formatMoney(nextBalance),
      expenses: {
        ...previousExpenses,
        staff: previousExpenses.staff + severance,
        total: previousExpenses.total + severance,
      },
    },
  };
}

function parseContractYear(until?: string) {
  const match = String(until ?? "").match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

function seededRandInt(seed: string, min: number, max: number, index: number) {
  const v = seededUnit(`${seed}:${index}`);
  return Math.floor(v * (max - min + 1)) + min;
}

function makeSeasonalStaffMember(clubId: string, role: string, date: string): StaffMember {
  const rating = seededRandInt(`${clubId}:${role}:${date}`, 45, 86, 1);
  const year = Number(date.slice(0, 4));
  const id = `${clubId}-${role.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${year}-${rating}`;
  const salaryWeekly = Math.round(1_200 + rating * 25);
  return {
    id,
    name: `${role} ${rating}`,
    role,
    nationality: "ENG",
    rating,
    clubId,
    salaryWeekly,
    contractYears: 2,
    contractUntil: `Jun ${year + 2}`,
  };
}

function shouldRenewStaff(staff: StaffMember, club: GameState["clubs"][string], date: string) {
  const baseChance =
    0.4 + Math.min(0.35, club.reputation / 250) + Math.min(0.25, staff.rating / 220);
  const chance = Math.min(0.9, baseChance);
  return seededUnit(`${club.id}:renew:${staff.id}:${date}`) < chance;
}

export function runSeasonalStaffLifecycle(state: GameState): GameState {
  const currentYear = Number(state.time.date.slice(0, 4));
  let next = state;
  let nextStaff = [...(next.staff ?? [])];
  const nextEvents = [...(next.events ?? [])];

  const roleRequirements = [
    { role: "Assistant Manager", facilityKey: "training", facilityBonus: 0.25 },
    { role: "Head Physio", facilityKey: "medical", facilityBonus: 0.25 },
    { role: "Chief Scout", facilityKey: "scouting", facilityBonus: 0.2 },
  ] as const;

  for (const club of Object.values(state.clubs)) {
    const clubStaff = nextStaff.filter((member) => member.clubId === club.id);

    for (const staff of clubStaff) {
      const remainingYears = Math.max(0, (staff.contractYears ?? 1) - 1);
      const contractYear = parseContractYear(staff.contractUntil);
      const isExpired =
        remainingYears <= 0 || (contractYear !== null && contractYear <= currentYear);

      if (isExpired) {
        if (shouldRenewStaff(staff, club, state.time.date)) {
          nextStaff = nextStaff.map((member) =>
            member.id === staff.id
              ? {
                  ...member,
                  contractYears: seededRandInt(`${member.id}:renew`, 2, 3, 2),
                  contractUntil: `Jun ${currentYear + 2}`,
                }
              : member,
          );
          continue;
        }

        nextStaff = nextStaff.filter((member) => member.id !== staff.id);
        nextEvents.push({
          id: `event-staff-${nextEvents.length + 1}`,
          date: state.time.date,
          type: "milestone" as const,
          description: `${staff.name} left ${club.name}`,
        });
        continue;
      }

      nextStaff = nextStaff.map((member) =>
        member.id === staff.id ? { ...member, contractYears: remainingYears } : member,
      );
    }

    const remainingClubStaff = nextStaff.filter((member) => member.clubId === club.id);
    for (const requirement of roleRequirements) {
      if (remainingClubStaff.some((member) => member.role === requirement.role)) continue;
      const facilityValue =
        requirement.facilityKey === "training"
          ? club.facilities.training
          : requirement.facilityKey === "medical"
            ? club.facilities.medical
            : club.scouting.rating;
      const hireChance = Math.min(
        0.75,
        0.22 + club.reputation / 220 + facilityValue / 260 + requirement.facilityBonus,
      );
      if (seededUnit(`${club.id}:${requirement.role}:${state.time.date}:hire`) >= hireChance)
        continue;
      const hired = makeSeasonalStaffMember(club.id, requirement.role, state.time.date);
      nextStaff.push(hired);
      nextEvents.push({
        id: `event-staff-${nextEvents.length + 1}`,
        date: state.time.date,
        type: "milestone" as const,
        description: `${club.name} hired ${hired.role}`,
      });
    }
  }

  next = { ...next, staff: nextStaff, events: nextEvents };
  return next;
}

export {};
