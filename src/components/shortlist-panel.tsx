/**
 * Shortlist Panel
 * ===============
 * Displays all shortlisted players with quick actions and persistence.
 */

import { TMod } from "./ui-modern";
import type { GameState, Player } from "@/state/types";
import type { TransferMarketRow } from "@/lib/transfer-market-filter";

interface ShortlistPanelProps {
  shortlistPlayerIds: string[];
  state: GameState;
  onRemove: (playerId: string) => void;
  onViewPlayer: (player: Player) => void;
  onClearAll: () => void;
  transferRows: TransferMarketRow[];
}

export function ShortlistPanel({
  shortlistPlayerIds,
  state,
  onRemove,
  onViewPlayer,
  onClearAll,
  transferRows,
}: ShortlistPanelProps) {
  const shortlistPlayers = shortlistPlayerIds
    .map((id) => state.players[id])
    .filter((p): p is Player => !!p);

  const getOverallColor = (overall: number): string => {
    if (overall >= 85) return TMod.accentGreen;
    if (overall >= 80) return TMod.accentBlue;
    if (overall >= 75) return TMod.accentCyan;
    return TMod.textSecondary;
  };

  return (
    <div
      style={{
        background: TMod.bgPanel,
        border: `1px solid ${TMod.borderLight}`,
        borderRadius: 12,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 12,
          borderBottom: `1px solid ${TMod.borderLight}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: TMod.textPrimary,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            ⭐ SHORTLIST
          </div>
          <div
            style={{
              fontSize: 11,
              color: TMod.textSecondary,
              marginTop: 2,
            }}
          >
            {shortlistPlayers.length} player{shortlistPlayers.length !== 1 ? "s" : ""}
          </div>
        </div>
        {shortlistPlayers.length > 0 && (
          <button
            onClick={onClearAll}
            type="button"
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: `1px solid ${TMod.accentRed}40`,
              background: `${TMod.accentRed}15`,
              color: TMod.accentRed,
              fontSize: 9,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Players List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {shortlistPlayers.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 120,
              color: TMod.textTertiary,
              fontSize: 12,
              textAlign: "center",
              padding: "20px",
            }}
          >
            No shortlisted players yet.
            <br />
            Click the ★ icon to add players.
          </div>
        ) : (
          shortlistPlayers.map((player) => {
            const transferListing = transferRows.find((r) => r.playerId === player.id);
            const club = player.clubId ? state.clubs[player.clubId] : undefined;
            const overallColor = getOverallColor(player.overall ?? 0);

            return (
              <div
                key={player.id}
                style={{
                  background: `rgba(0,0,0,0.2)`,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 8,
                  padding: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => onViewPlayer(player)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: TMod.textPrimary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {player.name}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: TMod.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {player.pos} • {club?.name ?? "Free Agent"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: overallColor,
                      minWidth: 24,
                      textAlign: "right",
                    }}
                  >
                    {player.overall ?? 0}
                  </div>
                </div>

                {/* Quick stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    fontSize: 9,
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div style={{ color: TMod.textTertiary, marginBottom: 1 }}>Age</div>
                    <div style={{ color: TMod.accentCyan, fontWeight: 600 }}>{player.age} yrs</div>
                  </div>
                  <div>
                    <div style={{ color: TMod.textTertiary, marginBottom: 1 }}>Value</div>
                    <div style={{ color: TMod.accentGold, fontWeight: 600 }}>
                      {player.value ?? "€0"}
                    </div>
                  </div>
                </div>

                {/* Status badge and remove button */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {transferListing && (
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 3,
                        background:
                          transferListing.status === "bid"
                            ? `${TMod.accentGold}20`
                            : `${TMod.accentGreen}20`,
                        color:
                          transferListing.status === "bid" ? TMod.accentGold : TMod.accentGreen,
                        fontSize: 8,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {transferListing.status}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(player.id);
                    }}
                    type="button"
                    style={{
                      padding: "3px 6px",
                      borderRadius: 3,
                      border: `1px solid ${TMod.accentRed}40`,
                      background: "transparent",
                      color: TMod.accentRed,
                      fontSize: 8,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    REMOVE
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
