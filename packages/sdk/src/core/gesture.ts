/**
 * Gesture-based activation for the debugging panel.
 *
 * Supported gestures:
 * - "shake"     : Device shake via DeviceMotionEvent (mobile)
 * - "corner-tap": Rapid triple-tap in any screen corner (touch)
 * - "key"       : Keyboard shortcut, e.g. { key: 'F8' } (desktop)
 *
 * Usage:
 *   const g = new GestureActivator({ gestures: ['shake', 'corner-tap'], onActivate: () => ... });
 *   g.start();
 *   g.stop();
 */

export type GestureType = 'shake' | 'corner-tap' | 'key';

export interface GestureConfig {
  /** Which gestures to listen for. Default: ['shake', 'corner-tap'] */
  gestures?: GestureType[];
  /** Called when a gesture is detected */
  onActivate: () => void;
  /**
   * For 'key' gesture: keyboard shortcut key name (e.g. 'F8', 'Alt+D').
   * Default: 'F8'
   */
  keyShortcut?: string;
  /** Shake sensitivity 0-1 (higher = less sensitive). Default: 0.65 */
  shakeSensitivity?: number;
  /** Corner-tap: number of taps required. Default: 3 */
  cornerTapCount?: number;
  /** Corner-tap: radius of corner zone in px. Default: 80 */
  cornerRadius?: number;
}

const SHAKE_THRESHOLD = 15; // m/s²

export class GestureActivator {
  private config: Required<GestureConfig>;
  private listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];
  private shakeLastAcc = { x: 0, y: 0, z: 0 };
  private shakeLastTime = 0;
  private cornerTapState = { count: 0, lastTime: 0, corner: -1 };
  private started = false;

  constructor(config: GestureConfig) {
    this.config = {
      gestures: config.gestures ?? ['shake', 'corner-tap'],
      onActivate: config.onActivate,
      keyShortcut: config.keyShortcut ?? 'F8',
      shakeSensitivity: config.shakeSensitivity ?? 0.65,
      cornerTapCount: config.cornerTapCount ?? 3,
      cornerRadius: config.cornerRadius ?? 80,
    };
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    for (const gesture of this.config.gestures) {
      switch (gesture) {
        case 'shake':
          this._startShake();
          break;
        case 'corner-tap':
          this._startCornerTap();
          break;
        case 'key':
          this._startKey();
          break;
      }
    }
  }

  stop(): void {
    for (const [target, type, handler] of this.listeners) {
      target.removeEventListener(type, handler);
    }
    this.listeners = [];
    this.started = false;
  }

  private _on(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject): void {
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }

  private _startShake(): void {
    if (!('DeviceMotionEvent' in window)) return;

    const threshold = SHAKE_THRESHOLD * (1 - this.config.shakeSensitivity + 0.1);

    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const now = Date.now();
      if (now - this.shakeLastTime < 100) return;
      this.shakeLastTime = now;

      const dx = Math.abs((acc.x ?? 0) - this.shakeLastAcc.x);
      const dy = Math.abs((acc.y ?? 0) - this.shakeLastAcc.y);
      const dz = Math.abs((acc.z ?? 0) - this.shakeLastAcc.z);

      this.shakeLastAcc = { x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 0 };

      if (dx + dy + dz > threshold) {
        this.config.onActivate();
      }
    };

    this._on(window, 'devicemotion', handler as EventListener);
  }

  private _startCornerTap(): void {
    const { cornerRadius, cornerTapCount } = this.config;
    const WINDOW_MS = 800;

    const handler = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const W = window.innerWidth;
      const H = window.innerHeight;
      const x = t.clientX;
      const y = t.clientY;

      // Detect which corner (0=TL, 1=TR, 2=BL, 3=BR)
      let corner = -1;
      if (x < cornerRadius && y < cornerRadius) corner = 0;
      else if (x > W - cornerRadius && y < cornerRadius) corner = 1;
      else if (x < cornerRadius && y > H - cornerRadius) corner = 2;
      else if (x > W - cornerRadius && y > H - cornerRadius) corner = 3;

      if (corner === -1) {
        this.cornerTapState = { count: 0, lastTime: 0, corner: -1 };
        return;
      }

      const now = Date.now();
      if (now - this.cornerTapState.lastTime > WINDOW_MS || corner !== this.cornerTapState.corner) {
        this.cornerTapState = { count: 1, lastTime: now, corner };
        return;
      }

      this.cornerTapState.count++;
      this.cornerTapState.lastTime = now;

      if (this.cornerTapState.count >= cornerTapCount) {
        this.cornerTapState = { count: 0, lastTime: 0, corner: -1 };
        this.config.onActivate();
      }
    };

    this._on(window, 'touchstart', handler as EventListener);
  }

  private _startKey(): void {
    const shortcut = this.config.keyShortcut;
    const parts = shortcut.split('+').map((s) => s.trim());
    const key = parts.pop() ?? 'F8';
    const needAlt = parts.includes('Alt');
    const needCtrl = parts.includes('Ctrl') || parts.includes('Control');
    const needShift = parts.includes('Shift');
    const needMeta = parts.includes('Meta') || parts.includes('Cmd');

    const handler = (e: KeyboardEvent) => {
      if (e.key !== key) return;
      if (needAlt && !e.altKey) return;
      if (needCtrl && !e.ctrlKey) return;
      if (needShift && !e.shiftKey) return;
      if (needMeta && !e.metaKey) return;
      e.preventDefault();
      this.config.onActivate();
    };

    this._on(window, 'keydown', handler as EventListener);
  }
}
