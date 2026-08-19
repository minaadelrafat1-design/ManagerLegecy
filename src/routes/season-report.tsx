import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TMod } from "@/components/ui-modern";
import { useGameState } from "@/state/store";

export const Route = createFileRoute("/season-report")({
  head: () => ({
    meta: [
      { title: "End-of-Season Report — Manager Legacy" },
      { name: "description", content: "Review the completed season at your club." },
    ],
  }),
  component: SeasonReportScreen,
});

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: TMod.bgTertiary, border: `1px solid ${TMod.borderLight}`, borderRadius: 8, padding: 14 }}>
      <div style={{ color: TMod.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: TMod.textPrimary, fontSize: 24, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: TMod.bgPanel, border: `1px solid ${TMod.borderMid}`, borderRadius: 12, padding: 20 }}>
      <h2 style={{ color: TMod.accentGreen, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

function SeasonReportScreen() {
  const { state } = useGameState();
  const report = state.seasonReport;

  if (!report) {
    return (
      <main style={{ minHeight: "100vh", background: TMod.bgPrimary, color: TMod.textPrimary, padding: 32 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h1 style={{ fontSize: 42, fontWeight: 900 }}>End-of-Season Report</h1>
          <p style={{ color: TMod.textSecondary, marginTop: 12 }}>The report will appear after the final fixture of the season.</p>
          <Link to="/" style={{ display: "inline-block", color: TMod.accentCyan, marginTop: 24 }}>Back to Manager HQ</Link>
        </div>
      </main>
    );
  }

  const { overview, squad, transfers, finances, manager } = report;
  return (
    <main style={{ minHeight: "100vh", background: TMod.bgPrimary, color: TMod.textPrimary, padding: "28px 20px 56px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ borderBottom: `1px solid ${TMod.borderMid}`, paddingBottom: 22, marginBottom: 22 }}>
          <div style={{ color: TMod.accentGreen, fontSize: 12, fontWeight: 900, letterSpacing: "0.18em" }}>SEASON {report.season}</div>
          <h1 style={{ fontSize: 48, fontWeight: 900, marginTop: 8 }}>End-of-Season Report</h1>
          <p style={{ color: TMod.textSecondary, marginTop: 8 }}>{report.clubName} · {report.managerName} · {report.tier}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          <Metric label="League Finish" value={overview.leaguePosition ? `#${overview.leaguePosition}` : "-"} />
          <Metric label="Points" value={overview.points} />
          <Metric label="Record" value={`${overview.wins}-${overview.draws}-${overview.losses}`} />
          <Metric label="Goal Difference" value={overview.goalDifference > 0 ? `+${overview.goalDifference}` : overview.goalDifference} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <Section title="Season Overview">
            <p>{overview.leagueName ?? "League campaign"}: {overview.goalsFor} goals for, {overview.goalsAgainst} against.</p>
            <p style={{ color: TMod.textSecondary, marginTop: 8 }}>{overview.totalMatches} league matches completed.</p>
          </Section>
          <Section title="Competitions">
            {report.competitions.map((competition) => <p key={competition.name} style={{ marginBottom: 8 }}>{competition.name}: <strong>{competition.status}</strong>{competition.standing ? ` · ${competition.standing}${competition.standing === 1 ? "st" : "th"}` : ""}</p>)}
          </Section>
          <Section title="Squad">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Metric label="Players" value={squad.players} /><Metric label="Average Rating" value={squad.averageRating} /><Metric label="Starters" value={squad.starters} /><Metric label="U21 Players" value={squad.youthPlayers} />
            </div>
            {squad.topPerformer && <p style={{ color: TMod.textSecondary, marginTop: 12 }}>Top performer: <strong style={{ color: TMod.textPrimary }}>{squad.topPerformer}</strong></p>}
            {squad.topScorer && <p style={{ color: TMod.textSecondary, marginTop: 8 }}>Top scorer: <strong style={{ color: TMod.textPrimary }}>{squad.topScorer.name}</strong> · {squad.topScorer.goals} goals</p>}
            {squad.topAssists && <p style={{ color: TMod.textSecondary, marginTop: 8 }}>Top assists: <strong style={{ color: TMod.textPrimary }}>{squad.topAssists.name}</strong> · {squad.topAssists.assists} assists</p>}
          </Section>
          <Section title="Transfers">
            <p>{transfers.arrivals} arrivals · {transfers.departures} departures · {transfers.spending.toLocaleString()} spent.</p>
            <p style={{ color: TMod.textSecondary, marginTop: 8 }}>{transfers.interested} remained under consideration.</p>
          </Section>
          <Section title="Finances">
            <p>Season net: <strong>{finances.netResult.toLocaleString()}</strong></p>
            <p style={{ color: TMod.textSecondary, marginTop: 8 }}>Revenue {finances.revenue.toLocaleString()} · Expenses {finances.expenses.toLocaleString()}</p>
            <p style={{ color: TMod.textSecondary, marginTop: 8 }}>Matchday {finances.matchdayIncome.toLocaleString()} · Transfer income {finances.transferIncome.toLocaleString()} · Wages {finances.wages.toLocaleString()}</p>
            <p style={{ color: TMod.accentGold, marginTop: 8 }}>Financial position: {finances.status}</p>
          </Section>
          <Section title="Manager Assessment">
            <p>{manager.tier} season · board confidence {manager.boardConfidence}.</p>
            <p style={{ color: TMod.textSecondary, marginTop: 8 }}>Credit {manager.creditDelta >= 0 ? "+" : ""}{manager.creditDelta} · Reputation {manager.reputationDelta >= 0 ? "+" : ""}{manager.reputationDelta}</p>
          </Section>
          <Section title="Highlights">
            {report.highlights.map((highlight) => <p key={highlight} style={{ marginBottom: 10 }}>• {highlight}</p>)}
          </Section>
        </div>
      </div>
    </main>
  );
}
