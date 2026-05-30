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
  connectTime: number;
  lastActiveTime: number;
  activeTabs: number;
  online: boolean;
}

export interface ConsoleLog {
  deviceId: string;
  tabId: string;
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'repl-input' | 'repl-output';
  message: string;
  stack?: string;
  serializedArgs?: SerializedValue[];
  cssStyles?: string[];
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
  messageCount?: number;
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

export interface PerformanceReport {
  deviceId: string;
  tabId: string;
  vitals: WebVital[];
  samples: PerformanceSample[];
  longTasks: LongTask[];
  resources: ResourceTiming[];
  interactions: InteractionTiming[];
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
