import { useState } from "react";
import type { ChangeEvent } from "react";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { T, Card, SecondaryButton } from "./ui";

export function AudioSettingsPanel() {
  const { settings, updateSetting } = useAudioSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 16,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.bgMid;
          e.currentTarget.style.borderColor = T.borderMid;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = T.border;
        }}
        title="Audio Settings"
      >
        {settings.masterVolume > 0 ? "🔊" : "🔇"}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={() => setIsOpen(false)}
    >
      <Card
        style={{
          padding: 20,
          maxWidth: 360,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>
            Audio Settings
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: T.textSec,
              cursor: "pointer",
              fontSize: 18,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Master Volume */}
          <div>
            <label
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
                fontWeight: 600,
                color: T.text,
                marginBottom: 8,
              }}
            >
              Master Volume
              <span style={{ color: T.textMuted, fontSize: 12 }}>
                {Math.round(settings.masterVolume)}%
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.masterVolume}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateSetting("masterVolume", parseInt(e.target.value))
              }
              style={{
                width: "100%",
                height: 4,
                borderRadius: 2,
                background: T.bgMid,
                cursor: "pointer",
              }}
            />
          </div>

          {/* UI Sounds */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.uiSoundsEnabled}
              onChange={(e) => updateSetting("uiSoundsEnabled", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: T.text }}>UI Sounds</span>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
              {settings.uiSoundsEnabled ? "On" : "Off"}
            </span>
          </label>

          {/* Match Sounds */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.matchSoundsEnabled}
              onChange={(e) => updateSetting("matchSoundsEnabled", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: T.text }}>Match Sounds</span>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
              {settings.matchSoundsEnabled ? "On" : "Off"}
            </span>
          </label>

          {/* Notification Sounds */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.notificationSoundsEnabled}
              onChange={(e) => updateSetting("notificationSoundsEnabled", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: T.text }}>Notification Sounds</span>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
              {settings.notificationSoundsEnabled ? "On" : "Off"}
            </span>
          </label>

          <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5, marginTop: 8 }}>
            Audio settings are saved locally in your browser. Sounds play for important game events
            when enabled.
          </div>
        </div>
      </Card>
    </div>
  );
}
