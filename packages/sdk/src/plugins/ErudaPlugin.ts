import type { DataBus } from '../core/DataBus.js';
import type { DataBusConsoleEntry } from '../core/DataBus.js';

interface ErudaConsolePanel {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  restoreConsole?: () => void;
}

interface ErudaInstance {
  get: (name: string) => ErudaConsolePanel | null;
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

  /** Find the Eruda toolbar, handling both shadow DOM (useShadowDom: true) and regular DOM */
  private getErudaToolbar(): HTMLElement | null {
    const shadowHost = document.getElementById('eruda');
    if (shadowHost?.shadowRoot) {
      const el = shadowHost.shadowRoot.querySelector('.eruda-toolbar') as HTMLElement | null;
      if (el) return el;
    }
    return document.querySelector('.eruda-toolbar') as HTMLElement | null;
  }

  private injectPerfRunButton(codelog: {
    startPerfRun(): void;
    stopPerfRun(): Promise<any>;
  }): void {
    const tryInject = () => {
      const toolbar = this.getErudaToolbar();
      if (!toolbar) {
        setTimeout(tryInject, 500);
        return;
      }
      const btn = document.createElement('div');
      btn.className = 'eruda-tool-btn';
      btn.textContent = '🏁跑分';
      btn.style.cssText =
        'padding:4px 8px;cursor:pointer;font-size:12px;border:1px solid #ccc;border-radius:3px;background:#fff;margin-left:4px;';
      let running = false;
      btn.addEventListener('click', async () => {
        if (running) {
          running = false;
          btn.textContent = '🏁跑分';
          await codelog.stopPerfRun();
        } else {
          running = true;
          btn.textContent = '⏹停止';
          codelog.startPerfRun();
        }
      });
      toolbar.appendChild(btn);
    };
    setTimeout(tryInject, 1000);
  }

  private injectPageIdBadge(pageId: string): void {
    const shortId = pageId.slice(-8);
    const tryInject = () => {
      const toolbar = this.getErudaToolbar();
      if (!toolbar) {
        setTimeout(tryInject, 500);
        return;
      }
      if (toolbar.querySelector('[data-codelog-pageid]')) return;

      const badge = document.createElement('div');
      badge.setAttribute('data-codelog-pageid', '1');
      badge.title = `Page ID: ${pageId}\nClick to copy`;
      badge.style.cssText =
        'padding:3px 7px;cursor:pointer;font-size:11px;font-family:monospace;' +
        'border:1px solid rgba(59,91,219,0.35);border-radius:3px;' +
        'background:#eef2ff;color:#3b5bdb;margin-left:4px;user-select:none;';
      badge.textContent = `#${shortId}`;

      badge.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(pageId).then(() => {
            badge.textContent = '✓ copied';
            setTimeout(() => { badge.textContent = `#${shortId}`; }, 1500);
          });
        } else {
          const tmp = document.createElement('input');
          tmp.value = pageId;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          document.body.removeChild(tmp);
          badge.textContent = '✓ copied';
          setTimeout(() => { badge.textContent = `#${shortId}`; }, 1500);
        }
      });

      toolbar.appendChild(badge);
    };
    setTimeout(tryInject, 1000);
  }
}
