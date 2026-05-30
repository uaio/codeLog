/**
 * OSpyPlugin — serverless (local-only) debugging mode.
 *
 * When a codeLog server is unavailable, OSpyPlugin collects all events
 * in memory + localStorage and renders a floating summary badge in the page.
 * Clicking the badge opens a popup with a mini log viewer.
 *
 * No server connection required.
 */

import type { CodeLogPlugin, PluginContext } from './PluginManager.js';
import type { DataBusEventMap } from '../core/DataBus.js';

export interface OSpyOptions {
  /** Position of the floating badge. Default: 'bottom-right' */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Max log entries to keep in memory. Default: 500 */
  maxEntries?: number;
}

type LogEntry = {
  ts: number;
  level: string;
  message: string;
};

export class OSpyPlugin implements CodeLogPlugin {
  readonly name = 'OSpyPlugin';

  private opts: OSpyOptions;
  private entries: LogEntry[] = [];
  private errorCount = 0;
  private unsubscribers: Array<() => void> = [];
  private badge: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private popupOpen = false;
  private maxEntries: number;
  private enabled = false;

  constructor(opts: OSpyOptions = {}) {
    this.opts = opts;
    this.maxEntries = opts.maxEntries ?? 500;
  }

  install(ctx: PluginContext): void {
    // Subscribe to console events
    const unsub = ctx.dataBus.on('console', (payload) => {
      this._addEntry(payload);
    });
    this.unsubscribers.push(unsub);

    const errUnsub = ctx.dataBus.on('error', (payload) => {
      this._addEntry({ level: 'error', message: (payload as any).message ?? 'Error', ...payload });
      this.errorCount += 1;
      this._updateBadge();
    });
    this.unsubscribers.push(errUnsub);

    this._mountBadge();
    this.enabled = true;
  }

  enable(): void {
    if (this.badge) (this.badge as HTMLElement).style.display = 'flex';
    this.enabled = true;
  }

  disable(): void {
    if (this.badge) (this.badge as HTMLElement).style.display = 'none';
    this.enabled = false;
  }

  uninstall(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.badge?.remove();
    this.popup?.remove();
    this.badge = null;
    this.popup = null;
    this.enabled = false;
  }

  private _addEntry(payload: any): void {
    const entry: LogEntry = {
      ts: payload.timestamp ?? Date.now(),
      level: payload.level ?? 'log',
      message: payload.message ?? String(payload),
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    if (entry.level === 'error' || entry.level === 'warn') this._updateBadge();
  }

  private _mountBadge(): void {
    if (typeof document === 'undefined') return;

    const pos = this.opts.position ?? 'bottom-right';
    const posStyle: Partial<CSSStyleDeclaration> = {
      bottom: pos.includes('bottom') ? '16px' : 'auto',
      top: pos.includes('top') ? '16px' : 'auto',
      right: pos.includes('right') ? '16px' : 'auto',
      left: pos.includes('left') ? '16px' : 'auto',
    };

    const badge = document.createElement('div');
    badge.id = '__ospy_badge__';
    Object.assign(badge.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '20px',
      backgroundColor: '#1a1a2e',
      color: '#fff',
      fontSize: '12px',
      fontFamily: 'system-ui, sans-serif',
      cursor: 'pointer',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      userSelect: 'none',
      ...posStyle,
    });
    badge.innerHTML = `<span style="font-size:14px">🔍</span> <span id="__ospy_count__">0 logs</span>`;
    badge.addEventListener('click', () => this._togglePopup());
    document.body.appendChild(badge);
    this.badge = badge;
  }

  private _updateBadge(): void {
    if (!this.badge) return;
    const span = this.badge.querySelector('#__ospy_count__');
    if (!span) return;
    const errCount = this.errorCount;
    span.textContent = `${this.entries.length} logs${errCount > 0 ? ` · ${errCount} errors` : ''}`;
    (this.badge as HTMLElement).style.backgroundColor = errCount > 0 ? '#c0392b' : '#1a1a2e';
  }

  private _togglePopup(): void {
    if (this.popupOpen) {
      this.popup?.remove();
      this.popup = null;
      this.popupOpen = false;
    } else {
      this._openPopup();
    }
  }

  private _openPopup(): void {
    if (typeof document === 'undefined') return;

    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position: 'fixed',
      bottom: '60px',
      right: '16px',
      zIndex: '2147483646',
      width: '420px',
      maxHeight: '60vh',
      backgroundColor: '#1a1a2e',
      color: '#e0e0e0',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily: 'monospace',
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid #333',
      color: '#fff',
      fontWeight: 'bold',
    });
    header.innerHTML = `<span>🔍 OSpyPlugin — Local Logs</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: '#999',
      cursor: 'pointer',
      fontSize: '14px',
    });
    closeBtn.addEventListener('click', () => this._togglePopup());
    header.appendChild(closeBtn);
    popup.appendChild(header);

    const list = document.createElement('div');
    Object.assign(list.style, { flex: '1', overflow: 'auto', padding: '4px 0' });

    const recentEntries = this.entries.slice(-200);
    for (const entry of recentEntries) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        padding: '4px 12px',
        borderBottom: '1px solid #252540',
        color: levelColor(entry.level),
        lineHeight: '1.5',
      });
      const time = new Date(entry.ts).toLocaleTimeString('zh-CN', { hour12: false });
      row.textContent = `[${time}] [${entry.level.toUpperCase()}] ${entry.message}`;
      list.appendChild(row);
    }

    if (recentEntries.length === 0) {
      const empty = document.createElement('div');
      Object.assign(empty.style, { padding: '16px', textAlign: 'center', color: '#666' });
      empty.textContent = 'No logs yet';
      list.appendChild(empty);
    }

    popup.appendChild(list);
    document.body.appendChild(popup);
    this.popup = popup;
    this.popupOpen = true;
    list.scrollTop = list.scrollHeight;
  }
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return '#ff6b6b';
    case 'warn': return '#ffd93d';
    case 'info': return '#74b9ff';
    default: return '#a8e6cf';
  }
}
