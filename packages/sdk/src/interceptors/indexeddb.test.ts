// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDBInterceptor } from '../interceptors/indexeddb.js';

// ── in-memory IndexedDB polyfill is provided by vitest's jsdom environment ──
// These tests run against the actual browser-api-compatible fake-indexeddb
// that ships with jsdom.

async function populateDB(dbName: string, storeName: string, records: Record<string, unknown>[]) {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      for (const r of records) store.add(r);
    };
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

async function populateOutOfLineDB(dbName: string, storeName: string, entries: Array<{ key: string; value: unknown }>) {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(storeName); // no keyPath
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const { key, value } of entries) store.put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe('IndexedDBInterceptor.getStoreData', () => {
  let interceptor: IndexedDBInterceptor;

  beforeEach(() => {
    interceptor = new IndexedDBInterceptor(() => {});
  });

  it('returns records and keys for a keyPath store', async () => {
    const db = `test-kp-${Date.now()}`;
    const store = 'users';
    await populateDB(db, store, [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ]);

    const data = await interceptor.getStoreData(db, store, 0, 50);

    expect(data.total).toBe(2);
    expect(data.records).toHaveLength(2);
    expect(data.keys).toHaveLength(2);
    expect(data.keyPath).toBe('id');
    // keys should be the id values since keyPath = 'id'
    expect(data.keys).toContain('u1');
    expect(data.keys).toContain('u2');
  });

  it('returns records and keys for out-of-line key store', async () => {
    const db = `test-ool-${Date.now()}`;
    const store = 'items';
    await populateOutOfLineDB(db, store, [
      { key: 'k1', value: { data: 'foo' } },
      { key: 'k2', value: { data: 'bar' } },
    ]);

    const data = await interceptor.getStoreData(db, store, 0, 50);

    expect(data.total).toBe(2);
    expect(data.keys).toHaveLength(2);
    expect(data.keyPath).toBeNull(); // out-of-line
    expect(data.keys).toContain('k1');
    expect(data.keys).toContain('k2');
  });

  it('paginates correctly and returns matching key slice', async () => {
    const db = `test-page-${Date.now()}`;
    const store = 'pg';
    await populateDB(db, store, [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'c', v: 3 },
    ]);

    const page0 = await interceptor.getStoreData(db, store, 0, 2);
    expect(page0.records).toHaveLength(2);
    expect(page0.keys).toHaveLength(2);
    expect(page0.total).toBe(3);

    const page1 = await interceptor.getStoreData(db, store, 1, 2);
    expect(page1.records).toHaveLength(1);
    expect(page1.keys).toHaveLength(1);
  });

  it('returns empty arrays for non-existent store', async () => {
    const db = `test-empty-${Date.now()}`;
    await populateDB(db, 'existing', []);

    const data = await interceptor.getStoreData(db, 'nonexistent', 0, 50);
    expect(data.records).toHaveLength(0);
    expect(data.keys).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it('records[i] and keys[i] are aligned', async () => {
    const db = `test-align-${Date.now()}`;
    const store = 'aligned';
    await populateDB(db, store, [
      { id: 'x', label: 'first' },
      { id: 'y', label: 'second' },
    ]);

    const data = await interceptor.getStoreData(db, store, 0, 50);
    for (let i = 0; i < data.records.length; i++) {
      const rec = data.records[i] as Record<string, unknown>;
      expect(data.keys![i]).toBe(rec.id);
    }
  });
});
