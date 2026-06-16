// ============================================================
// Focus Monitor (Client-Side)
// Tracks tab visibility, window focus, and idle state
// ============================================================

export interface FocusCallbacks {
  onFocusLost?: () => void;
  onFocusRegained?: (awaySeconds: number) => void;
  onIdle?: (idleSeconds: number) => void;
  onActivity?: () => void;
}

export class FocusMonitor {
  private callbacks: FocusCallbacks;
  private isActive: boolean = true;
  private isRunning: boolean = false;
  private lastActivityTime: number = Date.now();
  private focusLostTime: number | null = null;
  private idleTimeout: number = 120; // seconds
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private tabSwitchCount: number = 0;
  private totalDistractedTime: number = 0; // seconds

  // Bound handlers for proper cleanup
  private handleVisibilityChange: () => void;
  private handleWindowBlur: () => void;
  private handleWindowFocus: () => void;
  private handleActivity: () => void;

  constructor(callbacks: FocusCallbacks, idleTimeoutSeconds: number = 120) {
    this.callbacks = callbacks;
    this.idleTimeout = idleTimeoutSeconds;

    // Pre-bind handlers
    this.handleVisibilityChange = this.onVisibilityChange.bind(this);
    this.handleWindowBlur = this.onWindowBlur.bind(this);
    this.handleWindowFocus = this.onWindowFocus.bind(this);
    this.handleActivity = this.onUserActivity.bind(this);
  }

  /**
   * Start monitoring focus and idle state.
   */
  start(): void {
    if (this.isRunning || typeof window === 'undefined') return;

    this.isRunning = true;
    this.lastActivityTime = Date.now();

    // Tab visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Window focus/blur
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);

    // User activity detection
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((event) => {
      document.addEventListener(event, this.handleActivity, { passive: true });
    });

    // Idle check interval (every 10 seconds)
    this.idleCheckInterval = setInterval(() => {
      this.checkIdle();
    }, 10_000);
  }

  /**
   * Stop monitoring and clean up all listeners.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((event) => {
      document.removeEventListener(event, this.handleActivity);
    });

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  /**
   * Seconds since last user activity.
   */
  getIdleTime(): number {
    return Math.floor((Date.now() - this.lastActivityTime) / 1000);
  }

  /**
   * Whether the user is currently active (not idle, tab focused).
   */
  isUserActive(): boolean {
    return this.isActive && this.getIdleTime() < this.idleTimeout;
  }

  /**
   * Number of times the user switched away from the tab.
   */
  getTabSwitchCount(): number {
    return this.tabSwitchCount;
  }

  /**
   * Total seconds spent in a distracted state.
   */
  getTotalDistractedTime(): number {
    // Add ongoing distraction time if currently distracted
    if (this.focusLostTime) {
      return this.totalDistractedTime + (Date.now() - this.focusLostTime) / 1000;
    }
    return this.totalDistractedTime;
  }

  /**
   * Calculate a 0-100 focus score based on monitoring data.
   */
  calculateFocusScore(totalSessionSeconds: number): number {
    if (totalSessionSeconds <= 0) return 100;
    const distractedRatio = this.getTotalDistractedTime() / totalSessionSeconds;
    const switchPenalty = Math.min(this.tabSwitchCount * 2, 30); // Max 30 point penalty
    const score = Math.max(0, Math.round((1 - distractedRatio) * 100 - switchPenalty));
    return Math.min(100, score);
  }

  // --- Private handlers ---

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.markFocusLost();
      this.tabSwitchCount++;
    } else {
      this.markFocusRegained();
    }
  }

  private onWindowBlur(): void {
    this.markFocusLost();
  }

  private onWindowFocus(): void {
    this.markFocusRegained();
  }

  private onUserActivity(): void {
    const wasIdle = this.getIdleTime() >= this.idleTimeout;
    this.lastActivityTime = Date.now();

    if (wasIdle) {
      this.isActive = true;
      this.callbacks.onActivity?.();
    }
  }

  private markFocusLost(): void {
    if (!this.isActive) return; // Already in lost state
    this.isActive = false;
    this.focusLostTime = Date.now();
    this.callbacks.onFocusLost?.();
  }

  private markFocusRegained(): void {
    if (this.isActive) return; // Already focused

    const awaySeconds = this.focusLostTime
      ? Math.floor((Date.now() - this.focusLostTime) / 1000)
      : 0;

    if (this.focusLostTime) {
      this.totalDistractedTime += awaySeconds;
    }

    this.isActive = true;
    this.focusLostTime = null;
    this.lastActivityTime = Date.now();
    this.callbacks.onFocusRegained?.(awaySeconds);
  }

  private checkIdle(): void {
    const idleSeconds = this.getIdleTime();
    if (idleSeconds >= this.idleTimeout && this.isActive) {
      this.isActive = false;
      this.callbacks.onIdle?.(idleSeconds);
    }
  }
}
