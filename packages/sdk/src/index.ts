import { getDeviceInfo, generateTabId, updateDeviceActiveTime } from './core/device.js';
import { DataBus } from './core/DataBus.js';
import { Reporter } from './transport/reporter.js';
import { NetworkInterceptor } from './interceptors/network.js';
import { WebSocketInterceptor } from './interceptors/websocket.js';
import { EventSourceInterceptor } from './interceptors/eventsource.js';
import { BeaconInterceptor } from './interceptors/beacon.js';
import { StorageReader } from './interceptors/storage.js';
import { ErrorInterceptor } from './interceptors/error.js';
import { DOMCollector } from './interceptors/dom.js';
import { PerformanceCollector } from './interceptors/performance.js';
import { ScreenshotCollector } from './interceptors/screenshot.js';
import { SystemInfoCollector } from './interceptors/system.js';
import { IndexedDBInterceptor } from './interceptors/indexeddb.js';
import { ErudaPlugin } from './plugins/ErudaPlugin.js';
import { BrowserAdapter } from './platform/browser/index.js';
import { scorePerfRun } from './core/perf-score.js';
import { runPageAudit } from './interceptors/page-audit.js';
import { NetworkThrottle } from './interceptors/network-throttle.js';
import { MockAPI } from './interceptors/mock-api.js';
import type { PlatformAdapter } from './platform/types.js';
import type { RemoteConfig, ErudaConfig, NetworkInterceptorConfig } from './types/index.js';
import type { ThrottlePreset } from './interceptors/network-throttle.js';
import type { MockRule } from './types/index.js';
import type { PerfRunSession } from './types/index.js';
import { serializeArgs, cleanStackTrace, extractConsoleCssStyles, formatConsoleStyledParts } from './core/utils/serialize.js';
import { serializeConsoleArgs } from './core/utils/atom.js';
import { GestureActivator, type GestureConfig } from './core/gesture.js';
import { OfflineBuffer, type OfflineBufferOptions } from './core/offline-buffer.js';
import { PluginManager, type CodeLogPlugin } from './plugins/PluginManager.js';

// Eruda 类型声明
interface Eruda {
  init: (options?: ErudaConfig) => void;
  destroy: () => void;
  show: () => void;
  hide: () => void;
  get: (name: string) => unknown;
}

export const version = '0.1.0';

/** 默认心跳间隔（毫秒） */
const DEFAULT_HEARTBEAT_INTERVAL = 30000;

/** 用于检测已存在 CodeLog 实例的符号 */
const CODELOG_INSTANCE_KEY = Symbol.for('codelog.instance');

interface OriginalConsole {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
  info: typeof console.info;
  debug: typeof console.debug;
  trace: typeof console.trace;
  clear: typeof console.clear;
}

export interface CodeLogOptions extends RemoteConfig {
  /** 心跳间隔（毫秒），默认 30000 */
  heartbeatInterval?: number;
  /** Eruda 调试面板配置 */
  eruda?: ErudaConfig;
  /** 手势激活调试面板配置 */
  gesture?: GestureConfig;
  /** 网络请求拦截配置 */
  network?: NetworkInterceptorConfig;
  /** 是否自动捕获全局 JS 错误和未处理的 Promise rejection，默认 true */
  captureErrors?: boolean;
  /** DOM 快照配置 */
  dom?: {
    /** 是否启用 DOM 快照，默认 true */
    enabled?: boolean;
    /** 页面加载后延迟多少毫秒自动采集一次，默认 2000 */
    initialDelay?: number;
  };
  /** 性能监控配置 */
  performance?: {
    /** 是否启用性能监控，默认 true */
    enabled?: boolean;
  };
  /**
   * Console data processor — called for each console entry before it is sent.
   * Return the (optionally modified) entry to keep it, or null/undefined/false to drop it.
   */
  consoleProcessor?: (entry: {
    level: string;
    message: string;
    args: unknown[];
    timestamp: number;
  }) => { level: string; message: string; args: unknown[]; timestamp: number } | null | undefined | false;
  /**
   * Network data processor — called for each network request/response entry.
   * Return the entry to keep it, or null/undefined/false to drop it.
   */
  networkProcessor?: (entry: {
    url: string;
    method: string;
    type: string;
    status?: number;
    requestBody?: string;
    responseBody?: string;
  }) => { url: string; method: string; type: string; status?: number; requestBody?: string; responseBody?: string } | null | undefined | false;
  /**
   * Storage data processor — called for each storage snapshot.
   * Return the snapshot to keep it, or null/undefined/false to drop it.
   */
  storageProcessor?: (snapshot: {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    cookies: string;
  }) => { localStorage: Record<string, string>; sessionStorage: Record<string, string>; cookies: string } | null | undefined | false;
  /**
   * IndexedDB operation processor — called for each IDB entry before it is sent.
   * Return the entry to keep it, or null/undefined/false to drop it.
   */
  databaseProcessor?: (entry: {
    dbName: string;
    storeName: string;
    operation: string;
    key?: unknown;
    value?: unknown;
  }) => { dbName: string; storeName: string; operation: string; key?: unknown; value?: unknown } | null | undefined | false;
  /** Offline buffer configuration — persist events to localStorage when disconnected */
  offline?: OfflineBufferOptions & { enabled?: boolean };
  /** Plugins to install on startup */
  plugins?: CodeLogPlugin[];
  /**
   * Disable specific built-in interceptors by name.
   * Valid names: 'console' | 'network' | 'storage' | 'dom' | 'performance' | 'error' | 'indexeddb' | 'screenshot' | 'system'
   */
  disabledPlugins?: Array<'console' | 'network' | 'storage' | 'dom' | 'performance' | 'error' | 'indexeddb' | 'screenshot' | 'system'>;
  /** 平台适配器，默认 BrowserAdapter */
  platform?: PlatformAdapter;
}

export class CodeLog {
  private dataBus: DataBus;
  private reporter: Reporter;
  private erudaPlugin: ErudaPlugin;
  private deviceInfo: ReturnType<typeof getDeviceInfo>;
  private tabId: string;
  private projectId: string;
  private platform: PlatformAdapter;
  private heartbeatTimerId: number | null = null;
  private heartbeatIntervalMs: number;
  private originalConsole: OriginalConsole | null = null;
  private erudaInitialized = false;
  private eruda: Eruda | null = null;
  private networkInterceptor: NetworkInterceptor | null = null;
  private wsInterceptor: WebSocketInterceptor | null = null;
  private sseInterceptor: EventSourceInterceptor | null = null;
  private beaconInterceptor: BeaconInterceptor | null = null;
  private storageReader: StorageReader | null = null;
  private errorInterceptor: ErrorInterceptor | null = null;
  private domCollector: DOMCollector | null = null;
  private performanceCollector: PerformanceCollector | null = null;
  private screenshotCollector: ScreenshotCollector | null = null;
  private zenMode = false;
  private networkConfig: NetworkInterceptorConfig | undefined;
  private perfRunning = false;
  private perfRunCollector: PerformanceCollector | null = null;
  private perfRunStartTime = 0;
  private lastPerfRunSession: PerfRunSession | null = null;
  private networkThrottle: NetworkThrottle | null = null;
  private mockApi: MockAPI | null = null;
  private visibilityHandler: (() => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  private systemCollector: SystemInfoCollector | null = null;
  private idbInterceptor: IndexedDBInterceptor | null = null;
  private resolvedServerUrl: string | undefined;
  private gestureActivator: GestureActivator | null = null;
  private consoleProcessor: CodeLogOptions['consoleProcessor'] | undefined;
  private networkProcessor: CodeLogOptions['networkProcessor'] | undefined;
  private storageProcessor: CodeLogOptions['storageProcessor'] | undefined;
  private databaseProcessor: CodeLogOptions['databaseProcessor'] | undefined;
  private disabledPlugins: Set<string>;
  private offlineBuffer: OfflineBuffer | null = null;
  private pluginManager: PluginManager = new PluginManager();

  constructor(options: CodeLogOptions) {
    if (!options.projectId) {
      throw new Error('projectId is required');
    }

    // 检测是否已存在 CodeLog 实例
    const existingInstance = (globalThis as Record<symbol, unknown>)[CODELOG_INSTANCE_KEY];
    if (existingInstance) {
      console.warn('codeLog: 检测到已存在的实例，多个实例可能导致竞态条件');
    }

    this.projectId = options.projectId;
    this.platform = options.platform ?? new BrowserAdapter();
    this.deviceInfo = getDeviceInfo(options.projectId, this.platform);
    this.tabId = generateTabId();
    this.heartbeatIntervalMs = options.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
    this.consoleProcessor = options.consoleProcessor;
    this.networkProcessor = options.networkProcessor;
    this.storageProcessor = options.storageProcessor;
    this.databaseProcessor = options.databaseProcessor;
    this.disabledPlugins = new Set(options.disabledPlugins ?? []);
    if (options.offline?.enabled !== false && typeof localStorage !== 'undefined') {
      this.offlineBuffer = new OfflineBuffer(options.offline ?? {});
    }

    // ① 创建 DataBus — 所有数据采集的唯一来源，最先初始化
    this.dataBus = new DataBus();

    // ② Reporter 订阅 DataBus → 转发到远端 PC
    this.reporter = new Reporter(this.deviceInfo, this.tabId, this.platform);
    this.reporter.attachDataBus(this.dataBus);

    // ② Offline buffer: subscribe to console/error events for localStorage persistence
    if (this.offlineBuffer) {
      const buf = this.offlineBuffer;
      this.dataBus.on('console', (payload) => buf.push('console', payload));
      this.dataBus.on('error', (payload) => buf.push('error', payload));
      // Auto-save on page hide
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') buf.save();
        });
      }
    }

    // ③ Eruda 展示插件实例（会在 Eruda 异步加载后绑定）
    this.erudaPlugin = new ErudaPlugin();

    // 解析服务器地址：优先 server，其次 port（自动推断 hostname）
    const resolvedServer = options.server ?? resolveServerUrl(options.port);
    this.resolvedServerUrl = resolvedServer;

    // 检查用户是否之前关闭了远程监控
    const remoteDisabled =
      this.platform.storage.getItem(`codelog_remote_${this.projectId}`) === 'false';
    if (!remoteDisabled) {
      this.reporter.connect(resolvedServer);
    }

    // ④ Console 拦截 — DataBus emit 发生在第一时间，之后再调用原始 console（Eruda 链）
    if (!this.disabledPlugins.has('console')) {
      this.interceptConsole();
    }

    // ⑤ 其余采集器全部通过 DataBus 上报
    this.networkConfig = options.network;
    if (!this.disabledPlugins.has('network')) {
      this.initNetworkInterceptor(options.network);
    }
    if (!this.disabledPlugins.has('storage')) {
      this.initStorageReader();
    }

    if (options.captureErrors !== false && !this.disabledPlugins.has('error')) {
      this.initErrorInterceptor();
    }

    if (options.dom?.enabled !== false && !this.disabledPlugins.has('dom')) {
      this.initDOMCollector(options.dom?.initialDelay);
    }

    if (options.performance?.enabled !== false && !this.disabledPlugins.has('performance')) {
      this.initPerformanceCollector();
    }

    // ScreenshotCollector — skippable via disabledPlugins
    if (!this.disabledPlugins.has('screenshot')) {
      this.initScreenshotCollector();
    }

    // 注册跑分/Mock/节流相关回调
    this.reporter.onStartPerfRun(() => {
      this.startPerfRun();
    });
    this.reporter.onStopPerfRun(() => {
      this.stopPerfRun();
    });
    this.reporter.onSetNetworkThrottle((preset) => {
      this.setNetworkThrottle(preset as ThrottlePreset);
    });
    this.reporter.onAddMock((rule) => {
      if (!this.mockApi) {
        this.mockApi = new MockAPI();
        this.mockApi.start();
      }
      this.mockApi.addRule(rule);
    });
    this.reporter.onRemoveMock((id) => {
      this.removeMock(id);
    });
    this.reporter.onClearMocks(() => {
      this.clearMocks();
    });

    // IDB browser commands
    this.reporter.onRequestIDBSnapshot(async () => {
      if (!this.idbInterceptor) return;
      try {
        const snapshot = await this.idbInterceptor.takeSnapshot();
        this.reporter.reportIDBSnapshot(snapshot);
      } catch {
        // ignore
      }
    });
    this.reporter.onRequestIDBStoreData(async (dbName, storeName, page, pageSize, reqId) => {
      if (!this.idbInterceptor) return;
      try {
        const data = await this.idbInterceptor.getStoreData(dbName, storeName, page, pageSize);
        this.reporter.reportIDBStoreData({ ...data, reqId });
      } catch {
        // ignore
      }
    });

    this.reporter.onGetComputedStyles((selector) => {
      try {
        const el = document.querySelector(selector);
        if (!el) return;
        const cs = window.getComputedStyle(el);
        const props = [
          'color', 'background-color', 'background', 'font-size', 'font-family', 'font-weight',
          'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-decoration',
          'display', 'position', 'top', 'right', 'bottom', 'left',
          'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
          'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
          'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'border', 'border-radius', 'outline',
          'overflow', 'overflow-x', 'overflow-y',
          'z-index', 'opacity', 'visibility', 'cursor',
          'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self',
          'grid', 'grid-template-columns', 'grid-template-rows',
          'transform', 'transition', 'animation',
          'box-shadow', 'text-shadow',
          'pointer-events', 'user-select',
        ];
        const styles: Record<string, string> = {};
        for (const prop of props) {
          const val = cs.getPropertyValue(prop);
          if (val) styles[prop] = val;
        }
        this.reporter.reportComputedStyles(selector, styles);
      } catch {
        // ignore — element may not be in DOM
      }
    });

    this.reporter.onSetElementAttr((selector, attr, value) => {
      try {
        const el = document.querySelector(selector);
        if (!el) return;
        if (value === '') {
          el.removeAttribute(attr);
        } else {
          el.setAttribute(attr, value);
        }
        // Trigger DOM snapshot refresh so web panel updates
        this.domCollector?.collect();
      } catch {
        // ignore
      }
    });

    this.reporter.onStartElementPicker(() => {
      let overlay: HTMLDivElement | null = null;

      const buildSelector = (el: Element): string => {
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 2).join('.');
        return classes ? `${tag}.${classes}` : tag;
      };

      const onMove = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (!target || target === overlay) return;
        const rect = target.getBoundingClientRect();
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.style.cssText = [
            'position:fixed', 'pointer-events:none', 'z-index:2147483647',
            'border:2px solid #007acc', 'background:rgba(0,122,204,0.15)',
            'box-sizing:border-box', 'transition:all 60ms ease',
          ].join(';');
          document.body.appendChild(overlay);
        }
        overlay.style.top = `${rect.top}px`;
        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
      };

      const onPick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as Element | null;
        cleanup();
        if (!target) return;
        const selector = buildSelector(target);
        this.reporter.reportPickedElement(selector, target.tagName);
        // Also request DOM snapshot centered on this element
        this.domCollector?.collect();
      };

      const cleanup = () => {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('click', onPick, true);
        document.removeEventListener('keydown', onKey, true);
        if (overlay) { overlay.remove(); overlay = null; }
        document.body.style.cursor = '';
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') cleanup();
      };

      document.body.style.cursor = 'crosshair';
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('click', onPick, true);
      document.addEventListener('keydown', onKey, true);
    });

    // 标记实例存在
    (globalThis as Record<symbol, unknown>)[CODELOG_INSTANCE_KEY] = this;

    // 定期更新活跃时间
    this.heartbeatTimerId = this.platform.timer.setInterval(() => {
      updateDeviceActiveTime(this.projectId, this.platform);
      this.reporter.updateDeviceInfo();
    }, this.heartbeatIntervalMs);

    // ⑥ Eruda 最后异步加载（加载完成后将其与 DataBus 绑定，避免重复采集）
    if (options.eruda?.enabled !== false) {
      this.initEruda(options.eruda);
    }

    // ⑦ Lifecycle 事件
    this.dataBus.emit('lifecycle', {
      event: 'connect',
      url: typeof location !== 'undefined' ? location.href : undefined,
    });

    this.visibilityHandler = () => {
      const event = document.visibilityState === 'visible' ? 'page_show' : 'page_hide';
      this.dataBus.emit('lifecycle', { event, url: location.href });
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.beforeUnloadHandler = () => {
      this.dataBus.emit('lifecycle', { event: 'page_unload', url: location.href });
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    // ⑧ System info — collect once on connect, re-collect on network/battery change
    if (!this.disabledPlugins.has('system')) {
      this.systemCollector = new SystemInfoCollector((payload) => {
        this.dataBus.emit('system', payload);
      });
      void this.systemCollector.startWatching();
    }

    // ⑨ IndexedDB monitoring
    if (!this.disabledPlugins.has('indexeddb')) {
      this.idbInterceptor = new IndexedDBInterceptor((entry) => {
        // Apply user-defined database processor
        if (this.databaseProcessor) {
          const result = this.databaseProcessor({
            dbName: entry.dbName,
            storeName: entry.storeName,
            operation: entry.operation,
            key: entry.key,
            value: entry.value,
          });
          if (!result) return;
          this.dataBus.emit('indexeddb', { ...entry, ...result });
          return;
        }
        this.dataBus.emit('indexeddb', entry);
      });
      this.idbInterceptor.start();
    }

    // ⑩ Gesture activation (optional)
    if (options.gesture) {
      this.gestureActivator = new GestureActivator(options.gesture);
      this.gestureActivator.start();
    }

    // ⑪ Plugin manager — initialise context and install any plugins passed in options
    this.pluginManager = new PluginManager();
    const httpBase = resolvedServer
      ? resolvedServer.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://').replace(/\/ws$/, '')
      : undefined;
    this.pluginManager.setContext({
      dataBus: this.dataBus,
      projectId: this.projectId,
      serverUrl: httpBase,
    });
    for (const plugin of options.plugins ?? []) {
      void this.pluginManager.use(plugin);
    }
  }

  private async initEruda(config?: ErudaConfig): Promise<void> {
    try {
      // 动态导入 eruda UMD 模块
      const erudaModule = await import('@codelog/eruda');
      // @ts-ignore - eruda is UMD module, default export is the eruda object
      this.eruda = erudaModule.default || erudaModule;

      if (this.eruda && typeof this.eruda.init === 'function') {
        this.eruda.init({
          tool: config?.tool,
          autoScale: config?.autoScale ?? true,
          useShadowDom: true,
          defaults: {
            ...config?.defaults,
            // 禁用 Eruda 自身的 console override：
            // DataBus 已是唯一采集源，ErudaPlugin 负责将数据推入 Eruda 面板。
            // 若保留 overrideConsole，Eruda 会二次 patch 我们的 patch，导致：
            //   1. 数据双重采集
            //   2. DataBus emit 不再"第一时间"（Eruda 先于 DataBus 触发）
            overrideConsole: false,
          },
        });

        // 绑定 ErudaPlugin：订阅 DataBus → 将日志推入 Eruda console 面板
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.erudaPlugin.attach(this.eruda as any, this.dataBus, this);
        this.erudaInitialized = true;
      } else {
        console.warn('codeLog: Eruda 初始化失败 - 无效的 eruda 模块');
      }
    } catch (error) {
      console.warn('codeLog: Eruda 加载失败', error);
    }
  }

  private interceptConsole(): void {
    // 保存原始 console 方法（此时尚未被 Eruda patch，因为 Eruda 异步加载）
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
      trace: console.trace,
      clear: console.clear,
    };

    const self = this;
    let groupDepth = 0;
    const timerMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    // 创建通用的 console 拦截处理函数
    const createInterceptor = (
      level: 'log' | 'warn' | 'error' | 'info' | 'debug',
      originalFn: typeof console.log,
      captureStack = false,
    ) => {
      return function (...args: unknown[]) {
        // ① DataBus emit 在第一时间发生（先于原始 console 调用，先于 Eruda 面板展示）
        try {
          let message = serializeArgs(args);
          let processedArgs = args;
          // Apply user-defined console processor
          if (self.consoleProcessor) {
            const result = self.consoleProcessor({ level, message, args, timestamp: Date.now() });
            if (!result) {
              // Processor dropped this entry
              originalFn.apply(console, args);
              return;
            }
            message = result.message;
            processedArgs = result.args;
          }
          const cssStyles = extractConsoleCssStyles(processedArgs);
          const styledParts = formatConsoleStyledParts(processedArgs);
          const serializedArgs = serializeConsoleArgs(processedArgs);
          const entry = {
            timestamp: Date.now(),
            level,
            message,
            args: processedArgs,
            serializedArgs,
            indent: groupDepth,
            ...(cssStyles.length > 0 ? { cssStyles } : {}),
            ...(styledParts ? { styledParts } : {}),
            ...(captureStack ? { stack: cleanStackTrace(new Error().stack) } : {}),
          };
          self.dataBus.emit('console', entry);
        } catch {
          // 静默处理，避免影响原始 console 输出
        }

        // ② 调用原始方法
        originalFn.apply(console, args);
      };
    };

    console.log = createInterceptor('log', this.originalConsole.log);
    console.warn = createInterceptor('warn', this.originalConsole.warn);
    console.error = createInterceptor('error', this.originalConsole.error, true);
    console.info = createInterceptor('info', this.originalConsole.info);
    console.debug = createInterceptor('debug', this.originalConsole.debug);
    console.trace = createInterceptor('warn', this.originalConsole.trace, true);

    // ── console.table ──────────────────────────────────────────────────────────
    const originalTable = console.table;
    console.table = function (data?: unknown, _columns?: string[]) {
      try {
        // Normalize tabular data: array of objects or plain object
        let tableData: Array<Record<string, unknown>> = [];
        if (Array.isArray(data)) {
          tableData = data.map((row, i) =>
            (row !== null && typeof row === 'object')
              ? { '(index)': i, ...(row as Record<string, unknown>) }
              : { '(index)': i, Value: row },
          );
        } else if (data !== null && typeof data === 'object') {
          tableData = Object.entries(data as Record<string, unknown>).map(([k, v]) => ({
            '(index)': k,
            Value: v,
          }));
        }
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'table',
          message: serializeArgs([data]),
          args: [data],
          indent: groupDepth,
          tableData,
        });
      } catch {
        // ignore
      }
      originalTable?.apply(console, [data]);
    };

    // ── console.group / groupCollapsed / groupEnd ──────────────────────────────
    const originalGroup = console.group;
    const originalGroupCollapsed = console.groupCollapsed;
    const originalGroupEnd = console.groupEnd;

    console.group = function (...args: unknown[]) {
      try {
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'group',
          message: args.length ? serializeArgs(args) : 'console.group',
          args,
          indent: groupDepth,
        });
        groupDepth++;
      } catch { /* ignore */ }
      originalGroup?.apply(console, args);
    };

    console.groupCollapsed = function (...args: unknown[]) {
      try {
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'group-collapsed',
          message: args.length ? serializeArgs(args) : 'console.groupCollapsed',
          args,
          indent: groupDepth,
        });
        groupDepth++;
      } catch { /* ignore */ }
      originalGroupCollapsed?.apply(console, args);
    };

    console.groupEnd = function () {
      try {
        if (groupDepth > 0) groupDepth--;
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'group-end',
          message: '',
          args: [],
          indent: groupDepth,
        });
      } catch { /* ignore */ }
      originalGroupEnd?.apply(console);
    };

    // ── console.count / countReset ─────────────────────────────────────────────
    const originalCount = console.count;
    const originalCountReset = console.countReset;

    console.count = function (label = 'default') {
      try {
        const n = (countMap.get(label) ?? 0) + 1;
        countMap.set(label, n);
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'count',
          message: `${label}: ${n}`,
          args: [`${label}: ${n}`],
          indent: groupDepth,
        });
      } catch { /* ignore */ }
      originalCount?.call(console, label);
    };

    console.countReset = function (label = 'default') {
      try {
        countMap.set(label, 0);
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'count',
          message: `${label}: 0`,
          args: [`${label}: 0`],
          indent: groupDepth,
        });
      } catch { /* ignore */ }
      originalCountReset?.call(console, label);
    };

    // ── console.time / timeEnd / timeLog ──────────────────────────────────────
    const originalTime = console.time;
    const originalTimeEnd = console.timeEnd;
    const originalTimeLog = console.timeLog;

    console.time = function (label = 'default') {
      try {
        timerMap.set(label, performance.now());
      } catch { /* ignore */ }
      originalTime?.call(console, label);
    };

    console.timeEnd = function (label = 'default') {
      try {
        const start = timerMap.get(label);
        const elapsed = start !== undefined ? (performance.now() - start).toFixed(3) : '?';
        timerMap.delete(label);
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'time-log',
          message: `${label}: ${elapsed}ms`,
          args: [`${label}: ${elapsed}ms`],
          indent: groupDepth,
        });
      } catch { /* ignore */ }
      originalTimeEnd?.call(console, label);
    };

    console.timeLog = function (label = 'default', ...data: unknown[]) {
      try {
        const start = timerMap.get(label);
        const elapsed = start !== undefined ? (performance.now() - start).toFixed(3) : '?';
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'time-log',
          message: `${label}: ${elapsed}ms ${data.length ? serializeArgs(data) : ''}`.trim(),
          args: [`${label}: ${elapsed}ms`, ...data],
          indent: groupDepth,
        });
      } catch { /* ignore */ }
      originalTimeLog?.call(console, label, ...data);
    };

    // ── console.assert ─────────────────────────────────────────────────────────
    const originalAssert = console.assert;
    console.assert = function (condition?: boolean, ...args: unknown[]) {
      if (!condition) {
        try {
          const msg = args.length ? `Assertion failed: ${serializeArgs(args)}` : 'Assertion failed';
          self.dataBus.emit('console', {
            timestamp: Date.now(),
            level: 'assert',
            message: msg,
            args: args.length ? args : ['Assertion failed'],
            indent: groupDepth,
            stack: cleanStackTrace(new Error().stack),
          });
        } catch { /* ignore */ }
      }
      originalAssert?.apply(console, [condition, ...args]);
    };

    // ── console.clear ──────────────────────────────────────────────────────────
    const originalClear = console.clear;
    console.clear = function () {
      try {
        self.dataBus.emit('console', {
          timestamp: Date.now(),
          level: 'log',
          message: '--- console cleared ---',
          args: ['--- console cleared ---'],
          indent: 0,
        });
      } catch { /* ignore */ }
      originalClear?.call(console);
    };
  }

  private initNetworkInterceptor(config?: NetworkInterceptorConfig): void {
    const bus = this.dataBus;
    const proc = this.networkProcessor;
    const emit = (entry: any) => {
      if (proc) {
        const result = proc({
          url: entry.url,
          method: entry.method,
          type: entry.type,
          status: entry.status,
          requestBody: entry.requestBody,
          responseBody: entry.responseBody,
        });
        if (!result) return;
        bus.emit('network', { ...entry, ...result });
        return;
      }
      bus.emit('network', entry);
    };
    this.networkInterceptor = new NetworkInterceptor(emit, config);
    this.networkInterceptor.start();

    this.wsInterceptor = new WebSocketInterceptor(emit);
    this.wsInterceptor.start();

    this.sseInterceptor = new EventSourceInterceptor(emit);
    this.sseInterceptor.start();

    this.beaconInterceptor = new BeaconInterceptor(emit);
    this.beaconInterceptor.start();
  }

  private initStorageReader(): void {
    const bus = this.dataBus;
    const proc = this.storageProcessor;
    this.storageReader = new StorageReader((snapshot) => {
      if (proc) {
        const result = proc({
          localStorage: snapshot.localStorage,
          sessionStorage: snapshot.sessionStorage,
          cookies: snapshot.cookies,
        });
        if (!result) return;
        bus.emit('storage', { ...snapshot, ...result });
        return;
      }
      bus.emit('storage', snapshot);
    });

    // 开始监听所有存储写操作（localStorage / sessionStorage / cookie）
    // 任何写入（包括 Eruda 面板操作）都会自动防抖上报到 PC
    this.storageReader.watch();

    // 注册刷新存储的回调
    this.reporter.onRefreshStorage(() => {
      void this.storageReader?.readAndReport();
    });
  }

  private initErrorInterceptor(): void {
    this.errorInterceptor = new ErrorInterceptor(this.platform, this.dataBus);
    this.errorInterceptor.start();
  }

  private initDOMCollector(initialDelay = 2000): void {
    const bus = this.dataBus;
    this.domCollector = new DOMCollector(this.platform, (snapshot) => {
      bus.emit('dom', snapshot);
    });

    // 延迟初次采集，等页面渲染稳定
    this.platform.timer.setTimeout(() => {
      this.domCollector?.collect();
    }, initialDelay);

    // 响应 PC 端刷新指令
    this.reporter.onRefreshDOM(() => {
      this.domCollector?.collect();
    });
  }

  private initPerformanceCollector(): void {
    this.performanceCollector = new PerformanceCollector(this.dataBus);
    this.performanceCollector.start();
  }

  private initScreenshotCollector(): void {
    this.screenshotCollector = new ScreenshotCollector(this.dataBus);
    // 响应 PC 端截图指令
    this.reporter.onTakeScreenshot(() => {
      this.screenshotCollector?.capture();
    });
    // 响应 PC 端禅模式指令
    this.reporter.onZenMode((enabled) => {
      if (enabled) this.enterZenMode();
      else this.exitZenMode();
    });
  }

  /** 手动触发截图（供外部调用） */
  async takeScreenshot(): Promise<void> {
    return this.screenshotCollector?.capture();
  }

  startPerfRun(): void {
    if (this.perfRunning) return;
    this.enterZenMode();
    this.perfRunCollector = new PerformanceCollector(this.dataBus);
    this.perfRunCollector.start();
    this.perfRunStartTime = Date.now();
    this.perfRunning = true;
    this.dataBus.emit('console', {
      timestamp: Date.now(),
      level: 'log',
      message: '[codeLog] 🏁 跑分开始...',
      args: ['[codeLog] 🏁 跑分开始...'],
    });
  }

  async stopPerfRun(): Promise<PerfRunSession | null> {
    if (!this.perfRunning) return null;
    const snapshot = this.perfRunCollector?.getSnapshot() ?? {
      vitals: [],
      samples: [],
      longTasks: [],
      resources: [],
      interactions: [],
    };
    this.perfRunCollector?.destroy();
    this.perfRunCollector = null;
    this.exitZenMode();
    const scoreResult = scorePerfRun(snapshot);
    const audit = runPageAudit();
    const endTime = Date.now();
    const session: PerfRunSession = {
      sessionId: Date.now().toString(36),
      deviceId: this.deviceInfo.deviceId,
      tabId: this.tabId,
      startTime: this.perfRunStartTime,
      endTime,
      duration: endTime - this.perfRunStartTime,
      snapshot,
      score: scoreResult,
      audit,
    };
    this.dataBus.emit('perf_run', session);
    this.lastPerfRunSession = session;
    this.perfRunning = false;
    this.dataBus.emit('console', {
      timestamp: Date.now(),
      level: 'log',
      message: `[codeLog] 🏁 跑分结束，综合评分: ${scoreResult.total}`,
      args: [`[codeLog] 🏁 跑分结束，综合评分: ${scoreResult.total}`],
    });
    return session;
  }

  getPerfReport(): PerfRunSession | null {
    return this.lastPerfRunSession;
  }

  setNetworkThrottle(preset: ThrottlePreset): void {
    if (!this.networkThrottle) {
      this.networkThrottle = new NetworkThrottle();
    }
    this.networkThrottle.setPreset(preset);
  }

  addMock(urlPattern: string, response: Omit<MockRule, 'id' | 'pattern'>): string {
    if (!this.mockApi) {
      this.mockApi = new MockAPI();
      this.mockApi.start();
    }
    return this.mockApi.addRule({ pattern: urlPattern, ...response });
  }

  removeMock(id: string): void {
    this.mockApi?.removeRule(id);
  }

  clearMocks(): void {
    this.mockApi?.clearRules();
  }

  getMocks(): MockRule[] {
    return this.mockApi?.getRules() ?? [];
  }

  /**
   * 禅模式：停止所有高开销采集（FPS/PerformanceObserver/Network/Storage 监听），
   * 只保留 console + error 捕获和 WebSocket 传输。
   * 适合跑性能报告时使用，避免 SDK 自身干扰测量结果。
   */
  enterZenMode(): void {
    if (this.zenMode) return;
    this.zenMode = true;

    // 停止 FPS/内存/长任务/资源采集
    if (this.performanceCollector) {
      this.performanceCollector.destroy();
      this.performanceCollector = null;
    }

    // 停止 Network 拦截（XHR/fetch patch）
    if (this.networkInterceptor) {
      this.networkInterceptor.stop();
      this.networkInterceptor = null;
    }
    if (this.wsInterceptor) {
      this.wsInterceptor.stop();
      this.wsInterceptor = null;
    }
    if (this.sseInterceptor) {
      this.sseInterceptor.stop();
      this.sseInterceptor = null;
    }
    if (this.beaconInterceptor) {
      this.beaconInterceptor.stop();
      this.beaconInterceptor = null;
    }

    // 停止 Storage 实时监听（保留快照读能力）
    this.storageReader?.unwatch();

    // 停止 DOM 采集轮询（如有）
    this.domCollector?.destroy();
    this.domCollector = null;

    // 发一条日志告知用户
    this.dataBus.emit('console', {
      timestamp: Date.now(),
      level: 'warn',
      message: '[codeLog] Zen Mode ON — 已停止高开销采集',
      args: ['[codeLog] Zen Mode ON — 已停止高开销采集'],
    });
  }

  /**
   * 退出禅模式，恢复所有采集器。
   */
  exitZenMode(): void {
    if (!this.zenMode) return;
    this.zenMode = false;

    this.initNetworkInterceptor(this.networkConfig);
    this.initStorageReader();
    this.initPerformanceCollector();

    this.dataBus.emit('console', {
      timestamp: Date.now(),
      level: 'log',
      message: '[codeLog] Zen Mode OFF — 已恢复所有采集',
      args: ['[codeLog] Zen Mode OFF — 已恢复所有采集'],
    });
  }

  /** 当前是否处于禅模式 */
  isZenMode(): boolean {
    return this.zenMode;
  }

  enableRemote(): void {
    this.reporter.enableRemote();
  }

  disableRemote(): void {
    this.reporter.disableRemote();
  }

  isRemoteEnabled(): boolean {
    return this.reporter.isRemoteEnabled();
  }

  /** 上报自定义事件 */
  report(name: string, data: unknown): void {
    this.dataBus.emit('custom', { name, data });
  }

  /**
   * Upload buffered console logs to the server for offline replay.
   * Call this to persist the current session's logs before the page unloads.
   */
  async uploadLogs(options?: { startTime?: number; endTime?: number }): Promise<string | null> {
    if (!this.resolvedServerUrl) return null;

    const httpBase = this.resolvedServerUrl
      .replace(/^ws:\/\//, 'http://')
      .replace(/^wss:\/\//, 'https://')
      .replace(/\/ws$/, '');

    const logs = this.dataBus
      .getBuffer?.('console')
      ?.map((e: any) => ({
        timestamp: e.timestamp,
        level: e.level,
        message: e.message,
        stack: e.stack,
        tabId: this.tabId,
      })) ?? [];

    try {
      const res = await fetch(`${httpBase}/api/saved-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceInfo.deviceId,
          ua: this.deviceInfo.ua,
          projectId: this.projectId,
          startTime: options?.startTime ?? Date.now() - 3600_000,
          endTime: options?.endTime ?? Date.now(),
          logs,
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Flush the offline buffer: upload buffered events to the server and clear the buffer.
   * Returns the saved session ID, or null if upload failed.
   */
  async flushOfflineBuffer(): Promise<string | null> {
    if (!this.offlineBuffer || !this.resolvedServerUrl) return null;

    const entries = this.offlineBuffer.flush();
    if (entries.length === 0) return null;

    const httpBase = this.resolvedServerUrl
      .replace(/^ws:\/\//, 'http://')
      .replace(/^wss:\/\//, 'https://')
      .replace(/\/ws$/, '');

    const logs = entries
      .filter((e) => e.type === 'console' || e.type === 'error')
      .map((e: any) => ({
        timestamp: e.ts,
        level: (e.payload as any)?.level ?? 'log',
        message: (e.payload as any)?.message ?? '',
        stack: (e.payload as any)?.stack,
        tabId: this.tabId,
      }));

    try {
      const res = await fetch(`${httpBase}/api/saved-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceInfo.deviceId,
          ua: this.deviceInfo.ua,
          projectId: this.projectId,
          startTime: entries[0]?.ts ?? Date.now(),
          endTime: entries[entries.length - 1]?.ts ?? Date.now(),
          logs,
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.id ?? null;
    } catch {
      return null;
    }
  }

  destroy(): void {
    // Lifecycle disconnect 事件
    this.dataBus.emit('lifecycle', { event: 'disconnect' });

    // 清理 lifecycle 监听
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    // 清除心跳定时器
    if (this.heartbeatTimerId !== null) {
      this.platform.timer.clearInterval(this.heartbeatTimerId);
      this.heartbeatTimerId = null;
    }

    // 恢复原始 console 方法
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      console.info = this.originalConsole.info;
      console.debug = this.originalConsole.debug;
      console.trace = this.originalConsole.trace;
      console.clear = this.originalConsole.clear;
      this.originalConsole = null;
    }

    // 清除全局实例标记
    if ((globalThis as Record<symbol, unknown>)[CODELOG_INSTANCE_KEY] === this) {
      delete (globalThis as Record<symbol, unknown>)[CODELOG_INSTANCE_KEY];
    }

    // 解绑 Eruda 插件
    this.erudaPlugin.detach();

    // 销毁 Eruda
    if (this.erudaInitialized && this.eruda) {
      this.eruda.destroy();
      this.erudaInitialized = false;
      this.eruda = null;
    }

    // 停止网络拦截
    if (this.networkInterceptor) {
      this.networkInterceptor.stop();
      this.networkInterceptor = null;
    }
    if (this.wsInterceptor) {
      this.wsInterceptor.stop();
      this.wsInterceptor = null;
    }
    if (this.sseInterceptor) {
      this.sseInterceptor.stop();
      this.sseInterceptor = null;
    }
    if (this.beaconInterceptor) {
      this.beaconInterceptor.stop();
      this.beaconInterceptor = null;
    }

    // 停止错误拦截
    if (this.errorInterceptor) {
      this.errorInterceptor.stop();
      this.errorInterceptor = null;
    }

    // 清理 DOM 采集器
    if (this.domCollector) {
      this.domCollector.destroy();
      this.domCollector = null;
    }

    // 停止性能采集
    if (this.performanceCollector) {
      this.performanceCollector.destroy();
      this.performanceCollector = null;
    }

    // 清理存储读取器（先停止监听再置空）
    if (this.storageReader) {
      this.storageReader.unwatch();
      this.storageReader = null;
    }

    // 停止系统信息监听
    if (this.systemCollector) {
      this.systemCollector.stopWatching();
      this.systemCollector = null;
    }

    // 停止 IndexedDB 监控
    if (this.idbInterceptor) {
      this.idbInterceptor.stop();
      this.idbInterceptor = null;
    }

    if (this.gestureActivator) {
      this.gestureActivator.stop();
      this.gestureActivator = null;
    }

    // 解绑 Reporter，清空 DataBus 订阅
    if (this.networkThrottle) {
      this.networkThrottle.destroy();
      this.networkThrottle = null;
    }
    if (this.mockApi) {
      this.mockApi.stop();
      this.mockApi = null;
    }
    if (this.perfRunCollector) {
      this.perfRunCollector.destroy();
      this.perfRunCollector = null;
    }
    this.reporter.detachDataBus();
    this.dataBus.clear();
    this.pluginManager.destroyAll();
    this.reporter.disconnect();
  }

  /** Install a plugin dynamically at runtime */
  use(plugin: CodeLogPlugin): Promise<void> {
    return this.pluginManager.use(plugin);
  }

  /** Enable a previously disabled plugin */
  enablePlugin(name: string): void {
    this.pluginManager.enable(name);
  }

  /** Disable a plugin without uninstalling it */
  disablePlugin(name: string): void {
    this.pluginManager.disable(name);
  }

  /** Remove and uninstall a plugin */
  removePlugin(name: string): void {
    this.pluginManager.remove(name);
  }

  /** List all installed plugins */
  listPlugins(): Array<{ name: string; state: string }> {
    return this.pluginManager.list();
  }
}

// 默认导出
export default CodeLog;

// 导出平台适配接口，供外部平台实现
export type {
  PlatformAdapter,
  StorageAdapter,
  DeviceAdapter,
  TimerAdapter,
  WSConnection,
  WSEvents,
} from './platform/types.js';
export { BrowserAdapter } from './platform/browser/index.js';
export type { CodeLogPlugin, PluginContext } from './plugins/PluginManager.js';
export { DataHarborPlugin } from './plugins/DataHarborPlugin.js';
export { RRWebPlugin } from './plugins/RRWebPlugin.js';
export { OSpyPlugin } from './plugins/OSpyPlugin.js';

// ─────────────────────────────────────────────────────────────
// CDN / IIFE 友好 API
// 用法：<script src="https://unpkg.com/@codelog/sdk/dist/codelog.iife.js"></script>
//       CodeLog.init({ projectId: 'my-app', lang: 'zh', port: 38291 })
// ─────────────────────────────────────────────────────────────

let _instance: CodeLog | null = null;

/**
 * 全局初始化入口，适用于 CDN script 标签引入场景。
 * 重复调用会销毁旧实例并重新初始化。
 */
export function init(options: CodeLogOptions): CodeLog {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
  _instance = new CodeLog(options);
  return _instance;
}

/** 获取当前全局实例（CDN 场景下使用） */
export function getInstance(): CodeLog | null {
  return _instance;
}

/**
 * 根据 port 自动推断 WebSocket 服务器地址。
 * 使用当前页面的 hostname，适合 PC 和手机在同一局域网、
 * 页面由开发服务器（同一台机器）提供的场景。
 */
export function resolveServerUrl(port?: number): string | undefined {
  if (!port) return undefined;
  const protocol = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws';
  const host = typeof location !== 'undefined' ? location.hostname : 'localhost';
  return `${protocol}://${host}:${port}`;
}
