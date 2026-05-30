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
