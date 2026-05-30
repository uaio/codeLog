export interface IDBOperationEntry {
  deviceId: string;
  tabId: string;
  id: string;
  dbName: string;
  storeName: string;
  operation: 'get' | 'getAll' | 'put' | 'add' | 'delete' | 'clear' | 'openCursor' | 'count';
  key?: unknown;
  value?: unknown;
  result?: unknown;
  error?: string;
  duration?: number;
  timestamp: number;
}

export class IndexedDBStore {
  private entries: Map<string, IDBOperationEntry[]> = new Map();
  private readonly maxEntriesPerDevice: number;

  constructor(maxEntriesPerDevice = 200) {
    this.maxEntriesPerDevice = maxEntriesPerDevice;
  }

  push(deviceId: string, entry: IDBOperationEntry): void {
    if (!this.entries.has(deviceId)) {
      this.entries.set(deviceId, []);
    }
    const list = this.entries.get(deviceId)!;
    list.push(entry);
    if (list.length > this.maxEntriesPerDevice) {
      list.splice(0, list.length - this.maxEntriesPerDevice);
    }
  }

  getAll(deviceId: string): IDBOperationEntry[] {
    return this.entries.get(deviceId) ?? [];
  }

  clear(deviceId: string): void {
    this.entries.delete(deviceId);
  }

  deleteDevice(deviceId: string): void {
    this.entries.delete(deviceId);
  }
}

// ── IDB Snapshot Store (live database browser data) ──────────────────────────

export interface IDBSnapshotRecord {
  deviceId: string;
  ts: number;
  databases: unknown[];
}

export interface IDBStoreDataRecord {
  deviceId: string;
  reqId: string;
  dbName: string;
  storeName: string;
  page: number;
  pageSize: number;
  total: number;
  records: unknown[];
  ts: number;
}

/** Stores the latest IDB database structure snapshot per device. */
export class IDBSnapshotStore {
  private snapshots: Map<string, IDBSnapshotRecord> = new Map();
  /** Latest store-data responses keyed by "deviceId:reqId" */
  private storeData: Map<string, IDBStoreDataRecord> = new Map();

  setSnapshot(deviceId: string, snapshot: { databases: unknown[]; ts: number }): void {
    this.snapshots.set(deviceId, { deviceId, ...snapshot });
  }

  getSnapshot(deviceId: string): IDBSnapshotRecord | undefined {
    return this.snapshots.get(deviceId);
  }

  setStoreData(deviceId: string, data: Omit<IDBStoreDataRecord, 'deviceId'>): void {
    this.storeData.set(`${deviceId}:${data.reqId}`, { deviceId, ...data });
  }

  getStoreData(deviceId: string, reqId: string): IDBStoreDataRecord | undefined {
    return this.storeData.get(`${deviceId}:${reqId}`);
  }

  deleteDevice(deviceId: string): void {
    this.snapshots.delete(deviceId);
    for (const key of this.storeData.keys()) {
      if (key.startsWith(`${deviceId}:`)) this.storeData.delete(key);
    }
  }
}
