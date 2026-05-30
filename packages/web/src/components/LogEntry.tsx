import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { ConsoleLog, SerializedValue } from '../types/index.js';
import { JsonTreeView } from './JsonTreeView.js';

/** Convert a CSS string like "color:red;font-weight:bold" to a React style object */
function parseCssStyle(css: string): CSSProperties {
  const style: Record<string, string> = {};
  css.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (!prop || !val) return;
    // Convert kebab-case to camelCase
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[camel] = val;
  });
  return style as CSSProperties;
}

interface LogEntryProps {
  log: ConsoleLog;
}

function isComplex(v: SerializedValue): boolean {
  return v.t === 'arr' || v.t === 'obj' || v.t === 'map' || v.t === 'set';
}

/** Render tableData as an HTML table */
function TableView({ data }: { data: Array<Record<string, unknown>> }) {
  if (!data.length) return <span style={{ color: '#999' }}>[]</span>;
  const columns = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
  return (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={tableStyles.th}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={i % 2 === 0 ? tableStyles.rowEven : tableStyles.rowOdd}>
              {columns.map((col) => (
                <td key={col} style={tableStyles.td}>
                  {row[col] === null ? 'null'
                    : row[col] === undefined ? ''
                    : typeof row[col] === 'object'
                    ? JSON.stringify(row[col])
                    : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LogEntry({ log }: LogEntryProps) {
  const [treeOpen, setTreeOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(log.level !== 'group-collapsed');
  const [copied, setCopied] = useState(false);
  const hasRichArgs = (log.serializedArgs ?? []).some(isComplex);

  const handleCopy = useCallback(() => {
    const text = log.stack ? `${log.message}\n${log.stack}` : log.message;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {/* ignore */});
  }, [log.message, log.stack]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLevelIcon = (level: ConsoleLog['level']) => {
    switch (level) {
      case 'error': return '🔴';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'repl-input': return '▶';
      case 'repl-output': return '←';
      case 'table': return '📊';
      case 'group': return groupOpen ? '▼' : '▶';
      case 'group-collapsed': return groupOpen ? '▼' : '▶';
      case 'group-end': return '└';
      case 'count': return '🔢';
      case 'time-log': return '⏱️';
      case 'assert': return '❌';
      default: return '📝';
    }
  };

  const getLevelColor = (level: ConsoleLog['level']) => {
    switch (level) {
      case 'error': return '#ff4d4f';
      case 'warn': return '#faad14';
      case 'info': return '#597ef7';
      case 'repl-input': return '#1890ff';
      case 'repl-output': return '#52c41a';
      case 'table': return '#13c2c2';
      case 'group':
      case 'group-collapsed': return '#722ed1';
      case 'group-end': return '#bfbfbf';
      case 'count': return '#eb2f96';
      case 'time-log': return '#fa8c16';
      case 'assert': return '#ff4d4f';
      default: return '#52c41a';
    }
  };

  const getLevelLabel = (level: ConsoleLog['level']): string => {
    switch (level) {
      case 'repl-input': return 'INPUT';
      case 'repl-output': return 'RESULT';
      case 'group': return 'GROUP';
      case 'group-collapsed': return 'GROUP';
      case 'group-end': return '';
      case 'time-log': return 'TIME';
      case 'count': return 'COUNT';
      case 'assert': return 'ASSERT';
      default: return level.toUpperCase();
    }
  };

  const isGlobalError =
    log.level === 'error' &&
    (log.message.startsWith('[Uncaught ') ||
      log.message.startsWith('[Unhandled Promise Rejection]') ||
      log.message.startsWith('[Resource Error]'));

  const isReplInput = log.level === 'repl-input';
  const isReplOutput = log.level === 'repl-output';
  const isGroup = log.level === 'group' || log.level === 'group-collapsed';
  const isGroupEnd = log.level === 'group-end';
  const isTable = log.level === 'table';

  const indentPx = (log.indent ?? 0) * 16;

  if (isGroupEnd) {
    return (
      <div style={{ ...styles.entry, borderLeftColor: getLevelColor(log.level), paddingTop: 4, paddingBottom: 4, paddingLeft: 16 + indentPx }}>
        <div style={{ color: '#bfbfbf', fontSize: 12 }}>▲ group end</div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.entry,
        borderLeftColor: getLevelColor(log.level),
        paddingLeft: 16 + indentPx,
        backgroundColor: isGlobalError
          ? '#fff2f0'
          : log.level === 'assert'
          ? '#fff2f0'
          : isReplInput
            ? '#e6f7ff'
            : isReplOutput
              ? '#f6ffed'
              : isGroup
                ? '#f9f0ff'
                : '#fff',
      }}
    >
      <div style={styles.header}>
        <span
          style={{ ...styles.icon, fontFamily: isReplInput || isReplOutput ? 'monospace' : undefined, cursor: isGroup ? 'pointer' : undefined }}
          onClick={isGroup ? () => setGroupOpen((o) => !o) : undefined}
        >
          {isGlobalError ? '💥' : getLevelIcon(log.level)}
        </span>
        <span style={styles.timestamp}>{formatTime(log.timestamp)}</span>
        {getLevelLabel(log.level) && (
          <span style={{ ...styles.levelTag, color: getLevelColor(log.level) }}>
            {getLevelLabel(log.level)}
          </span>
        )}
        {isGlobalError && <span style={styles.globalErrorTag}>GLOBAL</span>}
        <button
          title="复制日志"
          onClick={handleCopy}
          style={styles.copyBtn}
        >
          {copied ? '✅' : '📋'}
        </button>
      </div>
      {(!isGroup || groupOpen) && (
        <>
          {isTable && log.tableData ? (
            <TableView data={log.tableData} />
          ) : (
            <div style={{ ...styles.message, fontFamily: isReplInput || isReplOutput ? 'monospace' : undefined }}>
              {log.styledParts && log.styledParts.length > 0 ? (
                log.styledParts.map((part, i) => (
                  <span key={i} style={part.style ? parseCssStyle(part.style) : undefined}>
                    {part.text}
                  </span>
                ))
              ) : (
                log.message
              )}
            </div>
          )}
          {hasRichArgs && (
            <div style={styles.treeToggle} onClick={() => setTreeOpen((o) => !o)}>
              {treeOpen ? '▾' : '▸'} {treeOpen ? 'Collapse' : 'Expand objects'}
            </div>
          )}
          {hasRichArgs && treeOpen && (
            <div style={styles.treeWrap}>
              {(log.serializedArgs ?? []).map((arg, i) => (
                <JsonTreeView key={i} value={arg} depth={0} defaultExpanded={true} />
              ))}
            </div>
          )}
          {log.stack && (
            <details style={styles.stackDetails}>
              <summary style={styles.stackSummary}>查看堆栈</summary>
              <pre style={styles.stack}>{log.stack}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}

const tableStyles = {
  table: {
    borderCollapse: 'collapse' as const,
    fontSize: 12,
    width: '100%',
    fontFamily: 'monospace',
  },
  th: {
    border: '1px solid #d9d9d9',
    padding: '4px 8px',
    background: '#f5f5f5',
    fontWeight: 'bold' as const,
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    border: '1px solid #d9d9d9',
    padding: '3px 8px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: '#fafafa' },
};

const styles = {
  entry: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '12px 16px',
    borderBottom: '1px solid #f0f0f0',
    borderLeft: '4px solid #52c41a',
    backgroundColor: '#fff',
    fontFamily:
      '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.6',
    transition: 'background-color 0.15s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  icon: {
    fontSize: '14px',
  },
  timestamp: {
    color: '#999',
    fontSize: '12px',
    fontWeight: '500' as const,
  },
  levelTag: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    padding: '2px 8px',
    borderRadius: '3px',
    backgroundColor: 'transparent',
    border: '1px solid currentColor',
    textTransform: 'uppercase' as const,
  },
  message: {
    color: '#262626',
    wordBreak: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
    fontSize: '13px',
  },
  stackDetails: {
    marginTop: '8px',
  },
  stackSummary: {
    cursor: 'pointer',
    color: '#1890ff',
    fontSize: '12px',
    userSelect: 'none' as const,
    '&:hover': {
      color: '#40a9ff',
    },
  },
  globalErrorTag: {
    fontSize: '10px',
    fontWeight: 'bold' as const,
    padding: '1px 6px',
    borderRadius: '3px',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  stack: {
    margin: '8px 0 0 0',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    color: '#666',
    fontSize: '11px',
    overflowX: 'auto' as const,
    border: '1px solid #e8e8e8',
  },
  treeToggle: {
    marginTop: '4px',
    fontSize: '11px',
    color: '#1890ff',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  treeWrap: {
    marginTop: '6px',
    padding: '8px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    border: '1px solid #333',
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    marginLeft: 'auto',
    opacity: 0.5,
    padding: '0 2px',
  },
};

