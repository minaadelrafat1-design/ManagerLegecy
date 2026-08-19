/**
 * Transfer Market Player Card
 * ===========================
 * Displays essential player information at a glance with quick actions.
 */

import { TMod } from "./ui-modern";
import type { Club, Player } from "@/state/types";
import type { TransferMarketRow } from "@/lib/transfer-market-filter";

interface TransferPlayerCardProps {
  row: TransferMarketRow;
  isShortlisted?: boolean;
  onApproach?: () => void;
  onShortlist?: (add: boolean) => void;
  onViewProfile?: () => void;
  canApproach?: boolean;
}

export function TransferPlayerCard({
  row,
  isShortlisted = false,
  onApproach,
  onShortlist,
  onViewProfile,
  canApproach = true,
}: TransferPlayerCardProps) {
  const getRatingColor = (overall: number): string => {
    if (overall >= 85) return TMod.accentGreen;
    if (overall >= 80) return TMod.accentBlue;
    if (overall >= 75) return TMod.accentCyan;
    if (overall >= 70) return TMod.textSecondary;
    return TMod.textTertiary;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "new":
        return TMod.accentGreen;
      case "interested":
        return TMod.accentCyan;
      case "bid":
        return TMod.accentGold;
      case "agreed":
        return TMod.accentGreen;
      case "rejected":
        return TMod.accentRed;
      default:
        return TMod.textSecondary;
    }
  };

  const ratingColor = getRatingColor(row.overall);

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${TMod.bgSecondary}, ${TMod.bgTertiary})`,
        border: `1px solid ${isShortlisted ? TMod.borderAccent : TMod.borderLight}`,
        borderRadius: 12,
        padding: "14px",
        transition: "all 0.25s ease",
        cursor: onViewProfile ? "pointer" : "default",
        position: "relative",
        boxShadow: isShortlisted ? `0 0 12px ${TMod.accentGreen}40` : TMod.shadowSm,
      }}
      onClick={onViewProfile}
    >
      {/* Shortlist indicator */}
      {isShortlisted && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: TMod.accentGreen,
            color: TMod.bgPrimary,
            borderRadius: 50,
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          ⭐
        </div>
      )}

      {/* Main info row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: TMod.textPrimary,
              marginBottom: 2,
            }}
          >
            {row.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: TMod.textSecondary,
              marginBottom: 6,
            }}
          >
            {row.position} • {row.age} yrs • {row.clubName}
          </div>

          {/* Key stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
              fontSize: 11,
            }}
          >
            <div>
              <div style={{ color: TMod.textTertiary, marginBottom: 2 }}>OVR</div>
              <div style={{ color: ratingColor, fontWeight: 700, fontSize: 13 }}>{row.overall}</div>
            </div>
            <div>
              <div style={{ color: TMod.textTertiary, marginBottom: 2 }}>Age</div>
              <div style={{ color: TMod.accentCyan, fontWeight: 700 }}>{row.age}</div>
            </div>
            <div>
              <div style={{ color: TMod.textTertiary, marginBottom: 2 }}>Value</div>
              <div style={{ color: TMod.accentGold, fontWeight: 700, fontSize: 11 }}>
                {row.valueFormatted}
              </div>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            background: `${getStatusColor(row.status)}20`,
            border: `1px solid ${getStatusColor(row.status)}`,
            fontSize: 9,
            fontWeight: 700,
            color: getStatusColor(row.status),
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          {row.status}
        </div>
      </div>

      {/* Personality tag if present */}
      {row.personality && (
        <div
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: 4,
            background: `${TMod.accentBlue}20`,
            border: `1px solid ${TMod.accentBlue}40`,
            color: TMod.accentBlue,
            fontSize: 9,
            fontWeight: 600,
            marginBottom: 10,
            textTransform: "capitalize",
          }}
        >
          {row.personality}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShortlist?.(!isShortlisted);
          }}
          type="button"
          style={{
            flex: 1,
            padding: "8px 12px",
            border: `1px solid ${isShortlisted ? TMod.accentGreen : TMod.borderLight}`,
            background: isShortlisted ? `${TMod.accentGreen}20` : "transparent",
            color: isShortlisted ? TMod.accentGreen : TMod.textSecondary,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {isShortlisted ? "✓ Shortlisted" : "★ Shortlist"}
        </button>

        {canApproach && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApproach?.();
            }}
            type="button"
            style={{
              flex: 1,
              padding: "8px 12px",
              border: `1px solid ${TMod.accentGold}`,
              background: `${TMod.accentGold}20`,
              color: TMod.accentGold,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            📞 Approach
          </button>
        )}
      </div>
    </div>
  );
}
