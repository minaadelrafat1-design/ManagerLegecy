import { createFileRoute } from "@tanstack/react-router";
import { useCurrentClub, useGameState, useManager } from "@/state/store";
import { getBoardPressureMessage, isUnderBoardPressure } from "@/state/board-pressure";
import { TMod } from "@/components/ui-modern";

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Board — Manager Legacy" },
      {
        name: "description",
        content: "Board confidence, expectations, and current board pressure.",
      },
    ],
  }),
  component: BoardScreen,
});

function BoardScreen() {
  const { state } = useGameState();
  const club = useCurrentClub();
  const manager = state.manager;
  const board = state.board ?? { confidence: 50, expectations: [] };
  const boardConfidence = manager.boardConfidence ?? 50;
  const underPressure = isUnderBoardPressure(state);
  const pressureMessage = getBoardPressureMessage(state);

  const recentBoardEvents = (state.events ?? [])
    .filter((e) => e.type === "board")
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 5);

  const recentBoardNews = (state.news ?? [])
    .filter((n) => n.tag === "board")
    .sort((a, b) => (b.time > a.time ? 1 : -1))
    .slice(0, 3);

  const confidenceColor =
    boardConfidence >= 70
      ? TMod.accentGreen
      : boardConfidence >= 50
        ? TMod.accentGold
        : boardConfidence >= 30
          ? TMod.accentGold
          : TMod.accentRed;

  const boardStatusLabel =
    boardConfidence >= 75
      ? "Very Confident"
      : boardConfidence >= 60
        ? "Confident"
        : boardConfidence >= 45
          ? "Neutral"
          : boardConfidence >= 30
            ? "Concerned"
            : boardConfidence >= 15
              ? "Very Concerned"
              : "Critical";

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
            MANAGEMENT
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
            Board & Management
          </h1>
          <div style={{ fontSize: 16, color: TMod.textSecondary, marginTop: 12 }}>
            {club.name} • Board Confidence:{" "}
            <span style={{ color: confidenceColor, fontWeight: 700 }}>
              {Math.round(boardConfidence)}%
            </span>
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
        {/* LEFT: Confidence & Status */}
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
                marginBottom: 16,
              }}
            >
              Board Confidence
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 12, color: TMod.textSecondary }}>Confidence Level</span>
              <span style={{ fontSize: 32, fontWeight: 900, color: confidenceColor }}>
                {Math.round(boardConfidence)}%
              </span>
            </div>

            <div
              style={{
                height: 8,
                background: TMod.borderLight,
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: `${Math.min(boardConfidence, 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${confidenceColor}, ${confidenceColor}aa)`,
                }}
              />
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: TMod.bgTertiary,
                border: `1px solid ${TMod.borderLight}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: TMod.textSecondary,
                  textTransform: "uppercase",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Status
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: confidenceColor }}>
                {boardStatusLabel}
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 8,
                background: underPressure ? "rgba(255, 99, 71, 0.08)" : "rgba(123, 255, 184, 0.08)",
                border: `1px solid ${underPressure ? "rgba(255, 99, 71, 0.3)" : "rgba(123, 255, 184, 0.3)"}`,
                fontSize: 12,
                color: underPressure ? "#ff6b6b" : "#7bffb8",
                fontWeight: 600,
              }}
            >
              {underPressure ? "⚠️" : "✓"} {pressureMessage}
            </div>
          </div>

          {/* Manager Status Cards */}
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
              Manager Status
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(126, 169, 255, 0.15)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#9db0c7",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Credit Buffer
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#f0c24b" }}>
                  {manager.credit} <span style={{ fontSize: 14, color: "#a8bbd6" }}>/ 100</span>
                </div>
                <div style={{ fontSize: 10, color: "#a8bbd6", marginTop: 6, lineHeight: 1.4 }}>
                  Earned through good seasons, acts as a buffer against poor results
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(126, 169, 255, 0.15)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#9db0c7",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Reputation
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#4fdbff" }}>
                  {manager.reputation} <span style={{ fontSize: 14, color: "#a8bbd6" }}>/ 100</span>
                </div>
                <div style={{ fontSize: 10, color: "#a8bbd6", marginTop: 6, lineHeight: 1.4 }}>
                  Global reputation affects job offers and player interest
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Events & News */}
        <div>
          {/* Board Expectations */}
          {board.expectations && board.expectations.length > 0 && (
            <div
              style={{
                background: "rgba(17, 30, 45, 0.8)",
                border: "1px solid rgba(126, 169, 255, 0.2)",
                borderRadius: 12,
                padding: "20px",
                marginBottom: 24,
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
                Board Expectations
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {board.expectations.map((exp, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(126, 169, 255, 0.15)",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#edf8ff" }}>
                      {exp.title}
                    </div>
                    <div style={{ fontSize: 9, color: "#a8bbd6", marginTop: 4 }}>
                      Progress: {exp.progress}% • {exp.note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Board Events */}
          {recentBoardEvents.length > 0 && (
            <div
              style={{
                background: "rgba(17, 30, 45, 0.8)",
                border: "1px solid rgba(126, 169, 255, 0.2)",
                borderRadius: 12,
                padding: "20px",
                marginBottom: 24,
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
                Recent Decisions
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 250,
                  overflowY: "auto",
                }}
              >
                {recentBoardEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      borderLeft: "2px solid #FFB800",
                      background: "rgba(255, 184, 0, 0.05)",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#dfeaff" }}>
                      {event.description}
                    </div>
                    <div style={{ fontSize: 9, color: "#a8bbd6", marginTop: 2 }}>{event.date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Board News */}
          {recentBoardNews.length > 0 && (
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
                Press Coverage
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recentBoardNews.map((news) => (
                  <div
                    key={news.id}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(126, 169, 255, 0.15)",
                    }}
                  >
                    <div style={{ fontSize: 10, fontStyle: "italic", color: "#dfeaff" }}>
                      "{news.text}"
                    </div>
                    <div style={{ fontSize: 9, color: "#a8bbd6", marginTop: 4 }}>{news.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
