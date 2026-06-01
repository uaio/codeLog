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
  get: (name: string) => ErudaConsolePanel | ErudaInfoPanel | null;
}

/**
 * Eruda 本地展示插件
 *
 * 职责：
 *  - 订阅 DataBus 的 console 事件，将日志推送到 Eruda 面板（保留原始 args 富文本渲染）
 *  - Eruda 以 overrideConsole: false 初始化，禁用其自身的 console 拦截，
 *    避免与 DataBus 采集层重复，确保"单一数据来源"
 *
 * 手机端 vs PC 端差异：
 *  - 手机端：console / 错误 / 基础 network（Eruda 自带 Network 面板保留）
 *  - PC 端：完整性能图表 + DOM 树 + 详细网络瀑布流（在 packages/web 实现）
 */
export class ErudaPlugin {
  private eruda: ErudaInstance | null = null;
  private unsubscribers: Array<() => void> = [];

  /** 将 Eruda 实例与 DataBus 绑定（可在 Eruda 异步加载完成后调用） */
  attach(
    eruda: ErudaInstance,
    bus: DataBus,
    codelog?: { startPerfRun(): void; stopPerfRun(): Promise<any> },
    pageId?: string,
  ): void {
    this.eruda = eruda;
    this.detach(); // 避免重复订阅

    // 订阅 console 事件 → 推入 Eruda console 面板
    this.unsubscribers.push(
      bus.on('console', (entry: DataBusConsoleEntry) => {
        this.forwardToEruda(entry);
      }),
    );

    if (codelog && typeof document !== 'undefined') {
      this.injectPerfRunButton(codelog);
    }

    if (pageId && typeof document !== 'undefined') {
      this.injectPageIdBadge(pageId);
    }
  }

  /** 解绑（清理订阅，不影响 DataBus 本身） */
  detach(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  private forwardToEruda(entry: DataBusConsoleEntry): void {
    if (!this.eruda) return;
    const panel = this.eruda.get('console');
    if (!panel) return;

    const method = entry.level as keyof ErudaConsolePanel;
    const fn = panel[method];
    if (typeof fn !== 'function') return;

    // 优先使用原始 args（保留 Eruda 的对象/数组富文本渲染）
    if (entry.args && entry.args.length > 0) {
      fn.call(panel, ...entry.args);
    } else {
      fn.call(panel, entry.message);
    }
  }

  /** Get the shadow root of the #eruda host (useShadowDom: true) */
  private getErudaShadowRoot(): ShadowRoot | null {
    return (document.getElementById('eruda') as HTMLElement | null)?.shadowRoot ?? null;
  }

  private injectPerfRunButton(codelog: {
    startPerfRun(): void;
    stopPerfRun(): Promise<any>;
  }): void {
    // Add a run button to the Eruda Info panel via official API
    const infoPanel = this.eruda?.get('info') as ErudaInfoPanel | null;
    if (!infoPanel || typeof infoPanel.add !== 'function') return;
    infoPanel.add('⚡ Perf', '<span id="codelog-perf-btn" style="cursor:pointer;padding:2px 8px;background:#000;color:#fff;border-radius:4px;font-size:12px;">🏁 开始跑分</span>');

    // Attach click handler after DOM settles
    const tryBind = () => {
      const shadowRoot = this.getErudaShadowRoot();
      const el = shadowRoot?.getElementById('codelog-perf-btn');
      if (!el) { setTimeout(tryBind, 500); return; }
      let running = false;
      el.addEventListener('click', async () => {
        if (running) {
          running = false;
          el.textContent = '🏁 开始跑分';
          await codelog.stopPerfRun();
        } else {
          running = true;
          el.textContent = '⏹ 停止';
          codelog.startPerfRun();
        }
      });
    };
    setTimeout(tryBind, 1200);
  }

  private injectPageIdBadge(pageId: string): void {
    const shortId = pageId.slice(-8);

    // 1. Add to Eruda Info panel via official API (always visible in Info tab)
    const infoPanel = this.eruda?.get('info') as ErudaInfoPanel | null;
    if (infoPanel && typeof infoPanel.add === 'function') {
      infoPanel.add(
        'Page ID',
        `<span id="codelog-pageid-info" title="Click to copy" style="cursor:pointer;font-family:monospace;color:#3b5bdb;">#${shortId}</span>`,
      );
      // Attach copy handler once the shadow DOM settles
      const tryBindInfo = () => {
        const shadowRoot = this.getErudaShadowRoot();
        const el = shadowRoot?.getElementById('codelog-pageid-info');
        if (!el) { setTimeout(tryBindInfo, 500); return; }
        el.addEventListener('click', () => this.copyToClipboard(pageId, el, `#${shortId}`));
      };
      setTimeout(tryBindInfo, 1200);
    }

    // 2. Floating badge above the entry button (always visible without opening Eruda)
    const tryInjectBadge = () => {
      const shadowRoot = this.getErudaShadowRoot();
      if (!shadowRoot) { setTimeout(tryInjectBadge, 500); return; }
      const entryBtn = shadowRoot.querySelector('.eruda-entry-btn') as HTMLElement | null;
      if (!entryBtn) { setTimeout(tryInjectBadge, 500); return; }
      if (shadowRoot.querySelector('[data-codelog-pageid]')) return;

      const badge = document.createElement('div');
      badge.setAttribute('data-codelog-pageid', '1');
      badge.title = `Page ID: ${pageId}\nClick to copy`;
      badge.style.cssText =
        'position:absolute;bottom:48px;left:50%;transform:translateX(-50%);' +
        'white-space:nowrap;padding:2px 6px;cursor:pointer;font-size:10px;' +
        'font-family:monospace;border-radius:3px;background:rgba(59,91,219,0.85);' +
        'color:#fff;user-select:none;z-index:10001;';
      badge.textContent = `#${shortId}`;
      badge.addEventListener('click', () => this.copyToClipboard(pageId, badge, `#${shortId}`));

      // entry-btn uses position:relative, so absolute child works
      entryBtn.style.overflow = 'visible';
      entryBtn.appendChild(badge);
    };
    setTimeout(tryInjectBadge, 1000);
  }

  private copyToClipboard(text: string, el: HTMLElement, resetLabel: string): void {
    const restore = () => { setTimeout(() => { el.textContent = resetLabel; }, 1500); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { el.textContent = '✓ copied'; restore(); });
    } else {
      const tmp = document.createElement('input');
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      el.textContent = '✓ copied';
      restore();
    }
  }
}
