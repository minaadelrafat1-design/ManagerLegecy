/**
 * Lightweight audio system for optional UI/event feedback.
 * Audio is optional and disabled by default to avoid dependency issues.
 * Users can enable in settings to get event sound feedback.
 * No large asset packs or external dependencies.
 */

export type AudioEventType =
  | "match-start"
  | "match-end"
  | "goal"
  | "transfer-offer"
  | "season-end"
  | "promotion"
  | "injury"
  | "ui-click";

interface AudioSettings {
  enabled: boolean;
  volume: number; // 0-100
}

class AudioSystem {
  private settings: AudioSettings = {
    enabled: false,
    volume: 50,
  };

  private audioContext: AudioContext | null = null;
  private oscillators: Map<string, OscillatorNode> = new Map();

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    const stored = localStorage.getItem("audio-settings");
    if (stored) {
      try {
        this.settings = JSON.parse(stored);
      } catch {
        // Ignore parse errors, use defaults
      }
    }
  }

  saveSettings() {
    localStorage.setItem("audio-settings", JSON.stringify(this.settings));
  }

  getSettings() {
    return { ...this.settings };
  }

  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    this.saveSettings();
    if (!enabled) {
      this.stopAll();
    }
  }

  setVolume(volume: number) {
    this.settings.volume = Math.max(0, Math.min(100, volume));
    this.saveSettings();
  }

  private getAudioContext() {
    if (this.audioContext) return this.audioContext;

    if (typeof window !== "undefined" && window.AudioContext) {
      this.audioContext = new window.AudioContext();
      return this.audioContext;
    }

    return null;
  }

  /**
   * Play a simple synthesized sound for UI feedback.
   * Uses Web Audio API to generate tones without external assets.
   */
  play(eventType: AudioEventType) {
    if (!this.settings.enabled) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Resume audio context if needed (required by modern browsers)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
        // User interaction required, silently continue
      });
    }

    try {
      switch (eventType) {
        case "match-start":
          this.playTone(ctx, 523.25, 0.2); // C5
          break;
        case "goal":
          // Rising tone
          this.playTone(ctx, 523.25, 0.15); // C5
          setTimeout(() => this.playTone(ctx, 659.25, 0.15), 75); // E5
          setTimeout(() => this.playTone(ctx, 783.99, 0.2), 150); // G5
          break;
        case "match-end":
          // Falling tone
          this.playTone(ctx, 783.99, 0.15); // G5
          setTimeout(() => this.playTone(ctx, 523.25, 0.2), 75); // C5
          break;
        case "transfer-offer":
          this.playTone(ctx, 587.33, 0.15); // D5
          setTimeout(() => this.playTone(ctx, 587.33, 0.15), 100); // D5
          break;
        case "season-end":
          // Chord-like
          this.playTone(ctx, 523.25, 0.3); // C5
          setTimeout(() => this.playTone(ctx, 659.25, 0.3), 50); // E5
          break;
        case "promotion":
          // Two rising tones
          this.playTone(ctx, 523.25, 0.15); // C5
          setTimeout(() => this.playTone(ctx, 659.25, 0.2), 100); // E5
          break;
        case "injury":
          this.playTone(ctx, 349.23, 0.2); // F4
          break;
        case "ui-click":
          this.playTone(ctx, 880, 0.08); // A5
          break;
      }
    } catch (err) {
      // Silently continue if audio fails
    }
  }

  private playTone(ctx: AudioContext, frequency: number, duration: number) {
    try {
      const now = ctx.currentTime;
      const gainNode = ctx.createGain();
      const oscillator = ctx.createOscillator();

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      gainNode.connect(ctx.destination);
      oscillator.connect(gainNode);

      // Fade in and out
      const volume = this.settings.volume / 100;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + duration * 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (err) {
      // Silently continue if tone fails
    }
  }

  stopAll() {
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // Already stopped
      }
    });
    this.oscillators.clear();
  }
}

// Singleton instance
const audioSystem = new AudioSystem();

export function useAudio() {
  return {
    play: audioSystem.play.bind(audioSystem),
    getSettings: audioSystem.getSettings.bind(audioSystem),
    setEnabled: audioSystem.setEnabled.bind(audioSystem),
    setVolume: audioSystem.setVolume.bind(audioSystem),
    saveSettings: audioSystem.saveSettings.bind(audioSystem),
  };
}

export default audioSystem;
