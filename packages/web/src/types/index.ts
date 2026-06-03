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

export interface Device {
  deviceId: string;
  projectId: string;
  ua: string;
  screen: string;
  pixelRatio: number;
  language: string;
  url?: string;
  connectTime: number;
  lastActiveTime: number;
  activeTabs: number;
  online: boolean;
}

export interface ConsoleLog {
  deviceId: string;
  tabId: string;
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'repl-input' | 'repl-output' | 'table' | 'group' | 'group-collapsed' | 'group-end' | 'assert' | 'count' | 'time-log';
  message: string;
  stack?: string;
  serializedArgs?: SerializedValue[];
  cssStyles?: string[];
  styledParts?: Array<{ text: string; style?: string }>;
  tableData?: Array<Record<string, unknown>>;
  indent?: number;
}

export interface NetworkRequest {
  deviceId: string;
  tabId: string;
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  duration?: number;
  type: 'xhr' | 'fetch' | 'ws' | 'sse' | 'beacon';
  error?: string;
  wsDirection?: 'send' | 'receive';
  wsEventType?: 'open' | 'close' | 'error' | 'message';
  wsConnectionId?: string;
  messageCount?: number;
  responseSize?: number;
  timingPhases?: {
    dns?: number;
    tcp?: number;
    ssl?: number;
    request?: number;
    response?: number;
    total?: number;
  };
  initiator?: string;
}

export interface CookieEntry {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface StorageSnapshot {
  deviceId: string;
  tabId: string;
  timestamp: number;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: string;
  /** Cookie 完整属性列表（cookieStore API 支持时才有值） */
  cookieEntries?: CookieEntry[];
  localStorageSize: number;
  sessionStorageSize: number;
}

export interface DOMNode {
  tag: string;
  id?: string;
  className?: string;
  attrs?: Record<string, string>;
  text?: string;
  children?: DOMNode[];
  childCount?: number;
}

export interface DOMSnapshot {
  deviceId: string;
  tabId: string;
  timestamp: number;
  url: string;
  title: string;
  dom: DOMNode;
  htmlSnapshot?: string;
}

export interface PerformanceSample {
  timestamp: number;
  fps: number;
  heapUsed?: number;
  heapTotal?: number;
}

export interface WebVital {
  name: string;
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

export interface UserMark {
  name: string;
  startTime: number;
  duration?: number;
  type: 'mark' | 'measure';
}

export interface PerformanceReport {
  deviceId: string;
  tabId: string;
  vitals: WebVital[];
  samples: PerformanceSample[];
  longTasks: LongTask[];
  resources: ResourceTiming[];
  interactions: InteractionTiming[];
  marks?: UserMark[];
}

export interface PerfScoreItem {
  name: string;
  score: number;
  weight: number;
  value: number | null;
  unit: string;
  rating: 'good' | 'needs-improvement' | 'poor' | 'unknown';
}

export interface PerfRunScore {
  total: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  items: PerfScoreItem[];
  issues: string[];
  summary: string;
  /** Lighthouse 风格 4 类别评分 */
  categories?: Record<string, {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    audits: Array<{
      id: string;
      title: string;
      description: string;
      score: number | null;
      weight: number;
      value?: string;
      details?: any;
    }>;
  }>;
}

export interface PerfRunSession {
  sessionId: string;
  deviceId: string;
  tabId: string;
  startTime: number;
  endTime: number;
  duration: number;
  snapshot: any;
  score: PerfRunScore;
  audit?: any;
}

// ── System Info ───────────────────────────────────────────────────────────────

export interface SystemConnectionInfo {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface SystemBatteryInfo {
  charging: boolean;
  level: number;
  chargingTime?: number;
  dischargingTime?: number;
}

export interface SystemInfo {
  deviceId: string;
  tabId: string;
  timestamp: number;
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  vendor?: string;
  cookieEnabled: boolean;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelRatio: number;
    orientation?: string;
  };
  hardware: {
    cpuCores?: number;
    memory?: number;
    maxTouchPoints?: number;
  };
  connection?: SystemConnectionInfo;
  battery?: SystemBatteryInfo;
  timezone: string;
  timezoneOffset: number;
  features: {
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
    // JS ES6+
    es6Class: boolean;
    es6Arrow: boolean;
    es6Template: boolean;
    es6Destructuring: boolean;
    es6Symbol: boolean;
    es6Promise: boolean;
    es6Proxy: boolean;
    es7Async: boolean;
    es8AsyncAwait: boolean;
    // CSS
    cssGrid: boolean;
    cssFlexbox: boolean;
    cssVariables: boolean;
    cssAnimation: boolean;
    cssCssHas: boolean;
    // Observer APIs
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

export interface IDBOperationEntry {
  deviceId: string;
  tabId: string;
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

// ── Saved Log Sessions ────────────────────────────────────────────────────────

export interface SavedLogEntry {
  timestamp: number;
  level: string;
  message: string;
  stack?: string;
  tabId?: string;
}

export interface SavedLogSessionMeta {
  id: string;
  deviceId: string;
  ua: string;
  projectId?: string;
  startTime: number;
  endTime: number;
  uploadedAt: number;
  entryCount: number;
}

export interface SavedLogSession extends SavedLogSessionMeta {
  logs: SavedLogEntry[];
}
