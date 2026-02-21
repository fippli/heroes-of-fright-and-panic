/**
 * Notifications - Browser notifications and audio alerts for turn changes
 */
export class Notifications {
  private static hasPermission: boolean = false;
  private static audioContext: AudioContext | null = null;

  /**
   * Request permission for browser notifications
   */
  static async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("Browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      this.hasPermission = true;
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === "granted";
      return this.hasPermission;
    }

    return false;
  }

  /**
   * Show a browser notification (only when tab is not focused)
   */
  static showNotification(title: string, body: string): void {
    if (!this.hasPermission) return;
    if (document.hasFocus()) return;

    try {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "turn-notification",
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Focus window when notification is clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.warn("Failed to show notification:", error);
    }
  }

  /**
   * Play a notification chime using Web Audio API
   */
  static playSound(): void {
    try {
      // Create audio context lazily (must be created after user interaction)
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          (window as typeof window & { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
      }

      const ctx = this.audioContext;

      // Resume context if suspended (browsers require user interaction)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Create a pleasant notification chime
      const now = ctx.currentTime;

      // First tone (higher pitch)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Second tone (lower pitch, slightly delayed)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, now + 0.1); // E6
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.2, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);
    } catch (error) {
      console.warn("Failed to play sound:", error);
    }
  }

  /**
   * Notify the player that it's their turn
   */
  static notifyTurnChange(playerType: "day" | "night"): void {
    const allianceName = playerType === "day" ? "Day" : "Night";

    // Play sound notification
    this.playSound();

    // Show browser notification
    this.showNotification(
      "Your Turn!",
      `It's the ${allianceName} player's turn to move.`,
    );
  }
}
