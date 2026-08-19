import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { TMod } from "@/components/ui-modern";
import { useGameState } from "@/state/store";
import { useToast } from "@/state/toast-context";
import { useLoading } from "@/state/loading-context";
import { SCOUT_TIER_DEFINITIONS, getAvailableScoutingTargets } from "@/state/scouting-network";
import { formatMoney, parseMoney } from "@/state/finance";

export const Route = createFileRoute("/scouting")({
  head: () => ({
    meta: [
      { title: "Scouting Network — Manager Legacy" },
      {
        name: "description",
        content:
          "Build your scouting network. Hire scouts, deploy assignments, and evaluate prospects worldwide.",
      },
      { property: "og:title", content: "Scouting Network — Manager Legacy" },
      {
        property: "og:description",
        content: "Scouting network management: hire scouts, track assignments, and view reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScoutingNetworkScreen,
});

function ScoutingNetworkScreen() {
  const { state, dispatch } = useGameState();
  const toast = useToast();
  const { isLoading, startLoading, stopLoading } = useLoading();
  const [activeTab, setActiveTab] = useState<"scouts" | "assignments" | "reports">("scouts");
  const [deployStaffId, setDeployStaffId] = useState("");
  const [deployCountry, setDeployCountry] = useState("");
  const [deployDays, setDeployDays] = useState(14);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  const scoutingNetwork = state.scoutingNetwork ?? { scouts: [], assignments: [], reports: [] };
  const scouts = scoutingNetwork.scouts ?? [];
  const assignments = scoutingNetwork.assignments ?? [];
  const reports = scoutingNetwork.reports ?? [];
  const scoutingTargets = useMemo(() => getAvailableScoutingTargets(state), [state]);
  const regionGroups = useMemo(() => {
    const regionNames = ["North America", "South America", "Western Europe", "Eastern Europe", "Africa", "Asia-Pacific"];
    return regionNames.map((name, index) => ({
      name,
      countries: scoutingTargets.filter((_, targetIndex) => targetIndex % regionNames.length === index),
    })).filter((region) => region.countries.length > 0);
  }, [scoutingTargets]);
  const selectedTarget = scoutingTargets.find((target) => target.id === deployCountry);
  const selectedScout = scouts.find((scout) => scout.id === deployStaffId);
  const selectedTier = selectedScout ? SCOUT_TIER_DEFINITIONS.find((tier) => tier.id === selectedScout.tierId) : undefined;
  const projectedFee = selectedTier ? Math.round(selectedTier.cost * (Math.max(1, deployDays) / 30)) : 0;

  const balance = parseMoney(state.finances?.balance ?? 0);

  const activeAssignments = useMemo(() => {
    return assignments.filter((a) => a.status === "active");
  }, [assignments]);

  const completedAssignments = useMemo(() => {
    return assignments.filter((a) => a.status === "completed");
  }, [assignments]);

  const tierData = useMemo(() => {
    return SCOUT_TIER_DEFINITIONS.map((tier) => {
      const tierScouts = scouts.filter((s) => s.tierId === tier.id);
      return { tier, count: tierScouts.length };
    });
  }, [scouts]);

  const handleHireScout = (tierId: string) => {
    try {
      startLoading("HIRE_SCOUT");
      const tier = SCOUT_TIER_DEFINITIONS.find((t) => t.id === tierId);

      if (!tier) {
        toast.error("Scout tier not found", 3000);
        stopLoading("HIRE_SCOUT");
        return;
      }

      dispatch({
        type: "HIRE_SCOUT",
        tierId,
        name: `Scout ${scouts.length + 1}`,
      });
      toast.success(`Hired ${tier?.label || "Scout"} successfully`, 2000);
      setTimeout(() => stopLoading("HIRE_SCOUT"), 2000);
    } catch (error) {
      toast.error(
        `Failed to hire scout: ${error instanceof Error ? error.message : "Unknown error"}`,
        3000,
      );
      stopLoading("HIRE_SCOUT");
    }
  };

  const handleDeployAssignment = () => {
    if (!deployStaffId) {
      toast.error("Please select a scout", 2000);
      return;
    }
    if (!deployCountry) {
      toast.error("Please select target country", 2000);
      return;
    }

    const scout = scouts.find((s) => s.id === deployStaffId);
    startLoading("HIRE_SCOUT");
    dispatch({
      type: "DEPLOY_SCOUTING_ASSIGNMENT",
      scoutId: deployStaffId,
      targetCountryId: deployCountry,
      durationDays: deployDays,
    });
    toast.success(`${scout?.name} deployed to ${deployCountry} for ${deployDays} days`, 2000);
    setTimeout(() => stopLoading("HIRE_SCOUT"), 2000);
    setDeployStaffId("");
    setDeployCountry("");
    setDeployDays(14);
  };

  const tabColors = {
    active: "#7EA7FF",
    inactive: "#6B8CAE",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: TMod.bgPrimary,
        color: TMod.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* TOP HEADER */}
      <div
        style={{
          width: "100%",
          background: `linear-gradient(180deg, ${TMod.bgPrimary}, ${TMod.bgSecondary})`,
          borderBottom: `1px solid ${TMod.borderMid}`,
          padding: "24px 26px",
        }}
      >
        <div style={{ maxWidth: 1440, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              color: TMod.textPrimary,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            DEVELOPMENT
          </div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              marginTop: 8,
              color: TMod.textPrimary,
            }}
          >
            Scouting Network
          </h1>
          <div style={{ fontSize: 16, color: TMod.textSecondary, marginTop: 12 }}>
            Build your talent identification network. Hire scouts, deploy assignments, and evaluate
            worldwide prospects.
          </div>
        </div>
      </div>

      {/* BALANCE & STATUS BAR */}
      <div
        style={{
          background: TMod.bgSecondary,
          borderBottom: `1px solid ${TMod.borderMid}`,
          padding: "16px 26px",
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: TMod.textSecondary,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Available Balance
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: TMod.accentBlue, marginTop: 4 }}>
              {formatMoney(balance)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: TMod.textSecondary,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Active Scouts
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: TMod.accentCyan, marginTop: 4 }}>
                {scouts.length}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: TMod.textSecondary,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Active Assignments
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: TMod.accentGold, marginTop: 4 }}>
                {activeAssignments.length}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: TMod.textSecondary,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Reports Available
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: TMod.accentRed, marginTop: 4 }}>
                {reports.filter((r) => r.status === "new").length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div
        style={{
          background: TMod.bgSecondary,
          borderBottom: `1px solid ${TMod.borderLight}`,
          padding: "12px 26px",
          display: "flex",
          gap: 24,
        }}
      >
        <div style={{ maxWidth: 1440, margin: "0 auto", width: "100%", display: "flex", gap: 24 }}>
          {(["scouts", "assignments", "reports"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                padding: "8px 0",
                fontSize: 14,
                fontWeight: 700,
                color: activeTab === tab ? tabColors.active : tabColors.inactive,
                borderBottom: activeTab === tab ? `2px solid ${tabColors.active}` : "none",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                transition: "all 0.2s",
              }}
            >
              {tab === "scouts" && `Scouts (${scouts.length})`}
              {tab === "assignments" && `Assignments (${assignments.length})`}
              {tab === "reports" && `Reports (${reports.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 26px" }}>
        {activeTab === "scouts" && (
          <div>
            <h2
              style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, color: TMod.textPrimary }}
            >
              Available Scout Tiers
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {tierData.map(({ tier, count }) => (
                <div
                  key={tier.id}
                  style={{
                    background: `linear-gradient(135deg, ${TMod.bgSecondary}, ${TMod.bgTertiary})`,
                    border: `1px solid ${TMod.borderMid}`,
                    borderRadius: 8,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: TMod.textPrimary,
                          margin: 0,
                        }}
                      >
                        {tier.label}
                      </h3>
                      <div style={{ fontSize: 12, color: TMod.textSecondary, marginTop: 4 }}>
                        {tier.description}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: TMod.accentCyan }}>
                      ×{count}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      margin: "12px 0",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: TMod.textTertiary,
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        Cost
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TMod.accentGold,
                          marginTop: 4,
                        }}
                      >
                        {formatMoney(tier.cost)}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: TMod.textTertiary,
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        Accuracy
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TMod.accentBlue,
                          marginTop: 4,
                        }}
                      >
                        {tier.scoutingAccuracy}%
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: TMod.textTertiary,
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        Report Speed
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TMod.accentRed,
                          marginTop: 4,
                        }}
                      >
                        {tier.reportSpeedDays}d
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: TMod.textTertiary,
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        Discovery
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TMod.accentCyan,
                          marginTop: 4,
                        }}
                      >
                        Tier {tier.discoveryQuality}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleHireScout(tier.id)}
                    disabled={balance < tier.cost}
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "10px 16px",
                      background: balance < tier.cost ? TMod.textMuted : TMod.gradientBlue,
                      border: "none",
                      borderRadius: 6,
                      color: balance < tier.cost ? TMod.textTertiary : TMod.textPrimary,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: balance < tier.cost ? "not-allowed" : "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {balance < tier.cost ? "Insufficient Funds" : "Hire Scout"}
                  </button>
                </div>
              ))}
            </div>

            {scouts.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: "#edf8ff" }}>
                  Active Scouts ({scouts.length})
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 12,
                  }}
                >
                  {scouts.map((scout) => {
                    const tier = SCOUT_TIER_DEFINITIONS.find((t) => t.id === scout.tierId);
                    const scoutAssignments = assignments.filter((a) => a.scoutId === scout.id);
                    return (
                      <div
                        key={scout.id}
                        style={{
                          background: "rgba(10,25,45,0.8)",
                          border: "1px solid rgba(149,225,211,0.3)",
                          borderRadius: 6,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "start",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#edf8ff" }}>
                              {scout.name}
                            </div>
                            <div style={{ fontSize: 12, color: "#a8bbd6", marginTop: 2 }}>
                              {tier?.label ?? "Unknown"}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#95E1D3",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            Active: {scoutAssignments.filter((a) => a.status === "active").length}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {scouts.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: TMod.accentGold }}>
                  Deploy Assignment
                </h2>
                <div
                  style={{
                    padding: "20px",
                    borderRadius: 12,
                    background: TMod.bgPanel,
                    border: `1px solid ${TMod.borderMid}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10 }}>
                    <select
                      value={deployStaffId}
                      onChange={(e) => setDeployStaffId(e.target.value)}
                      style={{
                        padding: "10px",
                        borderRadius: 6,
                        border: `1px solid ${TMod.borderMid}`,
                        background: TMod.bgTertiary,
                        color: TMod.textPrimary,
                        fontSize: 12,
                      }}
                    >
                      <option value="">Select scout...</option>
                      {scouts.map((scout) => (
                        <option key={scout.id} value={scout.id}>
                          {scout.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={deployDays}
                      onChange={(e) => setDeployDays(Number(e.target.value))}
                      min={7}
                      max={90}
                      placeholder="Days..."
                      style={{
                        padding: "10px",
                        borderRadius: 6,
                        border: `1px solid ${TMod.borderMid}`,
                        background: TMod.bgTertiary,
                        color: TMod.textPrimary,
                        fontSize: 12,
                      }}
                    />
                    <div />
                    <button
                      onClick={handleDeployAssignment}
                      disabled={isLoading("HIRE_SCOUT")}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: isLoading("HIRE_SCOUT") ? TMod.textMuted : TMod.gradientGold,
                        color: TMod.bgPrimary,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: isLoading("HIRE_SCOUT") ? "not-allowed" : "pointer",
                        opacity: isLoading("HIRE_SCOUT") ? 0.6 : 1,
                      }}
                    >
                      Deploy
                    </button>
                  </div>
                  <div style={{ marginTop: 8, borderTop: `1px solid ${TMod.borderLight}`, paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ color: TMod.textPrimary, fontWeight: 800, fontSize: 13 }}>Worldwide deployment map</div>
                        <div style={{ color: TMod.textTertiary, fontSize: 11, marginTop: 4 }}>Select a region, then choose a country inside it.</div>
                      </div>
                      {selectedTarget && <div style={{ color: TMod.accentCyan, fontSize: 11, fontWeight: 800 }}>Target: {selectedTarget.name}</div>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8, minHeight: 150, padding: 12, borderRadius: 10, background: "radial-gradient(circle at 35% 35%, rgba(79,219,255,.12), transparent 35%), linear-gradient(145deg,#071827,#122e42)", border: `1px solid ${TMod.borderMid}` }}>
                      {regionGroups.map((region, index) => {
                        const active = activeRegion === region.name;
                        return <button key={region.name} type="button" onClick={() => setActiveRegion(active ? null : region.name)} style={{ minHeight: 74, padding: 10, textAlign: "left", borderRadius: 8, border: `1px solid ${active ? TMod.accentCyan : "rgba(149,225,211,.25)"}`, background: active ? "rgba(79,219,255,.18)" : `rgba(${index % 2 ? "149,225,211" : "79,219,255"},.08)`, color: TMod.textPrimary, cursor: "pointer", clipPath: index % 2 ? "polygon(8% 0, 100% 10%, 92% 100%, 0 88%)" : "polygon(0 12%, 88% 0, 100% 88%, 12% 100%)" }}><div style={{ fontSize: 11, fontWeight: 900 }}>{region.name}</div><div style={{ fontSize: 10, color: active ? TMod.textPrimary : TMod.textSecondary, marginTop: 7 }}>{region.countries.length} countries</div></button>;
                      })}
                    </div>
                    {activeRegion && <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>{regionGroups.find((region) => region.name === activeRegion)?.countries.map((country) => <button key={country.id} type="button" onClick={() => setDeployCountry(country.id)} style={{ padding: "7px 10px", borderRadius: 5, border: `1px solid ${deployCountry === country.id ? TMod.accentGold : TMod.borderLight}`, background: deployCountry === country.id ? `${TMod.accentGold}20` : TMod.bgTertiary, color: deployCountry === country.id ? TMod.accentGold : TMod.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{country.name}</button>)}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12, color: TMod.textTertiary, fontSize: 11 }}><span>{selectedScout ? `${selectedScout.name} · ${selectedTier?.label ?? "Scout"}` : "Select a scout above"}</span><strong style={{ color: TMod.accentGold }}>{projectedFee ? `Projected fee: ${formatMoney(projectedFee)}` : "Choose duration"}</strong></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "assignments" && (
          <div>
            {activeAssignments.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: "#FFB800" }}>
                  Active Assignments
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                    gap: 12,
                  }}
                >
                  {activeAssignments.map((assignment) => {
                    const scout = scouts.find((s) => s.id === assignment.scoutId);
                    const progress = (assignment.progressDays / assignment.durationDays) * 100;
                    return (
                      <div
                        key={assignment.id}
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(8,20,40,0.8), rgba(10,25,45,0.6))",
                          border: "1px solid rgba(255,184,0,0.3)",
                          borderRadius: 8,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#edf8ff",
                            marginBottom: 8,
                          }}
                        >
                          {assignment.assignmentLabel}
                        </div>
                        <div style={{ fontSize: 12, color: "#a8bbd6", marginBottom: 2 }}>
                          Scout: {scout?.name ?? "Unknown"}
                        </div>
                        <div style={{ fontSize: 12, color: "#a8bbd6", marginBottom: 12 }}>
                          Target: {assignment.targetCountryId}
                        </div>

                        {/* Progress Bar */}
                        <div
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            borderRadius: 4,
                            height: 8,
                            overflow: "hidden",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              background: `linear-gradient(90deg, #FFB800, #F38181)`,
                              height: "100%",
                              width: `${progress}%`,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>

                        <div style={{ fontSize: 11, color: "#a8bbd6", textAlign: "center" }}>
                          {assignment.progressDays} / {assignment.durationDays} days
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {completedAssignments.length > 0 && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: "#95E1D3" }}>
                  Completed Assignments
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                    gap: 12,
                  }}
                >
                  {completedAssignments.map((assignment) => {
                    const scout = scouts.find((s) => s.id === assignment.scoutId);
                    const report = reports.find((r) => r.assignmentId === assignment.id);
                    return (
                      <div
                        key={assignment.id}
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(10,30,40,0.8), rgba(8,25,40,0.6))",
                          border: "1px solid rgba(149,225,211,0.2)",
                          borderRadius: 8,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#95E1D3",
                            marginBottom: 8,
                          }}
                        >
                          ✓ {assignment.assignmentLabel}
                        </div>
                        <div style={{ fontSize: 12, color: "#a8bbd6", marginBottom: 2 }}>
                          Scout: {scout?.name ?? "Unknown"}
                        </div>
                        <div style={{ fontSize: 12, color: "#a8bbd6", marginBottom: 2 }}>
                          Target: {assignment.targetCountryId}
                        </div>
                        <div style={{ fontSize: 12, color: "#a8bbd6" }}>
                          Report: {report ? report.playerInfo.name : "Pending"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeAssignments.length === 0 && completedAssignments.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#7a8fa3" }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No assignments yet</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Hire scouts to start deploying assignments to target regions.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <div>
            {reports.length > 0 ? (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: "#F38181" }}>
                  Scout Reports
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: 12,
                  }}
                >
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(8,20,40,0.8), rgba(10,25,45,0.6))",
                        border:
                          report.status === "new"
                            ? "1px solid rgba(243,129,129,0.4)"
                            : report.status === "shortlisted"
                              ? "1px solid rgba(149,225,211,0.3)"
                              : "1px solid rgba(126,169,255,0.2)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "start",
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#edf8ff" }}>
                            {report.playerInfo.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#a8bbd6", marginTop: 2 }}>
                            {report.playerInfo.position} • {report.playerInfo.age} years old
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            background:
                              report.status === "new"
                                ? "rgba(243,129,129,0.2)"
                                : report.status === "shortlisted"
                                  ? "rgba(149,225,211,0.2)"
                                  : "rgba(126,169,255,0.2)",
                            color:
                              report.status === "new"
                                ? "#F38181"
                                : report.status === "shortlisted"
                                  ? "#95E1D3"
                                  : "#7EA7FF",
                            borderRadius: 4,
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}
                        >
                          {report.status}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#7a8fa3",
                              textTransform: "uppercase",
                              fontWeight: 600,
                            }}
                          >
                            Ability
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#7EA7FF",
                              marginTop: 4,
                            }}
                          >
                            {report.abilityRange[0]}-{report.abilityRange[1]}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#7a8fa3",
                              textTransform: "uppercase",
                              fontWeight: 600,
                            }}
                          >
                            Confidence
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#FFB800",
                              marginTop: 4,
                            }}
                          >
                            {report.scoutingAccuracy}%
                          </div>
                        </div>
                      </div>

                      {report.potentialRange && (
                        <div
                          style={{
                            marginBottom: 12,
                            padding: "8px",
                            background: "rgba(149,225,211,0.1)",
                            borderRadius: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "#7a8fa3",
                              textTransform: "uppercase",
                              fontWeight: 600,
                            }}
                          >
                            Potential
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#95E1D3",
                              marginTop: 2,
                            }}
                          >
                            {report.potentialRange[0]}-{report.potentialRange[1]}
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 12,
                          color: "#a8bbd6",
                          fontStyle: "italic",
                          marginBottom: 12,
                        }}
                      >
                        "{report.recommendation}"
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <button
                          style={{
                            padding: "8px 12px",
                            background: "linear-gradient(135deg, #95E1D3, #7AC9B2)",
                            border: "none",
                            borderRadius: 4,
                            color: "#081120",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            textTransform: "uppercase",
                          }}
                        >
                          Shortlist
                        </button>
                        <button
                          style={{
                            padding: "8px 12px",
                            background: "linear-gradient(135deg, #FF6B6B, #E55555)",
                            border: "none",
                            borderRadius: 4,
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            textTransform: "uppercase",
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#7a8fa3" }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No scout reports yet</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Complete scouting assignments to receive reports on scouted players.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
