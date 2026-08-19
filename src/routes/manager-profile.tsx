import { createFileRoute } from "@tanstack/react-router";
import { useCurrentClub, useGameState, useManager } from "@/state/store";
import { TMod } from "@/components/ui-modern";

export const Route = createFileRoute("/manager-profile")({
  head: () => ({
    meta: [
      { title: "Manager Profile — Manager Legacy" },
      {
        name: "description",
        content: "Your career history, achievements, and manager statistics.",
      },
    ],
  }),
  component: ManagerProfileScreen,
});

function ManagerProfileScreen() {
  const { state } = useGameState();
  const club = useCurrentClub();
  const manager = state.manager;

  const reputation = manager.reputation ?? 50;
  const credit = manager.credit ?? 50;
  const boardConfidence = manager.boardConfidence ?? 50;

  const careerHistory = state.careerHistory ?? [];
  const seasonReviews = careerHistory.filter((e) => e.seasonReview);

  const totalSeasons = seasonReviews.length;
  const greatSeasons = seasonReviews.filter((e) => e.seasonReview?.tier === "great").length;
  const goodSeasons = seasonReviews.filter((e) => e.seasonReview?.tier === "good").length;
  const badSeasons = seasonReviews.filter((e) => e.seasonReview?.tier === "bad").length;
  const terribleSeasons = seasonReviews.filter((e) => e.seasonReview?.tier === "terrible").length;

  const lastSeason = [...seasonReviews].reverse()[0];
  const currentTier = lastSeason?.seasonReview?.tier ?? "unknown";

  const totalMatches = 0; // CareerEvent doesn't track match-level data
  const totalWins = 0;
  const winRate = 0;

  const recentSeasonReviews = seasonReviews
    .sort((a, b) => (b.season > a.season ? 1 : -1))
    .slice(0, 4);

  const tierColor = (tier?: string) => {
    switch (tier) {
      case "great":
        return TMod.accentGreen;
      case "good":
        return TMod.accentGold;
      case "bad":
        return TMod.accentGold;
      case "terrible":
        return TMod.accentRed;
      default:
        return TMod.accentBlue;
    }
  };

  const tierLabel = (tier?: string) => {
    return tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Unknown";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: TMod.bgPrimary,
        color: TMod.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* TOP HEADER */}
      <div
        style={{
          width: "100%",
          background: `linear-gradient(180deg, ${TMod.bgPrimary}, ${TMod.bgSecondary})`,
          borderBottom: `1px solid ${TMod.borderMid}`,
          padding: "24px 26px",
        }}
      >
        <div style={{ maxWidth: 1440, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              color: TMod.textSecondary,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            CAREER
          </div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              marginTop: 8,
              color: TMod.textPrimary,
            }}
          >
            Manager Profile
          </h1>
          <div style={{ fontSize: 16, color: TMod.textSecondary, marginTop: 12 }}>
            {manager.name ?? "Manager"} • {club.name} •{" "}
            <span style={{ color: tierColor(currentTier) }}>{tierLabel(currentTier)} Season</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "26px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        {/* LEFT: Career Stats */}
        <div>
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              borderRadius: 12,
              padding: "20px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                color: TMod.accentGreen,
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              Career Overview
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}
            >
              <div
                style={{
                  background: TMod.bgTertiary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: TMod.textTertiary,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Seasons
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: TMod.accentCyan }}>
                  {totalSeasons}
                </div>
              </div>
              <div
                style={{
                  background: TMod.bgTertiary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: TMod.textTertiary,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Matches
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: TMod.accentGreen }}>
                  {totalMatches}
                </div>
              </div>
              <div
                style={{
                  background: TMod.bgTertiary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: TMod.textTertiary,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Win Rate
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: winRate >= 50 ? TMod.accentGreen : TMod.accentGold,
                  }}
                >
                  {winRate}%
                </div>
              </div>
              <div
                style={{
                  background: TMod.bgTertiary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: TMod.textTertiary,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Best Season
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: greatSeasons > 0 ? TMod.accentGreen : TMod.accentGold,
                  }}
                >
                  {greatSeasons > 0 ? "Great" : goodSeasons > 0 ? "Good" : "Building"}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: `${TMod.accentGreen}15`,
                  border: `1px solid ${TMod.accentGreen}33`,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 900, color: TMod.accentGreen }}>
                  {greatSeasons}
                </div>
                <div style={{ fontSize: 9, color: TMod.textSecondary, marginTop: 4 }}>Great</div>
              </div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: `${TMod.accentGold}15`,
                  border: `1px solid ${TMod.accentGold}33`,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 900, color: TMod.accentGold }}>
                  {goodSeasons}
                </div>
                <div style={{ fontSize: 9, color: TMod.textSecondary, marginTop: 4 }}>Good</div>
              </div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: `${TMod.accentGold}15`,
                  border: `1px solid ${TMod.accentGold}33`,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 900, color: TMod.accentGold }}>
                  {badSeasons}
                </div>
                <div style={{ fontSize: 9, color: TMod.textSecondary, marginTop: 4 }}>Bad</div>
              </div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: `${TMod.accentRed}15`,
                  border: `1px solid ${TMod.accentRed}33`,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 900, color: TMod.accentRed }}>
                  {terribleSeasons}
                </div>
                <div style={{ fontSize: 9, color: TMod.textSecondary, marginTop: 4 }}>Terrible</div>
              </div>
            </div>
          </div>

          {/* Current Standing */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              borderRadius: 12,
              padding: "20px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                color: TMod.accentGreen,
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Current Standing
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: TMod.bgTertiary,
                  border: `1px solid ${TMod.borderLight}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: TMod.textTertiary,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Reputation
                  </div>
                  <div style={{ fontSize: 11, color: TMod.textSecondary, marginTop: 3 }}>
                    Global standing
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: TMod.accentCyan }}>
                  {reputation}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: TMod.bgTertiary,
                  border: `1px solid ${TMod.borderLight}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: TMod.textTertiary,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Credit Buffer
                  </div>
                  <div style={{ fontSize: 11, color: TMod.textSecondary, marginTop: 3 }}>
                    Trust at {club.name}
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: TMod.accentGold }}>
                  {credit}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(126, 169, 255, 0.15)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#9db0c7",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Board Confidence
                  </div>
                  <div style={{ fontSize: 11, color: "#a8bbd6", marginTop: 3 }}>Job security</div>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: boardConfidence >= 50 ? "#7bffb8" : "#FFB800",
                  }}
                >
                  {boardConfidence}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Recent Seasons */}
        <div>
          <div
            style={{
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
              borderRadius: 12,
              padding: "20px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                color: "#d8f9ea",
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Recent Seasons
            </div>

            {recentSeasonReviews.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#a8bbd6", fontSize: 13 }}>
                No completed seasons yet
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  maxHeight: 600,
                  overflowY: "auto",
                }}
              >
                {recentSeasonReviews.map((review) => (
                  <div
                    key={review.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${tierColor(review.seasonReview?.tier)}33`,
                      borderLeft: `3px solid ${tierColor(review.seasonReview?.tier)}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#edf8ff" }}>
                        Season {review.season}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "4px 8px",
                          borderRadius: 4,
                          background: `${tierColor(review.seasonReview?.tier)}22`,
                          color: tierColor(review.seasonReview?.tier),
                          textTransform: "uppercase",
                        }}
                      >
                        {tierLabel(review.seasonReview?.tier)}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "#dfeaff", lineHeight: 1.4 }}>
                      {review.summary}
                    </div>
                    {review.seasonReview && (
                      <div
                        style={{ fontSize: 9, color: "#a8bbd6", marginTop: 8, fontStyle: "italic" }}
                      >
                        "Season Tier: {tierLabel(review.seasonReview?.tier)}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StandingRow({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(126, 169, 255, 0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9db0c7" }}>{label}</div>
          <div style={{ fontSize: 12, color: "#a8bbd6", marginTop: 2 }}>{note}</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: accent }}>{value}</div>
      </div>
    </div>
  );
}
