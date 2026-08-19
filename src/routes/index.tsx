import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TMod } from "@/components/ui-modern";
import { Colors, Spacing } from "@/components/design-system";
import stadiumHero from "@/assets/stadium-hero.jpg";
import {
  useClubPlayers,
  useStartingXI,
  useCurrentClub,
  useGameState,
  useLeagueTable,
  useManager,
  useNextFixture,
} from "@/state/store";
import { getPendingManagerFixtureForToday } from "@/state/calendar";
import { filterVisibleNegotiations } from "@/state/transfer-visibility";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Manager HQ — Manager Legacy" },
      {
        name: "description",
        content:
          "Your club dashboard: next fixture, league position, season objectives, squad condition and key form players at your club.",
      },
      { property: "og:title", content: "Manager HQ — Manager Legacy" },
      {
        property: "og:description",
        content: "Next match, league table, objectives and squad status in one manager dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeScreen,
});

/**
 * Premium Football Management Command Center
 *
 * Layout:
 * - TOP HEADER: Current date, club identity, manager name, season context
 * - PRIMARY FIXTURE CARD: Next match (main focal point) with Advance Day button
 * - SECONDARY AREA: Manager Tasks/Attention Required (injuries, negotiations, contracts, board expectations)
 * - TERTIARY: News/Events feed
 * - QUICK ACCESS: Links to key sections
 */
function HomeScreen() {
  const { state, dispatch } = useGameState();
  const navigate = useNavigate();
  const currentClub = useCurrentClub();
  const manager = useManager();
  const players = useClubPlayers();
  const startingXI = useStartingXI();
  const table = useLeagueTable(currentClub.leagueId);
  const [selectedLeagueId, setSelectedLeagueId] = useState(currentClub.leagueId);
  const selectedLeagueTable = useLeagueTable(selectedLeagueId);
  const availableLeagues = Object.values(state.leagues).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const selectedLeague = state.leagues[selectedLeagueId];
  const nextFixture = useNextFixture();

  // Fixture state
  const isManagerFixture = (fixture: typeof nextFixture) =>
    Boolean(
      fixture &&
        (fixture.homeClubId === currentClub.id || fixture.awayClubId === currentClub.id),
    );
  const isTodayMatchDay = Boolean(
    nextFixture &&
      nextFixture.status === "scheduled" &&
      nextFixture.calendarDate === state.time.date &&
      isManagerFixture(nextFixture),
  );
  const blockingFixture =
    getPendingManagerFixtureForToday(state) ||
    (isTodayMatchDay && nextFixture?.status === "scheduled" ? nextFixture : undefined);
  const isAdvanceBlocked = !!blockingFixture;
  const nextOpponent = nextFixture
    ? state.clubs[
        nextFixture.homeClubId === currentClub.id ? nextFixture.awayClubId : nextFixture.homeClubId
      ]
    : undefined;
  const isHomeFixture = nextFixture?.homeClubId === currentClub.id;

  // Squad metrics
  const injured = players.filter((p) => p.status === "injured");
  const fatigued = players.filter((p) => p.fatigue > 75 && p.status !== "injured");
  const avgXI =
    startingXI.length > 0
      ? Math.round(startingXI.reduce((s, p) => s + p.overall, 0) / startingXI.length)
      : 0;
  const inForm = [...players].sort((a, b) => b.form - a.form).slice(0, 3);

  // Manager Tasks/Attention Required
  const expiringContracts = (state.contracts ?? []).filter(
    (c) => c.status === "expiring" || (c.status === "negotiating" && c.playerId),
  );
  const activeNegotiations = filterVisibleNegotiations(state, state.currentClub.id).filter(
    (n) => n.status === "open",
  );
  const lowBoardConfidence = state.board.confidence < 60;
  const injuryAlert = injured.length > 2;
  const urgentTasks: Array<{ type: string; label: string; severity: string }> = [];

  if (injuryAlert)
    urgentTasks.push({
      type: "injury",
      label: `${injured.length} players injured`,
      severity: "high",
    });
  if (expiringContracts.length > 0)
    urgentTasks.push({
      type: "contract",
      label: `${expiringContracts.length} contract(s) ending soon`,
      severity: "medium",
    });
  if (activeNegotiations.length > 0)
    urgentTasks.push({
      type: "negotiation",
      label: `${activeNegotiations.length} negotiation(s) in progress`,
      severity: "medium",
    });
  if (lowBoardConfidence)
    urgentTasks.push({ type: "board", label: "Board confidence low", severity: "high" });

  // Recent news (last 5 items)
  const recentNews = (state.news ?? []).slice(0, 5);

  // League position
  const ourLeagueRow = table.find((r) => r.clubId === currentClub.id);
  const topPlaces = table.slice(0, 4);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as typeof window & { __advanceDayDebug?: () => void }).__advanceDayDebug = () => {
        dispatch({ type: "ADVANCE_DAY", days: 1 });
      };
    }
  }, [dispatch]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: TMod.bgPrimary,
        color: TMod.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "26px 16px 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "8px 0 22px",
            flexWrap: "wrap",
            gap: "12px",
          }}
          className="home-header"
        >
          <div className="home-header-club">
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.22em",
                color: TMod.textPrimary,
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              TODAY • {state.time.date}
            </div>
            <h1
              style={{
                margin: "14px 0 0",
                fontSize: 72,
                lineHeight: 0.92,
                fontWeight: 900,
                letterSpacing: "-0.06em",
                color: TMod.textPrimary,
              }}
            >
              {currentClub.name}
            </h1>
            <div style={{ color: TMod.textSecondary, fontSize: 18, marginTop: 12 }}>
              {manager.name} • Season 1 • {currentClub.shortName}
            </div>
          </div>

          <div
            style={{
              width: 220,
              height: 180,
              background: TMod.gradientGreen,
              border: `1px solid ${TMod.borderAccent}`,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `inset 0 0 14px rgba(255,255,255,0.12)`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.18em",
                color: "rgba(3, 14, 13, 0.75)",
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              Squad Rating
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: "#052013",
                letterSpacing: "-0.08em",
                marginTop: 6,
              }}
            >
              {avgXI}
            </div>
          </div>
        </div>

        <div
          style={{
            background: TMod.bgPanel,
            border: `1px solid ${TMod.borderMid}`,
            borderRadius: 12,
            padding: "18px 22px 0",
            boxShadow: TMod.shadowMd,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  letterSpacing: "0.18em",
                  color: TMod.accentGreen,
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                Next Fixture
              </div>
              <div style={{ fontSize: 18, color: TMod.textPrimary, marginTop: 8 }}>
                {nextFixture
                  ? `${nextFixture.date} • Matchday ${nextFixture.matchday}`
                  : "No fixture scheduled"}
              </div>
            </div>

            {!isTodayMatchDay && nextFixture && (
              <div
                style={{
                  minWidth: 104,
                  background: `${TMod.accentGreen}18`,
                  border: `1px solid ${TMod.accentGreen}88`,
                  borderRadius: 10,
                  padding: "12px 16px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: TMod.accentGreen,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Days Until
                </div>
                <div
                  style={{ fontSize: 34, fontWeight: 900, color: TMod.accentGreen, marginTop: 4 }}
                >
                  {(() => {
                    const fixture = new Date(nextFixture.calendarDate);
                    const today = new Date(state.time.date);
                    const diff = Math.ceil(
                      (fixture.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    return Math.max(0, diff);
                  })()}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: `1px solid ${TMod.borderMid}`,
              padding: "18px 0 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <div style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  fontSize: 88,
                  fontWeight: 900,
                  color: TMod.accentGreen,
                  letterSpacing: "-0.08em",
                }}
              >
                {currentClub.abbr || "NFU"}
              </div>
              <div style={{ fontSize: 12, color: TMod.textSecondary, marginTop: 2 }}>
                {currentClub.shortName || currentClub.name}
              </div>
            </div>

            <div style={{ fontSize: 28, color: TMod.textPrimary, fontWeight: 800, opacity: 0.8 }}>
              VS
            </div>

            <div style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  fontSize: 88,
                  fontWeight: 900,
                  color: TMod.textPrimary,
                  letterSpacing: "-0.08em",
                }}
              >
                {nextOpponent?.abbr || "WPU"}
              </div>
              <div style={{ fontSize: 12, color: TMod.textSecondary, marginTop: 2 }}>
                {nextOpponent?.shortName || nextOpponent?.name || "Westport"}
              </div>
            </div>
          </div>
        </div>

        {/* ADVANCE CALENDAR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          {isTodayMatchDay && nextFixture ? (
            <button
              onClick={() => {
                // Dispatch action to set pending fixture BEFORE navigating
                dispatch({ type: "SET_PENDING_MATCH", fixtureId: nextFixture.id });
                navigate({ to: "/match" });
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background:
                  "linear-gradient(135deg, rgba(79, 219, 255, 0.4), rgba(79, 219, 255, 0.2))",
                color: "#4fdbff",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                opacity: 1,
                transition: "all 0.3s",
                textDecoration: "none",
                display: "inline-block",
                boxShadow: "0 0 14px rgba(79, 219, 255, 0.3)",
              }}
            >
              Play Match
            </button>
          ) : (
            <button
              onClick={() => {
                if (!isAdvanceBlocked) {
                  dispatch({ type: "ADVANCE_DAY", days: 1 });
                }
              }}
              disabled={isAdvanceBlocked}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "1px solid rgba(126, 169, 255, 0.3)",
                background: isAdvanceBlocked
                  ? "rgba(17, 30, 45, 0.4)"
                  : "linear-gradient(135deg, rgba(79, 219, 255, 0.2), rgba(79, 219, 255, 0.1))",
                color: isAdvanceBlocked ? "#7a8fa0" : "#4fdbff",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: isAdvanceBlocked ? "not-allowed" : "pointer",
                opacity: isAdvanceBlocked ? 0.5 : 1,
                transition: "all 0.3s",
              }}
            >
              Advance Day
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#a8bbd6",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Next →
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#4fdbff",
                letterSpacing: "-0.02em",
                minWidth: 100,
              }}
            >
              {(() => {
                const today = new Date(state.time.date);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow.toISOString().split("T")[0];
              })()}
            </div>
          </div>

          {isTodayMatchDay && (
            <div
              style={{
                fontSize: 11,
                color: "#4fdbff",
                marginLeft: 12,
                display: "flex",
                alignItems: "center",
                fontWeight: 700,
              }}
            >
              ⚽ Match day ready
            </div>
          )}
        </div>

        <style>{`
          @media (max-width: 768px) {
            .home-grid { grid-template-columns: 1fr !important; }
            .home-header { flex-direction: column; align-items: stretch; gap: 12px; }
            .home-header-club { margin-right: 0; }
            .match-cards { gap: 12px; }
          }
        `}</style>

        <div
          style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18, marginTop: 0 }}
          className="home-grid"
        >
          <div
            style={{
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "18px 20px",
                background: "rgba(44, 201, 133, 0.08)",
                borderBottom: "1px solid rgba(126, 169, 255, 0.2)",
              }}
            >
              <div style={{ fontSize: 18, color: "#7bffb8" }}>⚠</div>
              <div
                style={{
                  fontSize: 16,
                  letterSpacing: "0.12em",
                  color: "#dfffee",
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                Attention Required
              </div>
            </div>
            <div style={{ padding: "18px 20px" }}>
              {urgentTasks.length > 0 ? (
                urgentTasks.slice(0, 3).map((task, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: idx < urgentTasks.length - 1 ? 12 : 0,
                      marginBottom: idx < urgentTasks.length - 1 ? 12 : 0,
                      borderBottom:
                        idx < urgentTasks.length - 1
                          ? "1px solid rgba(126, 169, 255, 0.14)"
                          : "none",
                    }}
                  >
                    <div style={{ fontSize: 15, color: "#edf8ff", fontWeight: 700 }}>
                      {task.label}
                    </div>
                    <Link
                      to={
                        task.type === "injury"
                          ? "/treatment"
                          : task.type === "contract" || task.type === "negotiation"
                            ? "/transfers"
                            : "/board"
                      }
                      style={{
                        color: "#7bffb8",
                        textDecoration: "none",
                        fontWeight: 800,
                        fontSize: 11,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      View
                    </Link>
                  </div>
                ))
              ) : (
                <div style={{ color: "#a8bbd6", fontSize: 14 }}>No urgent issues right now.</div>
              )}
            </div>
          </div>

          <div
            style={{
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                background: "rgba(63, 139, 255, 0.06)",
                borderBottom: "1px solid rgba(126, 169, 255, 0.2)",
                fontSize: 16,
                letterSpacing: "0.12em",
                color: "#d9f0ff",
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              League Standing
            </div>
            <div style={{ padding: "18px 20px" }}>
              <select
                value={selectedLeagueId}
                onChange={(event) => setSelectedLeagueId(event.target.value)}
                aria-label="Select league standings"
                style={{
                  width: "100%",
                  marginBottom: 14,
                  padding: "9px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(126, 169, 255, 0.35)",
                  background: "rgba(17, 30, 45, 0.95)",
                  color: "#dfeaff",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {availableLeagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name} · {league.season}
                  </option>
                ))}
              </select>
              <div style={{ color: "#7bffb8", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>
                {selectedLeague?.name ?? "League standings"}
              </div>
              {selectedLeagueTable.map((row) => {
                const club = state.clubs[row.clubId];
                const isOurs = row.clubId === currentClub.id;
                return (
                  <button
                    key={row.clubId}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "6px 0",
                      color: isOurs ? "#7bffb8" : "#dfeaff",
                      fontWeight: isOurs ? 800 : 600,
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(126, 169, 255, 0.12)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 20,
                          display: "inline-block",
                          color: isOurs ? "#7bffb8" : "#93a7c7",
                        }}
                      >
                        {row.position}
                      </span>
                      <span>{club?.shortName || club?.name}</span>
                    </div>
                    <span>{row.points}</span>
                  </button>
                );
              })}
              {selectedLeagueId === currentClub.leagueId && ourLeagueRow && (
                <div style={{ marginTop: 12, color: "#a8bbd6", fontSize: 12 }}>
                  Your position:{" "}
                  <strong style={{ color: "#7bffb8" }}>#{ourLeagueRow.position}</strong> with{" "}
                  <strong>{ourLeagueRow.points}</strong> points
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
