import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { websocketManager } from '../lib/websocketManager.js';
import type { IDBOperationEntry } from '../types/index.js';

interface IndexedDBPanelProps {
  deviceId?: string;
}

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

export function IndexedDBPanel({ deviceId }: IndexedDBPanelProps) {
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
    if (!deviceId) {
      setEntries([]);
      return;
    }

    // Load existing entries
    api.getIndexedDB(deviceId).then(setEntries).catch(() => setEntries([]));

    // Subscribe to live updates
    const unsub = websocketManager.subscribe((msg: any) => {
      if (
        msg.type === 'event' &&
        msg.deviceId === deviceId &&
        msg.envelope?.type === 'indexeddb'
      ) {
        appendRef.current({ ...msg.envelope.data, deviceId, tabId: msg.envelope.tabId });
      }
    });

    return unsub;
  }, [deviceId]);

  if (!deviceId) {
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: '32px' }}>🗄️</div>
        <div>请先选择设备</div>
      </div>
    );
  }

  const dbNames = Array.from(new Set(entries.map((e) => e.dbName)));
  const storeNames = Array.from(
    new Set(entries.filter((e) => filterDB === 'all' || e.dbName === filterDB).map((e) => e.storeName)),
  );

  const filtered = entries.filter((e) => {
    if (filterDB !== 'all' && e.dbName !== filterDB) return false;
    if (filterStore !== 'all' && e.storeName !== filterStore) return false;
    if (filterOp !== 'all' && e.operation !== filterOp) return false;
    return true;
  });

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <select
          value={filterDB}
          onChange={(e) => { setFilterDB(e.target.value); setFilterStore('all'); }}
          style={styles.select}
        >
          <option value="all">All DBs</option>
          {dbNames.map((db) => <option key={db} value={db}>{db}</option>)}
        </select>
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Stores</option>
          {storeNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterOp}
          onChange={(e) => setFilterOp(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Ops</option>
          {['get', 'getAll', 'put', 'add', 'delete', 'clear', 'count', 'openCursor'].map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        <button style={styles.clearBtn} onClick={() => setEntries([])}>🗑</button>
        <span style={styles.count}>{filtered.length}</span>
      </div>

      <div style={styles.body}>
        {/* List */}
        <div style={styles.list}>
          {filtered.length === 0 && (
            <div style={styles.emptyHint}>暂无 IndexedDB 操作记录</div>
          )}
          {filtered.map((entry) => (
            <div
              key={entry.id}
              style={{
                ...styles.row,
                ...(selected?.id === entry.id ? styles.rowSelected : {}),
                ...(entry.error ? styles.rowError : {}),
              }}
              onClick={() => setSelected(entry)}
            >
              <span
                style={{
                  ...styles.op,
                  color: OP_COLORS[entry.operation] || '#666',
                }}
              >
                {entry.operation}
              </span>
              <span style={styles.dbName}>{entry.dbName}</span>
              <span style={styles.storeName}>{entry.storeName}</span>
              <span style={styles.duration}>
                {entry.duration !== undefined ? `${entry.duration}ms` : '-'}
              </span>
              {entry.error && <span style={styles.errorBadge}>ERR</span>}
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected && (
          <div style={styles.detail}>
            <div style={styles.detailHeader}>
              <span style={{ fontWeight: 600 }}>{selected.operation}</span>
              <span style={{ color: '#666', marginLeft: '8px' }}>
                {selected.dbName} / {selected.storeName}
              </span>
              <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={styles.detailBody}>
              {selected.error && (
                <div style={styles.errorMsg}>❌ {selected.error}</div>
              )}
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
    <div style={detailRowStyles.row}>
      <span style={detailRowStyles.label}>{label}</span>
      <pre style={{ ...detailRowStyles.value, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </pre>
    </div>
  );
}

const detailRowStyles = {
  row: {
    display: 'flex',
    gap: '12px',
    padding: '5px 0',
    borderBottom: '1px solid #f5f5f5',
    alignItems: 'flex-start',
  } as const,
  label: {
    fontSize: '11px',
    color: '#999',
    minWidth: '80px',
    flexShrink: 0,
  } as const,
  value: {
    fontSize: '11px',
    color: '#333',
    flex: 1,
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '200px',
    overflow: 'auto',
  } as const,
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#fff',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    gap: '8px',
  },
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
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    minWidth: 0,
  },
  emptyHint: {
    padding: '24px',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: '13px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    fontSize: '12px',
  },
  rowSelected: {
    backgroundColor: '#e6f7ff',
  },
  rowError: {
    backgroundColor: '#fff1f0',
  },
  op: {
    fontWeight: 600,
    minWidth: '80px',
    fontFamily: 'monospace',
    fontSize: '11px',
  },
  dbName: {
    color: '#666',
    minWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  storeName: {
    color: '#333',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  duration: {
    color: '#999',
    minWidth: '50px',
    textAlign: 'right' as const,
  },
  errorBadge: {
    background: '#ff4d4f',
    color: '#fff',
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: '10px',
  },
  detail: {
    width: '360px',
    flexShrink: 0,
    borderLeft: '1px solid #e8e8e8',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid #e8e8e8',
    backgroundColor: '#fafafa',
    fontSize: '12px',
  },
  closeBtn: {
    marginLeft: 'auto',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#999',
    padding: '0 4px',
  },
  detailBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 12px',
  },
  errorMsg: {
    color: '#ff4d4f',
    fontSize: '12px',
    marginBottom: '8px',
    padding: '6px',
    backgroundColor: '#fff1f0',
    borderRadius: '4px',
  },
};
