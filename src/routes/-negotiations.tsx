import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Clock3, Handshake, MessageSquare, X } from "lucide-react";
import { useGameState } from "@/state/store";
import { filterVisibleNegotiations } from "@/state/transfer-visibility";
import { addDaysISO } from "@/state/calendar";
import type { NegotiationEntry, NegotiationSession } from "@/state/types";

const C = { bg: "#07111f", panel: "#0d1b2d", raised: "#11243a", border: "rgba(145,181,215,.18)", text: "#edf6ff", muted: "#8da4ba", cyan: "#55d6ff", green: "#65e6aa", gold: "#f2c866", red: "#ff777e" };
const panel: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18, boxShadow: "0 12px 30px rgba(0,0,0,.16)" };
const input: React.CSSProperties = { width: "100%", minHeight: 38, borderRadius: 6, border: `1px solid ${C.border}`, background: "#081522", color: C.text, padding: "8px 10px", outline: "none" };
const button: React.CSSProperties = { minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 6, cursor: "pointer", padding: "0 13px", fontWeight: 800, fontSize: 11 };

function money(value?: number) {
  if (!value) return "-";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function label(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function offerLines(offer: NegotiationEntry["offer"]) {
  const keys = ["fee", "upfrontPayment", "futurePayment", "installments", "addOns", "performanceBonuses", "appearanceBonuses", "goalBonuses", "assistBonuses", "cleanSheetBonuses", "sellOnPercent", "playerExchangeId", "loanFee", "loanDurationWeeks", "wageContribution", "optionalPurchase", "mandatoryPurchase", "salaryWeekly", "years", "signingBonus", "releaseClause"] as const;
  return keys.flatMap((key) => {
    const value = offer[key];
    if (value === undefined || value === null || value === 0) return [];
    const cash = key === "fee" || key.includes("Payment") || key.includes("Fee") || key.includes("Bonus") || key.includes("Purchase") || key === "salaryWeekly";
    return [{ label: label(key), value: cash ? money(value as number) : key === "sellOnPercent" ? `${value}%` : String(value) }];
  });
}

function OfferEditor({ session, exchanges, onSubmit }: { session: NegotiationSession; exchanges: { id: string; name: string }[]; onSubmit: (offer: NegotiationEntry["offer"]) => void }) {
  const latest = session.entries[session.entries.length - 1]?.offer ?? {};
  const [values, setValues] = useState<Record<string, string>>({});
  const [loan, setLoan] = useState(Boolean(latest.loan));
  const [exchange, setExchange] = useState(latest.playerExchangeId ?? "");
  useEffect(() => {
    setValues(Object.fromEntries(Object.entries(latest).filter(([, value]) => typeof value === "number").map(([key, value]) => [key, String(value)])));
    setLoan(Boolean(latest.loan));
    setExchange(latest.playerExchangeId ?? "");
  }, [session.id, session.entries.length]);
  const setNumber = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const offer: NegotiationEntry["offer"] = Object.fromEntries(Object.entries(values).flatMap(([key, value]) => {
      const number = Number(value);
      return value !== "" && Number.isFinite(number) ? [[key, number]] : [];
    }));
    if (exchange) offer.playerExchangeId = exchange;
    if (loan) offer.loan = true;
    onSubmit(offer);
  };
  const fields: Array<keyof NegotiationEntry["offer"]> = session.stage === "player"
    ? ["salaryWeekly", "years", "signingBonus", "appearanceBonuses", "goalBonuses", "assistBonuses", "cleanSheetBonuses", "releaseClause"]
    : ["fee", "upfrontPayment", "futurePayment", "installments", "addOns", "appearanceBonuses", "goalBonuses", "assistBonuses", "cleanSheetBonuses", "sellOnPercent"];
  const loanFields: Array<[string, string]> = [["loanFee", "Loan fee"], ["loanDurationWeeks", "Duration (weeks)"], ["wageContribution", "Wage contribution %"], ["optionalPurchase", "Optional purchase"], ["mandatoryPurchase", "Mandatory purchase"]];
  return <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
      {fields.map((key) => <label key={key} style={smallLabel}>{label(String(key))}<input type="number" min={0} step={key === "sellOnPercent" || key === "installments" || key === "years" ? 1 : 1000} placeholder="0" value={values[String(key)] ?? ""} onChange={(event) => setNumber(String(key), event.target.value)} style={input} /></label>)}
    </div>
    {session.stage !== "player" && <>
      <label style={checkLabel}><input type="checkbox" checked={loan} onChange={(event) => setLoan(event.target.checked)} /> Loan structure</label>
      {loan && <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>{loanFields.map(([key, text]) => <label key={key} style={smallLabel}>{text}<input type="number" min={0} value={values[key] ?? ""} onChange={(event) => setNumber(key, event.target.value)} style={input} /></label>)}</div>}
      <label style={smallLabel}>Player exchange<select value={exchange} onChange={(event) => setExchange(event.target.value)} style={input}><option value="">No player exchange</option>{exchanges.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </>}
    <button type="submit" style={{ ...button, border: 0, background: C.green, color: "#06131f" }}><ArrowUpRight size={16} /> Submit proposal</button>
  </form>;
}

const smallLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, color: C.muted, fontSize: 10, fontWeight: 800 };
const checkLabel: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, color: C.text, fontSize: 12, fontWeight: 700 };
const sectionTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, margin: 0, color: C.text, fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" };
const pill: React.CSSProperties = { display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 7px", color: C.muted, fontSize: 9, fontWeight: 800, textTransform: "uppercase" };

export default function NegotiationsRoute() {
  const { state, dispatch } = useGameState();
  const sessions = useMemo(() => filterVisibleNegotiations(state, state.currentClub.id), [state]);
  const [selected, setSelected] = useState<string | null>(sessions[0]?.id ?? null);
  useEffect(() => {
    const current = sessions.find((item) => item.id === selected);
    const playerStage = current && current.status === "accepted"
      ? sessions.find((item) => item.playerId === current.playerId && item.stage === "player" && item.status === "open")
      : undefined;
    if (playerStage) {
      setSelected(playerStage.id);
    } else if (!selected || !current) {
      setSelected(sessions[0]?.id ?? null);
    }
  }, [sessions, selected]);
  const session = sessions.find((item) => item.id === selected) ?? null;
  const player = session ? state.players[session.playerId] : undefined;
  const seller = session && session.sellerClubId !== "free-agent" ? state.clubs[session.sellerClubId] : undefined;
  const buyer = session ? state.clubs[session.buyerClubId] : undefined;
  const exchanges = buyer?.playerIds.filter((id) => id !== session?.playerId).map((id) => ({ id, name: state.players[id]?.name ?? id })) ?? [];
  const deadline = session?.entries[0] ? addDaysISO(session.entries[0].date, session.type === "contract" ? 7 : 14) : null;
  const submitOffer = (offer: NegotiationEntry["offer"]) => {
    if (!session) return;
    if (session.type === "contract") {
      dispatch({ type: "ADD_NEGOTIATION_ENTRY", sessionId: session.id, fromClubId: session.buyerClubId, offer, message: "Manager submitted revised contract terms." });
      return;
    }
    dispatch({ type: "SUBMIT_TRANSFER_OFFER", sessionId: session.id, offer });
  };
  const acceptLatest = () => {
    if (!session) return;
    if (session.type === "contract") {
      const offer = session.entries[session.entries.length - 1]?.offer ?? {};
      dispatch({ type: "ACCEPT_CONTRACT_SESSION", sessionId: session.id, offer });
    } else {
      dispatch({ type: "ACCEPT_TRANSFER_SESSION", sessionId: session.id });
    }
  };
  const close = (status: "rejected" | "withdrawn") => { if (session) dispatch({ type: "CLOSE_NEGOTIATION", sessionId: session.id, status, message: status === "withdrawn" ? "Manager withdrew from negotiations." : "Manager rejected the latest proposal." }); };

  return <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
    <header style={{ borderBottom: `1px solid ${C.border}`, background: "linear-gradient(135deg,#0c1c30,#07111f)", padding: "30px clamp(18px,4vw,56px)" }}><div style={{ maxWidth: 1440, margin: "0 auto" }}><div style={{ color: C.cyan, fontSize: 11, fontWeight: 800, letterSpacing: ".18em" }}>TRANSFER OFFICE / LIVE COMMUNICATIONS</div><h1 style={{ margin: "10px 0 6px", fontSize: "clamp(30px,5vw,56px)", letterSpacing: "-.04em" }}>Negotiations</h1><p style={{ margin: 0, color: C.muted, maxWidth: 680 }}>Real proposals, real responses, and a clear handoff from club terms to player and agent terms.</p></div></header>
    <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px clamp(18px,4vw,56px)", display: "grid", gridTemplateColumns: "minmax(240px,.72fr) minmax(0,1.8fr)", gap: 18 }}>
      <aside><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={sectionTitle}>Threads</h2><span style={pill}>{sessions.filter((item) => item.status === "open").length} open</span></div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{sessions.map((item) => { const itemPlayer = state.players[item.playerId]; const last = item.entries[item.entries.length - 1]; return <button key={item.id} type="button" onClick={() => setSelected(item.id)} style={{ ...threadButton, ...(selected === item.id ? { borderColor: C.cyan, background: "#102a40" } : {}) }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{itemPlayer?.name ?? item.playerId}</strong><span style={{ ...pill, color: item.status === "open" ? C.green : C.muted }}>{item.status}</span></div><span style={{ color: C.muted, fontSize: 11 }}>{item.stage === "player" ? "Player / Agent" : item.type === "contract" ? "Contract renewal" : "Selling club"}</span><span style={{ color: C.muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last?.message ?? "No messages"}</span></button>; })}{sessions.length === 0 && <div style={{ border: `1px dashed ${C.border}`, padding: 24, color: C.muted, fontSize: 13 }}>No negotiation threads are currently visible.</div>}</div></aside>
      {!session || !player ? <div style={{ ...panel, minHeight: 420, display: "grid", placeItems: "center", color: C.muted }}>Select a negotiation to open the correspondence.</div> : <section style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...panel, display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}><div style={{ display: "flex", gap: 14, alignItems: "center" }}><div style={avatar}>{player.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><h2 style={{ margin: 0, fontSize: 24 }}>{player.name}</h2><div style={{ color: C.muted, fontSize: 12, marginTop: 5 }}>{player.pos} · {player.age} years · {player.overall} OVR · Valuation {player.value ?? money(player.marketValue)}</div></div></div><div style={{ display: "flex", alignItems: "center", gap: 8, color: session.stage === "player" ? C.gold : C.cyan, fontWeight: 800, fontSize: 11 }}><Handshake size={17} /> {session.stage === "player" ? "PLAYER / AGENT TERMS" : session.type === "contract" ? "CONTRACT TERMS" : "CLUB TERMS"}</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(260px,.8fr)", gap: 14 }}><div style={{ ...panel, padding: 0, overflow: "hidden" }}><div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}><div style={sectionTitle}><MessageSquare size={15} /> Correspondence</div><span style={pill}>{session.status}</span></div><div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, maxHeight: 620, overflowY: "auto" }}>{session.entries.map((entry) => { const managerSent = entry.fromClubId === session.buyerClubId; return <article key={entry.id} style={{ alignSelf: managerSent ? "flex-end" : "flex-start", width: "min(92%,590px)", border: `1px solid ${managerSent ? "rgba(85,214,255,.28)" : C.border}`, background: managerSent ? "rgba(38,128,164,.15)" : C.raised, borderRadius: managerSent ? "10px 10px 3px 10px" : "10px 10px 10px 3px", padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: managerSent ? C.cyan : C.gold, fontSize: 11, fontWeight: 800 }}><span>{managerSent ? "Manager" : session.stage === "player" ? "Player / Agent" : seller?.name ?? "Selling Club"}</span><span style={{ color: C.muted, fontWeight: 500 }}>{entry.date}</span></div><p style={{ margin: "10px 0", lineHeight: 1.55, fontSize: 13 }}>{entry.message}</p><div style={offerGrid}>{offerLines(entry.offer).map((line) => <div key={line.label}><span style={{ color: C.muted, fontSize: 10 }}>{line.label}</span><strong style={{ display: "block", marginTop: 2, fontSize: 12 }}>{line.value}</strong></div>)}</div></article>; })}</div></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}><div style={panel}><h3 style={sectionTitle}>Deal context</h3><div style={facts}><span>Current club</span><strong>{seller?.name ?? "Free agent"}</strong><span>Buying club</span><strong>{buyer?.name ?? session.buyerClubId}</strong><span>Deadline</span><strong style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock3 size={13} /> {deadline ?? "-"}</strong><span>Messages</span><strong>{session.entries.length}</strong></div></div>{session.status === "open" ? <div style={panel}><h3 style={sectionTitle}>{session.stage === "player" ? "Contract proposal" : "New proposal"}</h3><OfferEditor session={session} exchanges={exchanges} onSubmit={submitOffer} /><div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}><button type="button" onClick={acceptLatest} style={{ ...button, flex: 1, border: `1px solid ${C.green}`, background: "rgba(101,230,170,.1)", color: C.green }}><Check size={15} /> Accept latest</button><button type="button" onClick={() => close("withdrawn")} style={{ ...button, border: `1px solid ${C.red}`, background: "transparent", color: C.red }}><X size={15} /> Withdraw</button><button type="button" onClick={() => close("rejected")} style={{ ...button, border: `1px solid ${C.border}`, background: "transparent", color: C.muted }}>Reject</button></div></div> : <div style={{ ...panel, color: C.muted, fontSize: 13 }}>This thread is {session.status}. Its correspondence remains available for review.</div>}</div>
        </div>
      </section>}
    </div>
  </main>;
}

const threadButton: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 7, textAlign: "left", padding: 13, borderRadius: 7, border: `1px solid ${C.border}`, background: C.panel, color: C.text, cursor: "pointer" };
const avatar: React.CSSProperties = { width: 52, height: 52, display: "grid", placeItems: "center", borderRadius: 8, background: "linear-gradient(135deg,#55d6ff,#226587)", color: "#06131f", fontSize: 16, fontWeight: 900 };
const offerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "9px 14px", borderTop: `1px solid ${C.border}`, paddingTop: 10 };
const facts: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px", marginTop: 16, fontSize: 12 };