import { ConsolePayload } from '@codelog/types';
import { CustomPayload } from '@codelog/types';
import { DOMPayload } from '@codelog/types';
import { ErrorPayload } from '@codelog/types';
import { FullAuditReport } from '@codelog/types';
import { LifecyclePayload } from '@codelog/types';
import { MockRule } from '@codelog/types';
import { NetworkPayload } from '@codelog/types';
import { PerformancePayload } from '@codelog/types';
import { PerfScoreItem } from '@codelog/types';
import { ScreenshotPayload } from '@codelog/types';
import { StoragePayload } from '@codelog/types';
import { SystemPayload } from '@codelog/types';

declare interface AuditItem {
    id: string;
    title: string;
    score: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    value: string;
    details?: any;
}

/** 浏览器平台适配器 */
export declare class BrowserAdapter implements PlatformAdapter {
    storage: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
    };
    device: {
        getUserAgent(): string;
        getScreen(): string;
        getPixelRatio(): number;
        getLanguage(): string;
        getUrl(): string;
    };
    timer: {
        setTimeout(fn: () => void, ms: number): number;
        clearTimeout(id: number): void;
        setInterval(fn: () => void, ms: number): number;
        clearInterval(id: number): void;
    };
    createWebSocket(url: string, events: WSEvents): WSConnection;
}

declare class CodeLog {
    private dataBus;
    private reporter;
    private erudaPlugin;
    private deviceInfo;
    private tabId;
    private projectId;
    private platform;
    private heartbeatTimerId;
    private heartbeatIntervalMs;
    private originalConsole;
    private erudaInitialized;
    private eruda;
    private networkInterceptor;
    private wsInterceptor;
    private sseInterceptor;
    private beaconInterceptor;
    private storageReader;
    private errorInterceptor;
    private domCollector;
    private performanceCollector;
    private screenshotCollector;
    private zenMode;
    private networkConfig;
    private perfRunning;
    private perfRunCollector;
    private perfRunStartTime;
    private lastPerfRunSession;
    /** 页面加载阶段主 performanceCollector 已采集的 vitals，跑分时合并使用 */
    private prePerfRunVitals;
    private networkThrottle;
    private mockApi;
    private visibilityHandler;
    private beforeUnloadHandler;
    private systemCollector;
    private idbInterceptor;
    private resolvedServerUrl;
    private gestureActivator;
    private consoleProcessor;
    private networkProcessor;
    private storageProcessor;
    private databaseProcessor;
    private disabledPlugins;
    private offlineBuffer;
    private pluginManager;
    constructor(options: CodeLogOptions);
    private initEruda;
    private interceptConsole;
    private initNetworkInterceptor;
    private initStorageReader;
    private initErrorInterceptor;
    private initDOMCollector;
    private initPerformanceCollector;
    private initScreenshotCollector;
    /** 手动触发截图（供外部调用） */
    takeScreenshot(): Promise<void>;
    startPerfRun(): void;
    stopPerfRun(): Promise<PerfRunRawPayload | null>;
    getPerfReport(): PerfRunRawPayload | null;
    setNetworkThrottle(preset: ThrottlePreset): void;
    addMock(urlPattern: string, response: Omit<MockRule, 'id' | 'pattern'>): string;
    removeMock(id: string): void;
    clearMocks(): void;
    getMocks(): MockRule[];
    /**
     * 禅模式：停止所有高开销采集（FPS/PerformanceObserver/Network/Storage 监听），
     * 只保留 console + error 捕获和 WebSocket 传输。
     * 适合跑性能报告时使用，避免 SDK 自身干扰测量结果。
     */
    enterZenMode(silent?: boolean): void;
    /**
     * 退出禅模式，恢复所有采集器。
     */
    exitZenMode(silent?: boolean): void;
    /** 当前是否处于禅模式 */
    isZenMode(): boolean;
    enableRemote(): void;
    disableRemote(): void;
    isRemoteEnabled(): boolean;
    /** 上报自定义事件 */
    report(name: string, data: unknown): void;
    /**
     * Upload buffered console logs to the server for offline replay.
     * Call this to persist the current session's logs before the page unloads.
     */
    uploadLogs(options?: {
        startTime?: number;
        endTime?: number;
    }): Promise<string | null>;
    /**
     * Flush the offline buffer: upload buffered events to the server and clear the buffer.
     * Returns the saved session ID, or null if upload failed.
     */
    flushOfflineBuffer(): Promise<string | null>;
    destroy(): void;
    /** Install a plugin dynamically at runtime */
    use(plugin: CodeLogPlugin): Promise<void>;
    /** Enable a previously disabled plugin */
    enablePlugin(name: string): void;
    /** Disable a plugin without uninstalling it */
    disablePlugin(name: string): void;
    /** Remove and uninstall a plugin */
    removePlugin(name: string): void;
    /** List all installed plugins */
    listPlugins(): Array<{
        name: string;
        state: string;
    }>;
}
export { CodeLog }
export default CodeLog;

export declare interface CodeLogOptions extends RemoteConfig {
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
    }) => {
        level: string;
        message: string;
        args: unknown[];
        timestamp: number;
    } | null | undefined | false;
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
    }) => {
        url: string;
        method: string;
        type: string;
        status?: number;
        requestBody?: string;
        responseBody?: string;
    } | null | undefined | false;
    /**
     * Storage data processor — called for each storage snapshot.
     * Return the snapshot to keep it, or null/undefined/false to drop it.
     */
    storageProcessor?: (snapshot: {
        localStorage: Record<string, string>;
        sessionStorage: Record<string, string>;
        cookies: string;
    }) => {
        localStorage: Record<string, string>;
        sessionStorage: Record<string, string>;
        cookies: string;
    } | null | undefined | false;
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
    }) => {
        dbName: string;
        storeName: string;
        operation: string;
        key?: unknown;
        value?: unknown;
    } | null | undefined | false;
    /** Offline buffer configuration — persist events to localStorage when disconnected */
    offline?: OfflineBufferOptions & {
        enabled?: boolean;
    };
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

/** Plugin interface that all codeLog plugins must implement */
export declare interface CodeLogPlugin {
    /** Unique plugin name — used for conflict detection */
    readonly name: string;
    /** Human-readable tab label in the web panel (defaults to name) */
    readonly panelTitle?: string;
    /** Emoji or short icon string for the tab (defaults to '🔌') */
    readonly panelIcon?: string;
    /** Semantic version string (e.g. '1.0.0') */
    readonly version?: string;
    /** Called when the plugin is installed (CodeLog constructor). */
    install(ctx: PluginContext): void | Promise<void>;
    /** Called when the plugin is enabled after being disabled. */
    enable?(): void;
    /** Called when the plugin is temporarily disabled but not uninstalled. */
    disable?(): void;
    /** Called when CodeLog.destroy() is called or the plugin is explicitly removed. */
    uninstall?(): void;
}

/** 控制台日志 */
declare interface ConsoleLogEntry extends Omit<ConsolePayload, 'args'>, TransportFields {
    args: unknown[];
}

/**
 * 同步事件总线 — 所有数据采集的唯一来源
 *
 * 设计原则：
 *  - 同步 emit：保证采集发生在第一时间，任何订阅者延迟不影响数据完整性
 *  - 容错：单个订阅者抛错不会中断其余订阅者的接收
 *  - 多消费者：本地展示（Eruda）和远程传输（WebSocket）均可订阅，互不干扰
 */
declare class DataBus {
    private listeners;
    emit<K extends keyof DataBusEventMap>(event: K, data: DataBusEventMap[K]): void;
    /** 订阅事件，返回取消订阅函数 */
    on<K extends keyof DataBusEventMap>(event: K, cb: Listener<DataBusEventMap[K]>): () => void;
    off<K extends keyof DataBusEventMap>(event: K, cb: Listener<DataBusEventMap[K]>): void;
    /** 清除所有监听器（用于 destroy） */
    clear(): void;
}

/** DataBus 上的 console 事件包含 args，供本地展示层（Eruda）使用 */
declare interface DataBusConsoleEntry extends Omit<ConsoleLogEntry, 'deviceId' | 'tabId'> {
    /** 原始参数，供 Eruda 等本地展示层做富文本渲染，不通过 WebSocket 传输 */
    args: unknown[];
}

declare type DataBusEventMap = {
    console: DataBusConsoleEntry;
    network: Omit<NetworkRequestEntry, 'deviceId' | 'tabId'>;
    storage: Omit<StorageSnapshot, 'deviceId' | 'tabId'>;
    dom: Omit<DOMSnapshot, 'deviceId' | 'tabId'>;
    performance: PerformancePayload;
    screenshot: Omit<ScreenshotData, 'deviceId' | 'tabId'>;
    perf_run: PerfRunSession;
    perf_run_raw: PerfRunRawPayload;
    perf_run_done: PerfRunScore;
    error: ErrorPayload;
    system: SystemPayload;
    lifecycle: LifecyclePayload;
    custom: CustomPayload;
};

declare interface DataHarborOptions {
    /** Max entries to retain in memory. Default: 1000 */
    maxEntries?: number;
    /** localStorage key prefix. Default: '_codelog_harbor' */
    storageKey?: string;
    /** Types to capture. Default: all */
    captureTypes?: Array<keyof DataBusEventMap>;
    /** Auto-persist to localStorage on page hide. Default: true */
    autoPersist?: boolean;
}

export declare class DataHarborPlugin implements CodeLogPlugin {
    readonly name = "DataHarborPlugin";
    private entries;
    private maxEntries;
    private storageKey;
    private captureTypes;
    private autoPersist;
    private unsubscribers;
    private visibilityHandler;
    constructor(opts?: DataHarborOptions);
    install(ctx: PluginContext): void;
    enable(): void;
    disable(): void;
    uninstall(): void;
    /** Save current buffer to localStorage */
    persist(): void;
    /** Get all buffered entries */
    getEntries(): HarborEntry[];
    /** Export as JSON blob and trigger browser download */
    exportJSON(filename?: string): void;
    /** Export console entries as plain text log */
    exportLog(filename?: string): void;
    /** Clear the buffer and remove from localStorage */
    clear(): void;
    get size(): number;
    private _push;
    private _loadFromStorage;
}

/** 设备信息获取接口 */
export declare interface DeviceAdapter {
    getUserAgent(): string;
    getScreen(): string;
    getPixelRatio(): number;
    getLanguage(): string;
    getUrl(): string;
}

/** DOM 快照 */
declare interface DOMSnapshot extends DOMPayload, TransportFields {
}

declare interface ErudaConfig {
    enabled?: boolean;
    tool?: string[];
    autoScale?: boolean;
    useShadowDom?: boolean;
    defaults?: {
        transparency?: number;
        displaySize?: number;
        theme?: string;
        overrideConsole?: boolean;
    };
}

declare interface GestureConfig {
    /** Which gestures to listen for. Default: ['shake', 'corner-tap'] */
    gestures?: GestureType[];
    /** Called when a gesture is detected */
    onActivate: () => void;
    /**
     * For 'key' gesture: keyboard shortcut key name (e.g. 'F8', 'Alt+D').
     * Default: 'F8'
     */
    keyShortcut?: string;
    /** Shake sensitivity 0-1 (higher = less sensitive). Default: 0.65 */
    shakeSensitivity?: number;
    /** Corner-tap: number of taps required. Default: 3 */
    cornerTapCount?: number;
    /** Corner-tap: radius of corner zone in px. Default: 80 */
    cornerRadius?: number;
}

/**
 * Gesture-based activation for the debugging panel.
 *
 * Supported gestures:
 * - "shake"     : Device shake via DeviceMotionEvent (mobile)
 * - "corner-tap": Rapid triple-tap in any screen corner (touch)
 * - "key"       : Keyboard shortcut, e.g. { key: 'F8' } (desktop)
 *
 * Usage:
 *   const g = new GestureActivator({ gestures: ['shake', 'corner-tap'], onActivate: () => ... });
 *   g.start();
 *   g.stop();
 */
declare type GestureType = 'shake' | 'corner-tap' | 'key';

/** 获取当前全局实例（CDN 场景下使用） */
export declare function getInstance(): CodeLog | null;

declare type HarborEntry = {
    type: keyof DataBusEventMap;
    payload: unknown;
    ts: number;
};

/**
 * 全局初始化入口，适用于 CDN script 标签引入场景。
 * 重复调用会销毁旧实例并重新初始化。
 */
export declare function init(options: CodeLogOptions): CodeLog;

declare type Listener<T> = (data: T) => void;

declare interface NetworkInterceptorConfig {
    enabled?: boolean;
    maxRequestBodySize?: number;
    maxResponseBodySize?: number;
    ignoreUrls?: string[];
}

/** 网络请求记录 */
declare interface NetworkRequestEntry extends NetworkPayload, TransportFields {
    id: string;
}

declare interface OfflineBufferOptions {
    /** Max entries to keep in buffer. Default: 500 */
    maxEntries?: number;
    /** localStorage key. Default: '_codeLog_offline_buf' */
    storageKey?: string;
}

declare interface OSpyOptions {
    /** Position of the floating badge. Default: 'bottom-right' */
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    /** Max log entries to keep in memory. Default: 500 */
    maxEntries?: number;
}

export declare class OSpyPlugin implements CodeLogPlugin {
    readonly name = "OSpyPlugin";
    private opts;
    private entries;
    private errorCount;
    private unsubscribers;
    private badge;
    private popup;
    private popupOpen;
    private maxEntries;
    private enabled;
    constructor(opts?: OSpyOptions);
    install(ctx: PluginContext): void;
    enable(): void;
    disable(): void;
    uninstall(): void;
    private _addEntry;
    private _mountBadge;
    private _updateBadge;
    private _togglePopup;
    private _openPopup;
}

declare interface PageAuditReport {
    timestamp: number;
    url: string;
    audits: AuditItem[];
    summary: {
        good: number;
        warning: number;
        poor: number;
    };
}

/** SDK 发给服务端的原始数据（未评分），服务端负责计算分数 */
declare interface PerfRunRawPayload {
    sessionId: string;
    tabId: string;
    startTime: number;
    endTime: number;
    duration: number;
    snapshot: PerformancePayload;
    audit?: FullAuditReport;
}

declare interface PerfRunScore {
    total: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    items: PerfScoreItem[];
    issues: string[];
    summary: string;
}

declare interface PerfRunSession {
    sessionId: string;
    deviceId: string;
    tabId: string;
    startTime: number;
    endTime: number;
    duration: number;
    snapshot: PerformancePayload;
    score: PerfRunScore;
    audit?: PageAuditReport;
}

/** 平台适配器 - 平台相关的所有 API 封装 */
export declare interface PlatformAdapter {
    storage: StorageAdapter;
    device: DeviceAdapter;
    timer: TimerAdapter;
    createWebSocket(url: string, events: WSEvents): WSConnection;
}

/** Context provided to plugins when they are installed */
export declare interface PluginContext {
    /** The shared event bus — subscribe to data events */
    dataBus: DataBus;
    /** Project identifier for the current CodeLog instance */
    projectId: string;
    /** Base HTTP URL for the codeLog server (without trailing slash) */
    serverUrl: string | undefined;
}

declare interface RemoteConfig {
    projectId: string;
    server?: string;
    port?: number;
    lang?: 'zh' | 'en';
    /** Optional secret key sent as x-api-key header to authenticate with the server */
    secret?: string;
}

/**
 * 根据 port 自动推断 WebSocket 服务器地址。
 * 使用当前页面的 hostname，适合 PC 和手机在同一局域网、
 * 页面由开发服务器（同一台机器）提供的场景。
 */
export declare function resolveServerUrl(port?: number): string | undefined;

declare type RRWebEvent = {
    type: number;
    data: unknown;
    timestamp: number;
};

declare interface RRWebOptions {
    /** Recording sample interval (ms). Default: 50 */
    slimDOMOptions?: Record<string, boolean>;
    /** Max events per chunk before auto-flush to server. Default: 200 */
    chunkSize?: number;
    /** Auto-upload chunks to server. Default: true */
    autoUpload?: boolean;
    /** Recording checkpoint interval in ms. Default: 10000 */
    checkoutEveryNms?: number;
}

export declare class RRWebPlugin implements CodeLogPlugin {
    readonly name = "RRWebPlugin";
    private opts;
    private ctx;
    private stopFn;
    private events;
    private chunkIndex;
    private enabled;
    constructor(opts?: RRWebOptions);
    install(ctx: PluginContext): Promise<void>;
    enable(): void;
    disable(): void;
    uninstall(): void;
    /** Get all recorded events without clearing */
    getEvents(): RRWebEvent[];
    /** Clear the event buffer */
    clearEvents(): void;
    /** Download events as JSON for offline replay */
    exportRecording(filename?: string): void;
    private _start;
    private _flushChunk;
    private _upload;
}

/** 截图数据 */
declare interface ScreenshotData extends ScreenshotPayload, TransportFields {
}

/** 存储接口 */
export declare interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** 存储快照 */
declare interface StorageSnapshot extends StoragePayload, TransportFields {
}

declare type ThrottlePreset = 'none' | '3g' | '2g' | 'offline';

/** 定时器接口 */
export declare interface TimerAdapter {
    setTimeout(fn: () => void, ms: number): number;
    clearTimeout(id: number): void;
    setInterval(fn: () => void, ms: number): number;
    clearInterval(id: number): void;
}

/** Transport 标识字段（SDK 发送 Envelope 时携带） */
declare interface TransportFields {
    deviceId: string;
    tabId: string;
    timestamp: number;
}

export declare const version = "0.1.0";

/** 平台适配器接口，所有平台必须实现 */
/** WebSocket 连接抽象 */
export declare interface WSConnection {
    send(data: string): void;
    close(): void;
}

/** WebSocket 事件回调 */
export declare interface WSEvents {
    onOpen: () => void;
    onMessage: (data: unknown) => void;
    onClose: () => void;
    onError: (error: Error) => void;
}

export { }


declare global {
    interface Performance {
        memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
        };
    }
    interface PerformanceEventTiming extends PerformanceEntry {
        duration: number;
    }
}

