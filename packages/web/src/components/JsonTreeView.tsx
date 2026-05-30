import { CSSProperties, useState } from 'react';
import type { SerializedValue } from '../types/index.js';

interface JsonTreeViewProps {
  value: SerializedValue;
  depth?: number;
  label?: string;
  defaultExpanded?: boolean;
}

export function JsonTreeView({ value, depth = 0, label, defaultExpanded = false }: JsonTreeViewProps) {
  const [expanded, setExpanded] = useState(depth < 2 || defaultExpanded);
  const indent = depth * 14;

  const renderInline = (): { text: string; color: string } => {
    switch (value.t) {
      case 'null': return { text: 'null', color: '#808080' };
      case 'undefined': return { text: 'undefined', color: '#808080' };
      case 'str': return { text: `"${value.v}"`, color: '#ce9178' };
      case 'num': return { text: String(value.v), color: '#b5cea8' };
      case 'bool': return { text: String(value.v), color: '#569cd6' };
      case 'bigint': return { text: `${value.v}n`, color: '#b5cea8' };
      case 'sym': return { text: value.v, color: '#808080' };
      case 'fn': return { text: `ƒ ${value.name}()`, color: '#dcdcaa' };
      case 'regexp': return { text: `/${value.src}/${value.flags}`, color: '#d16969' };
      case 'date': return { text: value.iso, color: '#4ec9b0' };
      case 'err': return { text: `${value.name}: ${value.msg}`, color: '#f48771' };
      case 'circ': return { text: '[Circular]', color: '#808080' };
      case 'arr': return { text: `Array(${value.len})`, color: '#9cdcfe' };
      case 'obj': return { text: value.tag === 'Object' ? '{…}' : `${value.tag} {…}`, color: '#9cdcfe' };
      case 'map': return { text: `Map(${value.size})`, color: '#9cdcfe' };
      case 'set': return { text: `Set(${value.size})`, color: '#9cdcfe' };
      default: return { text: '?', color: '#808080' };
    }
  };

  const isExpandable = value.t === 'arr' || value.t === 'obj' || value.t === 'map' || value.t === 'set';
  const { text, color } = renderInline();

  const labelEl = label != null ? <span style={s.label}>{label}: </span> : null;

  if (!isExpandable) {
    return (
      <div style={{ ...s.row, marginLeft: indent }}>
        <span style={s.placeholder} />
        {labelEl}
        <span style={{ ...s.value, color }}>{text}</span>
      </div>
    );
  }

  const entries: Array<{ key: string; val: SerializedValue }> = (() => {
    if (value.t === 'arr') return value.items.map((v, i) => ({ key: String(i), val: v }));
    if (value.t === 'obj') return value.props.map(([k, v]) => ({ key: k, val: v }));
    if (value.t === 'map') return value.entries.map(([k, v], i) => ({ key: `[${i}]`, val: { t: 'arr' as const, items: [k, v], len: 2 } }));
    if (value.t === 'set') return value.values.map((v, i) => ({ key: String(i), val: v }));
    return [];
  })();

  const hasMore = (value.t === 'arr' || value.t === 'obj') && value.more;

  return (
    <div style={{ marginLeft: indent }}>
      <div style={s.row} onClick={() => setExpanded((e) => !e)}>
        <span style={s.arrow}>{expanded ? '▾' : '▸'}</span>
        {labelEl}
        <span style={{ ...s.value, color }}>{text}</span>
      </div>
      {expanded && (
        <div>
          {entries.map(({ key, val }) => (
            <JsonTreeView key={key} value={val} depth={depth + 1} label={key} />
          ))}
          {hasMore && (
            <div style={{ ...s.row, marginLeft: (depth + 1) * 14 }}>
              <span style={s.placeholder} />
              <span style={s.moreHint}>… more properties</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'baseline',
    padding: '1px 0',
    lineHeight: '1.6',
    cursor: 'default',
    userSelect: 'text',
    fontSize: '12px',
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
  },
  arrow: {
    color: '#888',
    width: '14px',
    flexShrink: 0,
    fontSize: '10px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  placeholder: {
    width: '14px',
    flexShrink: 0,
    display: 'inline-block',
  },
  label: {
    color: '#9cdcfe',
    marginRight: '2px',
    flexShrink: 0,
  },
  value: {
    wordBreak: 'break-all',
  },
  moreHint: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: '11px',
  },
};
