import { Link } from "@tanstack/react-router";
import { useCurrentClub, useGameState } from "@/state/store";
import { T } from "./ui";
import { AudioSettingsPanel } from "./AudioSettingsPanel";

export function TopNav() {
  const { state } = useGameState();
  const currentClub = useCurrentClub();
  const league = state.leagues[currentClub.leagueId];

  return (
    <nav
      className="ml-glass"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: "12px 20px 14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: T.ink,
                background: `linear-gradient(160deg, #4FDBFF, #1E5BC6)`,
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 10px 22px -16px rgba(58,160,255,0.9)",
              }}
            >
              ML
            </span>
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: T.text,
                  lineHeight: 1.15,
                }}
              >
                Manager Legacy
              </span>
              <span className="ml-eyebrow" style={{ display: "block", marginTop: 2 }}>
                {currentClub.name} · {league?.season ?? state.time.season}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <AudioSettingsPanel />
            <Link
              to="/manager-profile"
              className="ml-nav-link"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: T.textSec,
                textDecoration: "none",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "7px 10px",
                whiteSpace: "nowrap",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              Profile
            </Link>
            <Link
              to="/new-career"
              className="ml-nav-link"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: T.textSec,
                textDecoration: "none",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "7px 10px",
                whiteSpace: "nowrap",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              New Career
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Club", value: currentClub.name },
            { label: "Season", value: league?.season ?? state.time.season },
            { label: "Reputation", value: `${state.manager.reputation ?? 50}` },
            { label: "Board", value: `${state.board.confidence ?? 50}%` },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 9px",
                border: `1px solid ${T.border}`,
                borderRadius: 999,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.text,
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
