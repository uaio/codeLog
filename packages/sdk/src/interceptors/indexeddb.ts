import type {
  IDBSnapshotPayload,
  IDBStoreDataPayload,
  IDBDatabaseInfo,
  IDBStoreSchema,
} from '@codelog/types';

export type { IDBSnapshotPayload, IDBStoreDataPayload };

export interface IndexedDBEntry {
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

export type IDBReportCallback = (entry: IndexedDBEntry) => void;

export class IndexedDBInterceptor {
  private onReport: IDBReportCallback;
  private originalOpen: typeof indexedDB.open | null = null;
  private enabled = false;

  constructor(onReport: IDBReportCallback) {
    this.onReport = onReport;
  }

  start(): void {
    if (typeof indexedDB === 'undefined') return;
    this.enabled = true;
    this.originalOpen = indexedDB.open.bind(indexedDB);
    const self = this;

    // We intercept at the IDBObjectStore level by patching IDBTransaction prototype
    // to wrap all store operations
    const opNames: (keyof IDBObjectStore)[] = [
      'get', 'getAll', 'put', 'add', 'delete', 'clear', 'count', 'openCursor',
    ];

    opNames.forEach((opName) => {
      const original = IDBObjectStore.prototype[opName] as Function;
      if (typeof original !== 'function') return;

      (IDBObjectStore.prototype as any)[opName] = function (this: IDBObjectStore, ...args: unknown[]): IDBRequest {
        const start = Date.now();
        const dbName = (this.transaction.db as IDBDatabase).name;
        const storeName = this.name;
        const id = `idb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const request = original.apply(this, args) as IDBRequest;

        request.addEventListener('success', () => {
          if (!self.enabled) return;
          const result = request.result;
          let resultStr: unknown;
          try {
            // Summarize large results
            if (Array.isArray(result)) {
              resultStr = `[Array(${result.length})]`;
            } else if (result && typeof result === 'object' && result instanceof IDBCursor) {
              resultStr = '[IDBCursor]';
            } else {
              resultStr = result;
            }
          } catch {
            resultStr = '[unserializable]';
          }

          self.onReport({
            id,
            dbName,
            storeName,
            operation: opName as IndexedDBEntry['operation'],
            key: args[0],
            value: opName === 'put' || opName === 'add' ? args[0] : undefined,
            result: resultStr,
            duration: Date.now() - start,
            timestamp: start,
          });
        });

        request.addEventListener('error', () => {
          if (!self.enabled) return;
          self.onReport({
            id,
            dbName,
            storeName,
            operation: opName as IndexedDBEntry['operation'],
            key: args[0],
            error: request.error?.message ?? 'Unknown IDB error',
            duration: Date.now() - start,
            timestamp: start,
          });
        });

        return request;
      };
    });
  }

  stop(): void {
    this.enabled = false;
    // Note: We do not restore IDBObjectStore prototypes to avoid breaking
    // any in-flight requests. Disabled flag prevents further reporting.
  }

  /** Take a full snapshot of all IndexedDB databases (structure only, no record data). */
  async takeSnapshot(): Promise<IDBSnapshotPayload> {
    if (typeof indexedDB === 'undefined') return { ts: Date.now(), databases: [] };

    let dbList: Array<{ name: string; version: number }> = [];
    try {
      // indexedDB.databases() is Chrome 71+ / Firefox 126+
      dbList = await (indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name: string; version: number }>>;
      }).databases?.() ?? [];
    } catch {
      return { ts: Date.now(), databases: [] };
    }

    const databases: IDBDatabaseInfo[] = [];
    for (const { name, version } of dbList) {
      if (!name) continue;
      try {
        const info = await this._inspectDatabase(name, version);
        databases.push(info);
      } catch {
        // skip unreadable databases
      }
    }
    return { ts: Date.now(), databases };
  }

  /** Fetch paginated records from a specific store. */
  async getStoreData(
    dbName: string,
    storeName: string,
    page = 0,
    pageSize = 50,
  ): Promise<Omit<IDBStoreDataPayload, 'reqId'>> {
    return new Promise((resolve, reject) => {
      const openReq = indexedDB.open(dbName);
      openReq.onsuccess = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          return resolve({ dbName, storeName, records: [], total: 0, page, pageSize });
        }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        // Count total
        const countReq = store.count();
        countReq.onsuccess = () => {
          const total = countReq.result;
          const offset = page * pageSize;

          // Fetch records with cursor (skip offset, take pageSize)
          const records: unknown[] = [];
          let skipped = 0;
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) {
              db.close();
              return resolve({ dbName, storeName, records, total, page, pageSize });
            }
            if (skipped < offset) {
              skipped++;
              cursor.continue();
              return;
            }
            if (records.length < pageSize) {
              try {
                records.push(JSON.parse(JSON.stringify(cursor.value)));
              } catch {
                records.push(String(cursor.value));
              }
              cursor.continue();
            } else {
              db.close();
              resolve({ dbName, storeName, records, total, page, pageSize });
            }
          };
          cursorReq.onerror = () => {
            db.close();
            resolve({ dbName, storeName, records, total, page, pageSize });
          };
        };
        countReq.onerror = () => {
          db.close();
          reject(new Error('Count failed'));
        };
      };
      openReq.onerror = () => reject(new Error(`Cannot open ${dbName}`));
    });
  }

  private _inspectDatabase(name: string, version: number): Promise<IDBDatabaseInfo> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onsuccess = () => {
        const db = req.result;
        const stores: IDBStoreSchema[] = [];
        const storeNames = Array.from(db.objectStoreNames);

        // We need a read transaction to count records
        if (storeNames.length === 0) {
          db.close();
          return resolve({ name, version: db.version, stores });
        }

        let pending = storeNames.length;
        const tx = db.transaction(storeNames, 'readonly');

        storeNames.forEach((storeName) => {
          const store = tx.objectStore(storeName);
          const indexes = Array.from(store.indexNames).map((idxName) => {
            const idx = store.index(idxName);
            return {
              name: idxName,
              keyPath: idx.keyPath,
              unique: idx.unique,
              multiEntry: idx.multiEntry,
            };
          });
          const countReq = store.count();
          const schema: IDBStoreSchema = {
            name: storeName,
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement,
            indexes,
            count: 0,
          };
          countReq.onsuccess = () => {
            schema.count = countReq.result;
            stores.push(schema);
            pending--;
            if (pending === 0) {
              db.close();
              resolve({ name, version: db.version, stores });
            }
          };
          countReq.onerror = () => {
            stores.push(schema);
            pending--;
            if (pending === 0) {
              db.close();
              resolve({ name, version: db.version, stores });
            }
          };
        });
      };
      req.onerror = () => reject(new Error(`Cannot open ${name}`));
      req.onblocked = () => reject(new Error(`${name} is blocked`));
    });
  }
}
