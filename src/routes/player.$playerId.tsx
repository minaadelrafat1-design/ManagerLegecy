import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  T,
  Card,
  StatusBadge,
  Divider,
  SectionHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import { ScreenHeader, FitnessRing, meterColor, ratingColor } from "@/components/squad-bits";
import { getPlayer } from "@/data/squad";
import type { Player } from "@/data/squad";
import portrait from "@/assets/player-portrait.jpg";
import { usePlayer, useManager, useGameState } from "@/state/store";
import { estimatePlayerPotentialForViewer } from "@/state/scouting";
import { parseMoney } from "@/state/finance";

export const Route = createFileRoute("/player/$playerId")({
  loader: ({ params }) => {
    const player = getPlayer(params.playerId);
    if (!player) throw notFound();
    return { player };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Player unavailable — Manager Legacy" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.player;
    const title = `${p.name} — Player Profile | Manager Legacy`;
    const description = `${p.pos} · ${p.overall} OVR, age ${p.age}. Attributes, development and contract details.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: PlayerProfile,
});

function AttrCell({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? T.green : value >= 65 ? T.orange : T.red;
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 11,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: T.textMuted }}
        >
          {label.toUpperCase()}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color, letterSpacing: "-0.03em" }}>
          {value}
        </span>
      </div>
      <div
        style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 7 }}
      >
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function ConditionCell({ label, value, text }: { label: string; value: number; text?: string }) {
  const color = meterColor(value);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: T.textMuted }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 3 }}>
        {text ?? `${value}%`}
      </div>
      <div
        style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 6 }}
      >
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "9px 0",
      }}
    >
      <span style={{ fontSize: 12.5, color: T.textSec }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: accent ?? T.text }}>{value}</span>
    </div>
  );
}

function DevelopmentBar({ p }: { p: Player }) {
  const floor = 50;
  const cur = ((p.overall - floor) / (99 - floor)) * 100;
  const pot = ((p.potential - floor) / (99 - floor)) * 100;
  return (
    <div>
      <div
        style={{
          position: "relative",
          height: 10,
          borderRadius: 5,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pot}%`,
            background: "rgba(245,196,81,0.35)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${cur}%`,
            background: T.green,
            borderRadius: 5,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        <span style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>Current {p.overall}</span>
        <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>
          Potential {p.potential}
        </span>
      </div>
    </div>
  );
}

function PlayerProfile() {
  const { player: loaderPlayer } = Route.useLoaderData();
  // The router loader (`getPlayer`, above) runs outside React and only
  // exists to 404 unknown ids and populate <head> tags. Actual rendering
  // reads the same player from the shared GameState, so edits made
  // elsewhere (training, contracts, injuries, ...) show up here too — this
  // is the one authoritative Player object, not a second copy.
  const p = usePlayer(loaderPlayer.id) ?? loaderPlayer;
  const manager = useManager();
  const { state, dispatch } = useGameState();
  const viewerClubId = manager?.clubId ?? state.currentClub.id;
  const sellerClubId = state.players[p.id]?.clubId ?? viewerClubId;
  const scoutEstimate = estimatePlayerPotentialForViewer(state, p.id, viewerClubId) ?? {
    min: p.potential,
    max: p.potential,
    estimate: p.potential,
  };
  const gap = p.potential - p.overall;
  const wonderkid = p.age <= 21 && gap >= 10;

  const handleOfferNewContract = () => {
    if (!p || !p.id) return;
    const offer = {
      salaryWeekly: Math.max(5000, Math.round(parseMoney(p.salary ?? "€10,000 / wk") * 1.05)),
      years: Math.max(1, Math.min(5, p.contractYears ?? 2)),
      signingBonus: Math.round(parseMoney(p.value ?? "€0") * 0.05),
      guaranteedStarts: true,
    };

    dispatch({
      type: "CREATE_NEGOTIATION",
      buyerClubId: viewerClubId,
      sellerClubId,
      playerId: p.id,
      offer,
      message: `Offer new contract to ${p.name}`,
      negotiationType: "contract",
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 48 }}>
      <ScreenHeader
        title={p.name}
        subtitle={`#${p.number} · ${p.role}`}
        backTo="/"
        right={
          p.status === "injured" ? (
            <StatusBadge status="injured" />
          ) : (
            <StatusBadge status="available" />
          )
        }
      />

      {/* Hero */}
      <div
        style={{
          position: "relative",
          margin: "14px 20px 0",
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${wonderkid ? "rgba(245,196,81,0.3)" : T.border}`,
          background: wonderkid
            ? "linear-gradient(150deg, rgba(245,196,81,0.12) 0%, #0D1B2E 55%)"
            : "linear-gradient(150deg, rgba(58,160,255,0.10) 0%, #0D1B2E 55%)",
        }}
      >
        <div style={{ display: "flex", gap: 14, padding: 16 }}>
          <div
            style={{
              width: 96,
              height: 118,
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
              border: `1px solid ${T.borderMid}`,
              background: T.cardRaised,
            }}
          >
            <img
              src={portrait}
              alt={`Portrait of ${p.name}`}
              width={768}
              height={896}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              {wonderkid && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "rgba(245,196,81,0.15)",
                    color: T.gold,
                    fontSize: 9.5,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  HIGH POTENTIAL
                </span>
              )}
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: T.text,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 5,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: T.green }}
                >
                  {p.pos}
                </span>
                <span style={{ fontSize: 11, color: T.textMuted }}>·</span>
                <span style={{ fontSize: 12, color: T.textSec }}>{p.nationality}</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>·</span>
                <span style={{ fontSize: 12, color: T.textSec }}>{p.age} yrs</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: T.textMuted,
                  }}
                >
                  OVERALL
                </div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: ratingColor(p.overall),
                    letterSpacing: "-0.05em",
                    lineHeight: 1.1,
                  }}
                >
                  {p.overall}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: T.textMuted,
                  }}
                >
                  POTENTIAL
                </div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: T.gold,
                    letterSpacing: "-0.05em",
                    lineHeight: 1.1,
                  }}
                >
                  {scoutEstimate.estimate}{" "}
                  <span style={{ fontSize: 12, color: T.textMuted, marginLeft: 8 }}>
                    (est. {scoutEstimate.min}-{scoutEstimate.max})
                  </span>
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: T.textMuted,
                  }}
                >
                  FITNESS
                </div>
                <div style={{ marginTop: 3 }}>
                  <FitnessRing value={p.fitness} size={32} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Condition */}
      <div style={{ padding: "16px 20px 0" }}>
        <Card style={{ display: "flex", gap: 14 }}>
          <ConditionCell label="Form" value={p.form} />
          <ConditionCell label="Morale" value={p.morale} />
          <ConditionCell label="Professionalism" value={p.professionalism} />
        </Card>
      </div>

      {/* Attributes */}
      <div style={{ padding: "22px 20px 0" }}>
        <SectionHeader title="Attributes" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <AttrCell label="Pace" value={p.attrs.pace} />
          <AttrCell label="Shooting" value={p.attrs.shooting} />
          <AttrCell label="Passing" value={p.attrs.passing} />
          <AttrCell label="Dribbling" value={p.attrs.dribbling} />
          <AttrCell label="Defending" value={p.attrs.defending} />
          <AttrCell label="Physical" value={p.attrs.physical} />
        </div>
      </div>

      {/* Development */}
      <div style={{ padding: "22px 20px 0" }}>
        <SectionHeader title="Development" />
        <Card raised>
          <DevelopmentBar p={p} />
          <div style={{ margin: "14px 0" }}>
            <Divider />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: T.textMuted,
                }}
              >
                GROWTH REMAINING
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: gap > 0 ? T.gold : T.textSec,
                  letterSpacing: "-0.03em",
                  marginTop: 3,
                }}
              >
                {gap > 0 ? `+${gap}` : "Peaked"}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: T.textMuted,
                }}
              >
                NEXT RATING POINT
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: T.green,
                  letterSpacing: "-0.03em",
                  marginTop: 3,
                }}
              >
                {p.trainingProgress}%
              </div>
            </div>
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.07)",
              borderRadius: 2,
              marginTop: 10,
            }}
          >
            <div
              style={{
                width: `${p.trainingProgress}%`,
                height: "100%",
                background: T.green,
                borderRadius: 2,
              }}
            />
          </div>
          <div style={{ margin: "14px 0" }}>
            <Divider />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: T.textMuted,
                }}
              >
                CURRENT TRAINING FOCUS
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 3 }}>
                {p.trainingFocus}
              </div>
            </div>
            <SecondaryButton size="sm">Change</SecondaryButton>
          </div>
          <div style={{ fontSize: 11.5, color: T.textSec, marginTop: 10, lineHeight: 1.5 }}>
            {p.age <= 23
              ? "Still in his development window — consistent minutes and a focused training plan will accelerate growth."
              : "Approaching his ceiling. Training now mainly maintains condition and sharpens existing strengths."}
          </div>
        </Card>
      </div>

      {/* Personality */}
      <div style={{ padding: "22px 20px 0" }}>
        <SectionHeader title="Personality" />
        <Card>
          <InfoRow label="Personality" value={p.personality} />
          <Divider />
          <InfoRow label="Professionalism" value={`${p.professionalism} / 100`} />
          <Divider />
          <InfoRow label="Preferred Role" value={p.role} />
        </Card>
      </div>

      {/* Contract */}
      <div style={{ padding: "22px 20px 0" }}>
        <SectionHeader title="Contract" />
        <Card>
          <InfoRow label="Weekly Salary" value={p.salary} />
          <Divider />
          <InfoRow
            label="Contract Expiry"
            value={p.contractUntil}
            accent={p.contractYears <= 1 ? T.red : T.text}
          />
          <Divider />
          <InfoRow label="Transfer Value" value={p.value} accent={T.gold} />
          {p.contractYears <= 1 && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(239,83,80,0.10)",
                border: "1px solid rgba(239,83,80,0.25)",
                fontSize: 11.5,
                color: T.text,
                lineHeight: 1.5,
              }}
            >
              Expiring soon — renew now or risk losing him on a free transfer.
            </div>
          )}
        </Card>
      </div>

      <div style={{ padding: "22px 20px 0", display: "flex", gap: 8 }}>
        <PrimaryButton fullWidth size="sm" onClick={handleOfferNewContract}>
          Offer New Contract
        </PrimaryButton>
        <SecondaryButton fullWidth size="sm">
          Training Plan
        </SecondaryButton>
      </div>
    </div>
  );
}
