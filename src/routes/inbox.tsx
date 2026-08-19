import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { TMod, ScreenHeader, ModPanel, ModButton, ModBadge, ModSectionHead } from "@/components/ui-modern";
import { useGameState } from "@/state/store";
import type { InboxMessageCategory, InboxMessage } from "@/state/types";
import { getUnreadCount } from "@/state/inbox";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Manager Legacy" },
      { name: "description", content: "Manager inbox with game events and notifications." },
    ],
  }),
  component: InboxScreen,
});

function InboxScreen() {
  const { state, dispatch } = useGameState();
  const [selectedCategory, setSelectedCategory] = useState<InboxMessageCategory | "all">("all");
  const [showArchived, setShowArchived] = useState(false);

  const messages = state.inbox ?? [];
  const unreadCount = getUnreadCount(state);

  const categories: (InboxMessageCategory | "all")[] = [
    "all",
    "transfers",
    "squad",
    "training",
    "scouting",
    "youth",
    "board",
    "matches",
    "world",
  ];

  const filteredMessages = messages.filter((msg) => {
    const matchesCategory = selectedCategory === "all" || msg.category === selectedCategory;
    const matchesArchive = showArchived ? !!msg.archivedAt : !msg.archivedAt;
    return matchesCategory && matchesArchive;
  });

  const sortedMessages = [...filteredMessages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const categoryColors: Record<InboxMessageCategory, string> = {
    transfers: "#FFB800",
    squad: "#FF6B6B",
    training: "#4ECDC4",
    scouting: "#95E1D3",
    youth: "#F38181",
    board: "#AA96DA",
    matches: "#FCBAD3",
    world: "#A8D8EA",
  };

  const priorityColors = {
    low: "#7a8fa3",
    normal: "#e8f1ff",
    high: "#FFB800",
    critical: "#FF6B6B",
  };

  const handleMarkRead = (messageId: string) => {
    dispatch({
      type: "MARK_INBOX_MESSAGE_READ",
      messageId,
    });
  };

  const handleDelete = (messageId: string) => {
    dispatch({
      type: "DELETE_INBOX_MESSAGE",
      messageId,
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#061727", color: "#e8f1ff", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* TOP HEADER */}
      <div
        style={{
          width: "100%",
          background: "linear-gradient(180deg, rgba(8,17,32,0.98), rgba(7,15,28,0.96))",
          borderBottom: "1px solid rgba(126, 169, 255, 0.2)",
          padding: "24px 26px",
        }}
      >
        <div style={{ maxWidth: 1440, margin: "0 auto" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", color: "#dce9ff", fontWeight: 800, textTransform: "uppercase" }}>
            COMMUNICATION
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8, color: "#edf8ff" }}>
            Manager Inbox
          </h1>
          <div style={{ fontSize: 16, color: "#a8bbd6", marginTop: 12 }}>
            {unreadCount > 0 && (
              <span style={{ color: "#FFB800", fontWeight: 700 }}>
                {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}
              </span>
            )}
            {unreadCount === 0 && <span>All caught up</span>}
            {" "} • {messages.length} total message{messages.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "26px" }}>
        {/* FILTER TABS */}
        <div
          style={{
            background: "rgba(17, 30, 45, 0.4)",
            border: "1px solid rgba(126, 169, 255, 0.15)",
            borderRadius: 12,
            padding: "16px",
            marginBottom: 24,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: "8px 14px",
                background: selectedCategory === cat ? "rgba(126, 169, 255, 0.2)" : "transparent",
                border: `1px solid ${selectedCategory === cat ? "rgba(126, 169, 255, 0.4)" : "rgba(126, 169, 255, 0.15)"}`,
                borderRadius: 6,
                color: selectedCategory === cat ? "#e8f1ff" : "#a8bbd6",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "capitalize",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {cat}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#a8bbd6" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span>Show archived</span>
          </label>
        </div>

        {/* MESSAGES LIST */}
        {sortedMessages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#7a8fa3",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              {showArchived ? "No archived messages" : "No messages"}
            </div>
            <div style={{ fontSize: 14 }}>
              {showArchived ? "Archive some messages to see them here." : "Check back later for game updates and notifications."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sortedMessages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  background: msg.isRead
                    ? "rgba(17, 30, 45, 0.4)"
                    : "rgba(17, 30, 45, 0.8)",
                  border: `1px solid ${msg.isRead ? "rgba(126, 169, 255, 0.1)" : "rgba(126, 169, 255, 0.3)"}`,
                  borderRadius: 8,
                  padding: "16px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "start", marginBottom: 8 }}>
                    {/* UNREAD INDICATOR */}
                    {!msg.isRead && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#FFB800",
                          marginTop: 6,
                          flexShrink: 0,
                        }}
                      />
                    )}

                    {/* TITLE & CATEGORY BADGE */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
                        <h3
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: msg.isRead ? "#a8bbd6" : "#e8f1ff",
                            margin: 0,
                          }}
                        >
                          {msg.title}
                        </h3>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: categoryColors[msg.category],
                            padding: "2px 8px",
                            background: `${categoryColors[msg.category]}20`,
                            borderRadius: 4,
                          }}
                        >
                          {msg.category}
                        </span>
                        {msg.priority !== "normal" && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              color: priorityColors[msg.priority],
                              padding: "2px 8px",
                              background: `${priorityColors[msg.priority]}20`,
                              borderRadius: 4,
                            }}
                          >
                            {msg.priority}
                          </span>
                        )}
                      </div>

                      {/* BODY TEXT */}
                      <p
                        style={{
                          fontSize: 13,
                          color: msg.isRead ? "#7a8fa3" : "#a8bbd6",
                          margin: "8px 0 0 0",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.body}
                      </p>

                      {/* DATE & ACTIONS */}
                      <div
                        style={{
                          fontSize: 11,
                          color: "#7a8fa3",
                          marginTop: 10,
                          display: "flex",
                          gap: 16,
                          alignItems: "center",
                        }}
                      >
                        <span>{msg.date}</span>
                        <button
                          onClick={() => handleMarkRead(msg.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#7a8fa3",
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 600,
                            textDecoration: "underline",
                            padding: 0,
                          }}
                        >
                          {msg.isRead ? "Mark unread" : "Mark read"}
                        </button>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#7a8fa3",
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 600,
                            textDecoration: "underline",
                            padding: 0,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
