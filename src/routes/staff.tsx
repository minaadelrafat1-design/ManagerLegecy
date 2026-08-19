import { createFileRoute } from "@tanstack/react-router";
import { TMod } from "@/components/ui-modern";
import { useGameState } from "@/state/store";
import { useToast } from "@/state/toast-context";
import { useLoading } from "@/state/loading-context";
import { useState, useMemo } from "react";
import { validateStaffName, validateStaffRole, validateStaffRating } from "@/lib/validation";

const COACHING_POSITIONS = [
  { id: "head-coach", label: "Head Coach", description: "Oversees all tactical decisions" },
  { id: "assistant-coach", label: "Assistant Coach", description: "Supports head coach strategy" },
  { id: "goalkeeper-coach", label: "Goalkeeper Coach", description: "Specializes in goalkeeper training" },
  { id: "fitness-coach", label: "Fitness Coach", description: "Manages player fitness & conditioning" },
  { id: "analyst", label: "Analyst", description: "Opposition analysis & data insights" },
];

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Staff — Manager Legacy" }] }),
  component: StaffScreen,
});

function StaffScreen() {
  const { state, dispatch } = useGameState();
  const toast = useToast();
  const { isLoading, startLoading, stopLoading } = useLoading();
  const staff = state.staff ?? [];
  const [name, setName] = useState("");
  const [role, setRole] = useState("Assistant Manager");
  const [rating, setRating] = useState(50);
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // positionId -> staffId
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("head-coach");

  const clubStaff = staff.filter((s) => s.clubId === state.currentClub.id);
  const unassignedStaff = clubStaff.filter((s) => !Object.values(assignments).includes(s.id));

  const handleAssignStaff = () => {
    if (!selectedStaffId) {
      toast.error("Please select a staff member", 2000);
      return;
    }
    const staffMember = clubStaff.find((s) => s.id === selectedStaffId);
    setAssignments((prev) => ({ ...prev, [selectedPosition]: selectedStaffId }));
    toast.success(`${staffMember?.name} assigned to position`, 1500);
    setSelectedStaffId("");
  };

  const handleRemoveAssignment = (positionId: string) => {
    setAssignments((prev) => {
      const newAssignments = { ...prev };
      delete newAssignments[positionId];
      return newAssignments;
    });
    toast.info("Assignment removed", 1500);
  };

  function hire() {
    try {
      // Validate inputs
      const nameValidation = validateStaffName(name);
      if (!nameValidation.isValid) {
        toast.error(nameValidation.error || "Invalid staff name", 3000);
        return;
      }

      const roleValidation = validateStaffRole(role);
      if (!roleValidation.isValid) {
        toast.error(roleValidation.error || "Invalid staff role", 3000);
        return;
      }

      const ratingValidation = validateStaffRating(rating);
      if (!ratingValidation.isValid) {
        toast.error(ratingValidation.error || "Invalid staff rating", 3000);
        return;
      }

      startLoading("HIRE_STAFF");
      const member = {
        id: `staff-${Date.now()}`,
        name: name.trim(),
        role,
        nationality: "",
        rating,
        clubId: state.currentClub.id,
      };
      dispatch({ type: "HIRE_STAFF", member });
      toast.success(`${role} ${name} hired successfully`, 2000);
      setTimeout(() => stopLoading("HIRE_STAFF"), 2000);
      setName("");
      setRating(50);
    } catch (error) {
      toast.error(
        `Failed to hire staff: ${error instanceof Error ? error.message : "Unknown error"}`,
        3000,
      );
      stopLoading("HIRE_STAFF");
    }
  }

  function fire(id: string) {
    startLoading("FIRE_STAFF");
    const staffMember = staff.find((s) => s.id === id);
    dispatch({ type: "FIRE_STAFF", staffId: id });
    toast.info(`${staffMember?.name} released from staff`, 2000);
    setTimeout(() => stopLoading("FIRE_STAFF"), 2000);
  }

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
            MANAGEMENT
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
            Staff
          </h1>
          <div style={{ fontSize: 16, color: TMod.textSecondary, marginTop: 12 }}>
            Hire, manage and review your backroom staff
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
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
        {/* CLUB STAFF */}
        <div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.12em",
              color: TMod.accentGreen,
              fontWeight: 900,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Club Staff ({clubStaff.length})
          </div>
          {clubStaff.length === 0 ? (
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                background: TMod.bgPanel,
                border: `1px solid ${TMod.borderMid}`,
                textAlign: "center",
                color: TMod.textSecondary,
              }}
            >
              No staff members hired yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clubStaff.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "14px",
                    borderRadius: 12,
                    background: TMod.bgPanel,
                    border: `1px solid ${TMod.borderMid}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TMod.textPrimary }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: TMod.textSecondary, marginTop: 2 }}>
                      {s.role} · Rating {s.rating}
                    </div>
                  </div>
                  <button
                    onClick={() => fire(s.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      border: `1px solid ${TMod.accentRed}55`,
                      background: `${TMod.accentRed}15`,
                      color: TMod.accentRed,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Fire
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HIRE STAFF */}
        <div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.12em",
              color: TMod.accentGreen,
              fontWeight: 900,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Hire New Staff
          </div>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Staff name..."
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `1px solid ${TMod.borderMid}`,
                  background: TMod.bgTertiary,
                  color: TMod.textPrimary,
                  fontSize: 12,
                }}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `1px solid ${TMod.borderMid}`,
                  background: TMod.bgTertiary,
                  color: TMod.textPrimary,
                  fontSize: 12,
                }}
              >
                <option>Assistant Manager</option>
                <option>Head Coach</option>
                <option>Head Physio</option>
                <option>Chief Scout</option>
                <option>Analyst</option>
                <option>Scout</option>
                <option>Physio</option>
              </select>
              <input
                type="number"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                min={1}
                max={100}
                placeholder="Rating (1-100)"
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `1px solid ${TMod.borderMid}`,
                  background: TMod.bgTertiary,
                  color: TMod.textPrimary,
                  fontSize: 12,
                }}
              />
              <button
                onClick={hire}
                style={{
                  padding: "10px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: TMod.gradientGreen,
                  color: TMod.bgPrimary,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Hire
              </button>
            </div>
          </div>
        </div>

        {/* STAFF ASSIGNMENTS */}
        <div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.12em",
              color: TMod.accentCyan,
              fontWeight: 900,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Coaching Positions
          </div>

          {/* Current Assignments */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            {COACHING_POSITIONS.map((position) => {
              const assignedStaff = clubStaff.find((s) => s.id === assignments[position.id]);
              return (
                <div
                  key={position.id}
                  style={{
                    padding: "16px",
                    borderRadius: 12,
                    background: TMod.bgPanel,
                    border: `1px solid ${TMod.borderMid}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TMod.textPrimary }}>
                      {position.label}
                    </div>
                    <div style={{ fontSize: 11, color: TMod.textSecondary, marginTop: 4 }}>
                      {position.description}
                    </div>
                  </div>

                  {assignedStaff ? (
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: 6,
                        background: `${TMod.accentCyan}20`,
                        border: `1px solid ${TMod.accentCyan}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: TMod.accentCyan }}>
                          ✓ {assignedStaff.name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: TMod.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          Rating: {assignedStaff.rating}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAssignment(position.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: `1px solid ${TMod.accentRed}55`,
                          background: `${TMod.accentRed}15`,
                          color: TMod.accentRed,
                          fontSize: 9,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: 6,
                        background: `${TMod.textMuted}15`,
                        color: TMod.textTertiary,
                        fontSize: 11,
                        textAlign: "center",
                      }}
                    >
                      Unassigned
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Assign Staff */}
          {unassignedStaff.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: "0.12em",
                  color: TMod.accentGold,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Assign Staff to Position
              </div>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10 }}>
                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: 6,
                      border: `1px solid ${TMod.borderMid}`,
                      background: TMod.bgTertiary,
                      color: TMod.textPrimary,
                      fontSize: 12,
                    }}
                  >
                    {COACHING_POSITIONS.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: 6,
                      border: `1px solid ${TMod.borderMid}`,
                      background: TMod.bgTertiary,
                      color: TMod.textPrimary,
                      fontSize: 12,
                    }}
                  >
                    <option value="">Select staff member...</option>
                    {unassignedStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role}, Rating {s.rating})
                      </option>
                    ))}
                  </select>
                  <div />
                  <button
                    onClick={handleAssignStaff}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: TMod.gradientBlue,
                      color: TMod.bgPrimary,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
