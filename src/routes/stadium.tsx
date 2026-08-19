import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useGameState } from "@/state/store";
import { formatMoney, parseMoney } from "@/state/finance";
import {
  createStadiumDefaults,
  getStadiumOverview,
  getStadiumUpgradeStatusForComponent,
} from "@/state/stadium";
import { TMod } from "@/components/ui-modern";

export const Route = createFileRoute("/stadium")({
  head: () => ({ meta: [{ title: "Stadium — Manager Legacy" }] }),
  component: StadiumScreen,
});

function StadiumScreen() {
  const { state, dispatch } = useGameState();
  const club = state.currentClub;
  const stadium = club?.stadium ?? createStadiumDefaults(club);
  const overview = getStadiumOverview(club);
  const currentBalance = parseMoney(state.finances?.balance ?? 0);

  const activeUpgrades = stadium.upgrades.filter((upgrade) => upgrade.status === "in_progress");
  const [selectedComponentId, setSelectedComponentId] = useState<string>(overview.components[0]?.id ?? "seating");
  const selectedComponent = overview.components.find((component) => component.id === selectedComponentId) ?? overview.components[0];
  const previewCapacity = selectedComponent && selectedComponent.level < selectedComponent.maxLevel
    ? overview.capacity + (selectedComponent.id === "seating" ? selectedComponent.capacityImpact / Math.max(1, selectedComponent.level) : selectedComponent.capacityImpact / Math.max(1, selectedComponent.level))
    : overview.capacity;
  const previewMaintenance = selectedComponent && selectedComponent.level < selectedComponent.maxLevel
    ? overview.maintenanceCost + (selectedComponent.maintenanceCost / Math.max(1, selectedComponent.level)) * 0.18
    : overview.maintenanceCost;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: TMod.bgPrimary,
        color: TMod.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
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
              color: TMod.accentGreen,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            CLUB OPERATIONS
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
            Stadium & Facilities
          </h1>
          <div style={{ fontSize: 16, color: TMod.textSecondary, marginTop: 12 }}>
            {club?.name ?? "Current club"} • {stadium.name}
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
          }}
        >
          {[
            { label: "Capacity", value: `${overview.capacity.toLocaleString()}` },
            { label: "Condition", value: `${stadium.condition}%` },
            { label: "Maintenance", value: formatMoney(stadium.maintenanceCost) },
            { label: "Matchday Ops", value: formatMoney(stadium.matchdayOperatingCost) },
          ].map((metric) => (
            <div
              key={metric.label}
              style={{
                background: TMod.bgPanel,
                border: `1px solid ${TMod.borderMid}`,
                borderRadius: 14,
                padding: 18,
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ fontSize: 12, color: TMod.textSecondary, marginBottom: 8 }}>
                {metric.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: TMod.textPrimary }}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(360px,1.15fr) minmax(280px,.85fr)", gap: 18, alignItems: "stretch" }}>
          <div style={{ ...visualPanel, minHeight: 360 }}>
            <div style={eyebrow}>Stadium visualizer</div>
            <div style={{ color: TMod.textSecondary, fontSize: 13, marginTop: 6 }}>Select a facility below to preview how the ground changes before committing funds.</div>
            <div style={stadiumShell}>
              <div style={{ ...standStyle, ...northStand, height: `${48 + (stadium.componentLevels.seating ?? 1) * 5}px` }}><span>North Stand</span><strong>{Math.round(overview.capacity * .32).toLocaleString()}</strong></div>
              <div style={{ ...standStyle, ...southStand, height: `${48 + (stadium.componentLevels.seating ?? 1) * 5}px` }}><span>South Stand</span><strong>{Math.round(overview.capacity * .32).toLocaleString()}</strong></div>
              <div style={{ ...standStyle, ...westStand, width: `${42 + (stadium.componentLevels.seating ?? 1) * 4}px` }}><span>West Stand</span><strong>{Math.round(overview.capacity * .18).toLocaleString()}</strong></div>
              <div style={{ ...standStyle, ...eastStand, width: `${42 + (stadium.componentLevels.seating ?? 1) * 4}px` }}><span>East Stand</span><strong>{Math.round(overview.capacity * .18).toLocaleString()}</strong></div>
              <div style={{ ...cornerStyle, top: 70, left: 92 }}>NW</div><div style={{ ...cornerStyle, top: 70, right: 92 }}>NE</div><div style={{ ...cornerStyle, bottom: 70, left: 92 }}>SW</div><div style={{ ...cornerStyle, bottom: 70, right: 92 }}>SE</div>
              <div style={pitchStyle}><div style={centerLine} /><div style={centerCircle} /><span style={{ position: "absolute", bottom: 10, left: 12, color: "rgba(255,255,255,.55)", fontSize: 9, letterSpacing: ".12em" }}>MATCH PITCH</span></div>
            </div>
          </div>
          <div style={visualPanel}>
            <div style={eyebrow}>Upgrade preview</div>
            <h2 style={{ margin: "8px 0 4px", fontSize: 24 }}>{selectedComponent?.label ?? "Select a facility"}</h2>
            <div style={{ color: TMod.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{selectedComponent?.description}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
              <PreviewMetric label="Level" value={`Lv ${selectedComponent?.level ?? 1}`} next={selectedComponent && selectedComponent.level < selectedComponent.maxLevel ? `Lv ${selectedComponent.nextLevel}` : "MAX"} />
              <PreviewMetric label="Capacity" value={overview.capacity.toLocaleString()} next={previewCapacity.toLocaleString()} />
              <PreviewMetric label="Condition" value={`${stadium.condition}%`} next={`${Math.min(100, stadium.condition + (selectedComponent?.id === "pitch" ? 8 : 4))}%`} />
              <PreviewMetric label="Maintenance" value={formatMoney(overview.maintenanceCost)} next={formatMoney(Math.round(previewMaintenance))} />
            </div>
            <div style={{ marginTop: 20, padding: 12, borderRadius: 8, background: "rgba(240,194,75,.08)", border: `1px solid ${TMod.accentGold}44`, color: TMod.textSecondary, fontSize: 12 }}>
              <strong style={{ color: TMod.accentGold }}>Investment</strong><br />{selectedComponent ? `${formatMoney(selectedComponent.cost)} · ${selectedComponent.durationDays} days` : "Choose a facility to preview."}
            </div>
          </div>
        </div>

        <div
          style={{
            background: TMod.bgPanel,
            border: `1px solid ${TMod.borderMid}`,
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.12em",
              color: TMod.accentGreen,
              fontWeight: 900,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Active work
          </div>
          {activeUpgrades.length === 0 ? (
            <div style={{ color: TMod.textSecondary }}>
              No stadium works are currently underway.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activeUpgrades.map((upgrade) => (
                <div
                  key={upgrade.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    background: "rgba(34, 197, 94, 0.08)",
                    border: `1px solid ${TMod.borderMid}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{upgrade.description}</div>
                    <div style={{ color: TMod.textSecondary, fontSize: 13 }}>
                      {upgrade.fromLevel} → {upgrade.toLevel}
                    </div>
                  </div>
                  <div style={{ color: TMod.accentGreen, fontWeight: 700, whiteSpace: "nowrap" }}>
                    Due {upgrade.completesOn}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          {overview.components.map((component) => {
            const inProgress = getStadiumUpgradeStatusForComponent(club, component.id);
            const canAfford = currentBalance >= component.cost;
            const isMaxed = component.level >= component.maxLevel;
            const disabled = !canAfford || isMaxed || !!inProgress;

            return (
              <div
                key={component.id}
                style={{
                  background: TMod.bgPanel,
                  border: `1px solid ${TMod.borderMid}`,
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  outline: selectedComponentId === component.id ? `2px solid ${TMod.accentCyan}` : "none",
                }}
                onClick={() => setSelectedComponentId(component.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{component.label}</div>
                    <div style={{ color: TMod.textSecondary, fontSize: 13, marginTop: 4 }}>
                      {component.description}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: inProgress ? "rgba(34, 197, 94, 0.12)" : "rgba(148, 163, 184, 0.12)",
                      color: inProgress ? TMod.accentGreen : TMod.textSecondary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inProgress ? "In progress" : isMaxed ? "Maxed" : `Lv ${component.level}`}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                  <div style={{ color: TMod.textSecondary }}>Current</div>
                  <div style={{ textAlign: "right", fontWeight: 700 }}>Lv {component.level}</div>
                  <div style={{ color: TMod.textSecondary }}>Impact</div>
                  <div style={{ textAlign: "right", fontWeight: 700 }}>
                    +{component.capacityImpact.toLocaleString()} cap
                  </div>
                  <div style={{ color: TMod.textSecondary }}>Maintenance</div>
                  <div style={{ textAlign: "right", fontWeight: 700 }}>
                    {formatMoney(component.maintenanceCost)}
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: 10,
                    borderTop: `1px solid ${TMod.borderMid}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: TMod.textSecondary, textTransform: "uppercase" }}>
                      Upgrade cost
                    </div>
                    <div style={{ fontWeight: 800 }}>{formatMoney(component.cost)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!disabled) {
                        dispatch({ type: "QUEUE_STADIUM_UPGRADE", componentId: component.id });
                      }
                    }}
                    disabled={disabled}
                    style={{
                      border: "none",
                      borderRadius: 10,
                      background: disabled ? TMod.bgSecondary : TMod.accentGreen,
                      color: disabled ? TMod.textSecondary : TMod.textPrimary,
                      padding: "10px 14px",
                      fontWeight: 800,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    {inProgress
                      ? `Due ${inProgress.completesOn}`
                      : isMaxed
                        ? "Maxed"
                        : !canAfford
                          ? "Insufficient funds"
                          : "Upgrade"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value, next }: { label: string; value: string; next: string }) {
  return <div style={{ padding: 11, borderRadius: 8, background: "rgba(0,0,0,.16)", border: `1px solid ${TMod.borderLight}` }}><div style={{ color: TMod.textTertiary, fontSize: 10, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 5, fontWeight: 800 }}>{value}</div><div style={{ marginTop: 3, color: TMod.accentGreen, fontSize: 11, fontWeight: 700 }}>→ {next}</div></div>;
}

const visualPanel: CSSProperties = { background: TMod.bgPanel, border: `1px solid ${TMod.borderMid}`, borderRadius: 14, padding: 18, boxShadow: "0 8px 24px rgba(0,0,0,.18)" };
const eyebrow: CSSProperties = { fontSize: 11, color: TMod.accentGreen, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" };
const stadiumShell: CSSProperties = { position: "relative", height: 285, marginTop: 18, borderRadius: 18, background: "linear-gradient(145deg,#26364a,#152333)", border: "10px solid #27384b", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.08), 0 14px 30px rgba(0,0,0,.25)" };
const standStyle: CSSProperties = { position: "absolute", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 7, background: "linear-gradient(135deg,#8798a8,#4d6073)", border: "2px solid #b7c5d1", color: "#102030", fontSize: 9, fontWeight: 800, textTransform: "uppercase", boxShadow: "0 5px 12px rgba(0,0,0,.3)" };
const northStand: CSSProperties = { top: 8, left: "18%", right: "18%" };
const southStand: CSSProperties = { bottom: 8, left: "18%", right: "18%" };
const westStand: CSSProperties = { top: "24%", bottom: "24%", left: 8, writingMode: "vertical-rl" };
const eastStand: CSSProperties = { top: "24%", bottom: "24%", right: 8, writingMode: "vertical-rl" };
const cornerStyle: CSSProperties = { position: "absolute", zIndex: 3, width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 6, background: "#d0a84e", color: "#251a05", fontSize: 8, fontWeight: 900 };
const pitchStyle: CSSProperties = { position: "absolute", inset: "25% 22%", borderRadius: 8, background: "repeating-linear-gradient(90deg,#24734d 0 18px,#2b8056 18px 36px)", border: "2px solid rgba(255,255,255,.65)", boxShadow: "0 0 20px rgba(31,138,83,.45)" };
const centerLine: CSSProperties = { position: "absolute", top: 0, bottom: 0, left: "50%", borderLeft: "1px solid rgba(255,255,255,.65)" };
const centerCircle: CSSProperties = { position: "absolute", width: 34, height: 34, border: "1px solid rgba(255,255,255,.65)", borderRadius: "50%", top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
