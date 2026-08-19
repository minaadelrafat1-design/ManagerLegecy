import { createFileRoute, Link } from "@tanstack/react-router";
import { useClubPlayers } from "@/state/store";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: "Academy — Manager Legacy" },
      {
        name: "description",
        content:
          "Youth academy: emerging prospects, potential ratings, intake report and development pathway for your club.",
      },
      { property: "og:title", content: "Academy — Manager Legacy" },
      {
        property: "og:description",
        content: "Track youth prospects, potential and the next intake.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcademyScreen,
});

const INTAKE = [
  {
    name: "Tobias Mensah",
    pos: "CM",
    age: 17,
    current: 54,
    potential: 79,
    note: "Composed deep playmaker",
  },
  {
    name: "Erik Haugen",
    pos: "CB",
    age: 18,
    current: 58,
    potential: 76,
    note: "Dominant in the air",
  },
  {
    name: "Rafa Duarte",
    pos: "RW",
    age: 16,
    current: 49,
    potential: 82,
    note: "Explosive one-v-one dribbler",
  },
];

function AcademyScreen() {
  const players = useClubPlayers();
  const prospects = players
    .filter((p) => p.age <= 23)
    .sort((a, b) => b.potential - b.overall - (a.potential - a.overall));
  const topPotential = Math.max(...INTAKE.map((i) => i.potential));

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
            DEVELOPMENT
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
            Academy
          </h1>
          <div style={{ fontSize: 16, color: "#a8bbd6", marginTop: 12 }}>
            Youth development · Intake 2027 · Top Potential{" "}
            <span style={{ color: "#f0c24b", fontWeight: 700 }}>{topPotential}</span>
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
        {/* STATS GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#a8bbd6",
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              New Talents
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#4fdbff" }}>{INTAKE.length}</div>
          </div>
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#a8bbd6",
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              U23 in Squad
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#7bffb8" }}>
              {prospects.length}
            </div>
          </div>
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "rgba(17, 30, 45, 0.8)",
              border: "1px solid rgba(126, 169, 255, 0.2)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#a8bbd6",
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Facilities
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#f0c24b" }}>Good</div>
          </div>
        </div>

        {/* LATEST INTAKE */}
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
            Latest Intake
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {INTAKE.map((y) => (
              <div
                key={y.name}
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "rgba(17, 30, 45, 0.8)",
                  border: "1px solid rgba(126, 169, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#061727",
                    background: "linear-gradient(135deg, #4fdbff, #7bffb8)",
                  }}
                >
                  {y.pos}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#edf8ff" }}>{y.name}</div>
                  <div style={{ fontSize: 11, color: "#a8bbd6", marginTop: 2 }}>
                    Age {y.age} · {y.note}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#4fdbff" }}>{y.current}</div>
                  <div style={{ fontSize: 10, color: "#f0c24b", marginTop: 2 }}>
                    → {y.potential}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* YOUNG SQUAD PLAYERS */}
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
            Young Squad Players
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prospects.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "rgba(17, 30, 45, 0.8)",
                  border: "1px solid rgba(126, 169, 255, 0.2)",
                  color: "#a8bbd6",
                  textAlign: "center",
                }}
              >
                No U23 players in the senior squad.
              </div>
            ) : (
              prospects.map((p) => (
                <Link
                  key={p.id}
                  to="/player/$playerId"
                  params={{ playerId: p.id }}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: 12,
                      background: "rgba(17, 30, 45, 0.8)",
                      border: "1px solid rgba(126, 169, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#edf8ff" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#a8bbd6", marginTop: 2 }}>
                        Age {p.age} · {p.pos} · {p.role}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#4fdbff" }}>
                        {p.overall}
                      </div>
                      <div style={{ fontSize: 9, color: "#f0c24b", marginTop: 2 }}>
                        → {p.potential}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* ACADEMY REPORT */}
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
            Academy Report
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Coaching quality rated Good — an upgrade would raise growth rates.",
              "Recruitment network strongest in Scandinavia and West Africa.",
              "Two prospects ready for a senior bench role this season.",
            ].map((note, i) => (
              <div
                key={i}
                style={{
                  padding: "12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(126, 169, 255, 0.15)",
                  fontSize: 12,
                  color: "#a8bbd6",
                  lineHeight: 1.5,
                }}
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
