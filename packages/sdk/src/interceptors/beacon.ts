import type { NetworkRequestEntry } from '../types/index.js';

export type BeaconReportCallback = (
  entry: Omit<NetworkRequestEntry, 'deviceId' | 'tabId'>,
) => void;

export class BeaconInterceptor {
  private onReport: BeaconReportCallback;
  private originalSendBeacon: typeof navigator.sendBeacon | null = null;

  constructor(onReport: BeaconReportCallback) {
    this.onReport = onReport;
  }

  start(): void {
    if (typeof navigator?.sendBeacon !== 'function') return;
    this.originalSendBeacon = navigator.sendBeacon.bind(navigator);
    const self = this;

    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
      const id = `beacon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const urlStr = String(url);
      let bodyStr: string | undefined;

      if (data !== undefined && data !== null) {
        if (typeof data === 'string') {
          bodyStr = data;
        } else if (data instanceof Blob) {
          bodyStr = `[Blob: ${data.size} bytes, type: ${data.type || 'unknown'}]`;
        } else if (data instanceof FormData) {
          const parts: string[] = [];
          (data as FormData).forEach((value, key) => {
            parts.push(`${key}=${typeof value === 'string' ? value : '[File]'}`);
          });
          bodyStr = parts.join('&');
        } else if (data instanceof URLSearchParams) {
          bodyStr = data.toString();
        } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
          const len =
            data instanceof ArrayBuffer ? data.byteLength : (data as ArrayBufferView).byteLength;
          bodyStr = `[Binary: ${len} bytes]`;
        }
      }

      const result = self.originalSendBeacon!(url, data);

      self.onReport({
        id,
        method: 'BEACON',
        url: urlStr,
        type: 'beacon',
        requestBody: bodyStr,
        status: result ? 200 : 0,
        statusText: result ? 'Queued' : 'Failed',
        timestamp: Date.now(),
      });

      return result;
    };
  }

  stop(): void {
    if (this.originalSendBeacon) {
      navigator.sendBeacon = this.originalSendBeacon;
      this.originalSendBeacon = null;
    }
  }
}
