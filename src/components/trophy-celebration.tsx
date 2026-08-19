import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getConfirmedTrophyAchievements } from "@/state/achievements";
import { useGameState } from "@/state/store";

export function TrophyCelebration() {
  const { state, dispatch } = useGameState();
  const [activeId, setActiveId] = useState<string | null>(null);
  const achievements = getConfirmedTrophyAchievements(state).filter(
    (achievement) => !(state.seenAchievementIds ?? []).includes(achievement.id),
  );
  const candidate = achievements[0];
  const activeAchievement = activeId
    ? getConfirmedTrophyAchievements(state).find((achievement) => achievement.id === activeId)
    : undefined;

  useEffect(() => {
    if (!activeId && candidate) setActiveId(candidate.id);
  }, [activeId, candidate]);

  useEffect(() => {
    if (activeId && !(state.seenAchievementIds ?? []).includes(activeId)) {
      dispatch({ type: "MARK_ACHIEVEMENT_SEEN", achievementId: activeId });
    }
  }, [activeId, dispatch, state.seenAchievementIds]);

  if (!activeAchievement) return null;

  const continueToNext = () => setActiveId(null);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="trophy-celebration-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(3, 8, 20, 0.68)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          padding: "34px 28px 26px",
          textAlign: "center",
          color: "#f7fbff",
          background: "linear-gradient(145deg, #102a48, #071426)",
          border: "1px solid rgba(255, 211, 77, 0.72)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 36px rgba(255, 211, 77, 0.18)",
          pointerEvents: "auto",
          animation: "trophy-celebration-in 420ms ease-out both",
        }}
      >
        <div style={{ fontSize: 72, lineHeight: 1, animation: "trophy-bounce 1.3s ease-in-out infinite" }} aria-hidden="true">
          🏆
        </div>
        <div style={{ marginTop: 18, color: "#ffd34d", fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {activeAchievement.season}
        </div>
        <h2 id="trophy-celebration-title" style={{ margin: "10px 0 6px", fontSize: 34, fontWeight: 900 }}>
          {activeAchievement.achievement}
        </h2>
        <div style={{ fontSize: 21, fontWeight: 800 }}>{activeAchievement.competitionName}</div>
        <div style={{ marginTop: 8, color: "#b9cbe3", fontSize: 16 }}>{activeAchievement.clubName}</div>
        <div style={{ marginTop: 22, color: "#ffd34d", fontSize: 14, fontWeight: 800, letterSpacing: "0.08em" }}>
          Congratulations, champions!
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
          <button
            type="button"
            onClick={continueToNext}
            style={{ border: "none", borderRadius: 7, padding: "11px 20px", background: "#ffd34d", color: "#101b2d", fontWeight: 900, cursor: "pointer" }}
          >
            Continue
          </button>
          <Link
            to="/season-report"
            onClick={continueToNext}
            style={{ border: "1px solid rgba(255,255,255,0.32)", borderRadius: 7, padding: "10px 18px", color: "#f7fbff", textDecoration: "none", fontWeight: 800 }}
          >
            View Season Report
          </Link>
        </div>
      </div>
      <style>{`
        @keyframes trophy-celebration-in {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes trophy-bounce {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-8px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
}
