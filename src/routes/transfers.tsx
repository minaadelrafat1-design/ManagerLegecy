import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback } from "react";
import { TMod, ScreenHeader, MetricCard } from "@/components/ui-modern";
import { parseMoney } from "@/state/finance";
import type { NegotiationSession, Player, TransferListing } from "@/state/types";
import { useGameState } from "@/state/store";
import { getTransferWindowStatus } from "@/state/calendar";
import { filterVisibleNegotiations, filterVisibleTransferEvents } from "@/state/transfer-visibility";
import {
  buildTransferMarketRows,
  getFilteredTransferMarketRows,
  createDefaultFilters,
  type TransferMarketFilters,
  type TransferMarketRow,
} from "@/lib/transfer-market-filter";
import { TransferFilterPanel } from "@/components/transfer-filter-panel";
import { TransferPlayerCard } from "@/components/transfer-player-card";
import { PlayerProfileModal } from "@/components/player-profile-modal";

export { buildTransferMarketRows } from "@/lib/transfer-market-filter";

export function createTransferOfferForListing(
  player: Player | undefined,
  listing: TransferListing,
  buyerClubId: string,
) {
  const marketValue = Math.max(player?.marketValue ?? 500_000, 500_000);
  const fee = Math.max(750_000, Math.round(marketValue * (listing.loan ? 0.18 : 0.72)));
  const salaryWeekly = Math.max(
    12_000,
    Math.round(parseMoney(player?.salary ?? "€12,000 / wk") * (player ? 1.05 : 1)),
  );
  const years = Math.min(5, Math.max(2, player && player.age < 24 ? 4 : 3));
  const signingBonus = Math.round(fee * 0.08);

  return {
    fee,
    salaryWeekly,
    years,
    signingBonus,
    guaranteedStarts: true,
    releaseClause: listing.releaseClause ? parseMoney(listing.releaseClause) : null,
    loan: Boolean(listing.loan),
    loanDurationWeeks: listing.loanDurationWeeks ?? 12,
    buyerClubId,
  };
}

export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Transfers — Manager Legacy" },
      { name: "description", content: "Discover, filter, and negotiate transfers with advanced tools." },
      { property: "og:title", content: "Transfers — Manager Legacy" },
      { property: "og:description", content: "Professional transfer market discovery and management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransfersScreen,
});

function TransfersScreen() {
  const { state, dispatch } = useGameState();
  const navigate = useNavigate();

  // Filters and UI state: keep draft changes local until the user explicitly applies them.
  const [draftFilters, setDraftFilters] = useState<TransferMarketFilters>(createDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<TransferMarketFilters>(createDefaultFilters());
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const applyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setHasAppliedFilters(true);
  }, [draftFilters]);

  const availablePositions = useMemo(() => {
    const positions = new Set(
      Object.values(state.players ?? {})
        .filter((player): player is typeof player & { pos: string } => Boolean(player?.pos))
        .map((player) => player.pos),
    );
    return Array.from(positions).sort();
  }, [state.players]);

  const availableClubs = useMemo(
    () => Object.values(state.clubs ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [state.clubs],
  );

  const availablePersonalities = useMemo(() => {
    const personalities = new Set(
      Object.values(state.players ?? {})
        .map((player) => player?.personality)
        .filter((personality): personality is string => Boolean(personality)),
    );
    return Array.from(personalities).sort();
  }, [state.players]);

  const filteredRows = useMemo(() => {
    if (!hasAppliedFilters) return [];
    return getFilteredTransferMarketRows(state, appliedFilters).slice(0, 250);
  }, [state, appliedFilters, hasAppliedFilters]);

  const allMarketRows = useMemo(() => {
    if (!hasAppliedFilters) return [];
    return getFilteredTransferMarketRows(state, appliedFilters).slice(0, 250);
  }, [state, appliedFilters, hasAppliedFilters]);

  // Shortlist management with persistent state
  const shortlistPlayerIds = state.shortlistPlayerIds ?? [];
  const isPlayerShortlisted = useCallback(
    (playerId: string) => shortlistPlayerIds.includes(playerId),
    [shortlistPlayerIds],
  );

  const handleAddToShortlist = useCallback((playerId: string) => {
    dispatch({ type: "ADD_TO_SHORTLIST", playerId });
  }, [dispatch]);

  const handleRemoveFromShortlist = useCallback((playerId: string) => {
    dispatch({ type: "REMOVE_FROM_SHORTLIST", playerId });
  }, [dispatch]);

  const handleToggleShortlist = useCallback(
    (playerId: string, add: boolean) => {
      if (add) {
        handleAddToShortlist(playerId);
      } else {
        handleRemoveFromShortlist(playerId);
      }
    },
    [handleAddToShortlist, handleRemoveFromShortlist],
  );

  const handleClearShortlist = useCallback(() => {
    dispatch({ type: "CLEAR_SHORTLIST" });
  }, [dispatch]);

  const handleAcceptContractSession = useCallback(
    (session: NegotiationSession) => {
      const last = session.entries[session.entries.length - 1];
      if (!last) return;
      const offer = {
        salaryWeekly: last.offer.salaryWeekly ?? 10000,
        years: last.offer.years ?? 2,
        signingBonus: last.offer.signingBonus ?? 0,
        guaranteedStarts: last.offer.guaranteedStarts ?? false,
      };
      dispatch({ type: "ACCEPT_CONTRACT_SESSION", sessionId: session.id, offer });
    },
    [dispatch],
  );

  // Transfer actions
  const handleApproachPlayer = useCallback(
    (row: TransferMarketRow) => {
      if (!row.listing.playerId) return;

      const offer = createTransferOfferForListing(row.player, row.listing, state.currentClub.id);
      dispatch({
        type: "CREATE_NEGOTIATION",
        buyerClubId: state.currentClub.id,
        sellerClubId: row.listing.sellerClubId ?? "free-agent",
        playerId: row.listing.playerId,
        offer,
        message: `Approach ${row.name} with a firm opening bid.`,
        negotiationType: "transfer",
      });
    },
    [state.currentClub.id, dispatch],
  );

  const handleViewPlayer = useCallback((player: Player) => {
    setSelectedPlayer(player);
    setShowProfileModal(true);
  }, []);

  // Transfer window and statistics
  const transferWindow = useMemo(
    () => getTransferWindowStatus(state.time.date, String(state.time.season)),
    [state.time.date, state.time.season],
  );

  const activeNegotiations = useMemo(
    () => filterVisibleNegotiations(state, state.currentClub.id).filter((session) => session.status === "open"),
    [state, state.currentClub.id],
  );

  const transferEvents = useMemo(
    () =>
      filterVisibleTransferEvents(state, state.currentClub.id, shortlistPlayerIds)
        .sort((a, b) => (b.date > a.date ? 1 : -1))
        .slice(0, 8),
    [state, shortlistPlayerIds],
  );

  const selectedPlayerClub = selectedPlayer?.clubId ? (state.clubs[selectedPlayer.clubId] ?? null) : null;

  return (
    <>
      <ScreenHeader
        breadcrumb="SQUAD MANAGEMENT"
        title="Transfer Market"
        subtitle={`${allMarketRows.length} available players`}
        stats={[
          { label: "Budget", value: state.finances.transferBudget || "€0" },
          { label: "Squad Value", value: state.finances.squadValue || "€0" },
          { label: "Negotiations", value: activeNegotiations.length },
          { label: "Window", value: transferWindow.isOpen ? "OPEN" : "CLOSED" },
        ]}
      />

      <div style={{ background: TMod.bgPrimary, color: TMod.textPrimary, minHeight: "100vh", paddingBottom: 40 }}>
        {/* Stats Cards */}
        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            padding: "32px 32px 0",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <MetricCard label="Transfer Budget" value={state.finances.transferBudget || "€0"} variant="success" />
          <MetricCard label="Squad Value" value={state.finances.squadValue || "€0"} variant="default" />
          <MetricCard label="Open Negotiations" value={activeNegotiations.length} variant="warning" />
          <MetricCard
            label="Transfer Window"
            value={transferWindow.isOpen ? "OPEN" : "CLOSED"}
            variant={transferWindow.isOpen ? "success" : "default"}
          />
        </div>

        {/* Main Content */}
        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            padding: "0 32px",
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: 24,
          }}
        >
        {/* Market Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Filter Panel */}
          <TransferFilterPanel
            filters={draftFilters}
            onFiltersChange={setDraftFilters}
            onApplyFilters={applyFilters}
            availablePositions={availablePositions}
            availableClubs={availableClubs}
            availablePersonalities={availablePersonalities}
            resultCount={filteredRows.length}
          />

          {/* Player Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {filteredRows.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#a8bbd6",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                  No players found matching your filters
                </div>
                <div style={{ fontSize: 13 }}>
                  Try adjusting your criteria to find more options
                </div>
              </div>
            ) : (
              filteredRows.map((row) => {
                const isShortlisted = isPlayerShortlisted(row.playerId ?? "");
                // Free agents are valid targets too; the negotiation engine routes
                // them directly to the player/agent stage.
                const canApproach = !!row.listing.playerId;

                return (
                  <TransferPlayerCard
                    key={row.id}
                    row={row}
                    isShortlisted={isShortlisted}
                    onApproach={() => handleApproachPlayer(row)}
                    onShortlist={(add) =>
                      row.playerId && handleToggleShortlist(row.playerId, add)
                    }
                    onViewProfile={() => row.player && handleViewPlayer(row.player)}
                    canApproach={canApproach}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "fit-content", position: "sticky", top: 200 }}>
          {/* Shortlist Panel */}
          <div style={{ background: TMod.bgPanel, border: `1px solid ${TMod.borderLight}`, borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: TMod.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
              Shortlist
            </div>
            {shortlistPlayerIds.length === 0 ? (
              <div style={{ fontSize: 12, color: TMod.textSecondary, lineHeight: 1.6 }}>
                No players shortlisted yet. Add favorites to compare.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {allMarketRows
                    .filter((r) => shortlistPlayerIds.includes(r.playerId ?? ""))
                    .slice(0, 8)
                    .map((row) => (
                      <div
                        key={row.id}
                        style={{
                          padding: "10px 10px 8px",
                          background: TMod.bgSecondary,
                          border: `1px solid ${TMod.borderLight}`,
                          borderRadius: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: TMod.textPrimary }}>
                            {row.name}
                          </div>
                          <div style={{ fontSize: 9, color: TMod.textTertiary, marginTop: 2 }}>
                            {row.player?.pos ?? "N/A"}
                          </div>
                        </div>
                        <button
                          onClick={() => row.playerId && handleRemoveFromShortlist(row.playerId)}
                          style={{
                            background: "none",
                            border: "none",
                            color: TMod.accentRed,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                </div>
                {shortlistPlayerIds.length > 0 && (
                  <button
                    onClick={handleClearShortlist}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 10px",
                      background: `${TMod.accentRed}20`,
                      color: TMod.accentRed,
                      fontWeight: 700,
                      fontSize: 10,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Clear All
                  </button>
                )}
              </>
            )}
          </div>

          {/* Negotiations */}
          <div style={{ background: TMod.bgPanel, border: `1px solid ${TMod.borderLight}`, borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: TMod.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
              Active Negotiations ({activeNegotiations.length})
            </div>
            {activeNegotiations.length === 0 ? (
              <div style={{ fontSize: 12, color: TMod.textSecondary, lineHeight: 1.6 }}>
                No active negotiations. Approach a player to start bidding.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeNegotiations.map((session) => {
                  const lastEntry = session.entries[session.entries.length - 1];
                  return (
                    <div
                      key={session.id}
                      style={{
                        padding: "12px",
                        background: TMod.bgSecondary,
                        border: `1px solid ${TMod.borderLight}`,
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: TMod.accentCyan }}>
                          {session.type === "contract" ? "Contract" : "Transfer"}
                        </div>
                        <div
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: session.status === "open" ? TMod.accentGreen : TMod.accentGold,
                            background: session.status === "open" ? `${TMod.accentGreen}20` : `${TMod.accentGold}20`,
                          }}
                        >
                          {session.status}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: TMod.textPrimary, marginBottom: 6 }}>
                        {session.playerId}
                      </div>
                      {lastEntry && (
                        <div style={{ fontSize: 9, color: TMod.textSecondary, lineHeight: 1.4, marginBottom: 8 }}>
                          {lastEntry.message}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/negotiations" })}
                        style={{
                          width: "100%",
                          border: `1px solid ${TMod.accentCyan}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                          background: `${TMod.accentCyan}18`,
                          color: TMod.accentCyan,
                          fontWeight: 700,
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        Open Negotiation
                      </button>
                      {session.type === "contract" && session.status === "open" && (
                        <button
                          type="button"
                          onClick={() => handleAcceptContractSession(session)}
                          style={{
                            width: "100%",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 10px",
                            background: `linear-gradient(135deg, ${TMod.accentGreen}, #1a9d5d)`,
                            color: TMod.bgPrimary,
                            fontWeight: 700,
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          Accept Offer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transfer Window Info */}
          <div style={{ background: TMod.bgPanel, border: `1px solid ${TMod.borderLight}`, borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: TMod.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
              Transfer Window
            </div>
            <div style={{ fontSize: 12, color: TMod.textSecondary, lineHeight: 1.7 }}>
              <div style={{ marginBottom: 8 }}>
                Status: <span style={{ color: transferWindow.isOpen ? TMod.accentGreen : TMod.textPrimary, fontWeight: 700 }}>
                  {transferWindow.isOpen ? "OPEN" : "CLOSED"}
                </span>
              </div>
              {transferWindow.windowName && (
                <div style={{ marginBottom: 8 }}>
                  Window: <span style={{ color: TMod.textPrimary, fontWeight: 700 }}>{transferWindow.windowName}</span>
                </div>
              )}
              <div style={{ marginBottom: 8 }}>
                Opens: <span style={{ color: TMod.textPrimary, fontWeight: 700 }}>{transferWindow.opensOn}</span>
              </div>
              {transferWindow.closesOn && (
                <div>
                  Closes: <span style={{ color: TMod.textPrimary, fontWeight: 700 }}>{transferWindow.closesOn}</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background: TMod.bgPanel, border: `1px solid ${TMod.borderLight}`, borderRadius: 12, padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: TMod.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
              Recent Activity
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {transferEvents.length === 0 ? (
                <div style={{ textAlign: "center", color: TMod.textSecondary, fontSize: 12, paddingTop: 20 }}>
                  No recent activity
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {transferEvents.map((event, idx) => (
                    <div
                      key={`${event.id}-${idx}`}
                      style={{
                        padding: "10px",
                        borderLeft: `2px solid ${TMod.accentGold}`,
                        background: `${TMod.accentGold}10`,
                        fontSize: 10,
                        color: TMod.textPrimary,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {event.description || event.type}
                      </div>
                      <div style={{ fontSize: 9, color: TMod.textTertiary, marginTop: 2 }}>
                        {event.date}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Player Profile Modal */}
      <PlayerProfileModal
        player={selectedPlayer}
        club={selectedPlayerClub}
        isOpen={showProfileModal}
        isShortlisted={selectedPlayer ? isPlayerShortlisted(selectedPlayer.id) : false}
        onClose={() => setShowProfileModal(false)}
        onShortlist={(add) => selectedPlayer && handleToggleShortlist(selectedPlayer.id, add)}
        onApproach={() => {
          if (selectedPlayer) {
            const row = allMarketRows.find((r) => r.playerId === selectedPlayer.id);
            if (row) {
              handleApproachPlayer(row);
            }
          }
        }}
      />
      </div>
    </>
  );
}

