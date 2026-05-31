/**
 * 所有事件类型的 Payload 定义
 * 新平台接入时只需在此添加新的 EventType 和对应 Payload
 */

// ── Atom: Rich serialized JS values ──────────────────────────────────────────

export type SerializedValue =
  | { t: 'null' }
  | { t: 'undefined' }
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'bigint'; v: string }
  | { t: 'sym'; v: string }
  | { t: 'fn'; name: string }
  | { t: 'regexp'; src: string; flags: string }
  | { t: 'date'; iso: string }
  | { t: 'err'; name: string; msg: string; stack?: string }
  | { t: 'arr'; items: SerializedValue[]; len: number; more?: boolean }
  | { t: 'obj'; tag: string; props: Array<[string, SerializedValue]>; more?: boolean }
  | { t: 'map'; entries: Array<[SerializedValue, SerializedValue]>; size: number }
  | { t: 'set'; values: SerializedValue[]; size: number }
  | { t: 'circ' };

// ── Console ─────────────────────────────────────────────────────────────────

export interface ConsolePayload {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'repl-input' | 'repl-output' | 'table' | 'group' | 'group-collapsed' | 'group-end' | 'assert' | 'count' | 'time-log';
  /** 原始参数列表（已序列化为字符串，保留富文本） */
  args: string[];
  /** 合并后的可读消息（args.join(' ')，方便搜索过滤） */
  message: string;
  /** 调用栈（仅 error/warn 级别） */
  stack?: string;
  /** Rich serialized args for tree-view rendering */
  serializedArgs?: SerializedValue[];
  /** CSS styles extracted from %c format directives */
  cssStyles?: string[];
  /** Styled parts for %c rendering: each part has text + optional CSS style string */
  styledParts?: Array<{ text: string; style?: string }>;
  /** Tabular data for console.table() rendering */
  tableData?: Array<Record<string, unknown>>;
  /** Group nesting depth at time of log (for indentation) */
  indent?: number;
}

// ── Network ──────────────────────────────────────────────────────────────────

export interface NetworkPayload {
  /** 请求唯一 ID（用于关联请求/响应事件） */
  id: string;
  method: string;
  url: string;
  type: 'xhr' | 'fetch' | 'ws' | 'sse' | 'beacon';
  /** 请求头 */
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  /** 响应状态码 */
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  /** 请求耗时（ms），响应完成后才有值 */
  duration?: number;
  /** 发生错误时的错误信息 */
  error?: string;
  /** XHR: 是否携带凭证（withCredentials） */
  withCredentials?: boolean;
  /** WebSocket: 消息方向 send/receive */
  wsDirection?: 'send' | 'receive';
  /** WebSocket: 连接状态 open/close/error/message */
  wsEventType?: 'open' | 'close' | 'error' | 'message';
  /** WebSocket/SSE: 消息数量 */
  messageCount?: number;
  /** 响应体大小（bytes），从 Content-Length 头或 transferSize 获取 */
  responseSize?: number;
  /** 详细时间阶段（ms），从 PerformanceResourceTiming 获取 */
  timingPhases?: {
    dns?: number;
    tcp?: number;
    ssl?: number;
    request?: number;
    response?: number;
    total?: number;
  };
  /** 请求发起时的调用栈（用于定位发起位置） */
  initiator?: string;
}

// ── Storage ──────────────────────────────────────────────────────────────────

export interface CookieEntry {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  /** ISO 8601 过期时间，undefined 表示 Session cookie */
  expires?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface StoragePayload {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  /** Cookie 原始字符串（向后兼容） */
  cookies: string;
  /** Cookie 完整属性列表（cookieStore API 支持时才有值） */
  cookieEntries?: CookieEntry[];
  localStorageSize: number;
  sessionStorageSize: number;
}

// ── DOM ──────────────────────────────────────────────────────────────────────

export interface DOMNode {
  tag: string;
  id?: string;
  className?: string;
  attrs?: Record<string, string>;
  /** 文本内容（截断至 150 字符） */
  text?: string;
  children?: DOMNode[];
  /** 实际子节点数（children 被截断时） */
  childCount?: number;
}

export interface DOMPayload {
  url: string;
  title: string;
  dom: DOMNode;
  /** Full HTML snapshot (document.documentElement.outerHTML) */
  htmlSnapshot?: string;
}

// ── Performance ───────────────────────────────────────────────────────────────

export interface PerformanceSample {
  ts: number;
  fps: number;
  heapUsed?: number;
  heapTotal?: number;
}

export interface WebVital {
  name: 'LCP' | 'CLS' | 'FCP' | 'TTFB' | 'INP' | string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface LongTask {
  startTime: number;
  duration: number;
  name: string;
}

export interface ResourceTiming {
  name: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
  startTime: number;
}

export interface InteractionTiming {
  type: string;
  duration: number;
  startTime: number;
  target?: string;
}

export interface PerformancePayload {
  vitals: WebVital[];
  samples: PerformanceSample[];
  longTasks: LongTask[];
  resources: ResourceTiming[];
  interactions: InteractionTiming[];
  marks?: UserMark[];
}

export interface UserMark {
  name: string;
  startTime: number;
  /** Set for performance.measure() entries */
  duration?: number;
  type: 'mark' | 'measure';
}

// ── Error ─────────────────────────────────────────────────────────────────────

export type ErrorSource = 'uncaught' | 'unhandledrejection' | 'manual';

export interface ErrorPayload {
  source: ErrorSource;
  message: string;
  stack?: string;
  /** 对于 unhandledrejection，Promise rejection 的值 */
  reason?: string;
  /** 发生错误的文件 URL */
  filename?: string;
  lineno?: number;
  colno?: number;
}

// ── Screenshot ────────────────────────────────────────────────────────────────

export interface ScreenshotPayload {
  /** base64 data URL，格式 "data:image/png;base64,..." */
  dataUrl: string;
  width: number;
  height: number;
  url: string;
  title: string;
}

// ── Perf Run（跑分会话） ───────────────────────────────────────────────────────

export interface PerfScoreItem {
  name: string;
  score: number;
  weight: number;
  value: number | null;
  unit: string;
  rating: 'good' | 'needs-improvement' | 'poor' | 'unknown';
}

export interface PerfRunPayload {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  snapshot: Omit<PerformancePayload, never>;
  score: {
    total: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    items: PerfScoreItem[];
    issues: string[];
    summary: string;
  };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export type LifecycleEvent =
  | 'connect' // SDK 建立 WebSocket 连接
  | 'disconnect' // WebSocket 断开
  | 'page_show' // 页面可见（visibilitychange / pageshow）
  | 'page_hide' // 页面隐藏
  | 'page_load' // DOMContentLoaded
  | 'page_unload'; // beforeunload

export interface LifecyclePayload {
  event: LifecycleEvent;
  url?: string;
  title?: string;
  /** 额外平台特定数据（Native 路由、小程序页面栈等） */
  extra?: Record<string, unknown>;
}

// ── Custom（开发者自定义上报） ────────────────────────────────────────────────

export interface CustomPayload {
  /** 自定义事件名 */
  name: string;
  /** 任意结构的数据（PC 面板以 JSON 树展示） */
  data: unknown;
}

// ── System Info ───────────────────────────────────────────────────────────────

export interface SystemConnectionInfo {
  /** 连接类型: wifi, cellular, ethernet, none, unknown */
  type?: string;
  /** 有效速度等级: 4g, 3g, 2g, slow-2g */
  effectiveType?: string;
  /** 下行带宽估算 (Mbps) */
  downlink?: number;
  /** 往返延迟估算 (ms) */
  rtt?: number;
  /** 用户是否开启了省流模式 */
  saveData?: boolean;
}

export interface SystemBatteryInfo {
  charging: boolean;
  /** 电量百分比 0–100 */
  level: number;
  /** 充满所需秒数 (Infinity = 不充电中) */
  chargingTime?: number;
  /** 剩余使用秒数 (Infinity = 正在充电) */
  dischargingTime?: number;
}

export interface SystemPayload {
  // 浏览器/平台
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  vendor?: string;
  cookieEnabled: boolean;
  // 屏幕
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelRatio: number;
    orientation?: string;
  };
  // 硬件信息
  hardware: {
    cpuCores?: number;
    /** 设备内存 (GB), Chrome 63+ */
    memory?: number;
    maxTouchPoints?: number;
  };
  // 网络信息 (Network Information API)
  connection?: SystemConnectionInfo;
  // 电池信息 (Battery Status API)
  battery?: SystemBatteryInfo;
  // 时区
  timezone: string;
  timezoneOffset: number;
  // 浏览器特性检测
  features: {
    // Core APIs
    webGL: boolean;
    webGL2: boolean;
    webP: boolean;
    serviceWorker: boolean;
    webWorker: boolean;
    indexedDB: boolean;
    webSocket: boolean;
    webRTC: boolean;
    geolocation: boolean;
    notifications: boolean;
    vibration: boolean;
    bluetooth: boolean;
    usb: boolean;
    paymentRequest: boolean;
    clipboard: boolean;
    share: boolean;
    pdfViewer: boolean;
    // Network
    fetch: boolean;
    beacon: boolean;
    eventSource: boolean;
    // JS ES6+ features
    es6Class: boolean;
    es6Arrow: boolean;
    es6Template: boolean;
    es6Destructuring: boolean;
    es6Symbol: boolean;
    es6Promise: boolean;
    es6Proxy: boolean;
    es7Async: boolean;
    es8AsyncAwait: boolean;
    // CSS features
    cssGrid: boolean;
    cssFlexbox: boolean;
    cssVariables: boolean;
    cssAnimation: boolean;
    cssCssHas: boolean;
    // Element APIs
    intersectionObserver: boolean;
    resizeObserver: boolean;
    mutationObserver: boolean;
    performanceObserver: boolean;
    broadcastChannel: boolean;
    // Storage
    cacheStorage: boolean;
    localStorage: boolean;
    sessionStorage: boolean;
    cookieStore: boolean;
    webSQL: boolean;
  };
}



// ── IndexedDB ─────────────────────────────────────────────────────────────────

export interface IndexedDBEntry {
  id: string;
  dbName: string;
  storeName: string;
  operation: 'get' | 'getAll' | 'put' | 'add' | 'delete' | 'clear' | 'openCursor' | 'count';
  key?: unknown;
  value?: unknown;
  result?: unknown;
  error?: string;
  duration?: number;
  timestamp: number;
}

export interface IndexedDBPayload {
  entries: IndexedDBEntry[];
}

// ── IDB Browser (live data inspection) ───────────────────────────────────────

export interface IDBIndexInfo {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

export interface IDBStoreSchema {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IDBIndexInfo[];
  /** Approximate record count (−1 if unavailable) */
  count: number;
}

export interface IDBDatabaseInfo {
  name: string;
  version: number;
  stores: IDBStoreSchema[];
}

/** Snapshot of all IDB databases + their schemas (no record data). */
export interface IDBSnapshotPayload {
  databases: IDBDatabaseInfo[];
  ts: number;
}

/** Paginated record data for a specific store. */
export interface IDBStoreDataPayload {
  dbName: string;
  storeName: string;
  page: number;
  pageSize: number;
  total: number;
  records: unknown[];
  /** request correlation id */
  reqId: string;
}

/**
 * 所有事件类型的字符串枚举。
 * 新增类型时同步扩展 EventPayloadMap。
 */
export type EventType =
  | 'console'
  | 'network'
  | 'storage'
  | 'dom'
  | 'performance'
  | 'error'
  | 'screenshot'
  | 'perf_run'
  | 'lifecycle'
  | 'custom'
  | 'system'
  | 'indexeddb'
  | 'idb_snapshot'
  | 'idb_store_data';

/**
 * EventType → Payload 的映射关系（TypeScript discriminated union 的核心）。
 * 消费方通过 envelope.type 可自动推断 envelope.data 的类型。
 */
export interface EventPayloadMap {
  console: ConsolePayload;
  network: NetworkPayload;
  storage: StoragePayload;
  dom: DOMPayload;
  performance: PerformancePayload;
  error: ErrorPayload;
  screenshot: ScreenshotPayload;
  perf_run: PerfRunPayload;
  lifecycle: LifecyclePayload;
  custom: CustomPayload;
  system: SystemPayload;
  indexeddb: IndexedDBEntry;
  idb_snapshot: IDBSnapshotPayload;
  idb_store_data: IDBStoreDataPayload;
}
