// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAPI } from '../interceptors/mock-api.js';
import type { MockRule } from '../types/index.js';

// ── helpers ────────────────────────────────────────────────────────────────

function addRule(api: MockAPI, overrides: Partial<Omit<MockRule, 'id'>> = {}): string {
  return api.addRule({
    name: 'test rule',
    pattern: '/api/test',
    method: 'GET',
    status: 200,
    body: '{"ok":true}',
    enabled: true,
    headers: {},
    ...overrides,
  });
}

// ── fetch patching ─────────────────────────────────────────────────────────

describe('MockAPI — fetch', () => {
  let mockAPI: MockAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // spy on window.fetch so unmatched requests return a known response
    fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response('real', { status: 200 }),
    );
    mockAPI = new MockAPI();
  });

  afterEach(() => {
    mockAPI.stop();
    vi.restoreAllMocks();
  });

  it('passes through unmatched requests to real fetch', async () => {
    addRule(mockAPI, { pattern: '/other' });
    mockAPI.start();
    await window.fetch('/api/test');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('intercepts matched request and returns mock status + body', async () => {
    addRule(mockAPI, { status: 201, body: '{"created":true}' });
    mockAPI.start();
    const res = await window.fetch('/api/test');
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('{"created":true}');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('applies custom response headers', async () => {
    addRule(mockAPI, { headers: { 'X-Custom': 'hello' } });
    mockAPI.start();
    const res = await window.fetch('/api/test');
    expect(res.headers.get('X-Custom')).toBe('hello');
  });

  it('simulates delay before responding', async () => {
    vi.useFakeTimers();
    addRule(mockAPI, { delay: 300 });
    mockAPI.start();

    let resolved = false;
    const p = window.fetch('/api/test').then(() => { resolved = true; });

    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(resolved).toBe(true);

    vi.useRealTimers();
  });

  it('skips disabled rules', async () => {
    addRule(mockAPI, { enabled: false });
    mockAPI.start();
    await window.fetch('/api/test');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('matches by regex pattern', async () => {
    addRule(mockAPI, { pattern: '/api/.*', status: 299 });
    mockAPI.start();
    const res = await window.fetch('/api/anything');
    expect(res.status).toBe(299);
  });

  it('fires onMatch callback with rule id and url', async () => {
    const onMatch = vi.fn();
    mockAPI.onMatch = onMatch;
    const id = addRule(mockAPI);
    mockAPI.start();
    await window.fetch('/api/test');
    expect(onMatch).toHaveBeenCalledWith(id, '/api/test');
  });

  it('restores original fetch on stop', async () => {
    addRule(mockAPI);
    mockAPI.start();
    mockAPI.stop();
    await window.fetch('/api/test');
    expect(fetchSpy).toHaveBeenCalled();
  });
});

// ── rule management ────────────────────────────────────────────────────────

describe('MockAPI — rule management', () => {
  let mockAPI: MockAPI;

  beforeEach(() => {
    mockAPI = new MockAPI();
  });

  it('addRule returns a unique id', () => {
    const id1 = addRule(mockAPI);
    const id2 = addRule(mockAPI);
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('getRules returns all rules', () => {
    addRule(mockAPI, { name: 'a' });
    addRule(mockAPI, { name: 'b' });
    expect(mockAPI.getRules()).toHaveLength(2);
  });

  it('removeRule deletes by id', () => {
    const id = addRule(mockAPI);
    addRule(mockAPI);
    mockAPI.removeRule(id);
    expect(mockAPI.getRules()).toHaveLength(1);
    expect(mockAPI.getRules()[0].id).not.toBe(id);
  });

  it('clearRules removes all', () => {
    addRule(mockAPI);
    addRule(mockAPI);
    mockAPI.clearRules();
    expect(mockAPI.getRules()).toHaveLength(0);
  });

  it('updateRule toggles enabled state', () => {
    const id = addRule(mockAPI, { enabled: true });
    mockAPI.updateRule(id, { enabled: false });
    const rule = mockAPI.getRules().find((r) => r.id === id);
    expect(rule?.enabled).toBe(false);
  });
});
