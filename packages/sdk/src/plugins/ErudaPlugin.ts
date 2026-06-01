import type { DataBus } from '../core/DataBus.js';
import type { DataBusConsoleEntry } from '../core/DataBus.js';

interface ErudaConsolePanel {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  restoreConsole?: () => void;
}

interface ErudaInfoPanel {
  add: (name: string, val: string) => void;
  remove: (name: string) => void;
}

interface ErudaInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (name?: string) => any;
  on?: (event: string, fn: () => void) => void;
  off?: (event: string, fn: () => void) => void;
  i18n?: { setLang: (lang: string) => void; getLang: () => string };
}

type Lang = 'zh' | 'en';

const LABELS: Record<Lang, {
  pageId: string;
  pageUrl: string;
  perf: string;
  perfStart: string;
  perfStop: string;
  langToggle: string;
  copied: string;
  clickCopy: string;
}> = {
  zh: {
    pageId: '页面 ID',
    pageUrl: '页面地址',
    perf: '⚡ 跑分',
    perfStart: '🏁 开始跑分',
    perfStop: '⏹ 停止',
    langToggle: 'EN',
    copied: '✓ 已复制',
    clickCopy: '点击复制',
  },
  en: {
    pageId: 'Page ID',
    pageUrl: 'Page URL',
    perf: '⚡ Perf',
    perfStart: '🏁 Start',
    perfStop: '⏹ Stop',
    langToggle: '中',
    copied: '✓ Copied',
    clickCopy: 'Click to copy',
  },
};

/**
 * Eruda 本地展示插件
 *
 * 职责：
 *  - 订阅 DataBus 的 console 事件，将日志推送到 Eruda 面板（保留原始 args 富文本渲染）
 *  - Eruda 以 overrideConsole: false 初始化，禁用其自身的 console 拦截，
 *    避免与 DataBus 采集层重复，确保"单一数据来源"
 */
export class ErudaPlugin {
  private eruda: ErudaInstance | null = null;
  private unsubscribers: Array<() => void> = [];
  private lang: Lang = 'zh';
  private pageId: string | null = null;
  private pageUrl: string | null = null;
  private codelog: { startPerfRun(): void; stopPerfRun(): Promise<unknown> } | null = null;
  private perfRunning = false;
  private onDevToolsShow: (() => void) | null = null;

  /** 将 Eruda 实例与 DataBus 绑定（可在 Eruda 异步加载完成后调用） */
  attach(
    eruda: ErudaInstance,
    bus: DataBus,
    codelog?: { startPerfRun(): void; stopPerfRun(): Promise<unknown> },
    pageId?: string,
    pageUrl?: string,
  ): void {
    this.eruda = eruda;
    this.codelog = codelog ?? null;
    this.pageId = pageId ?? null;
    this.pageUrl = pageUrl ?? (typeof location !== 'undefined' ? location.href : null);
    this.detach();

    // Sync initial language from web panel preference
    this.lang = this.detectInitialLang();
    this.syncErudaLang(this.lang);

    // 订阅 console 事件 → 推入 Eruda console 面板
    this.unsubscribers.push(
      bus.on('console', (entry: DataBusConsoleEntry) => {
        this.forwardToEruda(entry);
      }),
    );

    if (typeof document !== 'undefined') {
      // Re-render info panel each time DevTools opens (reliable, always fresh)
      const devTools = eruda.get() as { on?: (e: string, fn: () => void) => void } | null;
      if (devTools?.on) {
        this.onDevToolsShow = () => {
          setTimeout(() => {
            this.renderInfoPanel();
            this.bindInfoPanelHandlers();
          }, 150);
        };
        devTools.on('show', this.onDevToolsShow);
      }
      // Also render once after init in case panel is already open
      setTimeout(() => this.renderInfoPanel(), 1200);
      setTimeout(() => this.customizeEntryButton(), 1200);
    }
  }

  /** 解绑（清理订阅，不影响 DataBus 本身） */
  detach(): void {
    // Remove DevTools show listener
    if (this.onDevToolsShow && this.eruda) {
      const devTools = this.eruda.get() as { off?: (e: string, fn: () => void) => void } | null;
      devTools?.off?.('show', this.onDevToolsShow);
      this.onDevToolsShow = null;
    }
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  private forwardToEruda(entry: DataBusConsoleEntry): void {
    if (!this.eruda) return;
    const panel = this.eruda.get('console') as ErudaConsolePanel | null;
    if (!panel) return;

    const method = entry.level as keyof ErudaConsolePanel;
    const fn = panel[method];
    if (typeof fn !== 'function') return;

    if (entry.args && entry.args.length > 0) {
      fn.call(panel, ...entry.args);
    } else {
      fn.call(panel, entry.message);
    }
  }

  private getErudaShadowRoot(): ShadowRoot | null {
    return (document.getElementById('eruda') as HTMLElement | null)?.shadowRoot ?? null;
  }

  /** Detect initial language from web panel preference stored in localStorage */
  private detectInitialLang(): Lang {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('codelog-lang');
        if (stored === 'zh' || stored === 'en') return stored;
      }
    } catch { /* ignore */ }
    return 'zh';
  }

  /** Sync eruda's built-in UI language via the fork's i18n module */
  private syncErudaLang(lang: Lang): void {
    const erudaLang = lang === 'zh' ? 'zh-CN' : 'en';
    this.eruda?.i18n?.setLang(erudaLang);
  }

  /** Render (or re-render) all CodeLog-injected Info panel items with current language */
  private renderInfoPanel(): void {
    const infoPanel = this.eruda?.get('info') as ErudaInfoPanel | null;
    if (!infoPanel || typeof infoPanel.add !== 'function') return;

    const L = LABELS[this.lang];

    // Remove stale entries (all possible label variants)
    for (const key of [LABELS.zh.pageId, LABELS.en.pageId, LABELS.zh.pageUrl, LABELS.en.pageUrl, LABELS.zh.perf, LABELS.en.perf, '🌐']) {
      try { infoPanel.remove(key); } catch { /* ignore */ }
    }

    // Page ID — show truncated display, copy full ID on click
    if (this.pageId) {
      const displayId = this.pageId.length > 20
        ? `${this.pageId.slice(0, 10)}…${this.pageId.slice(-6)}`
        : this.pageId;
      infoPanel.add(
        L.pageId,
        `<span id="codelog-pageid-info" title="${L.clickCopy}" style="cursor:pointer;font-family:monospace;font-size:11px;color:#3b5bdb;word-break:break-all;">${displayId}</span>`,
      );
    }

    // Page URL — truncated display, copy full URL on click
    if (this.pageUrl) {
      let displayUrl: string;
      try {
        const u = new URL(this.pageUrl);
        displayUrl = u.pathname + (u.search ? '?' + u.search.slice(1, 20) + (u.search.length > 20 ? '…' : '') : '');
        if (displayUrl.length > 30) displayUrl = displayUrl.slice(0, 28) + '…';
      } catch {
        displayUrl = this.pageUrl.slice(0, 30) + (this.pageUrl.length > 30 ? '…' : '');
      }
      infoPanel.add(
        L.pageUrl,
        `<span id="codelog-pageurl-info" title="${L.clickCopy}: ${this.pageUrl}" style="cursor:pointer;font-size:11px;color:#555;word-break:break-all;">${displayUrl}</span>`,
      );
    }

    // Perf run button
    if (this.codelog) {
      const btnLabel = this.perfRunning ? L.perfStop : L.perfStart;
      infoPanel.add(
        L.perf,
        `<span id="codelog-perf-btn" style="cursor:pointer;padding:2px 8px;background:#111;color:#fff;border-radius:4px;font-size:12px;">${btnLabel}</span>`,
      );
    }

    // Language toggle
    infoPanel.add(
      '🌐',
      `<span id="codelog-lang-toggle" style="cursor:pointer;padding:2px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;font-weight:600;">${L.langToggle}</span>`,
    );

    // Bind event handlers after DOM settles
    setTimeout(() => this.bindInfoPanelHandlers(), 300);
  }

  private bindInfoPanelHandlers(): void {
    const shadowRoot = this.getErudaShadowRoot();
    if (!shadowRoot) {
      setTimeout(() => this.bindInfoPanelHandlers(), 300);
      return;
    }

    // Page ID copy — full ID
    const pageIdEl = shadowRoot.getElementById('codelog-pageid-info');
    if (pageIdEl && this.pageId) {
      const displayId = this.pageId.length > 20
        ? `${this.pageId.slice(0, 10)}…${this.pageId.slice(-6)}`
        : this.pageId;
      pageIdEl.addEventListener('click', () =>
        this.copyToClipboard(this.pageId!, pageIdEl, displayId),
      );
    }

    // Page URL copy — full URL
    const pageUrlEl = shadowRoot.getElementById('codelog-pageurl-info');
    if (pageUrlEl && this.pageUrl) {
      let displayUrl: string;
      try {
        const u = new URL(this.pageUrl);
        displayUrl = u.pathname.slice(0, 28) + (u.pathname.length > 28 ? '…' : '');
      } catch {
        displayUrl = this.pageUrl.slice(0, 28) + (this.pageUrl.length > 28 ? '…' : '');
      }
      pageUrlEl.addEventListener('click', () =>
        this.copyToClipboard(this.pageUrl!, pageUrlEl, displayUrl),
      );
    }

    // Perf run toggle
    const perfBtn = shadowRoot.getElementById('codelog-perf-btn');
    if (perfBtn && this.codelog) {
      const L = LABELS[this.lang];
      perfBtn.addEventListener('click', async () => {
        if (this.perfRunning) {
          this.perfRunning = false;
          perfBtn.textContent = L.perfStart;
          await this.codelog!.stopPerfRun();
        } else {
          this.perfRunning = true;
          perfBtn.textContent = L.perfStop;
          this.codelog!.startPerfRun();
        }
      });
    }

    // Language toggle — switches both our labels and eruda's built-in i18n
    const langBtn = shadowRoot.getElementById('codelog-lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        this.lang = this.lang === 'zh' ? 'en' : 'zh';
        this.syncErudaLang(this.lang);
        this.renderInfoPanel();
      });
    }
  }

  /** Attach open/close CSS class to entry button for styling hooks */
  private customizeEntryButton(): void {
    const shadowRoot = this.getErudaShadowRoot();
    if (!shadowRoot) {
      setTimeout(() => this.customizeEntryButton(), 500);
      return;
    }

    const devTools = this.eruda?.get() as { on?: (e: string, fn: () => void) => void } | null;
    if (devTools?.on) {
      devTools.on('show', () => {
        shadowRoot.querySelector('.eruda-entry-btn')?.classList.add('codelog-open');
      });
      devTools.on('hide', () => {
        shadowRoot.querySelector('.eruda-entry-btn')?.classList.remove('codelog-open');
      });
    }
  }

  private copyToClipboard(text: string, el: HTMLElement, resetLabel: string): void {
    const L = LABELS[this.lang];
    const restore = () => { setTimeout(() => { el.textContent = resetLabel; }, 1500); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { el.textContent = L.copied; restore(); });
    } else {
      const tmp = document.createElement('input');
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      el.textContent = L.copied;
      restore();
    }
  }
}
