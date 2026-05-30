import type { NetworkRequestEntry } from '../types/index.js';

export type SSEReportCallback = (entry: Omit<NetworkRequestEntry, 'deviceId' | 'tabId'>) => void;

export class EventSourceInterceptor {
  private onReport: SSEReportCallback;
  private originalEventSource: typeof EventSource | null = null;

  constructor(onReport: SSEReportCallback) {
    this.onReport = onReport;
  }

  start(): void {
    if (typeof EventSource === 'undefined') return;
    this.originalEventSource = EventSource;
    const self = this;
    const OriginalEventSource = EventSource;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).EventSource = function (
      url: string | URL,
      init?: EventSourceInit,
    ): EventSource {
      const es = new OriginalEventSource(url, init);
      const id = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const urlStr = String(url);
      let openTime = Date.now();
      let messageCount = 0;

      es.addEventListener('open', () => {
        openTime = Date.now();
        self.onReport({
          id,
          method: 'SSE',
          url: urlStr,
          type: 'sse',
          wsEventType: 'open',
          status: 200,
          statusText: 'OK',
          timestamp: Date.now(),
        });
      });

      es.addEventListener('message', (event: MessageEvent) => {
        messageCount++;
        self.onReport({
          id: `${id}-msg-${messageCount}`,
          method: 'SSE',
          url: urlStr,
          type: 'sse',
          wsEventType: 'message',
          wsDirection: 'receive',
          responseBody: event.data,
          timestamp: Date.now(),
        });
      });

      es.addEventListener('error', () => {
        const duration = Date.now() - openTime;
        self.onReport({
          id: `${id}-err`,
          method: 'SSE',
          url: urlStr,
          type: 'sse',
          wsEventType: 'error',
          error: es.readyState === EventSource.CLOSED ? 'Connection closed' : 'SSE error',
          duration,
          messageCount,
          timestamp: Date.now(),
        });
      });

      return es;
    };
    (window.EventSource as any).prototype = OriginalEventSource.prototype;
    Object.assign(window.EventSource, {
      CONNECTING: OriginalEventSource.CONNECTING,
      OPEN: OriginalEventSource.OPEN,
      CLOSED: OriginalEventSource.CLOSED,
    });
  }

  stop(): void {
    if (this.originalEventSource) {
      (window as any).EventSource = this.originalEventSource;
      this.originalEventSource = null;
    }
  }
}
