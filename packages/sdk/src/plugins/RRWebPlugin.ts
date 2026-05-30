/**
 * RRWebPlugin — records DOM mutations using rrweb and sends snapshots to the server.
 *
 * Requires `rrweb` to be installed in the host application:
 *   npm install rrweb
 *
 * Usage:
 *   import { RRWebPlugin } from '@codelog/sdk';
 *   new CodeLog({ plugins: [new RRWebPlugin()] });
 */

import type { CodeLogPlugin, PluginContext } from './PluginManager.js';

export interface RRWebOptions {
  /** Recording sample interval (ms). Default: 50 */
  slimDOMOptions?: Record<string, boolean>;
  /** Max events per chunk before auto-flush to server. Default: 200 */
  chunkSize?: number;
  /** Auto-upload chunks to server. Default: true */
  autoUpload?: boolean;
  /** Recording checkpoint interval in ms. Default: 10000 */
  checkoutEveryNms?: number;
}

type RRWebEvent = { type: number; data: unknown; timestamp: number };

export class RRWebPlugin implements CodeLogPlugin {
  readonly name = 'RRWebPlugin';

  private opts: RRWebOptions;
  private ctx: PluginContext | null = null;
  private stopFn: (() => void) | null = null;
  private events: RRWebEvent[] = [];
  private chunkIndex = 0;
  private enabled = false;

  constructor(opts: RRWebOptions = {}) {
    this.opts = opts;
  }

  async install(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    await this._start();
    this.enabled = true;
  }

  enable(): void {
    if (!this.enabled) {
      void this._start();
      this.enabled = true;
    }
  }

  disable(): void {
    this.enabled = false;
    this.stopFn?.();
    this.stopFn = null;
  }

  uninstall(): void {
    this.disable();
    this.events = [];
    this.ctx = null;
  }

  /** Get all recorded events without clearing */
  getEvents(): RRWebEvent[] {
    return this.events.slice();
  }

  /** Clear the event buffer */
  clearEvents(): void {
    this.events = [];
    this.chunkIndex = 0;
  }

  /** Download events as JSON for offline replay */
  exportRecording(filename = `rrweb-recording-${Date.now()}.json`): void {
    const blob = new Blob([JSON.stringify(this.events)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async _start(): Promise<void> {
    let rrweb: any;
    try {
      // Truly dynamic import — prevents Rollup from bundling or erroring on optional dep
      rrweb = await new Function('return import("rrweb")')();
    } catch {
      console.warn('[RRWebPlugin] rrweb is not installed. Run: npm install rrweb');
      return;
    }

    const chunkSize = this.opts.chunkSize ?? 200;

    this.stopFn = rrweb.record({
      emit: (event: RRWebEvent, isCheckout?: boolean) => {
        if (isCheckout) {
          // New checkpoint — upload previous chunk
          this._flushChunk();
        }
        this.events.push(event);
        if (this.events.length >= chunkSize) {
          this._flushChunk();
        }
      },
      checkoutEveryNms: this.opts.checkoutEveryNms ?? 10_000,
      slimDOMOptions: this.opts.slimDOMOptions,
    });
  }

  private _flushChunk(): void {
    if (this.events.length === 0) return;
    const chunk = this.events.splice(0);
    this.chunkIndex += 1;
    if (this.opts.autoUpload !== false && this.ctx?.serverUrl) {
      this._upload(chunk);
    }
  }

  private _upload(events: RRWebEvent[]): void {
    const url = `${this.ctx!.serverUrl}/api/rrweb-recording`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkIndex: this.chunkIndex, events }),
    }).catch(() => {
      // Silently ignore — server may not support rrweb yet
    });
  }
}
