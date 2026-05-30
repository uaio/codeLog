/**
 * OfflineBuffer: persists console/error events to localStorage
 * so they survive page refreshes and can be uploaded on reconnect.
 */

export interface BufferedEntry {
  type: string;
  payload: unknown;
  ts: number;
}

export interface OfflineBufferOptions {
  /** Max entries to keep in buffer. Default: 500 */
  maxEntries?: number;
  /** localStorage key. Default: '_codeLog_offline_buf' */
  storageKey?: string;
}

export class OfflineBuffer {
  private entries: BufferedEntry[] = [];
  private maxEntries: number;
  private storageKey: string;
  private dirty = false;

  constructor(opts: OfflineBufferOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 500;
    this.storageKey = opts.storageKey ?? '_codeLog_offline_buf';
    this._load();
  }

  /** Record an event */
  push(type: string, payload: unknown): void {
    this.entries.push({ type, payload, ts: Date.now() });
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    this.dirty = true;
  }

  /** Persist to localStorage */
  save(): void {
    if (!this.dirty) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
      this.dirty = false;
    } catch {
      // localStorage may be full or unavailable
    }
  }

  /** Get all buffered entries and clear the buffer */
  flush(): BufferedEntry[] {
    const all = this.entries.slice();
    this.entries = [];
    this.dirty = true;
    this.save();
    return all;
  }

  /** Peek without clearing */
  peek(): BufferedEntry[] {
    return this.entries.slice();
  }

  get size(): number {
    return this.entries.length;
  }

  /** Clear without returning */
  clear(): void {
    this.entries = [];
    this.dirty = true;
    this.save();
  }

  private _load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        this.entries = JSON.parse(raw) as BufferedEntry[];
      }
    } catch {
      this.entries = [];
    }
  }
}
