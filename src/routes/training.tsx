import { createFileRoute, Link } from "@tanstack/react-router";
import { useClubPlayers, useGameState } from "@/state/store";
import { useToast } from "@/state/toast-context";
import { useLoading } from "@/state/loading-context";
import { formatMoney, parseMoney } from "@/state/finance";
import { getTrainingGroundOverview } from "@/state/training-ground";
import { TMod, ScreenHeader, ModPanel, ModButton, ModBadge } from "@/components/ui-modern";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training Ground — Manager Legacy" },
      {
        name: "description",
        content: "Weekly training schedule, individual focus areas, and player development.",
      },
    ],
  }),
  component: TrainingScreen,
});

const WEEK = [
  { day: "Mon", session: "Recovery", intensity: 25 },
  { day: "Tue", session: "Possession", intensity: 65 },
  { day: "Wed", session: "Pressing drills", intensity: 85 },
  { day: "Thu", session: "Set pieces", intensity: 50 },
  { day: "Fri", session: "Match prep", intensity: 40 },
  { day: "Sat", session: "Matchday", intensity: 100 },
  { day: "Sun", session: "Rest", intensity: 10 },
];

const PRESETS = {
  Balanced: {
    drills: ["Possession patterns", "Tactical positioning", "Set piece routines"],
    targetedAttributes: ["Passing", "Positioning", "Stamina"],
    expectedDevelopment: "+2-3 per week",
    workload: "Moderate",
    fatigue: "Low",
    risk: "Minimal",
    description: "Even split across technical, tactical and physical. Keeps condition stable.",
  },
  Attacking: {
    drills: ["Finishing drills", "Through ball play", "Attacking rotations"],
    targetedAttributes: ["Shooting", "Dribbling", "Pace"],
    expectedDevelopment: "+4-5 per week",
    workload: "High",
    fatigue: "Medium",
    risk: "Moderate",
    description: "Finishing and final-third rotations. Boosts shooting and dribbling.",
  },
  Defensive: {
    drills: ["Shape training", "Marking zones", "Pressing traps"],
    targetedAttributes: ["Defense", "Heading", "Positioning"],
    expectedDevelopment: "+3-4 per week",
    workload: "High",
    fatigue: "Medium",
    risk: "Moderate",
    description: "Shape, marking and pressing traps. Boosts defending.",
  },
  Fitness: {
    drills: ["Conditioning runs", "Interval training", "Stamina circuits"],
    targetedAttributes: ["Stamina", "Pace", "Physical"],
    expectedDevelopment: "+5-6 per week",
    workload: "Very High",
    fatigue: "High",
    risk: "High",
    description: "Higher load conditioning. Faster gains, greater injury risk.",
  },
};
const VISIBLE_PRESETS = ["Balanced", "Attacking", "Defensive"] as const;

function TrainingScreen() {
  const { state, dispatch } = useGameState();
  const toast = useToast();
  const { isLoading, startLoading, stopLoading } = useLoading();
  const players = useClubPlayers();
  const activePlanId = state.selectedTrainingPlanId ?? state.training[0]?.id ?? "";
  const activePlan = state.training.find((plan) => plan.id === activePlanId) ?? state.training[0];
  const planName = activePlan?.name ?? "Balanced";
  const presetInfo = PRESETS[planName as keyof typeof PRESETS];

  const available = players.filter((p) => p.status !== "injured");
  const needRest = available.filter((p) => p.fitness < 70);
  const avgFitness = Math.round(available.reduce((s, p) => s + p.fitness, 0) / available.length);
  const developing = [...players]
    .sort((a, b) => b.trainingProgress - a.trainingProgress)
    .slice(0, 6);
  const ground = state.currentClub?.trainingGround ?? undefined;
  const overview = state.currentClub ? getTrainingGroundOverview(state.currentClub) : null;
  const currentBalance = parseMoney(state.finances?.balance ?? 0);
  const activeUpgrades = overview?.upgrades.filter((upgrade: any) => upgrade.status === "in_progress") ?? [];
  const groundOverview = ground
    ? {
        condition: ground.condition,
        facilityCount: Object.keys(ground.facilities ?? {}).length,
        equipmentCount: Object.keys(ground.equipment ?? {}).length,
        highestFacility: (Object.values(ground.facilities ?? {}) as Array<{ level: number; label: string }>).sort((a, b) => b.level - a.level)[0]?.label ?? "Main Pitch",
      }
    : null;

  const getUpgradeCost = (kind: "facility" | "equipment", assetId: string, level: number) => {
    const facilityCosts: Record<string, number> = {
      pitch: 1_200_000, indoor: 1_500_000, gym: 1_250_000, recovery: 1_100_000,
      goalkeeping: 900_000, medical: 1_050_000, analysisSuite: 1_300_000, academy: 1_600_000,
    };
    const equipmentCosts: Record<string, number> = {
      strength: 420_000, cardio: 390_000, technical: 460_000, ball: 375_000,
      shooting: 430_000, goalkeeping: 410_000, recovery: 360_000, analysisTech: 520_000,
    };
    const baseCost =
      kind === "facility"
        ? facilityCosts[assetId] ?? 500_000
        : equipmentCosts[assetId] ?? 400_000;

    const growth = kind === "facility" ? 1.58 : 1.6;
    return Math.round(baseCost * Math.pow(growth, Math.max(0, level - 1)));
  };

  const getUpgradeDuration = (kind: "facility" | "equipment", assetId: string, level: number) => {
    const baseDays = kind === "facility" ? 9 : 6;
    const complexity = kind === "facility" ? 1.1 : 1.0;
    return Math.max(5, Math.round(baseDays + (level + 1) * 3 + (assetId.length * 0.8 * complexity)));
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 85) return TMod.accentRed;
    if (intensity >= 65) return TMod.accentGold;
    if (intensity >= 40) return TMod.accentGreen;
    return TMod.accentCyan;
  };

  const getWorkloadColor = (workload: string) => {
    if (workload === "Very High") return TMod.accentRed;
    if (workload === "High") return TMod.accentGold;
    if (workload === "Moderate") return TMod.accentGreen;
    return TMod.accentCyan;
  };

  const getRiskColor = (risk: string) => {
    if (risk === "High") return TMod.accentRed;
    if (risk === "Moderate") return TMod.accentGold;
    return TMod.accentGreen;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${TMod.bgPrimary} 0%, ${TMod.bgSecondary} 100%)`,
      }}
    >
      {/* HEADER */}
      <ScreenHeader
        title="Training Ground"
        subtitle="Training & Facilities"
      />

      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Ground condition", value: `${groundOverview?.condition ?? 0}%` },
            { label: "Maintenance", value: formatMoney(overview?.maintenanceCost ?? 0) },
            { label: "Annual run cost", value: formatMoney(overview?.operatingCost ?? 0) },
            { label: "Active upgrades", value: `${activeUpgrades.length}` },
          ].map((metric) => (
            <div
              key={metric.label}
              style={{
                background: TMod.bgPanel,
                border: `1px solid ${TMod.borderLight}`,
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.08em", color: TMod.textTertiary, textTransform: "uppercase" }}>
                {metric.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: TMod.textPrimary }}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>

        {activeUpgrades.length > 0 && (
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderLight}`,
              borderRadius: 12,
              padding: "16px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: TMod.textTertiary,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Active work
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeUpgrades.map((upgrade: any) => (
                <div
                  key={upgrade.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: `${TMod.accentGreen}12`,
                    border: `1px solid ${TMod.accentGreen}30`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: TMod.textPrimary }}>{upgrade.description}</div>
                    <div style={{ fontSize: 12, color: TMod.textSecondary }}>
                      {upgrade.fromLevel} → {upgrade.toLevel}
                    </div>
                  </div>
                  <div style={{ color: TMod.accentGreen, fontWeight: 800, whiteSpace: "nowrap" }}>
                    Due {upgrade.completesOn}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div
        style={{
          maxWidth: "100%",
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          maxHeight: "calc(100vh - 140px)",
          overflowY: "auto",
        }}
      >
        {/* LEFT: TRAINING PRESETS WITH VISUAL COMPARISON */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groundOverview && (
            <div
              style={{
                background: TMod.bgPanel,
                border: `1px solid ${TMod.borderLight}`,
                borderRadius: 12,
                padding: "16px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: TMod.textTertiary,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Training Ground
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: TMod.textTertiary, textTransform: "uppercase" }}>Condition</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: TMod.accentGreen }}>{groundOverview.condition}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: TMod.textTertiary, textTransform: "uppercase" }}>Best Asset</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: TMod.textPrimary }}>{groundOverview.highestFacility}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: TMod.textSecondary }}>
                {groundOverview.facilityCount} facilities • {groundOverview.equipmentCount} equipment sets
              </div>
            </div>
          )}
          {/* PRESET COMPARISON CARDS */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderLight}`,
              borderRadius: 12,
              padding: "16px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: TMod.textTertiary,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Training Presets
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {VISIBLE_PRESETS.map((preset) => {
                const info = PRESETS[preset];
                const isActive = planName === preset;
                return (
                  <button
                    key={preset}
                    disabled={isLoading("SET_TRAINING_PLAN")}
                    onClick={() => {
                      const plan = state.training.find((p) => p.name === preset);
                      if (plan) {
                        startLoading("SET_TRAINING_PLAN");
                        dispatch({ type: "SET_TRAINING_PLAN", planId: plan.id });
                        toast.success(`Training plan set to ${preset}`, 2000);
                        setTimeout(() => stopLoading("SET_TRAINING_PLAN"), 2000);
                      }
                    }}
                    style={{
                      background: isActive ? `${TMod.accentGreen}15` : TMod.bgSecondary,
                      border: `2px solid ${isActive ? TMod.accentGreen : TMod.borderLight}`,
                      borderRadius: 8,
                      padding: "12px",
                      textAlign: "left",
                      cursor: isLoading("SET_TRAINING_PLAN") ? "not-allowed" : "pointer",
                      transition: "all 0.2s ease",
                      opacity: isLoading("SET_TRAINING_PLAN") ? 0.6 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isActive ? TMod.accentGreen : TMod.textPrimary,
                        }}
                      >
                        {preset}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "3px 6px",
                          borderRadius: 3,
                          background: `${getWorkloadColor(info.workload)}25`,
                          color: getWorkloadColor(info.workload),
                          textTransform: "uppercase",
                        }}
                      >
                        {info.workload}
                      </span>
                    </div>

                    {/* METRICS ROW */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 10, color: TMod.textTertiary }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: TMod.accentGold,
                          }}
                        >
                          Development
                        </div>
                        <div style={{ color: TMod.textPrimary, fontWeight: 700 }}>
                          {info.expectedDevelopment}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: TMod.textTertiary }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: getRiskColor(info.risk),
                          }}
                        >
                          Risk
                        </div>
                        <div style={{ color: getRiskColor(info.risk), fontWeight: 700 }}>
                          {info.risk}
                        </div>
                      </div>
                    </div>

                    {/* TARGETED ATTRIBUTES */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {info.targetedAttributes.map((attr) => (
                        <span
                          key={attr}
                          style={{
                            fontSize: 8.5,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: `${TMod.accentCyan}20`,
                            color: TMod.accentCyan,
                            textTransform: "uppercase",
                          }}
                        >
                          {attr}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ background: TMod.bgPanel, border: `1px solid ${TMod.borderLight}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: TMod.textTertiary, textTransform: "uppercase", marginBottom: 6 }}>Assign players</div>
            <div style={{ fontSize: 12, color: TMod.textSecondary, marginBottom: 12 }}>Choose who follows the {planName} preset. Injured players are unavailable.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 7, maxHeight: 260, overflowY: "auto" }}>
              {available.map((player) => {
                const assigned = activePlan?.assignedPlayerIds?.includes(player.id) ?? false;
                return <label key={player.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 6, border: `1px solid ${assigned ? TMod.accentGreen : TMod.borderLight}`, background: assigned ? `${TMod.accentGreen}12` : TMod.bgSecondary, color: TMod.textPrimary, cursor: "pointer", fontSize: 11 }}><input type="checkbox" checked={assigned} onChange={() => { if (!activePlan) return; const next = assigned ? activePlan.assignedPlayerIds.filter((id) => id !== player.id) : [...activePlan.assignedPlayerIds, player.id]; dispatch({ type: "UPDATE_TRAINING_PLAN_PLAYERS", planId: activePlan.id, playerIds: next }); }} /><span style={{ flex: 1 }}>{player.shortName}</span><small style={{ color: TMod.textTertiary }}>{player.pos}</small></label>;
              })}
            </div>
            <div style={{ marginTop: 10, color: TMod.accentGreen, fontSize: 11, fontWeight: 800 }}>{activePlan?.assignedPlayerIds?.length ?? 0} players assigned</div>
          </div>

          {/* WEEKLY SCHEDULE */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderLight}`,
              borderRadius: 12,
              padding: "16px",
              flex: 1,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: TMod.textTertiary,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              This Week
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {WEEK.map((d) => (
                <div
                  key={d.day}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px",
                    borderRadius: 6,
                    background: TMod.bgSecondary,
                    border: `1px solid ${TMod.borderLight}`,
                  }}
                >
                  <span
                    style={{ width: 28, fontSize: 9, fontWeight: 800, color: TMod.textTertiary }}
                  >
                    {d.day}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 10,
                      fontWeight: 600,
                      color: TMod.textSecondary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.session}
                  </span>
                  <div
                    style={{
                      width: 40,
                      height: 3,
                      background: `${TMod.accentCyan}15`,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${d.intensity}%`,
                        height: "100%",
                        background: getIntensityColor(d.intensity),
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: 20,
                      textAlign: "right",
                      fontSize: 9,
                      fontWeight: 700,
                      color: getIntensityColor(d.intensity),
                    }}
                  >
                    {d.intensity}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: CURRENT PRESET DETAILS */}
        <div
          style={{
            background: TMod.bgPanel,
            border: `2px solid ${TMod.accentGreen}40`,
            borderRadius: 12,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxHeight: "calc(100vh - 180px)",
            overflowY: "auto",
          }}
        >
          <div>
            <div
              style={{ fontSize: 28, fontWeight: 900, color: TMod.accentGreen, marginBottom: 4 }}
            >
              {planName}
            </div>
            <div style={{ fontSize: 12, color: TMod.textSecondary, lineHeight: 1.5 }}>
              {presetInfo?.description}
            </div>
          </div>

          {/* DRILLS */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                color: TMod.textTertiary,
                marginBottom: 10,
              }}
            >
              Drills This Week
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {presetInfo?.drills.map((drill) => (
                <div
                  key={drill}
                  style={{
                    padding: "10px 12px",
                    background: `${TMod.accentGreen}10`,
                    border: `1px solid ${TMod.accentGreen}30`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: TMod.textPrimary,
                    fontWeight: 600,
                  }}
                >
                  ✓ {drill}
                </div>
              ))}
            </div>
          </div>

          {/* STATS GRID */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                color: TMod.textTertiary,
                marginBottom: 10,
              }}
            >
              Impact Summary
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div
                style={{
                  padding: "10px",
                  background: TMod.bgSecondary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: TMod.textTertiary,
                    marginBottom: 4,
                  }}
                >
                  Workload
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: getWorkloadColor(presetInfo?.workload || "Moderate"),
                  }}
                >
                  {presetInfo?.workload}
                </div>
              </div>
              <div
                style={{
                  padding: "10px",
                  background: TMod.bgSecondary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: TMod.textTertiary,
                    marginBottom: 4,
                  }}
                >
                  Fatigue
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TMod.textPrimary }}>
                  {presetInfo?.fatigue}
                </div>
              </div>
              <div
                style={{
                  padding: "10px",
                  background: TMod.bgSecondary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: TMod.textTertiary,
                    marginBottom: 4,
                  }}
                >
                  Risk
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: getRiskColor(presetInfo?.risk || "Minimal"),
                  }}
                >
                  {presetInfo?.risk}
                </div>
              </div>
              <div
                style={{
                  padding: "10px",
                  background: TMod.bgSecondary,
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: TMod.textTertiary,
                    marginBottom: 4,
                  }}
                >
                  Development
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TMod.accentGold }}>
                  {presetInfo?.expectedDevelopment}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: TMod.bgPanel,
            border: `1px solid ${TMod.borderLight}`,
            borderRadius: 12,
            padding: "16px",
            gridColumn: "1 / -1",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: TMod.textTertiary,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Training Ground Infrastructure
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {overview?.facilities.map((item) => {
              const isMaxed = item.level >= item.maxLevel;
              const inProgress = item.status === "in_progress";
              const cost = getUpgradeCost("facility", item.id, item.level);
              const canAfford = currentBalance >= cost;
              const disabled = isMaxed || inProgress || !canAfford;

              return (
                <div
                  key={item.id}
                  style={{
                    background: TMod.bgSecondary,
                    border: `1px solid ${TMod.borderLight}`,
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: TMod.textSecondary }}>Condition {item.condition}%</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: TMod.accentGreen }}>
                      Lv {item.level}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: TMod.textSecondary }}>
                    <div>Maint.</div>
                    <div style={{ textAlign: "right", color: TMod.textPrimary, fontWeight: 700 }}>{formatMoney(item.maintenanceCost)}</div>
                    <div>Cost</div>
                    <div style={{ textAlign: "right", color: TMod.textPrimary, fontWeight: 700 }}>{formatMoney(cost)}</div>
                    <div>Build</div>
                    <div style={{ textAlign: "right", color: TMod.textPrimary, fontWeight: 700 }}>{getUpgradeDuration("facility", item.id, item.level)}d</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!disabled) {
                        dispatch({
                          type: "QUEUE_TRAINING_GROUND_UPGRADE",
                          kind: "facility",
                          assetId: item.id,
                        });
                      }
                    }}
                    disabled={disabled}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      background: disabled ? TMod.bgPrimary : TMod.accentGreen,
                      color: disabled ? TMod.textSecondary : TMod.textPrimary,
                      padding: "8px 10px",
                      fontWeight: 800,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.7 : 1,
                    }}
                  >
                    {inProgress ? "In progress" : isMaxed ? "Maxed" : !canAfford ? "Need funds" : "Upgrade"}
                  </button>
                </div>
              );
            })}

            {overview?.equipment.map((item) => {
              const isMaxed = item.level >= item.maxLevel;
              const inProgress = item.status === "in_progress";
              const cost = getUpgradeCost("equipment", item.id, item.level);
              const canAfford = currentBalance >= cost;
              const disabled = isMaxed || inProgress || !canAfford;

              return (
                <div
                  key={item.id}
                  style={{
                    background: TMod.bgSecondary,
                    border: `1px solid ${TMod.borderLight}`,
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: TMod.textSecondary }}>Condition {item.condition}%</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: TMod.accentCyan }}>
                      Lv {item.level}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: TMod.textSecondary }}>
                    <div>Maint.</div>
                    <div style={{ textAlign: "right", color: TMod.textPrimary, fontWeight: 700 }}>{formatMoney(item.maintenanceCost)}</div>
                    <div>Cost</div>
                    <div style={{ textAlign: "right", color: TMod.textPrimary, fontWeight: 700 }}>{formatMoney(cost)}</div>
                    <div>Build</div>
                    <div style={{ textAlign: "right", color: TMod.textPrimary, fontWeight: 700 }}>{getUpgradeDuration("equipment", item.id, item.level)}d</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!disabled) {
                        dispatch({
                          type: "QUEUE_TRAINING_GROUND_UPGRADE",
                          kind: "equipment",
                          assetId: item.id,
                        });
                      }
                    }}
                    disabled={disabled}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      background: disabled ? TMod.bgPrimary : TMod.accentCyan,
                      color: disabled ? TMod.textSecondary : TMod.textPrimary,
                      padding: "8px 10px",
                      fontWeight: 800,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.7 : 1,
                    }}
                  >
                    {inProgress ? "In progress" : isMaxed ? "Maxed" : !canAfford ? "Need funds" : "Upgrade"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: PLAYER DEVELOPMENT & REST RECOMMENDATIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* PLAYER DEVELOPMENT */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderLight}`,
              borderRadius: 12,
              padding: "16px",
              flex: 1,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: TMod.textTertiary,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Top Developers
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {developing.map((p) => (
                <Link
                  key={p.id}
                  to="/player/$playerId"
                  params={{ playerId: p.id }}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      background: TMod.bgSecondary,
                      border: `1px solid ${TMod.borderLight}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: TMod.textPrimary }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 9, color: TMod.accentCyan, marginTop: 2 }}>
                        {p.trainingFocus || "General"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: TMod.accentGreen }}>
                        +{p.trainingProgress}%
                      </div>
                      <div style={{ fontSize: 9, color: TMod.textTertiary }}>Fit: {p.fitness}%</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* REST RECOMMENDED */}
          {needRest.length > 0 && (
            <div
              style={{
                background: `${TMod.accentGold}12`,
                border: `1px solid ${TMod.accentGold}40`,
                borderRadius: 12,
                padding: "16px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: TMod.accentGold,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                ⚠️ Rest Recommended
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {needRest.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: `${TMod.accentGold}15`,
                      border: `1px solid ${TMod.accentGold}30`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, color: TMod.textPrimary }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: TMod.accentGold }}>
                      {p.fitness}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
