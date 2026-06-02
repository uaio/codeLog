/**
 * DataHarborPlugin — offline event buffer and export.
 *
 * Subscribes to all DataBus events, stores them in localStorage,
 * and exposes download/export functionality.
 */

import type { CodeLogPlugin, PluginContext } from './PluginManager.js';
import type { DataBusEventMap } from '../core/DataBus.js';

type HarborEntry = {
  type: keyof DataBusEventMap;
  payload: unknown;
  ts: number;
};

export interface DataHarborOptions {
  /** Max entries to retain in memory. Default: 1000 */
  maxEntries?: number;
  /** localStorage key prefix. Default: '_codelog_harbor' */
  storageKey?: string;
  /** Types to capture. Default: all */
  captureTypes?: Array<keyof DataBusEventMap>;
  /** Auto-persist to localStorage on page hide. Default: true */
  autoPersist?: boolean;
}

const ALL_TYPES: Array<keyof DataBusEventMap> = [
  'console',
  'network',
  'storage',
  'dom',
  'performance',
  'screenshot',
  'perf_run_raw',
  'error',
  'lifecycle',
  'custom',
];

export class DataHarborPlugin implements CodeLogPlugin {
  readonly name = 'DataHarborPlugin';

  private entries: HarborEntry[] = [];
  private maxEntries: number;
  private storageKey: string;
  private captureTypes: Set<string>;
  private autoPersist: boolean;
  private unsubscribers: Array<() => void> = [];
  private visibilityHandler: (() => void) | null = null;

  constructor(opts: DataHarborOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 1000;
    this.storageKey = opts.storageKey ?? '_codelog_harbor';
    this.captureTypes = new Set(opts.captureTypes ?? ALL_TYPES);
    this.autoPersist = opts.autoPersist ?? true;
    this._loadFromStorage();
  }

  install(ctx: PluginContext): void {
    for (const type of ALL_TYPES) {
      if (!this.captureTypes.has(type)) continue;
      const unsub = ctx.dataBus.on(type as keyof DataBusEventMap, (payload) => {
        this._push(type, payload);
      });
      this.unsubscribers.push(unsub);
    }

    if (this.autoPersist && typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'hidden') this.persist();
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  enable(): void {}
  disable(): void {}

  uninstall(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /** Save current buffer to localStorage */
  persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {
      // Ignore quota exceeded
    }
  }

  /** Get all buffered entries */
  getEntries(): HarborEntry[] {
    return this.entries.slice();
  }

  /** Export as JSON blob and trigger browser download */
  exportJSON(filename = `codelog-harbor-${Date.now()}.json`): void {
    const data = JSON.stringify({ version: 1, entries: this.entries }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Export console entries as plain text log */
  exportLog(filename = `codelog-log-${Date.now()}.txt`): void {
    const lines = this.entries
      .filter((e) => e.type === 'console')
      .map((e) => {
        const p = e.payload as any;
        const d = new Date(e.ts).toISOString();
        return `[${d}] [${(p.level ?? 'log').toUpperCase()}] ${p.message ?? ''}`;
      });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Clear the buffer and remove from localStorage */
  clear(): void {
    this.entries = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch {}
  }

  get size(): number {
    return this.entries.length;
  }

  private _push(type: string, payload: unknown): void {
    this.entries.push({ type: type as keyof DataBusEventMap, payload, ts: Date.now() });
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  private _loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as HarborEntry[];
        this.entries = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      this.entries = [];
    }
  }
}
