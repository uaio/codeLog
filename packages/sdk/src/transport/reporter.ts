import type {
  DeviceInfo,
  ConsoleLogEntry,
  NetworkRequestEntry,
  StorageSnapshot,
  DOMSnapshot,
  PerformancePayload,
  ScreenshotData,
  PerfRunRawPayload,
  PerfRunScore,
} from '../types/index.js';
import type { PlatformAdapter } from '../platform/types.js';
import type { DataBus } from '../core/DataBus.js';
import { WebSocketTransport } from './websocket.js';
import { RateLimiter } from '../core/rate-limiter.js';
import { serializeArgs } from '../core/utils/serialize.js';

// 也作为 WebSocketReporter 别名，供旧代码引用
export type { Reporter as WebSocketReporter };

export class Reporter {
  private transport: WebSocketTransport | null = null;
  private deviceInfo: DeviceInfo;
  private tabId: string;
  private platform: PlatformAdapter;
  private remoteEnabled = true;
  private onRefreshStorageCallback: (() => void) | null = null;
  private onRefreshDOMCallback: (() => void) | null = null;
  private onTakeScreenshotCallback: (() => void) | null = null;
  private onZenModeCallback: ((enabled: boolean) => void) | null = null;
  private onStartPerfRunCallback: (() => void) | null = null;
  private onStopPerfRunCallback: (() => void) | null = null;
  private onPerfRunDoneCallback: ((score: PerfRunScore) => void) | null = null;
  private onSetNetworkThrottleCallback: ((preset: string) => void) | null = null;
  private onAddMockCallback: ((rule: any) => void) | null = null;
  private onRemoveMockCallback: ((id: string) => void) | null = null;
  private onClearMocksCallback: (() => void) | null = null;
  private onUpdateMockRuleCallback: ((id: string, enabled: boolean) => void) | null = null;
  private onRequestIDBSnapshotCallback: (() => void) | null = null;
  private onRequestIDBStoreDataCallback:
    | ((dbName: string, storeName: string, page: number, pageSize: number, reqId: string) => void)
    | null = null;
  private onGetComputedStylesCallback: ((selector: string) => void) | null = null;
  private onSetElementAttrCallback: ((selector: string, attr: string, value: string) => void) | null = null;
  private onStartElementPickerCallback: (() => void) | null = null;
  private executeJsBus: DataBus | null = null;
  private rateLimiter = new RateLimiter(100);
  private serverUrl: string | undefined;
  private dataBusUnsubscribers: Array<() => void> = [];

  constructor(deviceInfo: DeviceInfo, tabId: string, platform: PlatformAdapter) {
    this.deviceInfo = deviceInfo;
    this.tabId = tabId;
    this.platform = platform;
  }

  connect(serverUrl?: string): void {
    if (!this.remoteEnabled) return;

    this.serverUrl = serverUrl ?? this.serverUrl;

    this.transport = new WebSocketTransport(
      { projectId: this.deviceInfo.projectId, server: this.serverUrl },
      {
        onConnect: () => {
          this.sendRegisterMessage();
        },
        onMessage: (data) => {
          if (data.type === 'refresh_storage') {
            this.onRefreshStorageCallback?.();
          }
          if (data.type === 'refresh_dom') {
            this.onRefreshDOMCallback?.();
          }
          if (data.type === 'take_screenshot') {
            this.onTakeScreenshotCallback?.();
          }
          if (data.type === 'execute_js' && data.code && this.executeJsBus) {
            this.runCode(data.code, this.executeJsBus);
          }
          if (data.type === 'reload_page') {
            try {
              window.location.reload();
            } catch {
              /* ignore */
            }
          }
          if (data.type === 'set_storage') {
            try {
              if (data.storageType === 'cookie') {
                const setCookieValue = async () => {
                  const name = data.key;
                  const value = data.value ?? '';
                  // Prefer cookieStore API (preserves all attributes) when available
                  if (typeof (window as any).cookieStore?.set === 'function') {
                    const opts: Record<string, unknown> = { name, value };
                    if (data.path) opts.path = data.path;
                    if (data.domain) opts.domain = data.domain;
                    if (data.expires) opts.expires = data.expires;
                    if (data.secure !== undefined) opts.secure = data.secure;
                    if (data.sameSite) opts.sameSite = data.sameSite;
                    await (window as any).cookieStore.set(opts);
                  } else {
                    // Fallback: document.cookie string
                    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
                    cookieStr += `; path=${data.path ?? '/'}`;
                    if (data.domain) cookieStr += `; domain=${data.domain}`;
                    if (data.expires) cookieStr += `; expires=${new Date(data.expires).toUTCString()}`;
                    if (data.secure) cookieStr += `; Secure`;
                    if (data.sameSite) cookieStr += `; SameSite=${data.sameSite}`;
                    document.cookie = cookieStr;
                  }
                };
                void setCookieValue();
              } else {
                const store = data.storageType === 'session' ? sessionStorage : localStorage;
                store.setItem(data.key, data.value ?? '');
              }
            } catch {
              /* ignore */
            }
          }
          if (data.type === 'clear_storage') {
            try {
              if (data.storageType === 'session') sessionStorage.clear();
              else if (data.storageType === 'local') localStorage.clear();
              else {
                localStorage.clear();
                sessionStorage.clear();
              }
            } catch {
              /* ignore */
            }
          }
          if (data.type === 'delete_storage') {
            try {
              if (data.storageType === 'cookie') {
                // Delete cookie by setting expiry to the past
                // Try all common paths to maximize deletion
                const paths = ['/', '/'];
                const cookieName = encodeURIComponent(data.key);
                for (const path of paths) {
                  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
                }
              } else {
                const store = data.storageType === 'session' ? sessionStorage : localStorage;
                store.removeItem(data.key);
              }
            } catch {
              /* ignore */
            }
          }
          if (data.type === 'highlight_element' && data.selector) {
            this.highlightElement(data.selector, data.duration ?? 3000);
          }
          if (data.type === 'zen_mode') {
            this.onZenModeCallback?.(!!data.enabled);
          }
          if (data.type === 'start_perf_run') {
            this.onStartPerfRunCallback?.();
          }
          if (data.type === 'stop_perf_run') {
            this.onStopPerfRunCallback?.();
          }
          if (data.type === 'perf_run_done' && data.score) {
            this.onPerfRunDoneCallback?.(data.score);
          }
          if (data.type === 'set_network_throttle' && data.preset) {
            this.onSetNetworkThrottleCallback?.(data.preset);
          }
          if (data.type === 'add_mock' && data.rule) {
            this.onAddMockCallback?.(data.rule);
          }
          if (data.type === 'remove_mock' && data.id) {
            this.onRemoveMockCallback?.(data.id);
          }
          if (data.type === 'clear_mocks') {
            this.onClearMocksCallback?.();
          }
          if (data.type === 'update_mock_rule' && data.id) {
            this.onUpdateMockRuleCallback?.(data.id, data.enabled ?? true);
          }
          if (data.type === 'request_idb_snapshot') {
            this.onRequestIDBSnapshotCallback?.();
          }
          if (data.type === 'request_idb_store_data') {
            this.onRequestIDBStoreDataCallback?.(
              data.dbName,
              data.storeName,
              data.page ?? 0,
              data.pageSize ?? 50,
              data.reqId ?? '',
            );
          }
          if (data.type === 'idb_clear_store' && data.dbName && data.storeName) {
            try {
              const req = indexedDB.open(data.dbName);
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const tx = db.transaction(data.storeName, 'readwrite');
                  tx.objectStore(data.storeName).clear();
                  tx.oncomplete = () => { db.close(); };
                  tx.onerror = () => { db.close(); };
                } catch {
                  db.close();
                }
              };
            } catch {
              /* ignore */
            }
          }
          if (data.type === 'idb_put_record' && data.dbName && data.storeName && data.value !== undefined) {
            try {
              const req = indexedDB.open(data.dbName);
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const tx = db.transaction(data.storeName, 'readwrite');
                  const objStore = tx.objectStore(data.storeName);
                  // If keyPath is defined, key is embedded in value; otherwise use explicit key
                  const putReq = objStore.keyPath !== null
                    ? objStore.put(data.value)
                    : objStore.put(data.value, data.key);
                  putReq.onsuccess = () => {};
                  tx.oncomplete = () => { db.close(); };
                  tx.onerror = () => { db.close(); };
                } catch {
                  db.close();
                }
              };
            } catch {
              /* ignore */
            }
          }
          if (data.type === 'get_computed_styles' && data.selector) {
            this.onGetComputedStylesCallback?.(data.selector);
          }
          if (data.type === 'set_element_attr' && data.selector && data.attr !== undefined) {
            this.onSetElementAttrCallback?.(data.selector, data.attr, data.value ?? '');
          }
          if (data.type === 'start_element_picker') {
            this.onStartElementPickerCallback?.();
          }
        },
      },
      this.platform,
    );

    this.transport.connect();
  }

  onRefreshStorage(callback: () => void): void {
    this.onRefreshStorageCallback = callback;
  }

  onRefreshDOM(callback: () => void): void {
    this.onRefreshDOMCallback = callback;
  }

  onTakeScreenshot(callback: () => void): void {
    this.onTakeScreenshotCallback = callback;
  }

  onZenMode(callback: (enabled: boolean) => void): void {
    this.onZenModeCallback = callback;
  }

  onStartPerfRun(callback: () => void): void {
    this.onStartPerfRunCallback = callback;
  }
  onStopPerfRun(callback: () => void): void {
    this.onStopPerfRunCallback = callback;
  }
  onPerfRunDone(callback: (score: PerfRunScore) => void): void {
    this.onPerfRunDoneCallback = callback;
  }
  onSetNetworkThrottle(callback: (preset: string) => void): void {
    this.onSetNetworkThrottleCallback = callback;
  }
  onAddMock(callback: (rule: any) => void): void {
    this.onAddMockCallback = callback;
  }
  onRemoveMock(callback: (id: string) => void): void {
    this.onRemoveMockCallback = callback;
  }
  onClearMocks(callback: () => void): void {
    this.onClearMocksCallback = callback;
  }
  onUpdateMockRule(callback: (id: string, enabled: boolean) => void): void {
    this.onUpdateMockRuleCallback = callback;
  }
  reportMockMatch(ruleId: string, url: string): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.transport.send(JSON.stringify({ type: 'mock_matched', ruleId, url }));
  }
  onRequestIDBSnapshot(callback: () => void): void {
    this.onRequestIDBSnapshotCallback = callback;
  }
  onRequestIDBStoreData(
    callback: (dbName: string, storeName: string, page: number, pageSize: number, reqId: string) => void,
  ): void {
    this.onRequestIDBStoreDataCallback = callback;
  }

  onGetComputedStyles(callback: (selector: string) => void): void {
    this.onGetComputedStylesCallback = callback;
  }

  onSetElementAttr(callback: (selector: string, attr: string, value: string) => void): void {
    this.onSetElementAttrCallback = callback;
  }

  onStartElementPicker(callback: () => void): void {
    this.onStartElementPickerCallback = callback;
  }

  reportComputedStyles(selector: string, styles: Record<string, string>): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('computed_styles', { selector, styles });
  }

  reportPickedElement(selector: string, tagName: string): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('element_picked', { selector, tagName });
  }

  reportPerfRunRaw(payload: PerfRunRawPayload): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('perf_run_raw', payload);
  }

  reportIDBSnapshot(snapshot: import('@codelog/types').IDBSnapshotPayload): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('idb_snapshot', snapshot);
  }

  reportIDBStoreData(data: import('@codelog/types').IDBStoreDataPayload): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('idb_store_data', data);
  }

  disconnect(): void {
    this.transport?.disconnect();
  }

  /**
   * 将 Reporter 绑定到 DataBus，订阅所有事件并通过 WebSocket 转发到远端 PC
   * 调用多次会先解绑旧的再重新绑定
   */
  attachDataBus(bus: DataBus): void {
    this.detachDataBus();
    this.executeJsBus = bus;
    this.dataBusUnsubscribers = [
      bus.on('console', (entry) => this.reportConsole(entry)),
      bus.on('network', (entry) => this.reportNetwork(entry)),
      bus.on('storage', (snap) => this.reportStorage(snap)),
      bus.on('dom', (snap) => this.reportDOM(snap)),
      bus.on('performance', (report) => this.reportPerformance(report)),
      bus.on('screenshot', (data) => this.reportScreenshot(data)),
      bus.on('perf_run_raw', (payload) => this.reportPerfRunRaw(payload)),
    ];
  }

  detachDataBus(): void {
    for (const unsub of this.dataBusUnsubscribers) {
      unsub();
    }
    this.dataBusUnsubscribers = [];
    this.executeJsBus = null;
  }

  /** PC 下发的 JS 代码在手机端执行，结果经 DataBus console 通道回传 */
  private runCode(code: string, bus: DataBus): void {
    // 回显用户输入（repl-input 类型，Web 端以蓝色背景区分）
    bus.emit('console', {
      timestamp: Date.now(),
      level: 'repl-input',
      message: code,
      args: [code],
    });

    try {
      // eslint-disable-next-line no-eval
      const result = (0, eval)(code); // indirect eval：在全局作用域运行，不影响当前 scope
      // Only emit repl-output when there's a meaningful return value.
      // Suppressing `undefined` avoids noise for console.log() and void statements.
      if (result !== undefined) {
        bus.emit('console', {
          timestamp: Date.now(),
          level: 'repl-output',
          message: serializeArgs([result]),
          args: [result],
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit('console', {
        timestamp: Date.now(),
        level: 'error',
        message: msg,
        args: [msg],
      });
    }
  }

  private highlightElement(selector: string, duration: number): void {
    if (typeof document === 'undefined') return;
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const prev = el.style.outline;
      const prevBg = el.style.backgroundColor;
      el.style.outline = '3px solid #ff4d4f';
      el.style.backgroundColor = 'rgba(255,77,79,0.15)';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        el.style.outline = prev;
        el.style.backgroundColor = prevBg;
      }, duration);
    } catch {
      /* ignore */
    }
  }

  enableRemote(): void {
    this.remoteEnabled = true;
    this.platform.storage.setItem(`codelog_remote_${this.deviceInfo.projectId}`, 'true');
    if (!this.transport || this.transport.getState() === 'disconnected') {
      this.connect();
    }
  }

  disableRemote(): void {
    this.remoteEnabled = false;
    this.platform.storage.setItem(`codelog_remote_${this.deviceInfo.projectId}`, 'false');
    this.transport?.disconnect();
  }

  isRemoteEnabled(): boolean {
    return this.remoteEnabled;
  }

  reportConsole(entry: Omit<ConsoleLogEntry, 'deviceId' | 'tabId'>): void {
    if (!this.remoteEnabled || !this.transport) return;
    if (!this.rateLimiter.check()) return;
    this.sendEnvelope('console', {
      level: entry.level,
      args: (entry as any).args ?? [entry.message],
      message: entry.message,
      stack: entry.stack,
    });
  }

  reportNetwork(entry: Omit<NetworkRequestEntry, 'deviceId' | 'tabId'>): void {
    if (!this.remoteEnabled || !this.transport) return;
    if (!this.rateLimiter.check()) return;
    this.sendEnvelope('network', entry);
  }

  reportStorage(snapshot: Omit<StorageSnapshot, 'deviceId' | 'tabId'>): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('storage', snapshot);
  }

  reportDOM(snapshot: Omit<DOMSnapshot, 'deviceId' | 'tabId'>): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('dom', snapshot);
  }

  reportPerformance(report: PerformancePayload): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('performance', report);
  }

  reportScreenshot(data: Omit<ScreenshotData, 'deviceId' | 'tabId'>): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.sendEnvelope('screenshot', data);
  }

  updateDeviceInfo(): void {
    this.deviceInfo.lastActiveTime = Date.now();
    this.send({
      type: 'heartbeat',
      deviceId: this.deviceInfo.deviceId,
      timestamp: Date.now(),
    });
  }

  private sendRegisterMessage(): void {
    this.send({
      type: 'register',
      projectId: this.deviceInfo.projectId,
      deviceId: this.deviceInfo.deviceId,
      deviceInfo: {
        ua: this.deviceInfo.ua,
        screen: this.deviceInfo.screen,
        pixelRatio: this.deviceInfo.pixelRatio,
        language: this.deviceInfo.language,
        url: this.deviceInfo.url,
      },
    });
  }

  announcePlugins(plugins: Array<{ name: string; panelTitle?: string; panelIcon?: string; version?: string; state: string }>): void {
    if (!this.remoteEnabled || !this.transport) return;
    this.transport.send(JSON.stringify({
      type: 'plugin_announce',
      deviceId: this.deviceInfo.deviceId,
      plugins: plugins.map((p) => ({
        name: p.name,
        panelTitle: p.panelTitle,
        panelIcon: p.panelIcon,
        version: p.version,
        state: p.state === 'enabled' ? 'enabled' : 'disabled',
      })),
    }));
  }

  private sendEnvelope(type: string, data: unknown): void {
    this.send({
      v: '1',
      platform: 'web',
      device: {
        deviceId: this.deviceInfo.deviceId,
        projectId: this.deviceInfo.projectId,
        ua: this.deviceInfo.ua,
        screen: this.deviceInfo.screen,
        pixelRatio: this.deviceInfo.pixelRatio,
        language: this.deviceInfo.language,
        url: this.deviceInfo.url,
      },
      tabId: this.tabId,
      ts: Date.now(),
      type,
      data,
    });
  }

  private send(data: unknown): void {
    this.transport?.send(JSON.stringify(data));
  }
}
