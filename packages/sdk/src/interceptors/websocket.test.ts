// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketInterceptor } from '../interceptors/websocket.js';
import type { NetworkRequestEntry } from '../types/index.js';

// ── minimal WebSocket mock ─────────────────────────────────────────────────

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  url: string;
  protocol = '';
  extensions = '';
  bufferedAmount = 0;
  binaryType: BinaryType = 'blob';
  sentMessages: unknown[] = [];

  constructor(url: string | URL) {
    super();
    this.url = String(url);
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    this.sentMessages.push(data);
  }

  close(_code?: number, _reason?: string): void {}

  // helpers to simulate server events
  simulateOpen() { this.dispatchEvent(new Event('open')); }
  simulateMessage(data: string) {
    const e = new MessageEvent('message', { data });
    this.dispatchEvent(e);
  }
  simulateError() { this.dispatchEvent(new Event('error')); }
  simulateClose(code = 1000, reason = '') {
    const e = new CloseEvent('close', { code, reason });
    this.dispatchEvent(e);
  }
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('WebSocketInterceptor', () => {
  let interceptor: WebSocketInterceptor;
  let reported: NetworkRequestEntry[];
  let fakeWs: FakeWebSocket;

  beforeEach(() => {
    reported = [];
    interceptor = new WebSocketInterceptor((entry) => {
      reported.push(entry as NetworkRequestEntry);
    });

    // Replace native WebSocket with our fake so interceptor wraps FakeWebSocket
    vi.stubGlobal('WebSocket', function (url: string | URL) {
      fakeWs = new FakeWebSocket(url);
      return fakeWs;
    } as unknown as typeof WebSocket);

    interceptor.start();
    // Creates connection through the interceptor wrapper → sets fakeWs
    new WebSocket('wss://example.com/ws');
  });

  afterEach(() => {
    interceptor.stop();
    vi.unstubAllGlobals();
  });

  it('reports open event with wsConnectionId = id', () => {
    fakeWs.simulateOpen();
    const open = reported.find((e) => e.wsEventType === 'open');
    expect(open).toBeDefined();
    expect(open!.wsConnectionId).toBeDefined();
    expect(open!.wsConnectionId).toBe(open!.id);
  });

  it('reports received message with correct fields', () => {
    fakeWs.simulateOpen();
    fakeWs.simulateMessage('{"msg":"hello"}');

    const msg = reported.find((e) => e.wsEventType === 'message' && e.wsDirection === 'receive');
    expect(msg).toBeDefined();
    expect(msg!.responseBody).toBe('{"msg":"hello"}');
    expect(msg!.wsDirection).toBe('receive');
  });

  it('receive message wsConnectionId matches open event id', () => {
    fakeWs.simulateOpen();
    fakeWs.simulateMessage('ping');

    const open = reported.find((e) => e.wsEventType === 'open')!;
    const recv = reported.find((e) => e.wsEventType === 'message' && e.wsDirection === 'receive')!;
    expect(recv.wsConnectionId).toBe(open.wsConnectionId);
  });

  it('reports sent message with correct fields', () => {
    fakeWs.simulateOpen();
    fakeWs.send('client payload');

    const sent = reported.find((e) => e.wsEventType === 'message' && e.wsDirection === 'send');
    expect(sent).toBeDefined();
    expect(sent!.requestBody).toBe('client payload');
    expect(sent!.wsDirection).toBe('send');
  });

  it('send message wsConnectionId matches open event id', () => {
    fakeWs.simulateOpen();
    fakeWs.send('data');

    const open = reported.find((e) => e.wsEventType === 'open')!;
    const sent = reported.find((e) => e.wsEventType === 'message' && e.wsDirection === 'send')!;
    expect(sent.wsConnectionId).toBe(open.wsConnectionId);
  });

  it('reports close event with duration and wsConnectionId', () => {
    fakeWs.simulateOpen();
    fakeWs.simulateClose(1001, 'going away');

    const close = reported.find((e) => e.wsEventType === 'close');
    expect(close).toBeDefined();
    expect(close!.status).toBe(1001);
    expect(close!.statusText).toBe('going away');
    expect(close!.wsConnectionId).toBeDefined();

    const open = reported.find((e) => e.wsEventType === 'open')!;
    expect(close!.wsConnectionId).toBe(open.wsConnectionId);
  });

  it('reports error event with wsConnectionId', () => {
    fakeWs.simulateOpen();
    fakeWs.simulateError();

    const err = reported.find((e) => e.wsEventType === 'error');
    expect(err).toBeDefined();
    expect(err!.error).toBeTruthy();
    const open = reported.find((e) => e.wsEventType === 'open')!;
    expect(err!.wsConnectionId).toBe(open.wsConnectionId);
  });

  it('increments messageCount on close', () => {
    fakeWs.simulateOpen();
    fakeWs.simulateMessage('a');
    fakeWs.simulateMessage('b');
    fakeWs.send('c');
    fakeWs.simulateClose(1000, '');

    const close = reported.find((e) => e.wsEventType === 'close');
    expect(close!.messageCount).toBe(3);
  });

  it('all entries share the same url', () => {
    fakeWs.simulateOpen();
    fakeWs.simulateMessage('x');
    fakeWs.send('y');
    fakeWs.simulateClose(1000, '');

    const urls = new Set(reported.map((e) => e.url));
    expect(urls.size).toBe(1);
    expect([...urls][0]).toBe('wss://example.com/ws');
  });
});
