import { createFileRoute } from "@tanstack/react-router";
import { useGameState, useCurrentClub } from "@/state/store";

export const Route = createFileRoute("/fixtures")({
  head: () => ({
    meta: [
      { title: "Fixtures — Manager Legacy" },
      { name: "description", content: "Upcoming and recent matches for your club." },
      { property: "og:title", content: "Fixtures — Manager Legacy" },
      { property: "og:description", content: "Upcoming and recent matches for your club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FixturesScreen,
});

function FixturesScreen() {
  const { state } = useGameState();
  const currentClub = useCurrentClub();
  const league = state.leagues[currentClub.leagueId];
  const clubFixtures = state.fixtures.filter(
    (f) => f.homeClubId === currentClub.id || f.awayClubId === currentClub.id,
  );
  const played = clubFixtures.filter((f) => f.status === "played");
  const upcoming = clubFixtures.find((f) => f.status === "scheduled");
  const opponent = upcoming
    ? state.clubs[
        upcoming.homeClubId === currentClub.id ? upcoming.awayClubId : upcoming.homeClubId
      ]
    : undefined;

  const winCount = played.filter((f) => f.result === "W").length;
  const drawCount = played.filter((f) => f.result === "D").length;
  const lossCount = played.filter((f) => f.result === "L").length;
  const goalsFor = played.reduce(
    (sum, f) => sum + (f.homeClubId === currentClub.id ? (f.scoreHome ?? 0) : (f.scoreAway ?? 0)),
    0,
  );
  const goalsAgainst = played.reduce(
    (sum, f) => sum + (f.homeClubId === currentClub.id ? (f.scoreAway ?? 0) : (f.scoreHome ?? 0)),
    0,
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#061727",
        color: "#e8f1ff",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* TOP HEADER */}
      <div
        style={{
          width: "100%",
          background: "linear-gradient(180deg, rgba(8,17,32,0.98), rgba(7,15,28,0.96))",
          borderBottom: "1px solid rgba(126, 169, 255, 0.2)",
          padding: "24px 26px",
        }}
      >
        <div style={{ maxWidth: 1440, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              color: "#dce9ff",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            MATCHDAY
          </div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              marginTop: 8,
              color: "#edf8ff",
            }}
          >
            Fixtures
          </h1>
          <div style={{ fontSize: 16, color: "#a8bbd6", marginTop: 12 }}>
            Matchday {league?.matchday ?? "—"} · Season {league?.season ?? ""}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* NEXT MATCH */}
        {upcoming && opponent ? (
          <div>
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                color: "#d8f9ea",
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Next Match
            </div>
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                background: "rgba(17, 30, 45, 0.8)",
                border: "1px solid rgba(126, 169, 255, 0.2)",
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: 20,
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#edf8ff" }}>
                  {upcoming.homeClubId === currentClub.id
                    ? currentClub.shortName || currentClub.name
                    : opponent.shortName || opponent.name}
                </div>
                <div style={{ fontSize: 11, color: "#a8bbd6", marginTop: 4 }}>
                  Matchday {upcoming.matchday}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "#a8bbd6", marginBottom: 4 }}>vs</div>
                <div style={{ fontSize: 12, color: "#4fdbff", fontWeight: 700 }}>
                  {upcoming.date}
                </div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#edf8ff" }}>
                  {upcoming.homeClubId === currentClub.id
                    ? opponent.shortName || opponent.name
                    : currentClub.shortName || currentClub.name}
                </div>
                <div style={{ fontSize: 11, color: "#a8bbd6", marginTop: 4 }}>{league?.name}</div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                color: "#d8f9ea",
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Next Match
            </div>
            <div
              style={{
                padding: "24px",
                borderRadius: 12,
                background: "rgba(17, 30, 45, 0.8)",
                border: "1px solid rgba(126, 169, 255, 0.2)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#edf8ff", marginBottom: 6 }}>
                Season Complete
              </div>
              <div style={{ fontSize: 11, color: "#a8bbd6" }}>
                All fixtures have been played. Season will progress when you advance the calendar.
              </div>
            </div>
          </div>
        )}

        {/* SEASON STATS */}
        {played.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                color: "#d8f9ea",
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Season Statistics
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "rgba(17, 30, 45, 0.8)",
                  border: "1px solid rgba(126, 169, 255, 0.2)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#a8bbd6",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Wins
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#7bffb8" }}>{winCount}</div>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "rgba(17, 30, 45, 0.8)",
                  border: "1px solid rgba(126, 169, 255, 0.2)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#a8bbd6",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Draws
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#f0c24b" }}>{drawCount}</div>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "rgba(17, 30, 45, 0.8)",
                  border: "1px solid rgba(126, 169, 255, 0.2)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#a8bbd6",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Losses
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#ff6b6b" }}>{lossCount}</div>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "rgba(17, 30, 45, 0.8)",
                  border: "1px solid rgba(126, 169, 255, 0.2)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#a8bbd6",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Goal Diff
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color:
                      goalsFor - goalsAgainst > 0
                        ? "#7bffb8"
                        : goalsFor - goalsAgainst < 0
                          ? "#ff6b6b"
                          : "#a8bbd6",
                  }}
                >
                  {goalsFor - goalsAgainst > 0 ? "+" : ""}
                  {goalsFor - goalsAgainst}
                </div>
                <div style={{ fontSize: 10, color: "#a8bbd6", marginTop: 4 }}>
                  {goalsFor}:{goalsAgainst}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RECENT MATCHES */}
        {played.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                color: "#d8f9ea",
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Recent Matches
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...played]
                .reverse()
                .slice(0, 10)
                .map((match) => {
                  const isHome = match.homeClubId === currentClub.id;
                  const homeClub = state.clubs[match.homeClubId];
                  const awayClub = state.clubs[match.awayClubId];
                  return (
                    <div
                      key={match.id}
                      style={{
                        padding: "14px",
                        borderRadius: 12,
                        background: "rgba(17, 30, 45, 0.8)",
                        border: "1px solid rgba(126, 169, 255, 0.2)",
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: 16,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#edf8ff" }}>
                          {homeClub?.shortName || homeClub?.name || "—"}
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#4fdbff" }}>
                          {match.scoreHome} - {match.scoreAway}
                        </div>
                        <div style={{ fontSize: 9, color: "#a8bbd6", marginTop: 2 }}>
                          {match.date}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#edf8ff" }}>
                          {awayClub?.shortName || awayClub?.name || "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
