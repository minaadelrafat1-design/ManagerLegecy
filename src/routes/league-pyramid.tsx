import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import stadiumHero from "@/assets/stadium-hero.jpg";
import {
  useClubPlayers,
  useCurrentClub,
  useGameState,
  useLeagueTable,
  useNextFixture,
  useStartingXI,
} from "@/state/store";
import { TMod } from "@/components/ui-modern";

export const Route = createFileRoute("/league-pyramid")({
  head: () => ({
    meta: [
      { title: "League Pyramid — Manager Legacy" },
      { name: "description", content: "League pyramid layout matching the reference design." },
    ],
  }),
  component: LeaguePyramidScreen,
});

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{ padding: 4, borderRadius: 5, background: "rgba(0,0,0,0.08)", textAlign: "center" }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 800,
          color: "rgba(0,0,0,0.75)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#000", marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default function LeaguePyramidScreen() {
  const { state, dispatch } = useGameState();
  const navigate = useNavigate();
  const currentClub = useCurrentClub();
  const players = useClubPlayers();
  const startingXI = useStartingXI();
  const [selectedLeagueId, setSelectedLeagueId] = useState(currentClub.leagueId);
  const table = useLeagueTable(selectedLeagueId);
  const nextFixture = useNextFixture();
  const [activeTab, setActiveTab] = useState("CENTRAL");

  const availableLeagues = Object.values(state.leagues).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const selectedLeague = state.leagues[selectedLeagueId];

  const selectedPlayer = startingXI[0] ?? players[0];
  const avgOverall = Math.round(
    startingXI.reduce((sum, p) => sum + p.overall, 0) / Math.max(startingXI.length, 1),
  );

  // Get opponent team for next fixture
  const opponentClubId =
    nextFixture && nextFixture.homeClubId === currentClub.id
      ? nextFixture.awayClubId
      : nextFixture?.homeClubId;
  const opponentClub = opponentClubId ? state.clubs[opponentClubId] : null;

  const tabs = ["CENTRAL", "SQUAD", "TRANSFERS", "OFFICE"];

  // Navigation buttons with proper mappings
  const navButtons = [
    { label: "Back", destination: "/", icon: "←" },
    { label: "Select", destination: "/squad", icon: "👥" },
    { label: "Tutorials", destination: "/tactics", icon: "📋" },
    { label: "Messages", destination: "/transfers", icon: "✉" },
    { label: "Manage", destination: "/board", icon: "⚙" },
    { label: "Save", destination: null, action: "save", icon: "💾" },
  ];

  // Button handlers for actual game actions
  const handleButtonClick = (button: (typeof navButtons)[0]) => {
    if (button.action === "save") {
      dispatch({ type: "SAVE_GAME" });
      console.log("Game saved!");
    } else if (button.destination) {
      navigate({ to: button.destination });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${TMod.bgPrimary} 0%, ${TMod.bgSecondary} 100%)`,
        color: TMod.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        paddingBottom: 24,
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 16px" }}>
        {/* TOP HEADER WITH PLAYER INFO */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 0 12px",
            borderBottom: `2px solid ${TMod.borderMid}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Club logo placeholder */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: TMod.gradientBlue,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {currentClub.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: TMod.textPrimary }}>
                {selectedPlayer?.name || "Player"}
              </div>
              <div style={{ fontSize: 11, color: TMod.accentBlue }}>{currentClub.name}</div>
            </div>
          </div>

          {/* Rating Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: TMod.gradientGreen,
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 900,
              fontSize: 24,
              color: TMod.textPrimary,
              boxShadow: `0 4px 12px ${TMod.accentGreen}4D`,
            }}
          >
            {avgOverall || 80}
          </div>
        </header>

        {/* HORIZONTAL TABS AND ACTION BUTTONS */}
        <nav
          style={{
            display: "flex",
            gap: 12,
            padding: "12px 0",
            borderBottom: `2px solid ${TMod.borderMid}`,
            marginBottom: 16,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          {/* Left: Main Navigation Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? TMod.accentBlue : "transparent",
                  border: "none",
                  color: activeTab === tab ? TMod.textPrimary : TMod.accentBlue,
                  padding: "12px 32px",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderBottom: activeTab === tab ? `3px solid ${TMod.accentBlue}` : "none",
                  transition: "all 0.2s",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Right: Action Buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {navButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleButtonClick(btn)}
                style={{
                  border: `2px solid ${TMod.accentBlue}55`,
                  borderRadius: 6,
                  background: `${TMod.accentBlue}15`,
                  color: TMod.accentBlue,
                  padding: "8px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  opacity: 1,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${TMod.accentBlue}25`;
                  e.currentTarget.style.borderColor = TMod.accentCyan;
                  e.currentTarget.style.color = TMod.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${TMod.accentBlue}15`;
                  e.currentTarget.style.borderColor = `${TMod.accentBlue}55`;
                  e.currentTarget.style.color = TMod.accentBlue;
                }}
              >
                <span>{btn.icon}</span>
                {btn.label}
              </button>
            ))}
          </div>
        </nav>

        {/* MAIN 3-COLUMN LAYOUT */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr 300px",
            gap: 16,
            marginTop: 12,
          }}
        >
          {/* LEFT COLUMN - STATS/SCHEDULE */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                padding: 16,
                background: "rgba(255, 255, 255, 0.94)",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#0d1b2a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Advance
              </div>

              {/* Schedule Grid */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { day: "Thu", val: 29 },
                    { day: "Fri", val: 30 },
                    { day: "Sat", val: 1 },
                    { day: "Sun", val: 2 },
                  ].map((item) => (
                    <div key={item.day} style={{ textAlign: "center" }}>
                      <div
                        style={{ fontSize: 10, fontWeight: 700, color: "#0d1b2a", marginBottom: 4 }}
                      >
                        {item.day}
                      </div>
                      <div
                        style={{
                          padding: "8px 4px",
                          borderRadius: 4,
                          background: "rgba(33, 150, 243, 0.1)",
                          border: "1px solid rgba(33, 150, 243, 0.3)",
                          color: "#1976D2",
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional row */}
              <div style={{ marginTop: 12, fontSize: 10, fontWeight: 700, color: "#0d1b2a" }}>
                <div>Mon</div>
                <div
                  style={{
                    marginTop: 4,
                    padding: "8px 4px",
                    borderRadius: 4,
                    background: "rgba(33, 150, 243, 0.1)",
                    border: "1px solid rgba(33, 150, 243, 0.3)",
                    color: "#1976D2",
                    fontWeight: 900,
                  }}
                >
                  3
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER COLUMN - LARGE STADIUM/PLAYER IMAGE */}
          <main style={{ position: "relative" }}>
            <div
              style={{
                position: "relative",
                height: 480,
                borderRadius: 12,
                overflow: "hidden",
                border: "3px solid rgba(33, 150, 243, 0.5)",
                background: `linear-gradient(180deg, rgba(8,13,24,0.2), rgba(7,10,18,0.6)), url(${stadiumHero}) center/cover no-repeat`,
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(13,20,38,0.1), rgba(8,12,20,0.5))",
                }}
              />

              {nextFixture ? (
                <>
                  {/* vs Opponent Display */}
                  <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.8)",
                        marginBottom: 16,
                      }}
                    >
                      NEXT MATCH
                    </div>

                    {/* Home Team */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 24,
                        marginBottom: 24,
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #4CAF50, #45a049)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 32,
                            fontWeight: 900,
                            color: "#fff",
                            marginBottom: 8,
                          }}
                        >
                          {currentClub.name.charAt(0)}
                        </div>
                        <div
                          style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}
                        >
                          {currentClub.shortName || currentClub.name.substring(0, 3).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                          {nextFixture.venue === "H" ? "Home" : "Away"}
                        </div>
                      </div>

                      {/* VS */}
                      <div
                        style={{ fontSize: 24, fontWeight: 900, color: "rgba(255,255,255,0.6)" }}
                      >
                        VS
                      </div>

                      {/* Away Team */}
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #FF6F00, #E65100)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 32,
                            fontWeight: 900,
                            color: "#fff",
                            marginBottom: 8,
                          }}
                        >
                          {opponentClub?.name.charAt(0) || "?"}
                        </div>
                        <div
                          style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}
                        >
                          {opponentClub?.shortName ||
                            opponentClub?.name.substring(0, 3).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                          {nextFixture.venue === "A" ? "Home" : "Away"}
                        </div>
                      </div>
                    </div>

                    {/* Fixture Details */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                      {nextFixture.date} • Matchday {nextFixture.matchday}
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    textAlign: "center",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                    NO UPCOMING FIXTURE
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    All matches completed this season
                  </div>
                </div>
              )}

              {/* Bottom caption */}
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  right: 16,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.8)",
                  background: "rgba(0,0,0,0.3)",
                  padding: "8px 12px",
                  borderRadius: 6,
                  zIndex: 3,
                }}
              >
                ship: Wycombe Wanderers triumph! In the next season
              </div>
            </div>
          </main>

          {/* RIGHT COLUMN - STACKED INFO CARDS */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Card 1: Clickable league standings */}
            <div
              style={{
                padding: 14,
                background: "rgba(255, 255, 255, 0.94)",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.1)",
                minHeight: 140,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#0d1b2a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Classification
              </div>
              <select
                value={selectedLeagueId}
                onChange={(event) => setSelectedLeagueId(event.target.value)}
                aria-label="Select league standings"
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(25,118,210,0.35)",
                  background: "#f7fbff",
                  color: "#0d1b2a",
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
              <div style={{ marginTop: 12, color: "#1976D2", fontSize: 11, fontWeight: 900 }}>
                {selectedLeague?.name ?? "League standings"}
              </div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {table.map((row) => (
                  <button
                    key={row.clubId}
                    type="button"
                    onClick={() => setSelectedLeagueId(state.clubs[row.clubId]?.leagueId ?? selectedLeagueId)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      fontSize: 10,
                      color: "#0d1b2a",
                      background: row.clubId === currentClub.id ? "rgba(76,175,80,0.12)" : "transparent",
                      border: "none",
                      borderBottom: `1px solid rgba(0,0,0,0.08)`,
                      padding: "6px 2px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{row.position}</span>
                    <span style={{ fontWeight: 600 }}>
                      {state.clubs[row.clubId]?.shortName || "..."}
                    </span>
                    <span
                      style={{
                        fontWeight: 900,
                        color: row.clubId === currentClub.id ? "#4CAF50" : "#1976D2",
                      }}
                    >
                      {row.points}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card 2: Mailbox */}
            <div
              style={{
                padding: 14,
                background: "rgba(255, 255, 255, 0.94)",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.1)",
                minHeight: 120,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#0d1b2a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Mailbox
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: "#666" }}>No messages</div>
            </div>

            {/* Card 3: Stats */}
            <div
              style={{
                padding: 14,
                background: "rgba(255, 255, 255, 0.94)",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.1)",
                minHeight: 120,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#0d1b2a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Player Stats
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: "#666" }}>
                Individual player statistics
              </div>
            </div>

            {/* Card 4: No Notifications */}
            <div
              style={{
                padding: 14,
                background: "rgba(255, 255, 255, 0.94)",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.1)",
                minHeight: 100,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#0d1b2a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                No Notifications
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
