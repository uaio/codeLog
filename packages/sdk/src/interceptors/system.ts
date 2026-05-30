import type { SystemPayload, SystemBatteryInfo, SystemConnectionInfo } from '@codelog/types';

/**
 * 系统信息采集器
 * 收集设备硬件、浏览器特性、网络状态、电池等系统级信息
 * 通常在 SDK 初始化时调用一次，并在网络状态/电池变化时更新
 */
export class SystemInfoCollector {
  private onReport: (payload: SystemPayload) => void;
  private connectionChangeHandler: (() => void) | null = null;
  private batteryChangeHandler: (() => void) | null = null;
  private batteryObj: { removeEventListener?: (e: string, cb: () => void) => void } | null = null;

  constructor(onReport: (payload: SystemPayload) => void) {
    this.onReport = onReport;
  }

  /** 采集一次全量系统信息并上报 */
  async collect(): Promise<void> {
    const payload = await this.buildPayload();
    this.onReport(payload);
  }

  /** 开始监听网络/电池变化，并在变化时重新上报 */
  async startWatching(): Promise<void> {
    await this.collect();

    // 监听 Network Information API 变化
    const conn = (navigator as Navigator & { connection?: EventTarget & { onchange?: unknown } })
      .connection;
    if (conn) {
      this.connectionChangeHandler = () => void this.collect();
      conn.addEventListener('change', this.connectionChangeHandler);
    }

    // 监听 Battery API 变化
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as Navigator & { getBattery: () => Promise<unknown> }).getBattery() as
          EventTarget & {
            charging: boolean; level: number;
            chargingTime: number; dischargingTime: number;
            addEventListener: (e: string, cb: () => void) => void;
            removeEventListener: (e: string, cb: () => void) => void;
          };
        this.batteryObj = battery;
        this.batteryChangeHandler = () => void this.collect();
        battery.addEventListener('chargingchange', this.batteryChangeHandler);
        battery.addEventListener('levelchange', this.batteryChangeHandler);
      } catch {
        // Battery API not available or blocked
      }
    }
  }

  stopWatching(): void {
    const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (conn && this.connectionChangeHandler) {
      conn.removeEventListener('change', this.connectionChangeHandler);
      this.connectionChangeHandler = null;
    }
    if (this.batteryObj?.removeEventListener && this.batteryChangeHandler) {
      this.batteryObj.removeEventListener('chargingchange', this.batteryChangeHandler);
      this.batteryObj.removeEventListener('levelchange', this.batteryChangeHandler);
      this.batteryChangeHandler = null;
      this.batteryObj = null;
    }
  }

  private async buildPayload(): Promise<SystemPayload> {
    const nav = navigator as Navigator & {
      connection?: {
        type?: string; effectiveType?: string; downlink?: number;
        rtt?: number; saveData?: boolean;
      };
      deviceMemory?: number;
      getBattery?: () => Promise<{
        charging: boolean; level: number;
        chargingTime: number; dischargingTime: number;
      }>;
    };

    // Connection info
    let connection: SystemConnectionInfo | undefined;
    if (nav.connection) {
      const c = nav.connection;
      connection = {
        type: c.type,
        effectiveType: c.effectiveType,
        downlink: c.downlink,
        rtt: c.rtt,
        saveData: c.saveData,
      };
    }

    // Battery info
    let battery: SystemBatteryInfo | undefined;
    if (nav.getBattery) {
      try {
        const b = await nav.getBattery();
        battery = {
          charging: b.charging,
          level: Math.round(b.level * 100),
          chargingTime: isFinite(b.chargingTime) ? b.chargingTime : undefined,
          dischargingTime: isFinite(b.dischargingTime) ? b.dischargingTime : undefined,
        };
      } catch {
        // not available
      }
    }

    // Orientation
    const orientation = screen.orientation?.type ?? undefined;

    // WebP support detection
    const webPSupported = (() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').startsWith('data:image/webp');
      } catch {
        return false;
      }
    })();

    // WebGL support
    const webGLSupported = (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch {
        return false;
      }
    })();

    // WebGL2 support
    const webGL2Supported = (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl2');
      } catch {
        return false;
      }
    })();

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: Array.from(navigator.languages || [navigator.language]),
      vendor: navigator.vendor,
      cookieEnabled: navigator.cookieEnabled,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        orientation,
      },
      hardware: {
        cpuCores: navigator.hardwareConcurrency,
        memory: nav.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints,
      },
      connection,
      battery,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      features: {
        // Core APIs
        webGL: webGLSupported,
        webGL2: webGL2Supported,
        webP: webPSupported,
        serviceWorker: 'serviceWorker' in navigator,
        webWorker: typeof Worker !== 'undefined',
        indexedDB: 'indexedDB' in window,
        webSocket: 'WebSocket' in window,
        webRTC: 'RTCPeerConnection' in window,
        geolocation: 'geolocation' in navigator,
        notifications: 'Notification' in window,
        vibration: 'vibrate' in navigator,
        bluetooth: 'bluetooth' in navigator,
        usb: 'usb' in navigator,
        paymentRequest: 'PaymentRequest' in window,
        clipboard: 'clipboard' in navigator,
        share: 'share' in navigator,
        pdfViewer: (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled ?? false,
        // Network
        fetch: 'fetch' in window,
        beacon: 'sendBeacon' in navigator,
        eventSource: 'EventSource' in window,
        // JS ES6+ (syntax/runtime detection)
        es6Class: (() => { try { return !!Function('return class {}')(); } catch { return false; } })(),
        es6Arrow: (() => { try { return !!Function('return (() => true)()')(); } catch { return false; } })(),
        es6Template: (() => { try { return !!Function('return `ok`')(); } catch { return false; } })(),
        es6Destructuring: (() => { try { Function('const {a}={}'); return true; } catch { return false; } })(),
        es6Symbol: typeof Symbol === 'function',
        es6Promise: typeof Promise === 'function',
        es6Proxy: typeof Proxy === 'function',
        es7Async: (() => { try { Function('async function f(){}'); return true; } catch { return false; } })(),
        es8AsyncAwait: (() => { try { Function('async function f(){ await Promise.resolve(); }'); return true; } catch { return false; } })(),
        // CSS features
        cssGrid: (() => { try { return CSS.supports('display', 'grid'); } catch { return false; } })(),
        cssFlexbox: (() => { try { return CSS.supports('display', 'flex'); } catch { return false; } })(),
        cssVariables: (() => { try { return CSS.supports('--x', '0'); } catch { return false; } })(),
        cssAnimation: (() => { try { return CSS.supports('animation', 'none 1s'); } catch { return false; } })(),
        cssCssHas: (() => { try { return CSS.supports('selector(:has(*))'); } catch { return false; } })(),
        // Element / Observer APIs
        intersectionObserver: 'IntersectionObserver' in window,
        resizeObserver: 'ResizeObserver' in window,
        mutationObserver: 'MutationObserver' in window,
        performanceObserver: 'PerformanceObserver' in window,
        broadcastChannel: 'BroadcastChannel' in window,
        // Storage
        cacheStorage: 'caches' in window,
        localStorage: (() => { try { return !!window.localStorage; } catch { return false; } })(),
        sessionStorage: (() => { try { return !!window.sessionStorage; } catch { return false; } })(),
        cookieStore: 'cookieStore' in window,
        webSQL: 'openDatabase' in window,
      },
    };
  }
}
