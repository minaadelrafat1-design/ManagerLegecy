import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  T,
  Card,
  PrimaryButton,
  SecondaryButton,
  StatBar,
  SectionHeader,
  Divider,
  RatingBadge,
  ObjectiveCard,
} from "@/components/ui";
import { ScreenHeader } from "@/components/squad-bits";
import { useGameState } from "@/state/store";
import {
  MANAGER_NATIONALITIES,
  MANAGER_PHILOSOPHIES,
  generateManagerAttributeProfile,
  generateSquad,
  buildCareerState,
  type NewCareerChoices,
} from "@/state/new-career";
import { STARTER_CLUBS } from "@/data/starter-clubs";
import type { Player } from "@/state/types";

export const Route = createFileRoute("/new-career")({
  head: () => ({
    meta: [
      { title: "New Career — Manager Legacy" },
      {
        name: "description",
        content:
          "Create a manager, choose your philosophy and start your career at a low-division club.",
      },
      { property: "og:title", content: "New Career — Manager Legacy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewCareerScreen,
});

const STEP_LABELS = [
  "Create Manager",
  "Identity",
  "Philosophy",
  "Attributes",
  "Choose Club",
  "Review Club",
  "Start Career",
];
const TOTAL_STEPS = STEP_LABELS.length;

const SKILL_LABELS: {
  key:
    | "tactics"
    | "training"
    | "motivation"
    | "scouting"
    | "negotiation"
    | "manManagement"
    | "playerDevelopment";
  label: string;
}[] = [
  { key: "tactics", label: "Tactics" },
  { key: "training", label: "Training" },
  { key: "motivation", label: "Motivation" },
  { key: "scouting", label: "Scouting" },
  { key: "negotiation", label: "Negotiation" },
  { key: "manManagement", label: "Man Mgmt" },
  { key: "playerDevelopment", label: "Development" },
];

// ─── small local field controls (kept local — not added to the shared ui.tsx
// design system, since nothing else in the app needs a text input yet) ──────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.textSec,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "12px 14px",
        fontSize: 15,
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 600,
        color: T.text,
        background: T.card,
        border: `1px solid ${T.borderMid}`,
        borderRadius: 10,
        outline: "none",
      }}
    />
  );
}

function ChipGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: active ? 800 : 600,
              letterSpacing: "0.04em",
              color: active ? T.ink : T.textSec,
              background: active
                ? `linear-gradient(180deg, #4CF0A4 0%, ${T.green} 55%, ${T.greenDeep} 100%)`
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? "rgba(255,255,255,0.2)" : T.border}`,
              borderRadius: 999,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SelectableCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Card
      onClick={onClick}
      raised={selected}
      style={{
        cursor: "pointer",
        border: `1px solid ${selected ? T.green : T.border}`,
        boxShadow: selected ? `0 0 0 1px ${T.green} inset` : undefined,
      }}
    >
      {children}
    </Card>
  );
}

// ─── the wizard itself ───────────────────────────────────────────────────────

function NewCareerScreen() {
  const { dispatch } = useGameState();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [managerName, setManagerName] = useState("");
  const [nationality, setNationality] = useState<string>(MANAGER_NATIONALITIES[0]!);
  const [philosophyId, setPhilosophyId] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const club = useMemo(() => STARTER_CLUBS.find((c) => c.id === clubId) ?? null, [clubId]);
  const attrProfile = useMemo(
    () => (philosophyId ? generateManagerAttributeProfile(philosophyId) : null),
    [philosophyId],
  );
  // Generated once per club choice so the squad reviewed in step 6 is
  // exactly the squad the career actually starts with.
  const squadPreview: Player[] | null = useMemo(() => (club ? generateSquad(club) : null), [club]);

  const canAdvance =
    (step === 2 && managerName.trim().length >= 2 && !!nationality) ||
    (step === 3 && !!philosophyId) ||
    (step === 5 && !!clubId) ||
    step === 1 ||
    step === 4 ||
    step === 6;

  function goNext() {
    if (!canAdvance) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleStart() {
    if (!philosophyId || !clubId || starting) return;
    setStarting(true);
    const choices: NewCareerChoices = {
      managerName: managerName.trim(),
      nationality,
      philosophyId,
      clubId,
    };
    const newState = buildCareerState(choices, squadPreview ?? undefined);
    dispatch({ type: "RESET_GAME", state: newState });
    router.navigate({ to: "/" });
  }

  const philosophy = MANAGER_PHILOSOPHIES.find((p) => p.id === philosophyId) ?? null;
  const avgSquadRating = squadPreview
    ? Math.round(squadPreview.reduce((s, p) => s + p.overall, 0) / squadPreview.length)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 120 }}>
      <ScreenHeader
        title="New Career"
        subtitle={`Step ${step} of ${TOTAL_STEPS} · ${STEP_LABELS[step - 1]}`}
        backTo="/"
      />

      <div style={{ padding: "14px 20px 0", display: "flex", gap: 5 }}>
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < step ? T.green : "rgba(255,255,255,0.08)",
              transition: "background 0.25s",
            }}
          />
        ))}
      </div>

      <div style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {step === 1 && <StepIntro />}

        {step === 2 && (
          <StepIdentity
            managerName={managerName}
            setManagerName={setManagerName}
            nationality={nationality}
            setNationality={setNationality}
          />
        )}

        {step === 3 && (
          <StepPhilosophy philosophyId={philosophyId} setPhilosophyId={setPhilosophyId} />
        )}

        {step === 4 && philosophy && attrProfile && (
          <StepAttributes philosophy={philosophy} profile={attrProfile} />
        )}

        {step === 5 && <StepClub clubId={clubId} setClubId={setClubId} />}

        {step === 6 && club && (
          <StepClubReview
            club={club}
            avgSquadRating={avgSquadRating}
            squadSize={squadPreview?.length ?? 0}
          />
        )}

        {step === 7 && philosophy && club && (
          <StepConfirm
            managerName={managerName.trim() || "New Manager"}
            nationality={nationality}
            philosophy={philosophy}
            club={club}
          />
        )}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          gap: 10,
          padding: "14px 20px calc(14px + env(safe-area-inset-bottom, 0px))",
          background: "linear-gradient(0deg, rgba(4,10,30,0.98) 60%, rgba(4,10,30,0))",
        }}
      >
        {step > 1 && (
          <SecondaryButton onClick={goBack} size="lg">
            Back
          </SecondaryButton>
        )}
        {step < TOTAL_STEPS ? (
          <PrimaryButton fullWidth size="lg" disabled={!canAdvance} onClick={goNext}>
            {step === 1 ? "Get Started" : "Continue"}
          </PrimaryButton>
        ) : (
          <PrimaryButton fullWidth size="lg" disabled={starting} onClick={handleStart}>
            {starting ? "Starting…" : "Start Career"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: intro ────────────────────────────────────────────────────────────

function StepIntro() {
  const items = [
    "Set your manager's identity",
    "Choose a managerial philosophy",
    "Review your starting attributes",
    "Choose a low-division club",
    "Review its budget, squad and objectives",
    "Start the career",
  ];
  return (
    <Card raised style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: T.text,
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          Begin your management career
        </div>
        <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.6 }}>
          Every manager starts somewhere small. You'll create your manager, pick a philosophy, then
          take charge of a modest, low-division club — no shortcuts to the top.
        </div>
      </div>
      <Divider />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                color: T.green,
                background: T.greenDim,
                border: `1px solid rgba(47,224,138,0.3)`,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{item}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Step 2: identity ─────────────────────────────────────────────────────────

function StepIdentity({
  managerName,
  setManagerName,
  nationality,
  setNationality,
}: {
  managerName: string;
  setManagerName: (v: string) => void;
  nationality: string;
  setNationality: (v: string) => void;
}) {
  return (
    <>
      <SectionHeader title="Manager Identity" />
      <Card style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <FieldLabel>Manager Name</FieldLabel>
          <TextField
            value={managerName}
            onChange={setManagerName}
            placeholder="e.g. Jordan Ellis"
            maxLength={40}
          />
        </div>
        <div>
          <FieldLabel>Nationality</FieldLabel>
          <ChipGrid options={MANAGER_NATIONALITIES} value={nationality} onChange={setNationality} />
        </div>
      </Card>
    </>
  );
}

// ─── Step 3: philosophy ───────────────────────────────────────────────────────

function StepPhilosophy({
  philosophyId,
  setPhilosophyId,
}: {
  philosophyId: string | null;
  setPhilosophyId: (id: string) => void;
}) {
  return (
    <>
      <SectionHeader title="Managerial Philosophy" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MANAGER_PHILOSOPHIES.map((p) => (
          <SelectableCard
            key={p.id}
            selected={philosophyId === p.id}
            onClick={() => setPhilosophyId(p.id)}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 4 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 12, color: T.textSec, lineHeight: 1.5 }}>
                  {p.description}
                </div>
              </div>
              {philosophyId === p.id && (
                <span style={{ fontSize: 18, color: T.green, flexShrink: 0 }}>✓</span>
              )}
            </div>
          </SelectableCard>
        ))}
      </div>
    </>
  );
}

// ─── Step 4: attributes review ────────────────────────────────────────────────

function StepAttributes({
  philosophy,
  profile,
}: {
  philosophy: (typeof MANAGER_PHILOSOPHIES)[number];
  profile: ReturnType<typeof generateManagerAttributeProfile>;
}) {
  return (
    <>
      <SectionHeader title="Starting Attributes" />
      <Card raised style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <RatingBadge value={profile.reputation} size="lg" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Reputation</div>
          <div style={{ fontSize: 12, color: T.textSec, lineHeight: 1.5, marginTop: 2 }}>
            Low, as expected for a first-time manager — {philosophy.label.toLowerCase()} is your
            identity ( {philosophy.philosophyText}).
          </div>
        </div>
      </Card>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SKILL_LABELS.map(({ key, label }) => (
          <StatBar key={key} label={label} value={profile[key]} />
        ))}
      </Card>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, lineHeight: 1.5 }}>
        These attributes grow with results and experience — nobody starts as the finished article.
      </div>
    </>
  );
}

// ─── Step 5: club choice ──────────────────────────────────────────────────────

function StepClub({
  clubId,
  setClubId,
}: {
  clubId: string | null;
  setClubId: (id: string) => void;
}) {
  return (
    <>
      <SectionHeader title="Choose Your Club" />
      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 4, lineHeight: 1.5 }}>
        Every option here is a modest, low-division side — a realistic first job for a manager with
        no track record yet.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {STARTER_CLUBS.map((c) => (
          <SelectableCard key={c.id} selected={clubId === c.id} onClick={() => setClubId(c.id)}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                <span
                  aria-hidden
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: c.textColor,
                    background: `linear-gradient(160deg, ${c.primaryColor}, ${c.secondaryColor})`,
                  }}
                >
                  {c.abbr}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
                    {c.division} · {c.city}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                    {c.blurb}
                  </div>
                </div>
              </div>
              <RatingBadge value={c.reputation} size="sm" />
            </div>
          </SelectableCard>
        ))}
      </div>
    </>
  );
}

// ─── Step 6: club review ──────────────────────────────────────────────────────

function StepClubReview({
  club,
  avgSquadRating,
  squadSize,
}: {
  club: (typeof STARTER_CLUBS)[number];
  avgSquadRating: number | null;
  squadSize: number;
}) {
  return (
    <>
      <SectionHeader title={`${club.name} · Overview`} />

      <Card style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: T.textSec,
            textTransform: "uppercase",
          }}
        >
          Finances
        </div>
        <Row label="Transfer Budget" value={club.finances.transferBudget} />
        <Row label="Wage Budget" value={club.finances.wageBudget} />
        <Row label="Balance" value={club.finances.balance} />
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: T.textSec,
            textTransform: "uppercase",
          }}
        >
          Squad
        </div>
        <Row label="Squad Size" value={`${squadSize} players`} />
        <Row label="Avg. Rating" value={avgSquadRating != null ? String(avgSquadRating) : "—"} />
        <Row label="Formation" value={club.formation} />
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: T.textSec,
            textTransform: "uppercase",
          }}
        >
          Facilities
        </div>
        <StatBar label="Training" value={club.facilities.training} />
        <StatBar label="Medical" value={club.facilities.medical} />
        <StatBar label="Youth" value={club.facilities.youth} />
        <StatBar label="Stadium" value={club.facilities.stadium} />
      </Card>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: T.textSec,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Season Objectives
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {club.objectives.map((o) => (
          <ObjectiveCard
            key={o.title}
            title={o.title}
            description={o.note}
            progress={0}
            target={100}
            priority="secondary"
          />
        ))}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: T.textSec }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{value}</span>
    </div>
  );
}

// ─── Step 7: confirm ──────────────────────────────────────────────────────────

function StepConfirm({
  managerName,
  nationality,
  philosophy,
  club,
}: {
  managerName: string;
  nationality: string;
  philosophy: (typeof MANAGER_PHILOSOPHIES)[number];
  club: (typeof STARTER_CLUBS)[number];
}) {
  return (
    <>
      <SectionHeader title="Confirm & Start" />
      <Card raised style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Row label="Manager" value={managerName} />
        <Row label="Nationality" value={nationality} />
        <Row label="Philosophy" value={philosophy.label} />
        <Divider />
        <Row label="Club" value={club.name} />
        <Row label="Division" value={club.division} />
        <Row label="Reputation" value={String(club.reputation)} />
      </Card>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14, lineHeight: 1.6 }}>
        Starting the career saves your progress and takes you straight to Manager HQ, ready for
        pre-season.
      </div>
    </>
  );
}
