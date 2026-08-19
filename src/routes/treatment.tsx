import { createFileRoute, Link } from "@tanstack/react-router";
import { T, Card, SectionHeader, StatusBadge, StatTile, Divider } from "@/components/ui";
import { ScreenHeader, FitnessRing, MiniMeter, ratingColor } from "@/components/squad-bits";
import { useClubPlayers, useCurrentClub, useGameState } from "@/state/store";

export const Route = createFileRoute("/treatment")({
  head: () => ({
    meta: [
      { title: "Treatment Room — Manager Legacy" },
      {
        name: "description",
        content:
          "Medical centre: injury list, estimated return dates, recovery progress and players at risk in your squad.",
      },
      { property: "og:title", content: "Treatment Room — Manager Legacy" },
      {
        property: "og:description",
        content: "Injury list, recovery progress and fitness risks for your squad.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TreatmentScreen,
});

const INJURY_DETAIL: Record<string, { issue: string; weeks: number; recovery: number }> = {};

function detailFor(id: string, seed: number) {
  const cached = INJURY_DETAIL[id];
  if (cached) return cached;
  const issues = [
    "Hamstring strain",
    "Ankle sprain",
    "Knee knock",
    "Calf tightness",
    "Groin strain",
  ];
  const d = {
    issue: issues[seed % issues.length]!,
    weeks: (seed % 5) + 1,
    recovery: 25 + ((seed * 17) % 60),
  };
  INJURY_DETAIL[id] = d;
  return d;
}

function TreatmentScreen() {
  const { state } = useGameState();
  const currentClub = useCurrentClub();
  const league = state.leagues[currentClub.leagueId];
  const players = useClubPlayers();
  const injured = players.filter((p) => p.status === "injured");
  const atRisk = players
    .filter((p) => p.status !== "injured" && p.fitness < 78)
    .sort((a, b) => a.fitness - b.fitness);
  const fullyFit = players.filter((p) => p.status !== "injured" && p.fitness >= 90).length;

  return (
    <div className="ml-screen-pad-bottom" style={{ minHeight: "100vh", background: T.bg }}>
      <ScreenHeader
        title="Treatment Room"
        subtitle={`Medical centre · ${league?.matchday ? `Matchday ${league.matchday}` : `Day ${state.time.day}`}`}
        backTo="/"
        right={
          <div style={{ textAlign: "right" }}>
            <div
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: T.textMuted }}
            >
              OUT
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.red, letterSpacing: "-0.03em" }}>
              {injured.length}
            </div>
          </div>
        }
      />

      <div
        style={{
          padding: "14px 20px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
        }}
      >
        <StatTile label="Injured" value={String(injured.length)} color={T.red} />
        <StatTile label="At risk" value={String(atRisk.length)} color={T.orange} />
        <StatTile label="Fully fit" value={String(fullyFit)} color={T.green} />
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <SectionHeader title="Injury List" />
        {injured.length === 0 ? (
          <Card>
            <span style={{ fontSize: 13, color: T.textSec }}>
              No injuries — a clean bill of health.
            </span>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {injured.map((p, i) => {
              const d = detailFor(p.id, i + p.number);
              return (
                <Link
                  key={p.id}
                  to="/player/$playerId"
                  params={{ playerId: p.id }}
                  style={{ textDecoration: "none" }}
                >
                  <Card style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FitnessRing value={p.fitness} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 10.5, color: T.textSec, marginTop: 3 }}>
                          {p.pos} · {d.issue}
                        </div>
                      </div>
                      <StatusBadge status="injured" />
                    </div>
                    <Divider />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            color: T.textMuted,
                            marginBottom: 5,
                          }}
                        >
                          RECOVERY
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: "rgba(255,255,255,0.08)",
                            borderRadius: 2,
                          }}
                        >
                          <div
                            style={{
                              width: `${d.recovery}%`,
                              height: "100%",
                              background: T.orange,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.orange }}>
                        {d.weeks} {d.weeks === 1 ? "week" : "weeks"} out
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <SectionHeader title="Fitness Risk" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {atRisk.map((p) => (
            <Card
              key={p.id}
              style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}
            >
              <FitnessRing value={p.fitness} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: T.textSec, marginTop: 2 }}>{p.role}</div>
              </div>
              <MiniMeter label="Cond" value={p.fitness} width={44} />
              <span style={{ fontSize: 14, fontWeight: 800, color: ratingColor(p.overall) }}>
                {p.overall}
              </span>
            </Card>
          ))}
          {atRisk.length === 0 && (
            <Card>
              <span style={{ fontSize: 13, color: T.textSec }}>
                Every available player is above 78% condition.
              </span>
            </Card>
          )}
        </div>
      </div>

      <div style={{ padding: "22px 20px 0" }}>
        <SectionHeader title="Medical Staff Notes" />
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Rotate high-mileage midfielders for the midweek cup tie.",
            "Extra recovery session scheduled Sunday morning.",
            "Physio recommends reduced sprint load for players under 70% condition.",
          ].map((n) => (
            <div
              key={n}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${T.border}`,
                fontSize: 12.5,
                color: T.textSec,
                lineHeight: 1.45,
              }}
            >
              {n}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
