import type { Persistence } from './persistence.js';

export interface ConsoleLog {
  deviceId: string;
  tabId: string;
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'repl-input' | 'repl-output';
  message: string;
  stack?: string;
}

export class LogStore {
  private logs: Map<string, ConsoleLog[]> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly maxLogsPerDevice = 1000;
  /** TTL for log entries: 24 hours */
  private readonly maxAgeMs = 24 * 60 * 60 * 1000;
  private globalCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private db?: Persistence;

  constructor(db?: Persistence) {
    this.db = db;
  }

  /** Start a periodic job that prunes log entries older than maxAgeMs (runs every hour). */
  startPeriodicCleanup(intervalMs = 60 * 60 * 1000): void {
    if (this.globalCleanupTimer) return;
    this.globalCleanupTimer = setInterval(() => this.pruneOldLogs(), intervalMs);
    // Allow Node.js to exit even if this timer is running
    if (typeof (this.globalCleanupTimer as unknown as NodeJS.Timeout).unref === 'function') {
      (this.globalCleanupTimer as unknown as NodeJS.Timeout).unref();
    }
  }

  stopPeriodicCleanup(): void {
    if (this.globalCleanupTimer) {
      clearInterval(this.globalCleanupTimer);
      this.globalCleanupTimer = null;
    }
  }

  private pruneOldLogs(): void {
    const cutoff = Date.now() - this.maxAgeMs;
    for (const [deviceId, logs] of this.logs.entries()) {
      const pruned = logs.filter((l) => l.timestamp > cutoff);
      if (pruned.length !== logs.length) {
        if (pruned.length === 0) {
          this.logs.delete(deviceId);
        } else {
          this.logs.set(deviceId, pruned);
        }
      }
    }
  }

  push(deviceId: string, log: ConsoleLog): void {
    let logs = this.logs.get(deviceId);
    if (!logs) {
      logs = [];
      this.logs.set(deviceId, logs);
    }

    logs.push(log);

    if (logs.length > this.maxLogsPerDevice) {
      logs.shift();
    }

    this.db?.insertLog(log);
  }

  get(deviceId: string, limit?: number, level?: ConsoleLog['level']): ConsoleLog[] {
    let logs = this.logs.get(deviceId) || [];

    // If memory is empty but we have persistence, try loading from db
    if (logs.length === 0 && this.db) {
      logs = this.db.loadLogs(deviceId, limit || this.maxLogsPerDevice) as ConsoleLog[];
      if (logs.length > 0) {
        this.logs.set(deviceId, logs);
      }
    }

    if (level) {
      logs = logs.filter((l) => l.level === level);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs;
  }

  clear(deviceId: string): void {
    this.logs.delete(deviceId);
    this.cancelCleanup(deviceId);
    this.db?.clearLogs(deviceId);
  }

  cleanup(deviceId: string): void {
    this.cancelCleanup(deviceId);

    const timer = setTimeout(
      () => {
        this.logs.delete(deviceId);
        this.cleanupTimers.delete(deviceId);
      },
      30 * 60 * 1000,
    );

    this.cleanupTimers.set(deviceId, timer);
  }

  cancelCleanup(deviceId: string): void {
    const timer = this.cleanupTimers.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(deviceId);
    }
  }
}
