import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { TMod, ModPanel, ModSectionHead, ModButton, ModBadge } from "@/components/ui-modern";
import { ScreenHeader } from "@/components/squad-bits";
import { useGameState, useCurrentClub } from "@/state/store";
import type { Fixture, Club } from "@/state/types";
import {
  generateCalendarMonth,
  nextMonth,
  previousMonth,
  getMonthYearFromISO,
  formatDateLong,
  formatDateShort,
  getDayOfWeekName,
  compareISODates,
} from "@/lib/calendar-utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Manager Legacy" },
      { name: "description", content: "Full season fixture calendar and schedule." },
      { property: "og:title", content: "Calendar — Manager Legacy" },
      { property: "og:description", content: "Full season fixture calendar and schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarScreen,
});

interface FixtureOnDay {
  fixture: Fixture;
  isHome: boolean;
  opponent: string;
  opponentAbbr: string;
}

function CalendarScreen() {
  const { state } = useGameState();
  const currentClub = useCurrentClub();

  // Get today's date from game state
  const todayISO = state.time.date;
  const [displayYear, displayMonth] = getMonthYearFromISO(todayISO);

  // Navigation state
  const [viewYear, setViewYear] = useState(displayYear);
  const [viewMonth, setViewMonth] = useState(displayMonth);
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);

  // Generate calendar
  const calendarMonth = useMemo(
    () => generateCalendarMonth(viewYear, viewMonth, todayISO),
    [viewYear, viewMonth, todayISO],
  );

  // Get all fixtures for current club
  const clubFixtures = useMemo(
    () =>
      state.fixtures.filter(
        (f) => f.homeClubId === currentClub.id || f.awayClubId === currentClub.id,
      ),
    [state.fixtures, currentClub.id],
  );

  // Create a map of fixtures by date
  const fixturesByDate = useMemo(() => {
    const map = new Map<string, FixtureOnDay[]>();

    for (const fixture of clubFixtures) {
      const dateISO = fixture.calendarDate;
      const isHome = fixture.homeClubId === currentClub.id;
      const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
      const opponent = state.clubs[opponentId];

      if (!opponent) continue;

      const fixtureData: FixtureOnDay = {
        fixture,
        isHome,
        opponent: opponent.name,
        opponentAbbr: opponent.shortName || opponent.abbr || opponent.name.slice(0, 3),
      };

      if (!map.has(dateISO)) {
        map.set(dateISO, []);
      }
      map.get(dateISO)!.push(fixtureData);
    }

    return map;
  }, [clubFixtures, currentClub.id, state.clubs]);

  // Filter fixtures for list view
  const filteredFixtures = useMemo(() => {
    const fixtures = clubFixtures.map((fixture) => {
      const isHome = fixture.homeClubId === currentClub.id;
      const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
      const opponent = state.clubs[opponentId];
      return {
        fixture,
        isHome,
        opponent: opponent?.name || "Unknown",
        opponentAbbr: opponent?.shortName || opponent?.abbr || "???",
      };
    });

    // Sort by date
    fixtures.sort((a, b) => compareISODates(a.fixture.calendarDate, b.fixture.calendarDate));

    return fixtures;
  }, [clubFixtures, currentClub.id, state.clubs]);

  // Navigation handlers
  const goToPreviousMonth = () => {
    const [newYear, newMonth] = previousMonth(viewYear, viewMonth);
    setViewYear(newYear);
    setViewMonth(newMonth);
  };

  const goToNextMonth = () => {
    const [newYear, newMonth] = nextMonth(viewYear, viewMonth);
    setViewYear(newYear);
    setViewMonth(newMonth);
  };

  const goToCurrentMonth = () => {
    setViewYear(displayYear);
    setViewMonth(displayMonth);
  };

  return (
    <div style={{ minHeight: "100vh", background: TMod.bgPrimary, paddingBottom: 40 }}>
      <ScreenHeader title="Calendar" subtitle="Full season fixture schedule" backTo="/" />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
        {/* View Mode Tabs */}
        <div style={{ marginBottom: 24, display: "flex", gap: 12 }}>
          <ModButton
            variant={viewMode === "month" ? "primary" : "secondary"}
            onClick={() => setViewMode("month")}
            size="sm"
          >
            {viewMode === "month" ? "📅 Month View" : "Month View"}
          </ModButton>
          <ModButton
            variant={viewMode === "list" ? "primary" : "secondary"}
            onClick={() => setViewMode("list")}
            size="sm"
          >
            {viewMode === "list" ? "📋 List View" : "List View"}
          </ModButton>
        </div>

        {viewMode === "month" ? (
          <>
            {/* Month Navigation */}
            <CalendarMonthNavigation
              year={viewYear}
              month={viewMonth}
              displayYear={displayYear}
              displayMonth={displayMonth}
              onPrevious={goToPreviousMonth}
              onNext={goToNextMonth}
              onToday={goToCurrentMonth}
            />

            {/* Calendar Grid */}
            <CalendarGrid
              calendarMonth={calendarMonth}
              fixturesByDate={fixturesByDate}
              todayISO={todayISO}
              currentClubId={currentClub.id}
              state={state}
              onSelectFixture={setSelectedFixture}
            />
          </>
        ) : (
          /* List View */
          <FixtureListView
            fixtures={filteredFixtures}
            todayISO={todayISO}
            onSelectFixture={setSelectedFixture}
          />
        )}

        {/* Fixture Detail Panel */}
        {selectedFixture && (
          <FixtureDetailPanel
            fixture={selectedFixture}
            currentClub={currentClub}
            clubs={state.clubs}
            onClose={() => setSelectedFixture(null)}
          />
        )}
      </div>
    </div>
  );
}

interface CalendarMonthNavigationProps {
  year: number;
  month: number;
  displayYear: number;
  displayMonth: number;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

function CalendarMonthNavigation({
  year,
  month,
  displayYear,
  displayMonth,
  onPrevious,
  onNext,
  onToday,
}: CalendarMonthNavigationProps) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const isCurrentMonth = year === displayYear && month === displayMonth;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
        padding: "16px",
        background: `linear-gradient(135deg, ${TMod.bgSecondary} 0%, ${TMod.bgTertiary} 100%)`,
        border: `1px solid ${TMod.borderMid}`,
        borderRadius: 12,
      }}
    >
      <ModButton onClick={onPrevious} size="sm" variant="secondary">
        ← Previous
      </ModButton>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: TMod.textPrimary,
          }}
        >
          {monthNames[month - 1]} {year}
        </div>
        {!isCurrentMonth && (
          <div
            style={{
              fontSize: 12,
              color: TMod.textTertiary,
            }}
          >
            Today: {monthNames[displayMonth - 1]} {displayYear}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {!isCurrentMonth && (
          <ModButton onClick={onToday} size="sm" variant="secondary">
            Today
          </ModButton>
        )}
        <ModButton onClick={onNext} size="sm" variant="secondary">
          Next →
        </ModButton>
      </div>
    </div>
  );
}

interface CalendarGridProps {
  calendarMonth: ReturnType<typeof generateCalendarMonth>;
  fixturesByDate: Map<string, FixtureOnDay[]>;
  todayISO: string;
  currentClubId: string;
  state: ReturnType<typeof useGameState>["state"];
  onSelectFixture: (fixture: Fixture) => void;
}

function CalendarGrid({
  calendarMonth,
  fixturesByDate,
  todayISO,
  currentClubId,
  state,
  onSelectFixture,
}: CalendarGridProps) {
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      {/* Day headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {dayLabels.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: TMod.textSecondary,
              padding: "8px 0",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
        }}
      >
        {calendarMonth.days.map((day, idx) => {
          const fixtures = fixturesByDate.get(day.dateISO) || [];
          const isToday = day.isToday;
          const isCurrentMonth = day.isCurrentMonth;
          const isPast = compareISODates(day.dateISO, todayISO) < 0;

          return (
            <div
              key={idx}
              style={{
                minHeight: 120,
                padding: 12,
                border: `1px solid ${isCurrentMonth ? TMod.borderMid : TMod.borderLight}`,
                borderRadius: 8,
                background: isToday
                  ? `linear-gradient(135deg, rgba(76, 240, 164, 0.1) 0%, rgba(47, 224, 138, 0.05) 100%)`
                  : isCurrentMonth
                    ? TMod.bgPanel
                    : "rgba(0, 0, 0, 0.2)",
                borderColor: isToday
                  ? TMod.borderHighlight
                  : isCurrentMonth
                    ? TMod.borderMid
                    : TMod.borderLight,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                opacity: isCurrentMonth ? 1 : 0.5,
              }}
            >
              {/* Day number */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: isToday ? 16 : 14,
                    fontWeight: isToday ? 700 : 600,
                    color: isToday ? TMod.accentGreen : TMod.textPrimary,
                  }}
                >
                  {day.dayOfMonth}
                </div>
                {isToday && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: TMod.accentGreen,
                    }}
                  />
                )}
              </div>

              {/* Fixtures */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fixtures.map((fd, fixIdx) => (
                  <CalendarFixtureCard
                    key={fixIdx}
                    fixtureData={fd}
                    isPast={isPast}
                    onClick={() => onSelectFixture(fd.fixture)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CalendarFixtureCardProps {
  fixtureData: FixtureOnDay;
  isPast: boolean;
  onClick: () => void;
}

function CalendarFixtureCard({ fixtureData, isPast, onClick }: CalendarFixtureCardProps) {
  const { fixture, isHome, opponentAbbr } = fixtureData;
  const isPlayed = fixture.status === "played";
  const isPostponed = fixture.status === "postponed";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 8px",
        borderRadius: 6,
        background:
          isPlayed && isPast
            ? "rgba(47, 224, 138, 0.1)"
            : isPostponed
              ? "rgba(240, 194, 75, 0.1)"
              : "rgba(58, 160, 255, 0.1)",
        border: `1px solid ${
          isPlayed && isPast
            ? "rgba(47, 224, 138, 0.3)"
            : isPostponed
              ? "rgba(240, 194, 75, 0.3)"
              : "rgba(58, 160, 255, 0.3)"
        }`,
        cursor: "pointer",
        transition: "all 0.2s ease",
        fontSize: 11,
        color: TMod.textSecondary,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background =
          isPlayed && isPast
            ? "rgba(47, 224, 138, 0.2)"
            : isPostponed
              ? "rgba(240, 194, 75, 0.2)"
              : "rgba(58, 160, 255, 0.2)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background =
          isPlayed && isPast
            ? "rgba(47, 224, 138, 0.1)"
            : isPostponed
              ? "rgba(240, 194, 75, 0.1)"
              : "rgba(58, 160, 255, 0.1)";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          justifyContent: "space-between",
        }}
      >
        <span>{isHome ? "vs" : "@"}</span>
        <span style={{ fontWeight: 600 }}>{opponentAbbr}</span>
        {isPlayed && (
          <span
            style={{
              fontSize: 10,
              color: TMod.accentGreen,
              fontWeight: 600,
            }}
          >
            ✓
          </span>
        )}
      </div>
      {isPlayed && fixture.scoreHome !== undefined && fixture.scoreAway !== undefined && (
        <div
          style={{
            fontSize: 10,
            color: TMod.textTertiary,
            marginTop: 2,
          }}
        >
          {isHome
            ? `${fixture.scoreHome}-${fixture.scoreAway}`
            : `${fixture.scoreAway}-${fixture.scoreHome}`}
        </div>
      )}
    </div>
  );
}

interface FixtureListViewProps {
  fixtures: Array<FixtureOnDay & { fixture: Fixture }>;
  todayISO: string;
  onSelectFixture: (fixture: Fixture) => void;
}

function FixtureListView({ fixtures, todayISO, onSelectFixture }: FixtureListViewProps) {
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");

  const filtered = useMemo(() => {
    return fixtures.filter((f) => {
      if (filter === "upcoming") {
        return (
          compareISODates(f.fixture.calendarDate, todayISO) >= 0 && f.fixture.status === "scheduled"
        );
      } else if (filter === "completed") {
        return f.fixture.status === "played";
      }
      return true;
    });
  }, [fixtures, filter, todayISO]);

  return (
    <div>
      {/* Filter buttons */}
      <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        {(["all", "upcoming", "completed"] as const).map((f) => (
          <ModButton
            key={f}
            variant={filter === f ? "primary" : "secondary"}
            onClick={() => setFilter(f)}
            size="sm"
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </ModButton>
        ))}
      </div>

      {/* Fixtures */}
      {filtered.length === 0 ? (
        <ModPanel variant="secondary" padding="24px">
          <div style={{ textAlign: "center", color: TMod.textSecondary }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No fixtures found</div>
            <div style={{ fontSize: 12, color: TMod.textTertiary }}>
              {filter === "upcoming"
                ? "All upcoming matches completed or none scheduled."
                : filter === "completed"
                  ? "No completed matches yet."
                  : "No fixtures in this season."}
            </div>
          </div>
        </ModPanel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((fd, idx) => (
            <FixtureListItem
              key={idx}
              fixtureData={fd}
              todayISO={todayISO}
              onClick={() => onSelectFixture(fd.fixture)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FixtureListItemProps {
  fixtureData: FixtureOnDay & { fixture: Fixture };
  todayISO: string;
  onClick: () => void;
}

function FixtureListItem({ fixtureData, todayISO, onClick }: FixtureListItemProps) {
  const { fixture, isHome, opponent, opponentAbbr } = fixtureData;
  const isPast = compareISODates(fixture.calendarDate, todayISO) < 0;
  const isToday = fixture.calendarDate === todayISO;
  const isPlayed = fixture.status === "played";

  return (
    <ModPanel
      variant="secondary"
      padding="16px"
      interactive
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 100px 80px",
        gap: 16,
        alignItems: "center",
      }}
    >
      {/* Date */}
      <div>
        <div style={{ fontSize: 12, color: TMod.textTertiary, marginBottom: 4 }}>
          {formatDateShort(fixture.calendarDate)}
        </div>
        <div
          style={{
            fontSize: 11,
            color: TMod.textSecondary,
          }}
        >
          {getDayOfWeekName(new Date(`${fixture.calendarDate}T00:00:00.000Z`).getUTCDay())}
        </div>
      </div>

      {/* Match info */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TMod.textPrimary }}>
            {isHome ? "vs" : "@"} {opponent}
          </div>
          <div style={{ fontSize: 11, color: TMod.textTertiary }}>
            {fixture.competitionId === "national-cup" ? "Cup" : "League"}
          </div>
        </div>
      </div>

      {/* Score or status */}
      <div style={{ textAlign: "right" }}>
        {isPlayed && fixture.scoreHome !== undefined && fixture.scoreAway !== undefined ? (
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: TMod.textPrimary,
            }}
          >
            {isHome
              ? `${fixture.scoreHome}-${fixture.scoreAway}`
              : `${fixture.scoreAway}-${fixture.scoreHome}`}
          </div>
        ) : isToday ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: TMod.accentOrange,
            }}
          >
            TODAY
          </div>
        ) : null}
      </div>

      {/* Badge */}
      <div style={{ textAlign: "right" }}>
        {isPlayed ? (
          <ModBadge label="Played" color="green" variant="subtle" />
        ) : fixture.status === "postponed" ? (
          <ModBadge label="Postponed" color="orange" variant="subtle" />
        ) : isPast ? (
          <ModBadge label="Overdue" color="red" variant="subtle" />
        ) : isToday ? (
          <ModBadge label="Today" color="orange" variant="subtle" />
        ) : (
          <ModBadge label="Upcoming" color="blue" variant="subtle" />
        )}
      </div>
    </ModPanel>
  );
}

interface FixtureDetailPanelProps {
  fixture: Fixture;
  currentClub: Club;
  clubs: Record<string, Club>;
  onClose: () => void;
}

function FixtureDetailPanel({ fixture, currentClub, clubs, onClose }: FixtureDetailPanelProps) {
  const homeClub = clubs[fixture.homeClubId];
  const awayClub = clubs[fixture.awayClubId];
  const isHome = fixture.homeClubId === currentClub.id;
  const opponent = isHome ? awayClub : homeClub;
  const otherClubName = isHome ? awayClub?.name : homeClub?.name;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <ModPanel
        variant="elevated"
        padding="32px"
        style={{
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: TMod.textPrimary }}>
              Fixture Details
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              color: TMod.textSecondary,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Match info */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 16,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            {/* Home team */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: TMod.textPrimary,
                  marginBottom: 8,
                }}
              >
                {homeClub?.shortName || homeClub?.name}
              </div>
              {fixture.status === "played" && (
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: TMod.accentGreen,
                  }}
                >
                  {fixture.scoreHome}
                </div>
              )}
            </div>

            {/* VS */}
            <div
              style={{
                fontSize: 12,
                color: TMod.textTertiary,
                fontWeight: 600,
              }}
            >
              VS
            </div>

            {/* Away team */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: TMod.textPrimary,
                  marginBottom: 8,
                }}
              >
                {awayClub?.shortName || awayClub?.name}
              </div>
              {fixture.status === "played" && (
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: TMod.accentGreen,
                  }}
                >
                  {fixture.scoreAway}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixture details */}
        <div
          style={{
            padding: "16px 0",
            borderTop: `1px solid ${TMod.borderMid}`,
            borderBottom: `1px solid ${TMod.borderMid}`,
            marginBottom: 20,
          }}
        >
          <DetailRow label="Date" value={formatDateLong(fixture.calendarDate)} />
          <DetailRow label="Match Day" value={`${fixture.matchday}`} />
          <DetailRow
            label="Competition"
            value={fixture.competitionId === "national-cup" ? "Cup" : "League"}
          />
          <DetailRow label="Status" value={formatStatus(fixture.status)} />
          {fixture.status === "played" && fixture.result && (
            <DetailRow label="Result" value={fixture.result} />
          )}
        </div>

        {/* Close button */}
        <ModButton onClick={onClose} variant="secondary" fullWidth>
          Close
        </ModButton>
      </ModPanel>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: TMod.textSecondary }}>{label}</span>
      <span style={{ color: TMod.textPrimary, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function formatStatus(status: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "played":
      return "Played";
    case "postponed":
      return "Postponed";
    default:
      return status;
  }
}
