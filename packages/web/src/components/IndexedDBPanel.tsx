import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client.js';
import { websocketManager } from '../lib/websocketManager.js';
import type { IDBOperationEntry } from '../types/index.js';

interface IndexedDBPanelProps {
  deviceId?: string;
}

// ── Types for the database browser ───────────────────────────────────────────

interface IDBIndexInfo {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

interface IDBStoreSchema {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IDBIndexInfo[];
  count: number;
}

interface IDBDatabaseInfo {
  name: string;
  version: number;
  stores: IDBStoreSchema[];
}

interface IDBSnapshot {
  databases: IDBDatabaseInfo[];
  ts: number;
}

interface IDBStoreData {
  dbName: string;
  storeName: string;
  page: number;
  pageSize: number;
  total: number;
  records: unknown[];
  reqId: string;
}

// ── Tab: Operations Log ───────────────────────────────────────────────────────

const OP_COLORS: Record<string, string> = {
  get: '#1890ff',
  getAll: '#722ed1',
  put: '#52c41a',
  add: '#13c2c2',
  delete: '#ff4d4f',
  clear: '#ff7a45',
  count: '#fa8c16',
  openCursor: '#a0a0a0',
};

function OperationsLog({ deviceId }: { deviceId: string }) {
  const [entries, setEntries] = useState<IDBOperationEntry[]>([]);
  const [selected, setSelected] = useState<IDBOperationEntry | null>(null);
  const [filterDB, setFilterDB] = useState<string>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterOp, setFilterOp] = useState<string>('all');
  const appendRef = useRef<(e: IDBOperationEntry) => void>(() => {});

  appendRef.current = (entry: IDBOperationEntry) => {
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > 500 ? next.slice(-500) : next;
    });
  };

  useEffect(() => {
    api.getIndexedDB(deviceId).then(setEntries).catch(() => setEntries([]));

    const unsub = websocketManager.subscribe((msg: any) => {
      if (msg.type === 'event' && msg.deviceId === deviceId && msg.envelope?.type === 'indexeddb') {
        appendRef.current({ ...msg.envelope.data, deviceId, tabId: msg.envelope.tabId });
      }
    });
    return unsub;
  }, [deviceId]);

  const dbNames = Array.from(new Set(entries.map((e) => e.dbName)));
  const storeNames = Array.from(
    new Set(
      entries
        .filter((e) => filterDB === 'all' || e.dbName === filterDB)
        .map((e) => e.storeName),
    ),
  );

  const filtered = entries.filter((e) => {
    if (filterDB !== 'all' && e.dbName !== filterDB) return false;
    if (filterStore !== 'all' && e.storeName !== filterStore) return false;
    if (filterOp !== 'all' && e.operation !== filterOp) return false;
    return true;
  });

  return (
    <div style={s.container}>
      <div style={s.toolbar}>
        <select
          value={filterDB}
          onChange={(e) => {
            setFilterDB(e.target.value);
            setFilterStore('all');
          }}
          style={s.select}
        >
          <option value="all">All DBs</option>
          {dbNames.map((db) => (
            <option key={db} value={db}>
              {db}
            </option>
          ))}
        </select>
        <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)} style={s.select}>
          <option value="all">All Stores</option>
          {storeNames.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)} style={s.select}>
          <option value="all">All Ops</option>
          {['get', 'getAll', 'put', 'add', 'delete', 'clear', 'count', 'openCursor'].map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        <button style={s.clearBtn} onClick={() => setEntries([])}>
          🗑
        </button>
        <span style={s.count}>{filtered.length}</span>
      </div>

      <div style={s.body}>
        <div style={s.list}>
          {filtered.length === 0 && <div style={s.emptyHint}>暂无 IndexedDB 操作记录</div>}
          {filtered.map((entry) => (
            <div
              key={entry.id}
              style={{
                ...s.row,
                ...(selected?.id === entry.id ? s.rowSelected : {}),
                ...(entry.error ? s.rowError : {}),
              }}
              onClick={() => setSelected(entry)}
            >
              <span style={{ ...s.op, color: OP_COLORS[entry.operation] || '#666' }}>
                {entry.operation}
              </span>
              <span style={s.dbName}>{entry.dbName}</span>
              <span style={s.storeName}>{entry.storeName}</span>
              <span style={s.duration}>
                {entry.duration !== undefined ? `${entry.duration}ms` : '-'}
              </span>
              {entry.error && <span style={s.errorBadge}>ERR</span>}
            </div>
          ))}
        </div>

        {selected && (
          <div style={s.detail}>
            <div style={s.detailHeader}>
              <span style={{ fontWeight: 600 }}>{selected.operation}</span>
              <span style={{ color: '#666', marginLeft: '8px' }}>
                {selected.dbName} / {selected.storeName}
              </span>
              <button style={s.closeBtn} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <div style={s.detailBody}>
              {selected.error && <div style={s.errorMsg}>❌ {selected.error}</div>}
              <DetailRow label="Operation" value={selected.operation} />
              <DetailRow label="Database" value={selected.dbName} />
              <DetailRow label="Store" value={selected.storeName} />
              {selected.key !== undefined && (
                <DetailRow label="Key" value={JSON.stringify(selected.key)} mono />
              )}
              {selected.value !== undefined && (
                <DetailRow label="Value" value={JSON.stringify(selected.value, null, 2)} mono />
              )}
              {selected.result !== undefined && (
                <DetailRow label="Result" value={JSON.stringify(selected.result, null, 2)} mono />
              )}
              {selected.duration !== undefined && (
                <DetailRow label="Duration" value={`${selected.duration}ms`} />
              )}
              <DetailRow label="Time" value={new Date(selected.timestamp).toLocaleTimeString()} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Database Browser ─────────────────────────────────────────────────────

function DatabaseBrowser({ deviceId }: { deviceId: string }) {
  const [snapshot, setSnapshot] = useState<IDBSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<{ dbName: string; storeName: string } | null>(null);
  const [storeData, setStoreData] = useState<IDBStoreData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedDBs, setExpandedDBs] = useState<Set<string>>(new Set());
  const pendingReqRef = useRef<string | null>(null);

  const requestSnapshot = useCallback(() => {
    if (!deviceId) return;
    setLoading(true);
    websocketManager.send({ type: 'request_idb_snapshot', deviceId });

    // Poll for response — snapshot arrives via WS push as 'idb_snapshot' event
    const start = Date.now();
    const TIMEOUT = 10_000;
    const poll = () => {
      if (Date.now() - start > TIMEOUT) {
        setLoading(false);
        return;
      }
      // Server stores latest snapshot; poll the REST endpoint
      api
        .getIDBSnapshot(deviceId)
        .then((data) => {
          // Only accept if newer than before load clicked
          if (data && (snapshot === null || data.ts > (snapshot?.ts ?? 0))) {
            setSnapshot(data);
            setLoading(false);
            // Auto-expand all DBs
            setExpandedDBs(new Set(data.databases.map((d: IDBDatabaseInfo) => d.name)));
          } else {
            setTimeout(poll, 600);
          }
        })
        .catch(() => setTimeout(poll, 600));
    };
    setTimeout(poll, 800);
  }, [deviceId, snapshot]);

  // Also listen for live WS pushes so we can update without polling
  useEffect(() => {
    const unsub = websocketManager.subscribe((msg: any) => {
      if (msg.type === 'event' && msg.deviceId === deviceId && msg.envelope?.type === 'idb_snapshot') {
        setSnapshot(msg.envelope.data);
        setLoading(false);
        setExpandedDBs(new Set(msg.envelope.data.databases.map((d: IDBDatabaseInfo) => d.name)));
      }
      if (
        msg.type === 'event' &&
        msg.deviceId === deviceId &&
        msg.envelope?.type === 'idb_store_data' &&
        msg.envelope.data.reqId === pendingReqRef.current
      ) {
        setStoreData(msg.envelope.data);
        setDataLoading(false);
        pendingReqRef.current = null;
      }
    });
    return unsub;
  }, [deviceId]);

  const loadStoreData = useCallback(
    (dbName: string, storeName: string, page = 0) => {
      const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingReqRef.current = reqId;
      setSelectedStore({ dbName, storeName });
      setDataLoading(true);
      websocketManager.send({
        type: 'request_idb_store_data',
        deviceId,
        dbName,
        storeName,
        page,
        pageSize: 50,
        reqId,
      });

      // Fallback: poll REST endpoint if WS response is slow
      const start = Date.now();
      const poll = () => {
        if (Date.now() - start > 8_000 || pendingReqRef.current !== reqId) return;
        api
          .getIDBStoreData(deviceId, reqId)
          .then((data) => {
            if (data) {
              setStoreData(data);
              setDataLoading(false);
              pendingReqRef.current = null;
            } else {
              setTimeout(poll, 600);
            }
          })
          .catch(() => setTimeout(poll, 600));
      };
      setTimeout(poll, 800);
    },
    [deviceId],
  );

  const toggleDB = (dbName: string) => {
    setExpandedDBs((prev) => {
      const next = new Set(prev);
      if (next.has(dbName)) next.delete(dbName);
      else next.add(dbName);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: DB tree */}
      <div style={bs.tree}>
        <div style={bs.treeHeader}>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>数据库</span>
          <button style={bs.refreshBtn} onClick={requestSnapshot} title="刷新数据库结构">
            {loading ? '⏳' : '🔄'}
          </button>
        </div>

        {!snapshot && !loading && (
          <div style={bs.treeEmpty}>
            <div>点击 🔄 加载数据库结构</div>
          </div>
        )}
        {loading && <div style={bs.treeEmpty}>正在加载...</div>}

        {snapshot?.databases.map((db) => (
          <div key={db.name}>
            <div style={bs.dbRow} onClick={() => toggleDB(db.name)}>
              <span style={{ marginRight: '4px' }}>{expandedDBs.has(db.name) ? '▼' : '▶'}</span>
              <span style={bs.dbIcon}>🗄</span>
              <span style={bs.dbName}>{db.name}</span>
              <span style={bs.dbVersion}>v{db.version}</span>
            </div>

            {expandedDBs.has(db.name) &&
              db.stores.map((store) => (
                <div
                  key={store.name}
                  style={{
                    ...bs.storeRow,
                    ...(selectedStore?.dbName === db.name && selectedStore?.storeName === store.name
                      ? bs.storeRowActive
                      : {}),
                  }}
                  onClick={() => loadStoreData(db.name, store.name, 0)}
                >
                  <span style={bs.storeIcon}>📋</span>
                  <span style={bs.storeName}>{store.name}</span>
                  <span style={bs.storeCount}>{store.count}</span>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Right: Records table */}
      <div style={bs.records}>
        {!selectedStore && (
          <div style={bs.recordsEmpty}>
            <div style={{ fontSize: '28px' }}>📊</div>
            <div>选择左侧 Store 查看数据</div>
          </div>
        )}

        {selectedStore && (
          <>
            <div style={bs.recordsHeader}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>
                {selectedStore.dbName} / <span style={{ color: '#1890ff' }}>{selectedStore.storeName}</span>
              </span>
              {storeData && (
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>
                  共 {storeData.total} 条
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                {storeData && storeData.page > 0 && (
                  <button
                    style={bs.pageBtn}
                    onClick={() => loadStoreData(selectedStore.dbName, selectedStore.storeName, storeData.page - 1)}
                  >
                    ‹ 上一页
                  </button>
                )}
                {storeData && (storeData.page + 1) * storeData.pageSize < storeData.total && (
                  <button
                    style={bs.pageBtn}
                    onClick={() => loadStoreData(selectedStore.dbName, selectedStore.storeName, storeData.page + 1)}
                  >
                    下一页 ›
                  </button>
                )}
              </div>
            </div>

            {dataLoading && <div style={bs.recordsEmpty}>加载中...</div>}

            {!dataLoading && storeData && storeData.records.length === 0 && (
              <div style={bs.recordsEmpty}>Store 为空</div>
            )}

            {!dataLoading && storeData && storeData.records.length > 0 && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {storeData.records.map((record, idx) => (
                  <RecordRow
                    key={idx}
                    index={storeData.page * storeData.pageSize + idx}
                    record={record}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RecordRow({ index, record }: { index: number; record: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const json = (() => {
    try {
      return JSON.stringify(record, null, 2);
    } catch {
      return String(record);
    }
  })();
  const preview = json.length > 120 ? json.slice(0, 120) + '…' : json;

  return (
    <div style={bs.recordRow} onClick={() => setExpanded((v) => !v)}>
      <span style={bs.recordIdx}>#{index}</span>
      <pre style={{ ...bs.recordPreview, whiteSpace: expanded ? 'pre-wrap' : 'nowrap' }}>
        {expanded ? json : preview}
      </pre>
      <span style={{ color: '#ccc', fontSize: '10px', marginLeft: '4px' }}>
        {expanded ? '▲' : '▼'}
      </span>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function IndexedDBPanel({ deviceId }: IndexedDBPanelProps) {
  const [activeTab, setActiveTab] = useState<'ops' | 'browser'>('ops');

  if (!deviceId) {
    return (
      <div style={s.emptyFull}>
        <div style={{ fontSize: '32px' }}>🗄️</div>
        <div>请先选择设备</div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* Tab bar */}
      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(activeTab === 'ops' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('ops')}
        >
          操作日志
        </button>
        <button
          style={{ ...s.tab, ...(activeTab === 'browser' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('browser')}
        >
          数据库浏览器
        </button>
      </div>

      {activeTab === 'ops' ? (
        <OperationsLog deviceId={deviceId} />
      ) : (
        <DatabaseBrowser deviceId={deviceId} />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '5px 0', borderBottom: '1px solid #f5f5f5', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '11px', color: '#999', minWidth: '80px', flexShrink: 0 }}>{label}</span>
      <pre
        style={{
          fontSize: '11px',
          color: '#333',
          flex: 1,
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: '200px',
          overflow: 'auto',
          fontFamily: mono ? 'monospace' : 'inherit',
        }}
      >
        {value}
      </pre>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#fff',
  },
  emptyFull: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    gap: '8px',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e8e8e8',
    backgroundColor: '#fafafa',
    flexShrink: 0,
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    borderBottom: '2px solid transparent',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666',
  },
  tabActive: {
    color: '#1890ff',
    borderBottomColor: '#1890ff',
    fontWeight: 600,
  } as const,
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderBottom: '1px solid #e8e8e8',
    backgroundColor: '#fafafa',
    flexShrink: 0,
  },
  select: {
    padding: '4px 6px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: '#fff',
  },
  clearBtn: {
    padding: '4px 8px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
  },
  count: {
    fontSize: '11px',
    color: '#999',
    whiteSpace: 'nowrap' as const,
    marginLeft: 'auto',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  list: { flex: 1, overflowY: 'auto' as const, minWidth: 0 },
  emptyHint: { padding: '24px', textAlign: 'center' as const, color: '#999', fontSize: '13px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    fontSize: '12px',
  },
  rowSelected: { backgroundColor: '#e6f7ff' },
  rowError: { backgroundColor: '#fff1f0' },
  op: { fontWeight: 600, minWidth: '80px', fontFamily: 'monospace', fontSize: '11px' },
  dbName: { color: '#666', minWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  storeName: { color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  duration: { color: '#999', minWidth: '50px', textAlign: 'right' as const },
  errorBadge: { background: '#ff4d4f', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' },
  detail: { width: '360px', flexShrink: 0, borderLeft: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  detailHeader: { display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e8e8e8', backgroundColor: '#fafafa', fontSize: '12px' },
  closeBtn: { marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#999', padding: '0 4px' },
  detailBody: { flex: 1, overflowY: 'auto' as const, padding: '8px 12px' },
  errorMsg: { color: '#ff4d4f', fontSize: '12px', marginBottom: '8px', padding: '6px', backgroundColor: '#fff1f0', borderRadius: '4px' },
};

const bs = {
  tree: { width: '220px', flexShrink: 0, borderRight: '1px solid #e8e8e8', overflowY: 'auto' as const, backgroundColor: '#fafafa' },
  treeHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e8e8e8', backgroundColor: '#fff' },
  treeEmpty: { padding: '16px 12px', color: '#999', fontSize: '12px', textAlign: 'center' as const },
  refreshBtn: { border: '1px solid #d9d9d9', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: '14px' },
  dbRow: { display: 'flex', alignItems: 'center', padding: '5px 8px', cursor: 'pointer', fontSize: '12px', userSelect: 'none' as const, borderBottom: '1px solid #f0f0f0' },
  dbIcon: { fontSize: '13px', marginRight: '4px' },
  dbName: { flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  dbVersion: { fontSize: '10px', color: '#999', marginLeft: '4px' },
  storeRow: { display: 'flex', alignItems: 'center', padding: '4px 8px 4px 24px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f5f5f5' },
  storeRowActive: { backgroundColor: '#e6f7ff' },
  storeIcon: { fontSize: '12px', marginRight: '4px' },
  storeName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  storeCount: { fontSize: '10px', color: '#999', marginLeft: '4px' },
  records: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  recordsEmpty: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', color: '#999', gap: '8px', fontSize: '13px' },
  recordsHeader: { display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e8e8e8', backgroundColor: '#fafafa', fontSize: '12px', flexShrink: 0 },
  pageBtn: { padding: '2px 8px', border: '1px solid #d9d9d9', borderRadius: '3px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '11px' },
  recordRow: { display: 'flex', alignItems: 'flex-start', padding: '5px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', fontSize: '11px' },
  recordIdx: { color: '#999', minWidth: '32px', flexShrink: 0, marginRight: '8px' },
  recordPreview: { flex: 1, margin: 0, color: '#333', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' },
};

