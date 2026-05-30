import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useLogs } from '../hooks/useLogs.js';
import type { ConsoleLog } from '../types/index.js';

interface ErrorPanelProps {
  deviceId?: string;
}

const GLOBAL_PREFIXES = [
  '[Uncaught Error]',
  '[Unhandled Promise Rejection]',
  '[Resource Error]',
];

function isError(log: ConsoleLog): boolean {
  return (
    log.level === 'error' ||
    GLOBAL_PREFIXES.some((p) => log.message.startsWith(p))
  );
}

function severityColor(log: ConsoleLog): string {
  if (GLOBAL_PREFIXES.some((p) => log.message.startsWith(p))) return '#ff4d4f';
  if (log.level === 'error') return '#ff7875';
  return '#faad14';
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ErrorEntry({ log }: { log: ConsoleLog }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = log.stack ? `${log.message}\n${log.stack}` : log.message;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {/* ignore */});
  }, [log.message, log.stack]);

  const isGlobal = GLOBAL_PREFIXES.some((p) => log.message.startsWith(p));

  return (
    <div style={{ ...styles.entry, borderLeftColor: severityColor(log) }}>
      <div style={styles.entryHeader}>
        <span style={{ color: severityColor(log), fontSize: '16px' }}>
          {isGlobal ? '💥' : '🔴'}
        </span>
        <span style={styles.time}>{formatTime(log.timestamp)}</span>
        {isGlobal && <span style={styles.globalTag}>GLOBAL</span>}
        <span style={styles.levelBadge}>
          {log.level.toUpperCase()}
        </span>
        <div style={styles.spacer} />
        <button style={styles.iconBtn} title="复制" onClick={handleCopy}>
          {copied ? '✅' : '📋'}
        </button>
        {log.stack && (
          <button style={styles.iconBtn} onClick={() => setExpanded((v) => !v)}>
            {expanded ? '▾ 收起' : '▸ 堆栈'}
          </button>
        )}
      </div>
      <div style={styles.message}>{log.message}</div>
      {expanded && log.stack && (
        <pre style={styles.stack}>{log.stack}</pre>
      )}
    </div>
  );
}

export function ErrorPanel({ deviceId }: ErrorPanelProps) {
  const { logs } = useLogs(deviceId, 1000);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn'>('all');

  const errors = logs.filter((log) => {
    if (filter === 'error') return log.level === 'error' || GLOBAL_PREFIXES.some((p) => log.message.startsWith(p));
    if (filter === 'warn') return log.level === 'warn';
    return isError(log) || log.level === 'warn';
  });

  const errorCount = logs.filter((l) => l.level === 'error' || GLOBAL_PREFIXES.some((p) => l.message.startsWith(p))).length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  if (!deviceId) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <div style={{ fontSize: '32px' }}>🐛</div>
          <div style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>从左侧选择设备查看错误</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>错误 / Errors</h3>
        <div style={styles.filterRow}>
          {(['all', 'error', 'warn'] as const).map((f) => (
            <button
              key={f}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `全部 (${errorCount + warnCount})` : f === 'error' ? `🔴 错误 (${errorCount})` : `⚠️ 警告 (${warnCount})`}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.body}>
        {errors.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: '40px' }}>✅</div>
            <div style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>暂无错误</div>
          </div>
        ) : (
          errors.map((log, i) => <ErrorEntry key={i} log={log} />)
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #e8e8e8',
    backgroundColor: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
  },
  filterBtn: {
    padding: '3px 12px',
    fontSize: '12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#555',
  },
  filterBtnActive: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
    color: '#fff',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
  },
  entry: {
    padding: '12px 16px',
    borderBottom: '1px solid #f0f0f0',
    borderLeft: '4px solid #ff4d4f',
    fontFamily: '"SF Mono", Monaco, Consolas, "Courier New", monospace',
    fontSize: '13px',
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  time: {
    fontSize: '11px',
    color: '#999',
  },
  globalTag: {
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '1px 5px',
    borderRadius: '3px',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    textTransform: 'uppercase',
  },
  levelBadge: {
    fontSize: '10px',
    color: '#aaa',
  },
  spacer: {
    flex: 1,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '0 4px',
    color: '#666',
  },
  message: {
    color: '#333',
    lineHeight: '1.6',
    wordBreak: 'break-word',
  },
  stack: {
    marginTop: '8px',
    padding: '10px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#666',
    overflowX: 'auto',
    border: '1px solid #e8e8e8',
    whiteSpace: 'pre-wrap',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
};
