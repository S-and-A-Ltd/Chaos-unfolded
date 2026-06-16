// ============================================================
// Timer Engine (Client-Side)
// Countdown timer with quiz trigger support
// ============================================================

export type TimerTickCallback = (remaining: number, elapsed: number) => void;
export type TimerCompleteCallback = () => void;
export type QuizTriggerCallback = () => void;

export class TimerEngine {
  private onTick: TimerTickCallback;
  private onComplete: TimerCompleteCallback;
  private onQuizTrigger: QuizTriggerCallback;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private durationSeconds: number = 0;
  private elapsedSeconds: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  // Quiz trigger tracking
  private lastQuizTime: number = 0; // elapsed seconds at last quiz
  private nextQuizInterval: number = 0; // seconds until next quiz

  constructor(
    onTick: TimerTickCallback,
    onComplete: TimerCompleteCallback,
    onQuizTrigger: QuizTriggerCallback
  ) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.onQuizTrigger = onQuizTrigger;
    this.nextQuizInterval = this.randomQuizInterval();
  }

  /**
   * Start a countdown timer.
   */
  start(durationSeconds: number): void {
    this.stop(); // Clean up any existing timer

    this.durationSeconds = durationSeconds;
    this.elapsedSeconds = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.lastQuizTime = 0;
    this.nextQuizInterval = this.randomQuizInterval();

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Pause the timer.
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Resume a paused timer.
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Reset the timer with a new duration.
   */
  reset(durationSeconds: number): void {
    this.stop();
    this.durationSeconds = durationSeconds;
    this.elapsedSeconds = 0;
    this.lastQuizTime = 0;
    this.nextQuizInterval = this.randomQuizInterval();
  }

  /**
   * Stop the timer entirely.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.isPaused = false;
  }

  /**
   * Get elapsed seconds.
   */
  getElapsed(): number {
    return this.elapsedSeconds;
  }

  /**
   * Get remaining seconds.
   */
  getRemaining(): number {
    return Math.max(0, this.durationSeconds - this.elapsedSeconds);
  }

  /**
   * Whether the timer is currently active (running, not paused).
   */
  getIsRunning(): boolean {
    return this.isRunning && !this.isPaused;
  }

  /**
   * Whether the timer is paused.
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check if it's time to trigger a quiz.
   */
  shouldTriggerQuiz(): boolean {
    const timeSinceLastQuiz = this.elapsedSeconds - this.lastQuizTime;
    return timeSinceLastQuiz >= this.nextQuizInterval;
  }

  // --- Private ---

  private tick(): void {
    this.elapsedSeconds++;
    const remaining = this.durationSeconds - this.elapsedSeconds;

    // Notify tick
    this.onTick(Math.max(0, remaining), this.elapsedSeconds);

    // Check quiz trigger
    if (this.shouldTriggerQuiz()) {
      this.lastQuizTime = this.elapsedSeconds;
      this.nextQuizInterval = this.randomQuizInterval();
      this.onQuizTrigger();
    }

    // Check completion
    if (remaining <= 0) {
      this.stop();
      this.onComplete();
    }
  }

  /**
   * Generate a random interval between 5–15 minutes (300–900 seconds).
   */
  private randomQuizInterval(): number {
    return Math.floor(Math.random() * 600) + 300; // 300-900 seconds
  }
}
