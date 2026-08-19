/**
 * Player Profile Modal
 * ====================
 * Detailed player information view with full attributes, contract details, and actions.
 */

import type { Player, Club } from "@/state/types";
import { TMod } from "./ui-modern";

interface PlayerProfileModalProps {
  player: Player | null;
  club: Club | null;
  isOpen: boolean;
  isShortlisted?: boolean;
  onClose: () => void;
  onShortlist?: (add: boolean) => void;
  onApproach?: () => void;
}

export function PlayerProfileModal({
  player,
  club,
  isOpen,
  isShortlisted = false,
  onClose,
  onShortlist,
  onApproach,
}: PlayerProfileModalProps) {
  if (!isOpen || !player) return null;

  const getAttributeColor = (value: number): string => {
    if (value >= 85) return TMod.accentGreen;
    if (value >= 75) return TMod.accentBlue;
    if (value >= 65) return TMod.accentCyan;
    if (value >= 55) return TMod.textSecondary;
    return TMod.textTertiary;
  };

  const attributes = [
    { label: "Pace", value: player.pace ?? 0 },
    { label: "Shooting", value: player.shooting ?? 0 },
    { label: "Passing", value: player.passing ?? 0 },
    { label: "Dribbling", value: player.dribbling ?? 0 },
    { label: "Defence", value: player.defence ?? 0 },
    { label: "Physical", value: player.physical ?? 0 },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: TMod.bgSecondary,
          border: `1px solid ${TMod.borderMid}`,
          borderRadius: 12,
          maxWidth: 600,
          maxHeight: "90vh",
          overflowY: "auto",
          width: "90%",
          boxShadow: TMod.shadowXl,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px",
            borderBottom: `1px solid ${TMod.borderLight}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 900,
                color: TMod.textPrimary,
              }}
            >
              {player.name}
            </h2>
            <div style={{ fontSize: 13, color: TMod.textSecondary, marginTop: 4 }}>
              {player.pos} • {player.age} years old
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: TMod.textSecondary,
              fontSize: 24,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Key Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <div
              style={{
                background: `rgba(0,0,0,0.2)`,
                padding: "12px",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, color: TMod.textTertiary, marginBottom: 4 }}>OVERALL</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: getAttributeColor(player.overall ?? 0),
                }}
              >
                {player.overall ?? 0}
              </div>
            </div>
            <div
              style={{
                background: `rgba(0,0,0,0.2)`,
                padding: "12px",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, color: TMod.textTertiary, marginBottom: 4 }}>
                MARKET VALUE
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: TMod.accentGold,
                }}
              >
                {player.value ?? "€0"}
              </div>
            </div>
            <div
              style={{
                background: `rgba(0,0,0,0.2)`,
                padding: "12px",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, color: TMod.textTertiary, marginBottom: 4 }}>
                CONTRACT
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: TMod.accentCyan,
                }}
              >
                {player.contractYears ?? 0}y
              </div>
            </div>
          </div>

          {/* Club Information */}
          {club && (
            <div>
              <h3
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: TMod.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Current Club
              </h3>
              <div
                style={{
                  background: `rgba(0,0,0,0.2)`,
                  padding: "12px",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, color: TMod.textPrimary }}>{club.name}</div>
                <div style={{ fontSize: 11, color: TMod.textSecondary, marginTop: 4 }}>
                  League: {club.leagueId}
                </div>
              </div>
            </div>
          )}

          {/* Attributes */}
          <div>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 13,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Key Attributes
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {attributes.map((attr) => (
                <div key={attr.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: TMod.textSecondary }}>{attr.label}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: getAttributeColor(attr.value),
                      }}
                    >
                      {attr.value}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: `rgba(0,0,0,0.3)`,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${attr.value}%`,
                        background: getAttributeColor(attr.value),
                        boxShadow: `0 0 8px ${getAttributeColor(attr.value)}`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contract Details */}
          <div>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 13,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Contract Information
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div style={{ background: `rgba(0,0,0,0.2)`, padding: "10px", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: TMod.textTertiary, marginBottom: 2 }}>
                  SALARY
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TMod.accentGreen }}>
                  {player.salary ?? "€0"}
                </div>
              </div>
              <div style={{ background: `rgba(0,0,0,0.2)`, padding: "10px", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: TMod.textTertiary, marginBottom: 2 }}>
                  EXPIRES
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TMod.accentCyan }}>
                  {player.contractUntil ?? "TBD"}
                </div>
              </div>
            </div>
          </div>

          {/* Career Stats */}
          <div>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 13,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Career Overview
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
              }}
            >
              <div style={{ background: `rgba(0,0,0,0.2)`, padding: "10px", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: TMod.textTertiary, marginBottom: 2 }}>
                  NATIONALITY
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TMod.textPrimary }}>
                  {player.nationality ?? "Unknown"}
                </div>
              </div>
              <div style={{ background: `rgba(0,0,0,0.2)`, padding: "10px", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: TMod.textTertiary, marginBottom: 2 }}>
                  PERSONALITY
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: TMod.accentBlue,
                    textTransform: "capitalize",
                  }}
                >
                  {player.personality ?? "Not Specified"}
                </div>
              </div>
              <div style={{ background: `rgba(0,0,0,0.2)`, padding: "10px", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: TMod.textTertiary, marginBottom: 2 }}>
                  REPUTATION
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TMod.textPrimary }}>
                  {(player.reputation ?? 0).toFixed(0)}/100
                </div>
              </div>
              <div style={{ background: `rgba(0,0,0,0.2)`, padding: "10px", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: TMod.textTertiary, marginBottom: 2 }}>FORM</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TMod.accentGreen }}>
                  {(player.lastMatchRating ?? 0).toFixed(1)}/10
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 12,
              paddingTop: 12,
              borderTop: `1px solid ${TMod.borderLight}`,
            }}
          >
            <button
              onClick={() => {
                onShortlist?.(!isShortlisted);
              }}
              type="button"
              style={{
                flex: 1,
                padding: "12px 16px",
                border: `1px solid ${isShortlisted ? TMod.accentGreen : TMod.borderLight}`,
                background: isShortlisted ? `${TMod.accentGreen}20` : "transparent",
                color: isShortlisted ? TMod.accentGreen : TMod.textSecondary,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {isShortlisted ? "✓ Remove from Shortlist" : "★ Add to Shortlist"}
            </button>
            <button
              onClick={() => {
                onApproach?.();
                onClose();
              }}
              type="button"
              style={{
                flex: 1,
                padding: "12px 16px",
                border: `1px solid ${TMod.accentGold}`,
                background: `${TMod.accentGold}20`,
                color: TMod.accentGold,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              📞 Approach to Buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
