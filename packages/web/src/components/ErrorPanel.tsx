import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import {
  BugOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { Empty } from 'antd';
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
        <span style={{ color: severityColor(log), fontSize: '16px', display: 'inline-flex', alignItems: 'center' }}>
          {isGlobal ? <CloseCircleOutlined /> : <CloseCircleOutlined />}
        </span>
        <span style={styles.time}>{formatTime(log.timestamp)}</span>
        {isGlobal && <span style={styles.globalTag}>GLOBAL</span>}
        <span style={styles.levelBadge}>
          {log.level.toUpperCase()}
        </span>
        <div style={styles.spacer} />
        <button style={styles.iconBtn} title="复制" onClick={handleCopy}>
          {copied
            ? <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} />
            : <CopyOutlined style={{ fontSize: 12 }} />}
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
        <Empty
          image={<BugOutlined style={{ fontSize: 48, color: '#bbb' }} />}
          description="从左侧选择设备查看错误"
          style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        />
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
              {f === 'all'
                ? `全部 (${errorCount + warnCount})`
                : f === 'error'
                  ? <><CloseCircleOutlined style={{ marginRight: 4, color: '#ff4d4f' }} />错误 ({errorCount})</>
                  : <><WarningOutlined style={{ marginRight: 4, color: '#faad14' }} />警告 ({warnCount})</>}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.body}>
        {errors.length === 0 ? (
          <Empty
            image={<CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />}
            description="暂无错误"
            style={{ padding: '60px 20px' }}
          />
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
    backgroundColor: 'var(--ant-color-bg-container, #1f1f1f)',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--ant-color-border, #424242)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'var(--ant-color-text)',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
  },
  filterBtn: {
    padding: '3px 12px',
    fontSize: '12px',
    border: '1px solid var(--ant-color-border, #424242)',
    borderRadius: '4px',
    backgroundColor: 'var(--ant-color-bg-container, #1f1f1f)',
    cursor: 'pointer',
    color: 'var(--ant-color-text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
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
    borderBottom: '1px solid var(--ant-color-border-secondary, #303030)',
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
    color: 'var(--ant-color-text-secondary)',
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
    color: 'var(--ant-color-text-secondary)',
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
    color: 'var(--ant-color-text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
  },
  message: {
    color: 'var(--ant-color-text)',
    lineHeight: '1.6',
    wordBreak: 'break-word',
  },
  stack: {
    marginTop: '8px',
    padding: '10px',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    fontSize: '11px',
    color: 'var(--ant-color-text-secondary)',
    overflowX: 'auto',
    border: '1px solid var(--ant-color-border, #424242)',
    whiteSpace: 'pre-wrap',
  },
};
