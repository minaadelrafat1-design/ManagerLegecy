import { createFileRoute } from "@tanstack/react-router";
import { useCurrentClub, useGameState } from "@/state/store";

export const Route = createFileRoute("/fans")({
  head: () => ({
    meta: [
      { title: "Fans — Manager Legacy" },
      {
        name: "description",
        content:
          "Fan approval, recent reactions, and crowd atmosphere. Keep fans happy through winning and entertaining football.",
      },
    ],
  }),
  component: FansScreen,
});

function FansScreen() {
  const { state } = useGameState();
  const club = useCurrentClub();
  const fans = state.fans ?? { approval: 50, attendanceAvg: 30000 };

  const approval = fans.approval ?? 50;
  const morale = 50; // Fans type doesn't have morale property

  const recentFanEvents = (state.events ?? [])
    .filter(
      (e) =>
        e.type === "PLAYER_RETIRED" ||
        e.type === "TRANSFER_COMPLETED" ||
        e.type === "YOUTH_GENERATED",
    )
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 8);

  const recentFanNews = (state.news ?? [])
    .filter((n) => n.tag === "fans" || n.tag === "match")
    .sort((a, b) => (b.time > a.time ? 1 : -1))
    .slice(0, 3);

  const approvalColor =
    approval >= 75
      ? "#7bffb8"
      : approval >= 55
        ? "#f0c24b"
        : approval >= 35
          ? "#FFB800"
          : "#ff6b6b";

  const moraleColor =
    morale >= 75 ? "#7bffb8" : morale >= 55 ? "#f0c24b" : morale >= 35 ? "#FFB800" : "#ff6b6b";

  const approvalLabel =
    approval >= 80
      ? "Ecstatic"
      : approval >= 65
        ? "Happy"
        : approval >= 50
          ? "Content"
          : approval >= 35
            ? "Frustrated"
            : approval >= 20
              ? "Angry"
              : "Furious";

  const moraleLabel =
    morale >= 75
      ? "Excellent"
      : morale >= 60
        ? "Good"
        : morale >= 50
          ? "Fair"
          : morale >= 35
            ? "Declining"
            : "Terrible";

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
            COMMUNITY
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
            Fans & Atmosphere
          </h1>
          <div style={{ fontSize: 16, color: "#a8bbd6", marginTop: 12 }}>
            {club.name} · Crowd Reaction · Approval{" "}
            <span style={{ color: approvalColor, fontWeight: 700 }}>{Math.round(approval)}%</span>
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
        {/* FAN APPROVAL & MORALE */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Approval */}
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
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
              Fan Approval
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#a8bbd6",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Approval Rating
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: approvalColor }}>
                {Math.round(approval)}%
              </div>
            </div>
            <div
              style={{
                height: 8,
                background: "rgba(126, 169, 255, 0.1)",
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${Math.min(approval, 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${approvalColor}, ${approvalColor}aa)`,
                }}
              />
            </div>
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(126, 169, 255, 0.15)",
              }}
            >
              <div style={{ fontSize: 10, color: "#a8bbd6", marginBottom: 2 }}>Mood</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: approvalColor }}>
                {approvalLabel}
              </div>
            </div>
          </div>

          {/* Morale */}
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
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
              Crowd Morale
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#a8bbd6",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Morale Level
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: moraleColor }}>
                {Math.round(morale)}%
              </div>
            </div>
            <div
              style={{
                height: 8,
                background: "rgba(126, 169, 255, 0.1)",
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${Math.min(morale, 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${moraleColor}, ${moraleColor}aa)`,
                }}
              />
            </div>
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(126, 169, 255, 0.15)",
              }}
            >
              <div style={{ fontSize: 10, color: "#a8bbd6", marginBottom: 2 }}>Atmosphere</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: moraleColor }}>{moraleLabel}</div>
            </div>
          </div>
        </div>

        {/* RECENT REACTIONS */}
        {recentFanEvents.length > 0 && (
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
              Recent Crowd Reactions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentFanEvents.map((event) => (
                <div
                  key={event.id}
                  style={{
                    padding: "12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(126, 169, 255, 0.15)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "#edf8ff", fontWeight: 600 }}>{event.description}</div>
                  <div style={{ fontSize: 10, color: "#a8bbd6", marginTop: 3 }}>{event.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAN NEWS */}
        {recentFanNews.length > 0 && (
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
              Press Coverage
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentFanNews.map((news) => (
                <div
                  key={news.id}
                  style={{
                    padding: "12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(126, 169, 255, 0.15)",
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: "#dce9ff", fontStyle: "italic" }}>{news.text}</div>
                  <div style={{ fontSize: 10, color: "#a8bbd6", marginTop: 3 }}>{news.time}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
