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
}
