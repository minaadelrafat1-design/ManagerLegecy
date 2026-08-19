import { useState, useEffect } from "react";

export interface AudioSettings {
  masterVolume: number; // 0-100
  uiSoundsEnabled: boolean;
  matchSoundsEnabled: boolean;
  notificationSoundsEnabled: boolean;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 70,
  uiSoundsEnabled: true,
  matchSoundsEnabled: true,
  notificationSoundsEnabled: true,
};

const STORAGE_KEY = "ml_audio_settings";

export function useAudioSettings() {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load audio settings from localStorage", e);
    }
    setIsLoaded(true);
  }, []);

  const updateSetting = <K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.warn("Failed to save audio settings to localStorage", e);
    }
  };

  const isEnabled = () => settings.masterVolume > 0 && settings.uiSoundsEnabled;

  const playSound = (soundType: "ui" | "match" | "notification") => {
    if (!settings.masterVolume || settings.masterVolume === 0) return;

    const isTypeEnabled =
      soundType === "ui"
        ? settings.uiSoundsEnabled
        : soundType === "match"
          ? settings.matchSoundsEnabled
          : settings.notificationSoundsEnabled;

    if (!isTypeEnabled) return;

    // Lightweight: Just log for now, can be extended with actual audio
    // Production: Load from asset URL and play with Web Audio API
    console.debug(`[Audio] ${soundType} sound at ${settings.masterVolume}%`);
  };

  return {
    settings,
    updateSetting,
    isEnabled,
    playSound,
    isLoaded,
  };
}
