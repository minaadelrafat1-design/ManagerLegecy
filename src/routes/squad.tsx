import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { T } from "@/components/ui";
import {
  TMod,
  ScreenHeader,
  ModPanel,
  ModSectionHead,
  ModTabs,
  MetricCard,
  ModBadge,
  FilterChip,
} from "@/components/ui-modern";
import {
  FormArrow,
  MiniMeter,
  FitnessRing,
  PotentialDots,
  ratingColor,
  meterColor,
} from "@/components/squad-bits";
import type { Player } from "@/data/squad";
import { PlayerFigure } from "@/components/player-figure";
import {
  useClubPlayers,
  useStartingXI,
  useBench,
  useCurrentClub,
  useGameState,
} from "@/state/store";

export const Route = createFileRoute("/squad")({
  head: () => ({
    meta: [
      { title: "Squad — Manager Legacy" },
      {
        name: "description",
        content:
          "Manage your starting XI, formation, fitness, morale and form on an interactive pitch in Manager Legacy.",
      },
      { property: "og:title", content: "Squad — Manager Legacy" },
      {
        property: "og:description",
        content: "Interactive pitch, squad depth and player condition at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SquadScreen,
});

const FORMATIONS = ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2", "5-3-2"];
const TACTICS = ["Balanced", "Gegenpress", "Possession", "Counter", "Low Block"];

function StatBar({ label, value }: { label: string; value: number }) {
  const percentage = (value / 99) * 100;
  const color =
    value >= 85
      ? "#2FE08A"
      : value >= 75
        ? TMod.accentCyan
        : value >= 60
          ? TMod.accentGold
          : "#FF6B6B";
  return (
    <div>
      <div style={{ fontSize: 8, fontWeight: 700, marginBottom: 2, color: "#1a1a1a" }}>
        {label} {value}
      </div>
      <div
        style={{
          width: "100%",
          height: 4,
          background: "rgba(0,0,0,0.25)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{ width: `${percentage}%`, height: "100%", background: color, borderRadius: 2 }}
        />
      </div>
    </div>
  );
}

function StatBoxSmall({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{ padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)", textAlign: "center" }}
    >
      <div style={{ fontSize: 8, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#1a1a1a" }}>●</div>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#1a1a1a" }}>{value}</div>
    </div>
  );
}

function SquadScreen() {
  const { state } = useGameState();
  const navigate = useNavigate();
  const currentClub = useCurrentClub();
  const players = useClubPlayers();
  const startingXI = useStartingXI();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(startingXI[0] || null);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const avgOverall = Math.round(
    startingXI.reduce((sum, p) => sum + p.overall, 0) / Math.max(startingXI.length, 1),
  );

  // Separate squad into starting XI, subs, and reserves
  const startingXIIds = new Set(startingXI.map((p) => p.id));
  const substitutes = players.filter((p) => !startingXIIds.has(p.id) && players.indexOf(p) < 20);
  const reserves = players.filter((p) => !startingXIIds.has(p.id) && players.indexOf(p) >= 20);

  const handleStartSession = () => {
    navigate({ to: "/training" });
  };

  return (
    <>
      <ScreenHeader
        breadcrumb="SQUAD MANAGEMENT"
        title="Squad & Development"
        subtitle={`${startingXI.length}/11 Starting • ${currentClub.name}`}
        stats={[
          { label: "Overall", value: avgOverall },
          { label: "Squad Size", value: players.length },
          {
            label: "Avg Age",
            value: Math.round(players.reduce((sum, p) => sum + p.age, 0) / players.length),
          },
        ]}
      />

      <div
        style={{ background: TMod.bgPrimary, minHeight: "calc(100vh - 200px)", padding: "32px" }}
      >
        <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
          {/* HIERARCHY GRID: Starting XI, Subs, Reserves */}
          <div style={{ display: "grid", gap: 32, marginBottom: 32 }}>
            {/* STARTING XI - PRIMARY */}
            <div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}
              >
                <h2 style={{ fontSize: "20px", fontWeight: "900", color: TMod.textPrimary }}>
                  Starting XI
                </h2>
                <ModBadge label={`${startingXI.length}/11`} variant="solid" />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                {startingXI.map((player) => (
                  <SquadPlayerCard
                    key={player.id}
                    player={player}
                    isSelected={selectedPlayer?.id === player.id}
                    isHovered={hoveredPlayer === player.id}
                    isExpanded={expandedPlayer === player.id}
                    onSelect={() => setSelectedPlayer(player)}
                    onHover={(id) => setHoveredPlayer(id)}
                    onToggleExpand={() =>
                      setExpandedPlayer(expandedPlayer === player.id ? null : player.id)
                    }
                  />
                ))}
              </div>
            </div>

            {/* SUBSTITUTES - SECONDARY */}
            {substitutes.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <h2 style={{ fontSize: "18px", fontWeight: "800", color: TMod.textSecondary }}>
                    Substitutes
                  </h2>
                  <ModBadge label={`${substitutes.length}`} variant="outline" />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {substitutes.map((player) => (
                    <SquadPlayerCard
                      key={player.id}
                      player={player}
                      isSelected={selectedPlayer?.id === player.id}
                      isHovered={hoveredPlayer === player.id}
                      isExpanded={expandedPlayer === player.id}
                      onSelect={() => setSelectedPlayer(player)}
                      onHover={(id) => setHoveredPlayer(id)}
                      onToggleExpand={() =>
                        setExpandedPlayer(expandedPlayer === player.id ? null : player.id)
                      }
                      variant="secondary"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* RESERVES - TERTIARY */}
            {reserves.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <h2 style={{ fontSize: "16px", fontWeight: "700", color: TMod.textTertiary }}>
                    Reserves
                  </h2>
                  <ModBadge label={`${reserves.length}`} variant="outline" />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {reserves.map((player) => (
                    <SquadPlayerCard
                      key={player.id}
                      player={player}
                      isSelected={selectedPlayer?.id === player.id}
                      isHovered={hoveredPlayer === player.id}
                      isExpanded={expandedPlayer === player.id}
                      onSelect={() => setSelectedPlayer(player)}
                      onHover={(id) => setHoveredPlayer(id)}
                      onToggleExpand={() =>
                        setExpandedPlayer(expandedPlayer === player.id ? null : player.id)
                      }
                      variant="tertiary"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PLAYER DETAIL PANEL - SHOWS WHEN SELECTED */}
          {selectedPlayer && (
            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "900",
                  color: TMod.textPrimary,
                  marginBottom: "16px",
                }}
              >
                Player Details
              </h2>
              <PlayerDetailPanel
                player={selectedPlayer}
                handleStartSession={handleStartSession}
                currentClub={currentClub}
              />
            </div>
          )}

        </div>
      </div>
    </>
  );
}

interface SquadPlayerCardProps {
  player: Player;
  isSelected: boolean;
  isHovered: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
  onToggleExpand: () => void;
  variant?: "primary" | "secondary" | "tertiary";
}

function SquadPlayerCard({
  player,
  isSelected,
  isHovered,
  isExpanded,
  onSelect,
  onHover,
  onToggleExpand,
  variant = "primary",
}: SquadPlayerCardProps) {
  const statusColor =
    player.status === "injured"
      ? "#FF6B6B"
      : player.fitness < 75
        ? "#FFB800"
        : player.morale < 70
          ? "#FFB800"
          : TMod.accentGreen;

  const statusLabel =
    player.status === "injured"
      ? "INJURED"
      : player.fitness < 75
        ? "LOW FITNESS"
        : player.morale < 70
          ? "LOW MORALE"
          : "READY";

  const cardScale = variant === "primary" ? 1 : variant === "secondary" ? 0.95 : 0.9;

  return (
    <div
      onMouseEnter={() => onHover(player.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        transform: isHovered ? "scale(1.02)" : "scale(1)",
        transition: "all 0.3s ease",
      }}
    >
      <ModPanel
        variant={isSelected ? "primary" : "secondary"}
        padding="14px"
      >
        <button
          onClick={onSelect}
          style={{
            width: "100%",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {/* PLAYER HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: "10px",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: TMod.textPrimary }}>
                #{player.number}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: TMod.textSecondary,
                  marginTop: "2px",
                }}
              >
                {player.shortName}
              </div>
            </div>
            <div
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                background: ratingColor(player.overall),
                color: "#fff",
                fontSize: "10px",
                fontWeight: "800",
              }}
            >
              {player.overall}
            </div>
          </div>

          {/* POSITION & STATUS */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            <div
              style={{
                padding: "2px 6px",
                borderRadius: "3px",
                background: `${TMod.accentCyan}20`,
                fontSize: "8px",
                fontWeight: "700",
                color: TMod.accentCyan,
              }}
            >
              {player.pos}
            </div>
            <div
              style={{
                padding: "2px 6px",
                borderRadius: "3px",
                background: `${statusColor}20`,
                fontSize: "8px",
                fontWeight: "700",
                color: statusColor,
              }}
            >
              {statusLabel}
            </div>
          </div>

          {/* CONDITION BARS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "8px",
                  fontWeight: "700",
                  marginBottom: "2px",
                }}
              >
                <span>FITNESS</span>
                <span style={{ color: player.fitness < 75 ? "#FF6B6B" : TMod.accentGreen }}>
                  {player.fitness}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: TMod.bgPanel,
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${player.fitness}%`,
                    height: "100%",
                    background: player.fitness < 75 ? "#FF6B6B" : TMod.accentGreen,
                  }}
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "8px",
                  fontWeight: "700",
                  marginBottom: "2px",
                }}
              >
                <span>MORALE</span>
                <span style={{ color: player.morale < 70 ? "#FFB800" : TMod.accentGreen }}>
                  {player.morale}
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: TMod.bgPanel,
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(player.morale / 100) * 100}%`,
                    height: "100%",
                    background: player.morale < 70 ? "#FFB800" : TMod.accentGreen,
                  }}
                />
              </div>
            </div>
          </div>
        </button>
      </ModPanel>
    </div>
  );
}

interface PlayerDetailPanelProps {
  player: Player;
  handleStartSession: () => void;
  currentClub: any;
}

function PlayerDetailPanel({ player, handleStartSession, currentClub }: PlayerDetailPanelProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "24px" }}>
      {/* ATTRIBUTES */}
      <ModPanel variant="secondary" padding="20px">
        <ModSectionHead title="Attributes" divider />
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            fontSize: "11px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>PACE</span>
            <span style={{ fontWeight: "800", color: TMod.accentCyan }}>
              {player.attrs?.pace || 72}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>SHOOTING</span>
            <span style={{ fontWeight: "800", color: TMod.accentCyan }}>
              {player.attrs?.shooting || 65}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>PASSING</span>
            <span style={{ fontWeight: "800", color: TMod.accentCyan }}>
              {player.attrs?.passing || 67}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>DRIBBLING</span>
            <span style={{ fontWeight: "800", color: TMod.accentCyan }}>
              {player.attrs?.dribbling || 71}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>DEFENSE</span>
            <span style={{ fontWeight: "800", color: TMod.accentCyan }}>
              {player.attrs?.defending || 31}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>PHYSICAL</span>
            <span style={{ fontWeight: "800", color: TMod.accentCyan }}>
              {player.attrs?.physical || 66}
            </span>
          </div>
        </div>
      </ModPanel>

      {/* PLAYER INFO */}
      <ModPanel variant="secondary" padding="20px">
        <ModSectionHead title="Information" divider />
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            fontSize: "11px",
          }}
        >
          <div>
            <div
              style={{
                color: TMod.textTertiary,
                fontSize: "9px",
                fontWeight: "700",
                marginBottom: "4px",
              }}
            >
              NAME
            </div>
            <div style={{ fontWeight: "700", color: TMod.textPrimary }}>{player.name}</div>
          </div>
          <div>
            <div
              style={{
                color: TMod.textTertiary,
                fontSize: "9px",
                fontWeight: "700",
                marginBottom: "4px",
              }}
            >
              CLUB
            </div>
            <div style={{ fontWeight: "700", color: TMod.textPrimary }}>{currentClub.name}</div>
          </div>
          <div>
            <div
              style={{
                color: TMod.textTertiary,
                fontSize: "9px",
                fontWeight: "700",
                marginBottom: "4px",
              }}
            >
              AGE
            </div>
            <div style={{ fontWeight: "700", color: TMod.textPrimary }}>{player.age} years</div>
          </div>
          <div>
            <div
              style={{
                color: TMod.textTertiary,
                fontSize: "9px",
                fontWeight: "700",
                marginBottom: "4px",
              }}
            >
              POSITION
            </div>
            <div style={{ fontWeight: "700", color: TMod.textPrimary }}>{player.pos}</div>
          </div>
        </div>
      </ModPanel>

      {/* CONDITION */}
      <ModPanel variant="secondary" padding="20px">
        <ModSectionHead title="Condition" divider />
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                fontWeight: "700",
                marginBottom: "6px",
              }}
            >
              <span>FITNESS</span>
              <span style={{ color: player.fitness < 75 ? "#FF6B6B" : TMod.accentGreen }}>
                {player.fitness}%
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                background: TMod.bgPanel,
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${player.fitness}%`,
                  height: "100%",
                  background: player.fitness < 75 ? "#FF6B6B" : TMod.accentGreen,
                }}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                fontWeight: "700",
                marginBottom: "6px",
              }}
            >
              <span>MORALE</span>
              <span style={{ color: player.morale < 70 ? "#FFB800" : TMod.accentGreen }}>
                {player.morale}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                background: TMod.bgPanel,
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(player.morale / 100) * 100}%`,
                  height: "100%",
                  background: player.morale < 70 ? "#FFB800" : TMod.accentGreen,
                }}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                fontWeight: "700",
                marginBottom: "6px",
              }}
            >
              <span>FORM</span>
              <span style={{ color: TMod.accentCyan }}>{player.form || 50}/100</span>
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                background: TMod.bgPanel,
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${player.form || 50}%`,
                  height: "100%",
                  background: TMod.accentCyan,
                }}
              />
            </div>
          </div>
        </div>
      </ModPanel>

      {/* DEVELOPMENT */}
      <ModPanel variant="secondary" padding="20px">
        <ModSectionHead title="Development" divider />
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                fontWeight: "700",
                marginBottom: "4px",
              }}
            >
              <span>POTENTIAL</span>
              <span style={{ color: TMod.accentGold }}>
                {player.potential || player.overall + 3}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "4px",
                background: TMod.bgPanel,
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${((player.potential || player.overall + 3) / 99) * 100}%`,
                  height: "100%",
                  background: TMod.accentGold,
                }}
              />
            </div>
          </div>
          <div
            style={{
              padding: "10px",
              borderRadius: "6px",
              background: `${TMod.accentGreen}15`,
              border: `1px solid ${TMod.accentGreen}`,
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: "700", color: TMod.accentGreen }}>
              Training Focus: {player.trainingFocus || "General"}
            </div>
          </div>
        </div>
      </ModPanel>
    </div>
  );
}
