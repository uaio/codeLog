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
  perfRunning: string;
  copied: string;
  clickCopy: string;
}> = {
  zh: {
    pageId: '页面 ID',
    perf: '⚡ 跑分',
    perfStart: '🏁 开始跑分',
    perfStop: '⏹ 停止跑分',
    perfRunning: '⏳ 跑分中...',
    copied: '✓ 已复制',
    clickCopy: '点击复制',
  },
  en: {
    pageId: 'Page ID',
    perf: '⚡ Perf',
    perfStart: '🏁 Start',
    perfStop: '⏹ Stop',
    perfRunning: '⏳ Running...',
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
  private settingsItemsAdded = false;
  private settingsItemCount = 0;

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
    this.settingsItemsAdded = false;
    this.settingsItemCount = 0;
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

    // 跑分完成 → 重置按钮状态
    this.unsubscribers.push(
      bus.on('perf_run_done', () => {
        this.perfRunning = false;
        this.renderInfoPanel();
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
      // Render once after init + add settings items to Settings panel
      setTimeout(() => this.renderInfoPanel(), 1200);
      setTimeout(() => this.addSettingsItems(), 1200);
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
      const isRunning = this.perfRunning;
      const btnLabel = isRunning ? L.perfRunning : L.perfStart;
      const btnStyle = isRunning
        ? 'cursor:not-allowed;padding:2px 8px;background:#bbb;color:#fff;border-radius:4px;font-size:12px;border:none;pointer-events:none;'
        : 'cursor:pointer;padding:2px 8px;background:#111;color:#fff;border-radius:4px;font-size:12px;border:none;';
      infoPanel.add(
        L.perf,
        `<button id="codelog-perf-btn" ${isRunning ? 'disabled' : ''} style="${btnStyle}">${btnLabel}</button>`,
      );
    }

    // Bind event handlers after DOM settles
    setTimeout(() => this.bindInfoPanelHandlers(), 300);
  }

  /** Add language + theme selects to top of Settings panel (called once after attach) */
  private addSettingsItems(): void {
    if (this.settingsItemsAdded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = this.eruda?.get('settings') as any;
    if (!settings || typeof settings.select !== 'function') return;

    let count = 0;

    // --- Language select ---
    // Uses display labels '中文'/'English' as option values so the dropdown renders correctly.
    // On change: save to localStorage then reload so eruda re-inits with the new language.
    const langConfig = {
      get: (_key: string) => (this.lang === 'zh' ? '中文' : 'English'),
      set: (_key: string, val: string) => {
        const newLang: Lang = val === '中文' ? 'zh' : 'en';
        try { localStorage.setItem('codelog-lang', newLang); } catch { /* ignore */ }
        location.reload();
      },
    };
    settings.select(langConfig, 'lang', '语言 / Language', ['中文', 'English']);
    count++;

    // --- Theme select (Light / Dark) ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devTools = this.eruda?.get() as any;
    if (devTools?.config) {
      const DARK_THEMES = ['Dark', 'Material Oceanic', 'Material Darker', 'Material Palenight',
        'Material Deep Ocean', 'Monokai Pro', 'Dracula', 'Arc Dark', 'Atom One Dark',
        'Solarized Dark', 'Night Owl', 'AMOLED'];
      const themeConfig = {
        get: (_key: string) => DARK_THEMES.includes(devTools.config.get('theme')) ? 'Dark' : 'Light',
        set: (_key: string, val: string) => { devTools.config.set('theme', val); },
      };
      settings.select(themeConfig, 'theme', '主题 / Theme', ['Light', 'Dark']);
      count++;
    }

    // --- Separator after our items, before eruda's built-in items ---
    settings.separator();
    count++;

    this.settingsItemCount = count;
    this.settingsItemsAdded = true;
    setTimeout(() => this.moveSettingsItemsToTop(), 300);
  }

  /** Move our injected settings items (last N children) to the top of the Settings panel */
  private moveSettingsItemsToTop(): void {
    const shadowRoot = this.getErudaShadowRoot();
    if (!shadowRoot) return;
    const settingsContainer = shadowRoot.querySelector('.luna-setting');
    if (!settingsContainer) return;
    const children = Array.from(settingsContainer.children);
    const count = this.settingsItemCount;
    if (children.length < count) return;
    // Items to move are the last `count` children; move them to front in original order.
    // Inserting in reverse order (last→first) via insertBefore(x, firstChild) keeps order intact.
    const itemsToMove = children.slice(-count);
    for (let i = itemsToMove.length - 1; i >= 0; i--) {
      settingsContainer.insertBefore(itemsToMove[i]!, settingsContainer.firstChild);
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
      // Use onclick to avoid duplicate handlers when bindInfoPanelHandlers is called multiple times
      pageIdEl.onclick = () => this.copyToClipboard(this.pageId!, pageIdEl, displayId);
    }

    // Perf run toggle
    const perfBtn = shadowRoot.getElementById('codelog-perf-btn') as HTMLButtonElement | null;
    if (perfBtn && this.codelog) {
      const L = LABELS[this.lang];
      // Use onclick to avoid duplicate handlers when bindInfoPanelHandlers is called multiple times
      perfBtn.onclick = async () => {
        if (this.perfRunning) return; // already running, button should be disabled
        this.perfRunning = true;
        perfBtn.textContent = L.perfRunning;
        perfBtn.disabled = true;
        perfBtn.style.cssText = 'cursor:not-allowed;padding:2px 8px;background:#bbb;color:#fff;border-radius:4px;font-size:12px;border:none;pointer-events:none;';
        this.codelog!.startPerfRun();
        // Auto-stop after 10 seconds to collect enough data and send to server
        setTimeout(() => {
          this.codelog?.stopPerfRun();
        }, 10000);
      };
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
