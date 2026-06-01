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
  perf: string;
  perfStart: string;
  perfStop: string;
  copied: string;
  clickCopy: string;
}> = {
  zh: {
    pageId: '页面 ID',
    perf: '⚡ 跑分',
    perfStart: '🏁 开始跑分',
    perfStop: '⏹ 停止',
    copied: '✓ 已复制',
    clickCopy: '点击复制',
  },
  en: {
    pageId: 'Page ID',
    perf: '⚡ Perf',
    perfStart: '🏁 Start',
    perfStop: '⏹ Stop',
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
  private codelog: { startPerfRun(): void; stopPerfRun(): Promise<unknown> } | null = null;
  private perfRunning = false;
  private onDevToolsShow: (() => void) | null = null;
  private langSettingAdded = false;

  /** 将 Eruda 实例与 DataBus 绑定（可在 Eruda 异步加载完成后调用） */
  attach(
    eruda: ErudaInstance,
    bus: DataBus,
    codelog?: { startPerfRun(): void; stopPerfRun(): Promise<unknown> },
    pageId?: string,
  ): void {
    this.eruda = eruda;
    this.codelog = codelog ?? null;
    this.pageId = pageId ?? null;
    this.langSettingAdded = false;
    this.detach();

    // Sync initial language from web panel preference or SDK init option
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
      // Render once after init + add lang setting to Settings panel
      setTimeout(() => this.renderInfoPanel(), 1200);
      setTimeout(() => this.addLangSetting(), 1200);
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
    for (const key of [LABELS.zh.pageId, LABELS.en.pageId, LABELS.zh.perf, LABELS.en.perf]) {
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

    // Perf run button
    if (this.codelog) {
      const btnLabel = this.perfRunning ? L.perfStop : L.perfStart;
      infoPanel.add(
        L.perf,
        `<span id="codelog-perf-btn" style="cursor:pointer;padding:2px 8px;background:#111;color:#fff;border-radius:4px;font-size:12px;">${btnLabel}</span>`,
      );
    }

    // Bind event handlers after DOM settles
    setTimeout(() => this.bindInfoPanelHandlers(), 300);
  }

  /** Add language select to the top of the Settings panel (called once after attach) */
  private addLangSetting(): void {
    if (this.langSettingAdded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = this.eruda?.get('settings') as any;
    if (!settings || typeof settings.select !== 'function') return;

    // Non-persisting config object — routes changes to eruda.i18n without localStorage
    const langConfig = {
      get: (_key: string) => this.lang === 'zh' ? 'zh-CN' : 'en',
      set: (_key: string, val: string) => {
        this.lang = val === 'zh-CN' ? 'zh' : 'en';
        this.syncErudaLang(this.lang);
        this.renderInfoPanel();
      },
    };

    // Append at the end first, then move to top via DOM
    settings.select(langConfig, 'lang', '语言 / Language', ['zh-CN', 'en']);
    settings.separator();
    this.langSettingAdded = true;

    // Move the lang select + separator to be the first items in the settings list
    setTimeout(() => this.moveLangSettingToTop(), 300);
  }

  /** Move the lang select (last 2 DOM children) to the top of the Settings panel */
  private moveLangSettingToTop(): void {
    const shadowRoot = this.getErudaShadowRoot();
    if (!shadowRoot) return;
    // luna-setting renders items as direct children of its host element
    const settingsContainer = shadowRoot.querySelector('.luna-setting');
    if (!settingsContainer) return;
    const children = Array.from(settingsContainer.children);
    if (children.length < 2) return;
    // Our items: select = second-to-last, separator = last
    const selectItem = children[children.length - 2];
    const separatorItem = children[children.length - 1];
    if (selectItem && separatorItem) {
      settingsContainer.insertBefore(separatorItem, settingsContainer.firstChild);
      settingsContainer.insertBefore(selectItem, settingsContainer.firstChild);
    }
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
