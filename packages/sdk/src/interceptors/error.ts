import type { PlatformAdapter } from '../platform/types.js';
import type { DataBus } from '../core/DataBus.js';
import { cleanStackTrace } from '../core/utils/serialize.js';

export type ErrorReportCallback = (entry: {
  timestamp: number;
  level: 'error';
  message: string;
  stack?: string;
}) => void;

/**
 * 全局错误拦截器
 * 使用 addEventListener 而非替换 window.onerror，避免与页面自身的错误处理逻辑冲突：
 *   - addEventListener 是叠加式的，多个 handler 互不覆盖
 *   - window.onerror 是单值赋值，存在"后来者覆盖前者"的竞态问题
 */
export class ErrorInterceptor {
  private platform: PlatformAdapter;
  private bus: DataBus;
  private errorHandler: ((event: Event) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
  private started = false;
  /** 防止 callback 自身报错引发无限循环 */
  private reporting = false;

  constructor(platform: PlatformAdapter, bus: DataBus) {
    this.platform = platform;
    this.bus = bus;
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    // 使用 addEventListener('error') 而非替换 window.onerror
    // capture: true 确保能捕获到 iframe / 子资源加载错误
    this.errorHandler = (event: Event) => {
      if (this.reporting) return;

      // 资源加载失败（img/script/link 等）：target 是 HTMLElement，无 event.error
      if (event.target instanceof HTMLElement) {
        const el = event.target as HTMLImageElement & HTMLScriptElement & HTMLLinkElement;
        const url = el.src || el.href || '';
        const tag = el.tagName.toLowerCase();
        const message = `[Resource Error] Failed to load <${tag}>${url ? `: ${url}` : ''}`;

        this.safeReport({ timestamp: Date.now(), level: 'error', message });
        this.bus.emit('error', { source: 'resource', message, url, tag });
        return;
      }

      // JS 运行时错误
      const errorEvent = event as ErrorEvent;
      const error = errorEvent.error;
      const stack = error?.stack
        ? cleanStackTrace(error.stack)
        : errorEvent.filename
          ? `    at ${errorEvent.filename}:${errorEvent.lineno}:${errorEvent.colno}`
          : undefined;

      const errorName = error?.name ?? 'Error';
      const consoleEntry = {
        timestamp: Date.now(),
        level: 'error' as const,
        message: `[Uncaught ${errorName}] ${errorEvent.message}`,
        stack,
      };

      this.safeReport(consoleEntry);

      this.bus.emit('error', {
        source: 'uncaught',
        message: errorEvent.message,
        stack,
        filename: errorEvent.filename,
        lineno: errorEvent.lineno,
        colno: errorEvent.colno,
      });
    };

    // 捕获未处理的 Promise rejection（addEventListener 本身已是叠加式）
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      if (this.reporting) return;
      const reason = event.reason;
      let message: string;
      let stack: string | undefined;

      if (reason instanceof Error) {
        message = `[Unhandled Promise Rejection] ${reason.message}`;
        stack = cleanStackTrace(reason.stack);
      } else {
        message = `[Unhandled Promise Rejection] ${String(reason)}`;
      }

      this.safeReport({ timestamp: Date.now(), level: 'error', message, stack });

      this.bus.emit('error', {
        source: 'unhandledrejection',
        message,
        stack,
        reason: String(reason),
      });
    };

    window.addEventListener('error', this.errorHandler, true);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler, true);
      this.errorHandler = null;
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }
  }

  private safeReport(entry: Parameters<ErrorReportCallback>[0]): void {
    this.reporting = true;
    try {
      this.bus.emit('console', { ...entry, args: [entry.message] });
    } catch {
      // 静默忽略：DataBus emit 自身的错误不能再触发 onerror
    } finally {
      this.reporting = false;
    }
  }
}
