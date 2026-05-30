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

export class SystemStore {
  /** Latest system info per device (most recent tab wins) */
  private info: Map<string, SystemInfo> = new Map();

  set(deviceId: string, info: SystemInfo): void {
    this.info.set(deviceId, info);
  }

  get(deviceId: string): SystemInfo | undefined {
    return this.info.get(deviceId);
  }

  delete(deviceId: string): void {
    this.info.delete(deviceId);
  }
}
