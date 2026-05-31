import { CSSProperties, useState, useCallback, useEffect } from 'react';
import { useDOM } from '../hooks/useDOM.js';
import { useI18n } from '../i18n/index.js';
import { api } from '../api/client.js';
import type { DOMNode } from '../types/index.js';

interface DOMPanelProps {
  deviceId?: string;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

interface DOMNodeViewProps {
  node: DOMNode;
  depth?: number;
  deviceId?: string;
  selectedSelector?: string;
  onSelect?: (selector: string) => void;
}

function buildSelector(node: DOMNode): string {
  if (node.id) return `#${node.id}`;
  if (node.className) {
    const first = node.className.trim().split(/\s+/)[0];
    return `${node.tag.toLowerCase()}.${first}`;
  }
  return node.tag.toLowerCase();
}

function DOMNodeView({ node, depth = 0, deviceId, selectedSelector, onSelect }: DOMNodeViewProps) {
  const hasChildren = (node.children && node.children.length > 0) || (node.childCount ?? 0) > 0;
  const [expanded, setExpanded] = useState(depth < 3);
  const [hovered, setHovered] = useState(false);
  const [editingAttr, setEditingAttr] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const selector = buildSelector(node);
  const isSelected = selectedSelector === selector;

  const indent = depth * 14;

  const handleHighlight = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!deviceId) return;
      try {
        await api.post(`/api/devices/${deviceId}/highlight`, { selector, duration: 3000 });
      } catch {
        /* ignore */
      }
    },
    [deviceId, selector],
  );

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.(selector);
      if (hasChildren) setExpanded((v) => !v);
    },
    [selector, hasChildren, onSelect],
  );

  const startEditAttr = useCallback((e: React.MouseEvent, attrName: string, currentVal: string) => {
    e.stopPropagation();
    setEditingAttr(attrName);
    setEditingVal(currentVal);
  }, []);

  const commitAttrEdit = useCallback(async () => {
    if (!deviceId || !editingAttr) return;
    try {
      await api.setElementAttr(deviceId, selector, editingAttr, editingVal);
    } catch {
      /* ignore */
    }
    setEditingAttr(null);
  }, [deviceId, selector, editingAttr, editingVal]);

  const cancelAttrEdit = useCallback(() => {
    setEditingAttr(null);
  }, []);

  /** Render a single attribute — double-click to edit inline */
  const renderAttr = (attrName: string, attrVal: string, color: string) => {
    if (editingAttr === attrName) {
      return (
        <span key={attrName} style={{ color }} onClick={(e) => e.stopPropagation()}>
          {' '}{attrName}=&quot;
          <input
            autoFocus
            value={editingVal}
            onChange={(e) => setEditingVal(e.target.value)}
            onBlur={commitAttrEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAttrEdit();
              if (e.key === 'Escape') cancelAttrEdit();
            }}
            style={nodeStyles.attrInput}
          />
          &quot;
        </span>
      );
    }
    return (
      <span
        key={attrName}
        style={{ ...nodeStyles.attr, color }}
        onDoubleClick={(e) => startEditAttr(e, attrName, attrVal)}
        title="双击编辑"
      >
        {' '}{attrName}=<span style={nodeStyles.attrVal}>"{attrVal.slice(0, 40)}"</span>
      </span>
    );
  };

  return (
    <div style={{ marginLeft: indent }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Opening tag */}
      <div
        style={{
          ...nodeStyles.row,
          cursor: 'pointer',
          backgroundColor: isSelected
            ? 'rgba(0,122,204,0.25)'
            : hovered
              ? 'rgba(0,120,212,0.06)'
              : undefined,
          borderRadius: '3px',
        }}
        onClick={handleSelect}
      >
        {hasChildren && <span style={nodeStyles.arrow}>{expanded ? '▾' : '▸'}</span>}
        {!hasChildren && <span style={nodeStyles.arrowPlaceholder} />}

        <span style={nodeStyles.tag}>&lt;{node.tag}</span>
        {node.id && renderAttr('id', node.id, '#ce9178')}
        {node.className && renderAttr('class', node.className, '#ce9178')}
        {node.attrs &&
          Object.entries(node.attrs).map(([k, v]) => renderAttr(k, v, '#9cdcfe'))}
        <span style={nodeStyles.tag}>&gt;</span>

        {/* Inline text for leaf nodes */}
        {node.text && !hasChildren && (
          <span style={nodeStyles.text}> {node.text.slice(0, 80)}</span>
        )}

        {/* Action buttons (shown on hover) */}
        {hovered && deviceId && (
          <button
            title="在设备上高亮此元素"
            onClick={handleHighlight}
            style={nodeStyles.highlightBtn}
          >
            🔍
          </button>
        )}

        {/* Collapsed hint */}
        {hasChildren && !expanded && (
          <span style={nodeStyles.collapsedHint}>
            …{node.childCount ?? node.children?.length ?? 0} children
          </span>
        )}
      </div>

      {/* Children */}
      {expanded &&
        node.children &&
        node.children.map((child, i) => (
          <DOMNodeView
            key={i}
            node={child}
            depth={depth + 1}
            deviceId={deviceId}
            selectedSelector={selectedSelector}
            onSelect={onSelect}
          />
        ))}

      {/* Truncation notice */}
      {expanded && node.childCount && node.children && node.childCount > node.children.length && (
        <div style={{ marginLeft: 18, ...nodeStyles.truncated }}>
          … {node.childCount - node.children.length} more children not shown
        </div>
      )}

      {/* Closing tag for expanded parents */}
      {hasChildren && expanded && <div style={nodeStyles.closeTag}>&lt;/{node.tag}&gt;</div>}
    </div>
  );
}

/** Right-side computed styles panel */
function ComputedStylesPanel({
  deviceId,
  selector,
}: {
  deviceId: string;
  selector: string;
}) {
  const [styles, setStyles] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selector) return;
    setLoading(true);
    setStyles(null);

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const result = await api.getComputedStyles(deviceId);
      if (cancelled) return;
      if (result && result.selector === selector) {
        setStyles(result.styles);
        setLoading(false);
        return;
      }
      pollTimer = setTimeout(poll, 300);
    };

    api.requestComputedStyles(deviceId, selector).then(() => {
      if (!cancelled) pollTimer = setTimeout(poll, 200);
    });

    // Timeout after 5s
    const timeout = setTimeout(() => {
      cancelled = true;
      clearTimeout(pollTimer);
      setLoading(false);
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
      clearTimeout(timeout);
    };
  }, [deviceId, selector]);

  if (!selector) return null;

  return (
    <div style={computedStyles.panel}>
      <div style={computedStyles.header}>
        <span style={computedStyles.title}>Computed Styles</span>
        <span style={computedStyles.selectorLabel} title={selector}>
          {selector}
        </span>
      </div>
      <div style={computedStyles.body}>
        {loading && <div style={computedStyles.loading}>⏳ Loading…</div>}
        {!loading && !styles && (
          <div style={computedStyles.empty}>No styles available</div>
        )}
        {styles && (
          <table style={computedStyles.table}>
            <tbody>
              {Object.entries(styles).map(([prop, val]) => (
                <tr key={prop} style={computedStyles.row}>
                  <td style={computedStyles.propCell}>{prop}</td>
                  <td style={computedStyles.valCell}>{val || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function DOMPanel({ deviceId }: DOMPanelProps) {
  const { snapshot, loading, refresh } = useDOM(deviceId);
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<'tree' | 'source'>('tree');
  const [selectedSelector, setSelectedSelector] = useState<string | undefined>(undefined);

  if (!deviceId) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <div style={styles.placeholderIcon}>🌲</div>
          <div style={styles.placeholderText}>{t.common.selectDevice}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Element</h3>
        <div style={styles.headerRight}>
          {snapshot && (
            <span style={styles.meta}>
              {snapshot.title && <span style={styles.pageTitle}>{snapshot.title}</span>}
              <span style={styles.updateTime}>· {formatTime(snapshot.timestamp)}</span>
            </span>
          )}
          <button
            style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
            onClick={refresh}
            disabled={loading}
          >
            🔄 {t.common.refresh}
          </button>
        </div>
      </div>

      {/* URL bar */}
      {snapshot?.url && (
        <div style={styles.urlBar}>
          <span style={styles.urlLabel}>URL</span>
          <span style={styles.urlValue}>{snapshot.url}</span>
        </div>
      )}

      {/* View mode tabs */}
      <div style={styles.viewTabs}>
        <button
          style={{ ...styles.viewTab, ...(viewMode === 'tree' ? styles.viewTabActive : {}) }}
          onClick={() => setViewMode('tree')}
        >
          🌲 Elements
        </button>
        <button
          style={{ ...styles.viewTab, ...(viewMode === 'source' ? styles.viewTabActive : {}) }}
          onClick={() => setViewMode('source')}
        >
          {'</>'}  HTML Source
        </button>
      </div>

      {/* DOM Tree + Computed Styles side by side */}
      <div style={styles.mainArea}>
        <div style={styles.tree}>
          {loading && <div style={styles.loadingWrap}>⏳ {t.common.loading}</div>}
          {!loading && !snapshot && (
            <div style={styles.emptyWrap}>
              <span style={styles.emptyIcon}>📡</span>
              <span>{t.domPanel.waitingHint}</span>
            </div>
          )}
          {!loading && snapshot && viewMode === 'tree' && (
            <DOMNodeView
              node={snapshot.dom}
              depth={0}
              deviceId={deviceId}
              selectedSelector={selectedSelector}
              onSelect={setSelectedSelector}
            />
          )}
          {!loading && snapshot && viewMode === 'source' && (
            <pre style={styles.htmlSource}>
              {snapshot.htmlSnapshot ?? '(HTML snapshot not available — upgrade SDK)'}
            </pre>
          )}
        </div>

        {/* Computed Styles panel — visible when a node is selected */}
        {viewMode === 'tree' && selectedSelector && deviceId && (
          <ComputedStylesPanel deviceId={deviceId} selector={selectedSelector} />
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
    backgroundColor: '#1e1e1e',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid #333',
    backgroundColor: '#252526',
    flexShrink: 0,
  },
  title: { margin: 0, fontSize: '14px', fontWeight: 600, color: '#ccc' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  meta: { display: 'flex', alignItems: 'center', gap: '6px' },
  pageTitle: {
    fontSize: '12px',
    color: '#888',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  updateTime: { fontSize: '11px', color: '#666' },
  btn: {
    padding: '4px 10px',
    fontSize: '12px',
    border: '1px solid #555',
    borderRadius: '4px',
    backgroundColor: '#333',
    cursor: 'pointer',
    color: '#ccc',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  urlBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 16px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  urlLabel: { fontSize: '11px', color: '#666', fontFamily: 'monospace' },
  urlValue: { fontSize: '11px', color: '#9cdcfe', fontFamily: 'monospace', wordBreak: 'break-all' },
  viewTabs: {
    display: 'flex',
    borderBottom: '1px solid #333',
    backgroundColor: '#252526',
    flexShrink: 0,
  },
  viewTab: {
    padding: '6px 14px',
    fontSize: '12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  viewTabActive: {
    color: '#ccc',
    borderBottom: '2px solid #007acc',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  htmlSource: {
    margin: 0,
    padding: '8px',
    color: '#ce9178',
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
    fontSize: '11px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflow: 'auto',
  },
  tree: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 8px',
    fontFamily: '"SF Mono", Monaco, "Cascadia Code", Consolas, monospace',
    fontSize: '12px',
  },
  loadingWrap: { padding: '40px', color: '#666', textAlign: 'center' },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: '#555',
    gap: '10px',
    fontSize: '13px',
  },
  emptyIcon: { fontSize: '32px', opacity: 0.5 },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#555',
    gap: '12px',
  },
  placeholderIcon: { fontSize: '48px', opacity: 0.3 },
  placeholderText: { fontSize: '14px' },
};

const nodeStyles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'baseline',
    padding: '1px 0',
    lineHeight: '1.7',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  arrow: { color: '#888', width: '14px', flexShrink: 0, fontSize: '10px', userSelect: 'none' },
  arrowPlaceholder: { width: '14px', flexShrink: 0, display: 'inline-block' },
  tag: { color: '#4ec9b0' },
  attr: { color: '#9cdcfe' },
  attrVal: { color: '#ce9178' },
  attrInput: {
    background: '#2d2d2d',
    border: '1px solid #007acc',
    borderRadius: '2px',
    color: '#ce9178',
    fontSize: '12px',
    padding: '0 2px',
    outline: 'none',
    width: '120px',
    fontFamily: 'inherit',
  },
  text: {
    color: '#d4d4d4',
    fontSize: '11px',
    marginLeft: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  collapsedHint: { color: '#666', fontSize: '11px', marginLeft: '8px', fontStyle: 'italic' },
  truncated: { color: '#666', fontSize: '11px', fontStyle: 'italic', padding: '2px 0' },
  closeTag: { color: '#4ec9b0', paddingLeft: 0 },
  highlightBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    marginLeft: '6px',
    padding: '0 3px',
    opacity: 0.7,
    flexShrink: 0,
  },
};

const computedStyles: Record<string, CSSProperties> = {
  panel: {
    width: '280px',
    flexShrink: 0,
    borderLeft: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e1e1e',
  },
  header: {
    padding: '6px 10px',
    borderBottom: '1px solid #2d2d2d',
    backgroundColor: '#252526',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flexShrink: 0,
  },
  title: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#ccc',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  selectorLabel: {
    fontSize: '11px',
    color: '#4ec9b0',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  loading: {
    padding: '20px 10px',
    color: '#666',
    fontSize: '12px',
    textAlign: 'center',
  },
  empty: {
    padding: '20px 10px',
    color: '#555',
    fontSize: '12px',
    textAlign: 'center',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  row: {
    borderBottom: '1px solid #2a2a2a',
  },
  propCell: {
    padding: '3px 10px',
    color: '#9cdcfe',
    verticalAlign: 'top',
    width: '45%',
    whiteSpace: 'nowrap',
  },
  valCell: {
    padding: '3px 10px',
    color: '#ce9178',
    verticalAlign: 'top',
    wordBreak: 'break-all',
  },
};
