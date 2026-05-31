import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { sendToDevice, registerDeviceClient, registerPCClient, broadcastToViewers } from '../handlers.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeFakeWs(readyState = WebSocket.OPEN): { ws: WebSocket; messages: string[] } {
  const messages: string[] = [];
  const ws = {
    readyState,
    send: vi.fn((msg: string) => messages.push(msg)),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  } as unknown as WebSocket;
  return { ws, messages };
}

// ── sendToDevice ───────────────────────────────────────────────────────────

describe('sendToDevice', () => {
  it('sends JSON message to a registered device by id', () => {
    const { ws, messages } = makeFakeWs();
    registerDeviceClient(ws, 'dev-test-1');

    sendToDevice('dev-test-1', { type: 'reload_page' });

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0])).toEqual({ type: 'reload_page' });
  });

  it('does not send to a different device id', () => {
    const { ws, messages } = makeFakeWs();
    registerDeviceClient(ws, 'dev-test-2');

    sendToDevice('dev-other', { type: 'reload_page' });

    expect(messages).toHaveLength(0);
  });

  it('does not send to a closed device connection', () => {
    const { ws, messages } = makeFakeWs(WebSocket.CLOSED);
    registerDeviceClient(ws, 'dev-test-3');

    sendToDevice('dev-test-3', { type: 'take_screenshot' });

    expect(messages).toHaveLength(0);
  });

  it('forwards idb_put_record with all fields', () => {
    const { ws, messages } = makeFakeWs();
    registerDeviceClient(ws, 'dev-idb-1');

    sendToDevice('dev-idb-1', {
      type: 'idb_put_record',
      dbName: 'myDB',
      storeName: 'users',
      key: 'u1',
      value: { id: 'u1', name: 'Alice' },
    });

    expect(messages).toHaveLength(1);
    const parsed = JSON.parse(messages[0]);
    expect(parsed.type).toBe('idb_put_record');
    expect(parsed.dbName).toBe('myDB');
    expect(parsed.storeName).toBe('users');
    expect(parsed.key).toBe('u1');
    expect(parsed.value).toEqual({ id: 'u1', name: 'Alice' });
  });

  it('forwards idb_clear_store with db and store names', () => {
    const { ws, messages } = makeFakeWs();
    registerDeviceClient(ws, 'dev-idb-2');

    sendToDevice('dev-idb-2', {
      type: 'idb_clear_store',
      dbName: 'myDB',
      storeName: 'orders',
    });

    expect(messages).toHaveLength(1);
    const parsed = JSON.parse(messages[0]);
    expect(parsed.type).toBe('idb_clear_store');
    expect(parsed.dbName).toBe('myDB');
    expect(parsed.storeName).toBe('orders');
  });

  it('forwards execute_js with code payload', () => {
    const { ws, messages } = makeFakeWs();
    registerDeviceClient(ws, 'dev-exec-1');

    sendToDevice('dev-exec-1', {
      type: 'execute_js',
      code: 'console.log("hello")',
    });

    const parsed = JSON.parse(messages[0]);
    expect(parsed.type).toBe('execute_js');
    expect(parsed.code).toBe('console.log("hello")');
  });
});

// ── broadcastToViewers ─────────────────────────────────────────────────────

describe('broadcastToViewers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('broadcasts envelope to registered PC viewer', () => {
    const { ws, messages } = makeFakeWs();
    registerPCClient(ws);

    const envelope = {
      type: 'log',
      device: { deviceId: 'dev-x' },
      data: { level: 'log', args: ['hello'] },
    };
    broadcastToViewers(envelope);

    expect(messages.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(messages.at(-1)!);
    expect(parsed.type).toBe('event');
    expect(parsed.deviceId).toBe('dev-x');
    expect(parsed.envelope).toMatchObject({ type: 'log' });
  });

  it('uses "unknown" deviceId when device field is missing', () => {
    const { ws, messages } = makeFakeWs();
    registerPCClient(ws);

    broadcastToViewers({ type: 'screenshot' });

    const parsed = JSON.parse(messages.at(-1)!);
    expect(parsed.deviceId).toBe('unknown');
  });
});
