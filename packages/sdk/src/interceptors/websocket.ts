import type { NetworkRequestEntry } from '../types/index.js';

export type WSReportCallback = (entry: Omit<NetworkRequestEntry, 'deviceId' | 'tabId'>) => void;

interface WSConnectionInfo {
  id: string;
  url: string;
  openTime: number;
  messageCount: number;
}

export class WebSocketInterceptor {
  private onReport: WSReportCallback;
  private originalWebSocket: typeof WebSocket | null = null;
  private connections = new Map<WebSocket, WSConnectionInfo>();

  constructor(onReport: WSReportCallback) {
    this.onReport = onReport;
  }

  start(): void {
    if (typeof WebSocket === 'undefined') return;
    this.originalWebSocket = WebSocket;
    const self = this;
    const OriginalWebSocket = WebSocket;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).WebSocket = function (
      url: string | URL,
      protocols?: string | string[],
    ): WebSocket {
      const ws =
        protocols !== undefined
          ? new OriginalWebSocket(url, protocols)
          : new OriginalWebSocket(url);
      const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const urlStr = String(url);

      const info: WSConnectionInfo = {
        id,
        url: urlStr,
        openTime: Date.now(),
        messageCount: 0,
      };
      self.connections.set(ws, info);

      // Connection open
      ws.addEventListener('open', () => {
        info.openTime = Date.now();
        self.onReport({
          id,
          method: 'WS',
          url: urlStr,
          type: 'ws',
          wsEventType: 'open',
          status: 101,
          statusText: 'Switching Protocols',
          timestamp: Date.now(),
        });
      });

      // Message received
      ws.addEventListener('message', (event: MessageEvent) => {
        info.messageCount++;
        const body =
          typeof event.data === 'string'
            ? event.data
            : event.data instanceof ArrayBuffer
              ? `[Binary ArrayBuffer: ${event.data.byteLength} bytes]`
              : event.data instanceof Blob
                ? `[Blob: ${event.data.size} bytes]`
                : String(event.data);

        self.onReport({
          id: `${id}-recv-${info.messageCount}`,
          method: 'WS',
          url: urlStr,
          type: 'ws',
          wsEventType: 'message',
          wsDirection: 'receive',
          responseBody: body,
          timestamp: Date.now(),
        });
      });

      // Connection error
      ws.addEventListener('error', () => {
        self.onReport({
          id: `${id}-err`,
          method: 'WS',
          url: urlStr,
          type: 'ws',
          wsEventType: 'error',
          error: 'WebSocket error',
          timestamp: Date.now(),
        });
        self.connections.delete(ws);
      });

      // Connection closed
      ws.addEventListener('close', (event: CloseEvent) => {
        const duration = Date.now() - info.openTime;
        self.onReport({
          id: `${id}-close`,
          method: 'WS',
          url: urlStr,
          type: 'ws',
          wsEventType: 'close',
          status: event.code,
          statusText: event.reason || 'Connection closed',
          duration,
          messageCount: info.messageCount,
          timestamp: Date.now(),
        });
        self.connections.delete(ws);
      });

      // Intercept send
      const originalSend = ws.send.bind(ws);
      ws.send = (data: string | ArrayBuffer | Blob | ArrayBufferView): void => {
        info.messageCount++;
        const body =
          typeof data === 'string'
            ? data
            : data instanceof ArrayBuffer
              ? `[Binary ArrayBuffer: ${data.byteLength} bytes]`
              : data instanceof Blob
                ? `[Blob: ${data.size} bytes]`
                : `[Binary: ${(data as ArrayBufferView).byteLength} bytes]`;

        self.onReport({
          id: `${id}-send-${info.messageCount}`,
          method: 'WS',
          url: urlStr,
          type: 'ws',
          wsEventType: 'message',
          wsDirection: 'send',
          requestBody: body,
          timestamp: Date.now(),
        });

        originalSend(data);
      };

      return ws;
    };

    // Copy static properties
    Object.assign(window.WebSocket, {
      CONNECTING: OriginalWebSocket.CONNECTING,
      OPEN: OriginalWebSocket.OPEN,
      CLOSING: OriginalWebSocket.CLOSING,
      CLOSED: OriginalWebSocket.CLOSED,
    });
    (window.WebSocket as any).prototype = OriginalWebSocket.prototype;
  }

  stop(): void {
    if (this.originalWebSocket) {
      (window as any).WebSocket = this.originalWebSocket;
      this.originalWebSocket = null;
    }
    this.connections.clear();
  }
}
