import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  TMod,
  ScreenHeader,
  ModPanel,
  ModSectionHead,
  ModTabs,
  ModButton,
  StatBarRow,
  FilterChip,
  ModBadge,
} from "@/components/ui-modern";
import { useCurrentClub, useGameState } from "@/state/store";
import { useToast } from "@/state/toast-context";
import { useLoading } from "@/state/loading-context";
import { mentalityLabel, type TacticsInstructions } from "@/hooks/use-tactics";
import {
  getRolesForPosition,
  getInstructionsForRole,
  getRoleById,
  createDefaultTacticalConfig,
} from "@/state/player-tactics";
import {
  scorePlayerRoleSuitability,
  scoreAllRolesForPlayer,
  getRoleSuitabilityFeedback,
} from "@/lib/player-suitability";
import type { Player } from "@/state/types";

export const Route = createFileRoute("/tactics")({
  head: () => ({
    meta: [
      { title: "Tactics — Manager Legacy" },
      { name: "description", content: "Set formation, style of play and in-match instructions." },
      { property: "og:title", content: "Tactics — Manager Legacy" },
      {
        property: "og:description",
        content: "Set formation, style of play and in-match instructions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TacticsScreen,
});

const INSTRUCTIONS: Array<{ key: keyof TacticsInstructions; label: string; hint: string }> = [
  { key: "outFromBack", label: "Play out of defence", hint: "Safer build-up, less direct" },
  { key: "counterPress", label: "Counter-press", hint: "Press harder, costs stamina" },
  { key: "workIntoBox", label: "Work ball into box", hint: "More direct, more shots" },
  { key: "fullBacksWide", label: "Distribute to full-backs", hint: "Wider play, more crosses" },
];

function SliderControl({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value));
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: TMod.textPrimary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </label>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: TMod.accentGreen,
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        style={{
          width: "100%",
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(to right, ${TMod.accentGreen} 0%, ${TMod.accentGreen} ${percentage}%, ${TMod.borderMid} ${percentage}%, ${TMod.borderMid} 100%)`,
          WebkitAppearance: "none",
          appearance: "none",
          cursor: "pointer",
          outline: "none",
        }}
      />
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${TMod.accentGreen};
          cursor: pointer;
          box-shadow: 0 0 8px rgba(47, 224, 138, 0.4);
          border: 2px solid #062015;
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${TMod.accentGreen};
          cursor: pointer;
          box-shadow: 0 0 8px rgba(47, 224, 138, 0.4);
          border: 2px solid #062015;
        }
      `}</style>
    </div>
  );
}

function TacticsScreen() {
  const { state, dispatch } = useGameState();
  const toast = useToast();
  const { isLoading, startLoading, stopLoading } = useLoading();
  const currentClub = useCurrentClub();
  const settings = state.tactics;
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showTeamInstructions, setShowTeamInstructions] = useState(false);

  const setDial = (
    key: keyof Omit<import("@/state/types").TacticsSettings, "instructions">,
    value: number,
  ) => {
    startLoading("SET_TACTICS");
    dispatch({ type: "SET_TACTICS", tactics: { ...settings, [key]: value } });
    toast.info("Tactics updated", 1500);
    setTimeout(() => stopLoading("SET_TACTICS"), 1500);
  };

  const toggleInstruction = (key: keyof TacticsInstructions) => {
    startLoading("SET_TACTICS");
    dispatch({
      type: "SET_TACTICS",
      tactics: {
        ...settings,
        instructions: { ...settings.instructions, [key]: !settings.instructions[key] },
      },
    });
    toast.info("Instructions updated", 1500);
    setTimeout(() => stopLoading("SET_TACTICS"), 1500);
  };

  const squad = currentClub.playerIds
    .map((pid) => state.players[pid])
    .filter((p) => p !== undefined);

  const squad11 = squad.slice(0, 11);
  const selectedPlayer = selectedPlayerId ? (state.players[selectedPlayerId] ?? null) : null;

  // Calculate formation positions for visual pitch layout
  const formationMap: { [key: string]: { x: number; y: number }[] } = {
    "4-4-2": [
      // Goalkeeper
      { x: 50, y: 8 },
      // Defenders (4)
      { x: 20, y: 22 },
      { x: 35, y: 22 },
      { x: 65, y: 22 },
      { x: 80, y: 22 },
      // Midfielders (4)
      { x: 20, y: 50 },
      { x: 35, y: 50 },
      { x: 65, y: 50 },
      { x: 80, y: 50 },
      // Strikers (2)
      { x: 35, y: 78 },
      { x: 65, y: 78 },
    ],
    "4-3-3": [
      { x: 50, y: 8 },
      { x: 20, y: 22 },
      { x: 35, y: 22 },
      { x: 65, y: 22 },
      { x: 80, y: 22 },
      { x: 25, y: 45 },
      { x: 50, y: 50 },
      { x: 75, y: 45 },
      { x: 20, y: 78 },
      { x: 50, y: 85 },
      { x: 80, y: 78 },
    ],
    "4-2-3-1": [
      { x: 50, y: 8 },
      { x: 20, y: 22 },
      { x: 35, y: 22 },
      { x: 65, y: 22 },
      { x: 80, y: 22 },
      { x: 30, y: 38 },
      { x: 70, y: 38 },
      { x: 25, y: 60 },
      { x: 50, y: 60 },
      { x: 75, y: 60 },
      { x: 50, y: 80 },
    ],
  };

  const positions = formationMap[currentClub.formation] || formationMap["4-4-2"];

  return (
    <>
      <ScreenHeader
        breadcrumb="MATCH PREPARATION"
        title="Tactics & Formation"
        subtitle={`${currentClub.formation} • ${mentalityLabel(settings.mentality)} • ${currentClub.name}`}
        stats={[
          { label: "Formation", value: currentClub.formation },
          { label: "Mentality", value: mentalityLabel(settings.mentality) },
          { label: "Pressing", value: `${settings.pressing}%` },
        ]}
      />

      <div
        style={{ background: TMod.bgPrimary, minHeight: "calc(100vh - 200px)", padding: "32px" }}
      >
        <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
          {/* MAIN PITCH + CONTROLS GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: selectedPlayer ? "2fr 1fr" : "1fr",
              gap: 32,
              marginBottom: 32,
            }}
          >
            {/* LEFT: PITCH - PRIMARY FOCUS */}
            <div>
              <ModPanel variant="primary" padding="24px">
                {/* TACTICAL PITCH */}
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "4/5",
                    background: `linear-gradient(135deg, ${TMod.accentGreen}22 0%, ${TMod.accentBlue}11 100%)`,
                    border: `2px solid ${TMod.accentGreen}`,
                    borderRadius: "12px",
                    overflow: "hidden",
                    marginBottom: "24px",
                  }}
                >
                  {/* PITCH MARKINGS */}
                  <svg
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {/* Center line */}
                    <line
                      x1="50"
                      y1="0"
                      x2="50"
                      y2="100"
                      stroke={TMod.accentGreen}
                      strokeWidth="0.3"
                      opacity="0.4"
                    />
                    {/* Center circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="10"
                      fill="none"
                      stroke={TMod.accentGreen}
                      strokeWidth="0.3"
                      opacity="0.4"
                    />
                    {/* Penalty areas */}
                    <rect
                      x="10"
                      y="12"
                      width="20"
                      height="26"
                      fill="none"
                      stroke={TMod.accentGreen}
                      strokeWidth="0.3"
                      opacity="0.3"
                    />
                    <rect
                      x="70"
                      y="12"
                      width="20"
                      height="26"
                      fill="none"
                      stroke={TMod.accentGreen}
                      strokeWidth="0.3"
                      opacity="0.3"
                    />
                  </svg>

                  {/* PLAYER MARKERS */}
                  <div style={{ position: "absolute", inset: 0 }}>
                    {squad11.map((player, idx) => {
                      const pos = positions?.[idx] || { x: 50, y: 50 };
                      const isSelected = selectedPlayerId === player.id;
                      const role = getRoleById(player.tacticalConfig?.roleId || "");

                      return (
                        <button
                          key={player.id}
                          onClick={() => setSelectedPlayerId(isSelected ? null : player.id)}
                          style={{
                            position: "absolute",
                            left: `${pos.x}%`,
                            top: `${pos.y}%`,
                            transform: "translate(-50%, -50%)",
                            width: "52px",
                            height: "52px",
                            padding: 0,
                            border: `3px solid ${isSelected ? TMod.accentGreen : TMod.accentCyan}`,
                            borderRadius: "50%",
                            background: isSelected
                              ? `radial-gradient(circle, ${TMod.accentGreen}30, ${TMod.accentGreen}10)`
                              : `radial-gradient(circle, ${TMod.accentCyan}20, ${TMod.accentCyan}05)`,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.3s ease",
                            boxShadow: isSelected ? `0 0 16px ${TMod.accentGreen}` : "none",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.transform =
                              "translate(-50%, -50%) scale(1.1)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.transform =
                              "translate(-50%, -50%)";
                          }}
                        >
                          {/* Jersey Number */}
                          <div
                            style={{ fontSize: "16px", fontWeight: "900", color: TMod.textPrimary }}
                          >
                            {player.number}
                          </div>
                          {/* Role Badge */}
                          {role && (
                            <div
                              style={{
                                fontSize: "8px",
                                fontWeight: "700",
                                color: TMod.accentGreen,
                                marginTop: "2px",
                              }}
                            >
                              {role.name.substring(0, 3).toUpperCase()}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FORMATION INFO */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div
                    style={{
                      padding: "12px",
                      background: TMod.bgSecondary,
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: TMod.textTertiary,
                        marginBottom: "4px",
                      }}
                    >
                      FORMATION
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: TMod.accentGreen }}>
                      {currentClub.formation}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px",
                      background: TMod.bgSecondary,
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: TMod.textTertiary,
                        marginBottom: "4px",
                      }}
                    >
                      MENTALITY
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: TMod.accentCyan }}>
                      {mentalityLabel(settings.mentality)}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px",
                      background: TMod.bgSecondary,
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: TMod.textTertiary,
                        marginBottom: "4px",
                      }}
                    >
                      XI READY
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "900", color: TMod.accentGold }}>
                      {squad11.length}/11
                    </div>
                  </div>
                </div>
              </ModPanel>
            </div>

            {/* RIGHT: SELECTED PLAYER TACTICAL PANEL */}
            {selectedPlayer && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <PlayerTacticalPanel player={selectedPlayer} state={state} dispatch={dispatch} />
              </div>
            )}
          </div>

          {/* TEAM INSTRUCTIONS - COMPACT & ACCESSIBLE */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            {/* FORMATION SLIDERS */}
            <ModPanel variant="secondary" padding="24px">
              <ModSectionHead title="Formation Settings" divider />
              <div
                style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "16px" }}
              >
                <SliderControl
                  label="Mentality"
                  value={settings.mentality}
                  min={0}
                  max={100}
                  onChange={(v) => setDial("mentality", v)}
                />
                <SliderControl
                  label="Width"
                  value={settings.width}
                  min={0}
                  max={100}
                  onChange={(v) => setDial("width", v)}
                />
                <SliderControl
                  label="Depth"
                  value={settings.depth}
                  min={0}
                  max={100}
                  onChange={(v) => setDial("depth", v)}
                />
                <SliderControl
                  label="Tempo"
                  value={settings.tempo}
                  min={0}
                  max={100}
                  onChange={(v) => setDial("tempo", v)}
                />
                <SliderControl
                  label="Pressing"
                  value={settings.pressing}
                  min={0}
                  max={100}
                  onChange={(v) => setDial("pressing", v)}
                />
              </div>
            </ModPanel>

            {/* MATCH INSTRUCTIONS */}
            <ModPanel variant="secondary" padding="24px">
              <ModSectionHead title="In-Match Instructions" divider />
              <div
                style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}
              >
                {INSTRUCTIONS.map(({ key, label, hint }) => {
                  const active = settings.instructions[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleInstruction(key)}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: `1px solid ${active ? TMod.accentGreen : TMod.borderMid}`,
                        background: active ? `${TMod.accentGreen}15` : TMod.bgPanel,
                        color: TMod.textPrimary,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.2s ease",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = active
                          ? `${TMod.accentGreen}25`
                          : TMod.bgTertiary;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = active
                          ? `${TMod.accentGreen}15`
                          : TMod.bgPanel;
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: "700", marginBottom: "2px" }}>
                          {label}
                        </div>
                        <div style={{ fontSize: "9px", color: TMod.textTertiary }}>{hint}</div>
                      </div>
                      <ModBadge
                        label={active ? "✓ ON" : "OFF"}
                        variant={active ? "solid" : "outline"}
                      />
                    </button>
                  );
                })}
              </div>
            </ModPanel>
          </div>
        </div>
      </div>
    </>
  );
}

interface PlayerTacticalPanelProps {
  player: Player;
  state: any;
  dispatch: any;
}

function PlayerTacticalPanel({ player, state, dispatch }: PlayerTacticalPanelProps) {
  const config = player.tacticalConfig || createDefaultTacticalConfig(player.pos);
  const availableRoles = getRolesForPosition(player.pos);
  const currentRole = getRoleById(config.roleId);
  const availableInstructions = currentRole
    ? getInstructionsForRole(currentRole.id, player.pos)
    : [];
  const suitabilityScores = scoreAllRolesForPlayer(player, availableRoles);
  const currentRoleSuitability = scorePlayerRoleSuitability(player, currentRole);

  const setRole = (roleId: string) => {
    dispatch({ type: "SET_PLAYER_ROLE", playerId: player.id, roleId });
  };

  const toggleInstruction = (instructionId: string) => {
    const newInstructions = config.instructions.includes(instructionId)
      ? config.instructions.filter((id: string) => id !== instructionId)
      : [...config.instructions, instructionId];
    dispatch({
      type: "SET_PLAYER_INSTRUCTIONS",
      playerId: player.id,
      instructions: newInstructions,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* PLAYER INFO HEADER */}
      <ModPanel variant="primary" padding="16px">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            marginBottom: "12px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: TMod.textTertiary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              #{player.number} {player.pos}
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "900",
                color: TMod.textPrimary,
                marginTop: "4px",
              }}
            >
              {player.name}
            </div>
          </div>
          <div
            style={{
              padding: "8px 12px",
              background: TMod.bgSecondary,
              borderRadius: "6px",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: "700", color: TMod.textTertiary }}>
              OVERALL
            </div>
            <div style={{ fontSize: "18px", fontWeight: "900", color: TMod.accentCyan }}>
              {player.overall}
            </div>
          </div>
        </div>
      </ModPanel>

      {/* ROLE SELECTOR & SUITABILITY */}
      <ModPanel variant="secondary" padding="16px">
        <ModSectionHead title="Tactical Role" divider />
        <div style={{ marginTop: "12px" }}>
          <select
            value={config.roleId}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: `1px solid ${TMod.borderMid}`,
              background: TMod.bgPanel,
              color: TMod.textPrimary,
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              marginBottom: "12px",
            }}
          >
            {availableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          {currentRole && (
            <div
              style={{
                padding: "12px",
                background: `${TMod.accentBlue}15`,
                borderRadius: "6px",
                borderLeft: `3px solid ${TMod.accentBlue}`,
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: TMod.textSecondary,
                  marginBottom: "8px",
                  lineHeight: "1.4",
                }}
              >
                {currentRole.description}
              </div>

              {/* ROLE SUITABILITY SCORE */}
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: `1px solid ${TMod.borderLight}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ fontSize: "10px", fontWeight: "700", color: TMod.textTertiary }}>
                    SUITABILITY
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "900",
                      color:
                        currentRoleSuitability >= 85
                          ? TMod.accentGreen
                          : currentRoleSuitability >= 70
                            ? TMod.accentCyan
                            : currentRoleSuitability >= 55
                              ? TMod.accentGold
                              : "#FF6B6B",
                    }}
                  >
                    {currentRoleSuitability}/100
                  </div>
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
                      width: `${currentRoleSuitability}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${TMod.accentGreen}, ${TMod.accentCyan})`,
                      borderRadius: "3px",
                    }}
                  />
                </div>
                <div style={{ fontSize: "9px", color: TMod.textTertiary, marginTop: "4px" }}>
                  ({getRoleSuitabilityFeedback(currentRoleSuitability)})
                </div>
              </div>
            </div>
          )}

          {suitabilityScores.length > 1 && (
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: `1px solid ${TMod.borderLight}`,
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  color: TMod.textTertiary,
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Alternative Roles
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {suitabilityScores.slice(1, 3).map((score) => (
                  <div
                    key={score.roleId}
                    style={{
                      fontSize: "10px",
                      color: TMod.textSecondary,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{score.roleName}</span>
                    <span style={{ fontWeight: "700", color: TMod.accentCyan }}>
                      {score.score}/100
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ModPanel>

      {/* INSTRUCTIONS - GROUPED BY CATEGORY */}
      {availableInstructions.length > 0 && (
        <ModPanel variant="secondary" padding="16px">
          <ModSectionHead title="Player Instructions" divider />
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {availableInstructions.map((instr) => {
              const isActive = config.instructions.includes(instr.id);
              return (
                <button
                  key={instr.id}
                  onClick={() => toggleInstruction(instr.id)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${isActive ? TMod.accentGreen : TMod.borderMid}`,
                    background: isActive ? `${TMod.accentGreen}15` : TMod.bgPanel,
                    color: TMod.textPrimary,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = isActive
                      ? `${TMod.accentGreen}25`
                      : TMod.bgTertiary;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = isActive
                      ? `${TMod.accentGreen}15`
                      : TMod.bgPanel;
                  }}
                >
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "2px" }}>
                      {instr.name}
                    </div>
                    <div style={{ fontSize: "8px", color: TMod.textTertiary }}>
                      {instr.description}
                    </div>
                  </div>
                  <ModBadge
                    label={isActive ? "✓" : "—"}
                    variant={isActive ? "solid" : "outline"}
                  />
                </button>
              );
            })}
          </div>
        </ModPanel>
      )}
    </div>
  );
}

interface PlayerRolesTabProps {
  squad: Player[];
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string) => void;
  selectedPlayer: Player | null;
  state: any;
  dispatch: any;
}

function PlayerRolesTab({
  squad,
  selectedPlayerId,
  onSelectPlayer,
  selectedPlayer,
  state,
  dispatch,
}: PlayerRolesTabProps) {
  const squad11 = squad.slice(0, 11);

  const getPlayerTacticalConfig = (player: Player) => {
    return player.tacticalConfig || createDefaultTacticalConfig(player.pos);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
      {/* LEFT: Squad Grid */}
      <ModPanel variant="primary" padding="20px">
        <ModSectionHead title="Starting XI" divider />

        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 16 }}
        >
          {squad11.map((player) => {
            const config = getPlayerTacticalConfig(player);
            const isSelected = selectedPlayerId === player.id;
            const role = getRoleById(config.roleId);

            return (
              <button
                key={player.id}
                onClick={() => onSelectPlayer(player.id)}
                style={{
                  padding: "12px",
                  borderRadius: 8,
                  border: `2px solid ${isSelected ? TMod.accentGreen : TMod.borderMid}`,
                  background: isSelected ? `${TMod.accentGreen}15` : TMod.bgPanel,
                  color: TMod.textPrimary,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = isSelected
                    ? `${TMod.accentGreen}22`
                    : TMod.bgTertiary;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = isSelected
                    ? `${TMod.accentGreen}15`
                    : TMod.bgPanel;
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700 }}>
                  #{player.number} {player.name}
                </div>
                <div style={{ fontSize: 9, color: TMod.textTertiary }}>
                  {player.pos} • {role?.name || "—"}
                </div>
              </button>
            );
          })}
        </div>
      </ModPanel>

      {/* RIGHT: Player Config */}
      {selectedPlayer ? (
        <PlayerTacticalPanel player={selectedPlayer} state={state} dispatch={dispatch} />
      ) : (
        <ModPanel variant="secondary" padding="40px 20px">
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <div
              style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: TMod.textPrimary }}
            >
              Select a player to configure
            </div>
            <div style={{ fontSize: 12, color: TMod.textTertiary }}>
              Click on a player card to set their tactical role and instructions
            </div>
          </div>
        </ModPanel>
      )}
    </div>
  );
}
