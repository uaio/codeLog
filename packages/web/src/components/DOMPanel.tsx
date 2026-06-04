import { CSSProperties, useState, useCallback, useEffect, useRef } from 'react';
import {
  Space,
  Button,
  Typography,
  Segmented,
  Spin,
  Empty,
  Descriptions,
  Input,
  Tooltip,
  Tag,
} from 'antd';
import {
  ReloadOutlined,
  AimOutlined,
  EyeOutlined,
  ApiOutlined,
  CodeOutlined,
  GlobalOutlined,
  CameraOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import { useDOM } from '../hooks/useDOM.js';
import { useI18n } from '../i18n/index.js';
import { api } from '../api/client.js';
import { websocketManager } from '../lib/websocketManager.js';
import type { DOMNode } from '../types/index.js';

const { Text } = Typography;

interface DOMPanelProps {
  deviceId?: string;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

// ─── Recursive search to check if a subtree contains a selector ───
function treeContainsSelector(node: DOMNode, target: string): boolean {
  if (buildSelector(node) === target) return true;
  if (node.children) {
    for (const child of node.children) {
      if (treeContainsSelector(child, target)) return true;
    }
  }
  return false;
}

interface DOMNodeViewProps {
  node: DOMNode;
  depth?: number;
  deviceId?: string;
  selectedSelector?: string;
  expandedPaths?: Set<string>;
  onSelect?: (selector: string) => void;
  onToggle?: (path: string) => void;
  parentPath?: string;
}

function buildSelector(node: DOMNode): string {
  if (node.id) return `#${node.id}`;
  if (node.className) {
    const first = node.className.trim().split(/\s+/)[0];
    return `${node.tag.toLowerCase()}.${first}`;
  }
  return node.tag.toLowerCase();
}

function buildPath(node: DOMNode, parentPath?: string, index?: number): string {
  const sel = buildSelector(node);
  return parentPath ? `${parentPath}/${sel}[${index ?? 0}]` : `/${sel}`;
}

function DOMNodeView({
  node,
  depth = 0,
  deviceId,
  selectedSelector,
  expandedPaths,
  onSelect,
  onToggle,
  parentPath,
}: DOMNodeViewProps) {
  const hasChildren = (node.children && node.children.length > 0) || (node.childCount ?? 0) > 0;
  const [hovered, setHovered] = useState(false);
  const [editingAttr, setEditingAttr] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const selector = buildSelector(node);
  const isSelected = selectedSelector === selector;
  const childIndex = parentPath ? parseInt(parentPath.match(/\[(\d+)\]$/)?.[1] ?? '0', 10) : 0;
  const path = buildPath(node, parentPath, childIndex);
  const isExpanded = expandedPaths?.has(path) ?? depth < 3;

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
      if (hasChildren) onToggle?.(path);
    },
    [selector, hasChildren, onSelect, onToggle, path],
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle?.(path);
    },
    [onToggle, path],
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
          <Input
            size="small"
            autoFocus
            value={editingVal}
            onChange={(e) => setEditingVal(e.target.value)}
            onBlur={commitAttrEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAttrEdit();
              if (e.key === 'Escape') cancelAttrEdit();
            }}
            style={{ width: 120, fontFamily: 'inherit', fontSize: 12, padding: '0 2px' }}
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
        {hasChildren && (
          <span style={nodeStyles.arrow} onClick={handleToggle}>
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
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
          <Tooltip title="在设备上高亮此元素">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={handleHighlight}
              style={nodeStyles.highlightBtn}
            />
          </Tooltip>
        )}

        {/* Collapsed hint */}
        {hasChildren && !isExpanded && (
          <span style={nodeStyles.collapsedHint}>
            …{node.childCount ?? node.children?.length ?? 0} children
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded &&
        node.children &&
        node.children.map((child, i) => (
          <DOMNodeView
            key={i}
            node={child}
            depth={depth + 1}
            deviceId={deviceId}
            selectedSelector={selectedSelector}
            expandedPaths={expandedPaths}
            onSelect={onSelect}
            onToggle={onToggle}
            parentPath={path}
          />
        ))}

      {/* Truncation notice */}
      {isExpanded && node.childCount && node.children && node.childCount > node.children.length && (
        <div style={{ marginLeft: 18, ...nodeStyles.truncated }}>
          … {node.childCount - node.children.length} more children not shown
        </div>
      )}

      {/* Closing tag for expanded parents */}
      {hasChildren && isExpanded && <div style={nodeStyles.closeTag}>&lt;/{node.tag}&gt;</div>}
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
  const [styleEntries, setStyleEntries] = useState<[string, string][] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selector) return;
    setLoading(true);
    setStyleEntries(null);

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const result = await api.getComputedStyles(deviceId);
      if (cancelled) return;
      if (result && result.selector === selector) {
        setStyleEntries(Object.entries(result.styles));
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
    <div style={css.panel}>
      <div style={css.header}>
        <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Computed Styles
        </Text>
        <Text code style={{ fontSize: 11, color: '#4ec9b0' }} ellipsis title={selector}>
          {selector}
        </Text>
      </div>
      <div style={css.body}>
        {loading && (
          <div style={{ padding: '20px 10px', textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        )}
        {!loading && !styleEntries && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No styles available"
            style={{ padding: '20px 0' }}
          />
        )}
        {styleEntries && (
          <Descriptions
            size="small"
            bordered
            column={1}
            style={css.table}
          >
            {styleEntries.map(([prop, val]) => (
              <Descriptions.Item
                key={prop}
                label={
                  <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#9cdcfe' }}>
                    {prop}
                  </Text>
                }
              >
                <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#ce9178', wordBreak: 'break-all' }}>
                  {val || '—'}
                </Text>
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───

export function DOMPanel({ deviceId }: DOMPanelProps) {
  const { snapshot, loading, refresh } = useDOM(deviceId);
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<'tree' | 'source'>('tree');
  const [selectedSelector, setSelectedSelector] = useState<string | undefined>(undefined);
  const [pickerActive, setPickerActive] = useState(false);

  // Expand/collapse state: set of node paths
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Default: expand first 3 levels
    const s = new Set<string>();
    return s;
  });

  // Resizable panel widths (preview / styles)
  const [previewWidth, setPreviewWidth] = useState(280);
  const [stylesWidth, setStylesWidth] = useState(280);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'preview' | 'styles' | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Screenshot for page preview
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Auto-capture preview when device connects or DOM refreshes
  const capturePreview = useCallback(async () => {
    if (!deviceId) return;
    setPreviewLoading(true);
    try {
      // Send correct message format that server handles
      websocketManager.send({
        type: 'take_screenshot',
        deviceId,
      });
    } catch {
      /* ignore */
    }
  }, [deviceId]);

  // Listen for screenshot response to use as preview
  useEffect(() => {
    if (!deviceId) return;
    const unsub = websocketManager.subscribe((msg: any) => {
      if (
        msg.type === 'event' &&
        msg.deviceId === deviceId &&
        msg.envelope?.type === 'screenshot' &&
        msg.envelope?.data?.dataUrl
      ) {
        setPreviewSrc(msg.envelope.data.dataUrl);
        setPreviewLoading(false);
      }
    });
    return unsub;
  }, [deviceId]);

  // Inject pulse animation keyframes for LIVE indicator and preview
  useEffect(() => {
    const id = 'dom-panel-pulse-anim';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes previewPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
        50% { box-shadow: 0 0 8px 2px rgba(82, 196, 26, 0.2); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  // Auto-refresh preview every 5 seconds when deviceId is present
  useEffect(() => {
    if (!deviceId) return;
    // Capture immediately
    capturePreview();
    // Then every 5 seconds
    const timer = setInterval(capturePreview, 5000);
    return () => clearInterval(timer);
  }, [deviceId, capturePreview]);

  // Listen for element_picked events from device
  useEffect(() => {
    if (!deviceId) return;
    const unsub = websocketManager.subscribe((msg: any) => {
      if (
        msg.type === 'event' &&
        msg.deviceId === deviceId &&
        msg.envelope?.type === 'element_picked'
      ) {
        const selector = msg.envelope.data?.selector;
        if (selector) setSelectedSelector(selector);
        setPickerActive(false);
      }
    });
    return unsub;
  }, [deviceId]);

  // Auto-expand ancestor nodes when selectedSelector changes
  useEffect(() => {
    if (!selectedSelector || !snapshot?.dom) return;
    const target = selectedSelector;
    const newExpanded = new Set(expandedPaths);

    // Recursively find and expand ancestors of the target selector
    function expandToTarget(node: DOMNode, parentPath: string | undefined, idx: number): boolean {
      const path = buildPath(node, parentPath, idx);
      const sel = buildSelector(node);

      if (sel === target) return true;

      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          if (treeContainsSelector(node.children[i], target)) {
            newExpanded.add(path);
            expandToTarget(node.children[i], path, i);
            return true;
          }
        }
      }
      return false;
    }

    expandToTarget(snapshot.dom, undefined, 0);
    setExpandedPaths(newExpanded);
    // Only run when selectedSelector changes, not when expandedPaths changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSelector, snapshot?.dom]);

  const startPicker = useCallback(() => {
    if (!deviceId) return;
    setPickerActive(true);
    websocketManager.send({ type: 'start_element_picker', deviceId });
  }, [deviceId]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // ─── Drag resize handlers ───
  const onDividerMouseDown = useCallback(
    (which: 'preview' | 'styles') => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = which;
      startXRef.current = e.clientX;
      startWidthRef.current = which === 'preview' ? previewWidth : stylesWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (draggingRef.current === 'preview') {
          const delta = ev.clientX - startXRef.current;
          setPreviewWidth(Math.max(120, Math.min(600, startWidthRef.current + delta)));
        } else if (draggingRef.current === 'styles') {
          const delta = startXRef.current - ev.clientX;
          setStylesWidth(Math.max(180, Math.min(500, startWidthRef.current + delta)));
        }
      };

      const onMouseUp = () => {
        draggingRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [previewWidth, stylesWidth],
  );

  // Initialize default expanded paths (first 3 levels) when snapshot changes
  useEffect(() => {
    if (!snapshot?.dom) return;
    const defaultExpanded = new Set<string>();

    function expandLevels(node: DOMNode, parentPath: string | undefined, idx: number, depth: number) {
      if (depth >= 3) return;
      const path = buildPath(node, parentPath, idx);
      if ((node.children && node.children.length > 0) || (node.childCount ?? 0) > 0) {
        defaultExpanded.add(path);
      }
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          expandLevels(node.children[i], path, i, depth + 1);
        }
      }
    }

    expandLevels(snapshot.dom, undefined, 0, 0);
    setExpandedPaths(defaultExpanded);
  }, [snapshot?.dom]);

  if (!deviceId) {
    return (
      <div style={styles.container}>
        <Empty
          image={<ApiOutlined style={{ fontSize: 48, opacity: 0.3 }} />}
          description={t.common.selectDevice}
          style={{ margin: 'auto' }}
        />
      </div>
    );
  }

  return (
    <div style={styles.container} ref={containerRef}>
      {/* Header */}
      <div style={styles.header}>
        <Text strong style={{ fontSize: 14 }}>
          Element
        </Text>
        <Space size="small">
          {snapshot && (
            <span style={styles.meta}>
              {snapshot.title && (
                <Text
                  type="secondary"
                  ellipsis
                  style={{ maxWidth: 200, fontSize: 12 }}
                >
                  {snapshot.title}
                </Text>
              )}
              <Text type="secondary" style={{ fontSize: 11, color: '#666' }}>
                · {formatTime(snapshot.timestamp)}
              </Text>
            </span>
          )}
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={refresh}
            loading={loading}
          >
            {t.common.refresh}
          </Button>
          {deviceId && (
            <Tooltip title="在设备上点击元素以选中">
              <Button
                size="small"
                type={pickerActive ? 'primary' : 'default'}
                icon={<AimOutlined />}
                onClick={startPicker}
              >
                {pickerActive ? '等待选择…' : '选取元素'}
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* URL bar */}
      {snapshot?.url && (
        <div style={styles.urlBar}>
          <Text style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>URL</Text>
          <Text style={{ fontSize: 11, color: '#9cdcfe', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {snapshot.url}
          </Text>
        </div>
      )}

      {/* View mode tabs */}
      <div style={styles.viewTabsWrap}>
        <Segmented
          size="small"
          value={viewMode}
          onChange={(val) => setViewMode(val as 'tree' | 'source')}
          options={[
            {
              label: (
                <Space size={4}>
                  <CodeOutlined />
                  Elements
                </Space>
              ),
              value: 'tree',
            },
            {
              label: (
                <Space size={4}>
                  <GlobalOutlined />
                  HTML Source
                </Space>
              ),
              value: 'source',
            },
          ]}
        />
      </div>

      {/* ─── Three-panel layout: Preview | Tree | Styles ─── */}
      <div style={styles.mainArea}>
        {/* LEFT: Page Preview panel */}
        <div style={{ ...css.panel, width: previewWidth, flexShrink: 0, borderRight: '1px solid #333' }}>
          <div style={css.header}>
            <Space size={4}>
              <ExpandOutlined style={{ fontSize: 12 }} />
              <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Page Preview
              </Text>
              <Tag color="success" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0, border: 'none' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#52c41a', display: 'inline-block', marginRight: 4, animation: 'pulse 2s infinite' }} />
                LIVE
              </Tag>
            </Space>
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, position: 'relative' }}>
            {previewLoading && previewSrc && (
              <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                <Spin size="small" />
              </div>
            )}
            {previewSrc ? (
              <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={previewSrc}
                  alt="Page preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: 4,
                    border: previewLoading ? '1px solid rgba(82, 196, 26, 0.6)' : '1px solid #333',
                    animation: previewLoading ? 'previewPulse 1.5s ease-in-out infinite' : 'none',
                  }}
                />
              </div>
            ) : (
              <Empty
                image={<CameraOutlined style={{ fontSize: 32, opacity: 0.3 }} />}
                description="正在获取页面预览…"
                style={{ margin: 'auto' }}
              />
            )}
          </div>
        </div>

        {/* Draggable divider: preview ↔ tree */}
        <div
          style={css.divider}
          onMouseDown={onDividerMouseDown('preview')}
        />

        {/* CENTER: DOM Tree */}
        <div style={styles.tree}>
          {loading && (
            <div style={styles.loadingWrap}>
              <Spin tip={t.common.loading} />
            </div>
          )}
          {!loading && !snapshot && (
            <Empty
              image={<ApiOutlined style={{ fontSize: 32, opacity: 0.5 }} />}
              description={t.domPanel.waitingHint}
              style={{ padding: '60px 20px' }}
            />
          )}
          {!loading && snapshot && viewMode === 'tree' && (
            <DOMNodeView
              node={snapshot.dom}
              depth={0}
              deviceId={deviceId}
              selectedSelector={selectedSelector}
              expandedPaths={expandedPaths}
              onSelect={setSelectedSelector}
              onToggle={handleToggle}
            />
          )}
          {!loading && snapshot && viewMode === 'source' && (
            <pre style={styles.htmlSource}>
              {snapshot.htmlSnapshot ?? '(HTML snapshot not available — upgrade SDK)'}
            </pre>
          )}
        </div>

        {/* Draggable divider: tree ↔ styles */}
        {viewMode === 'tree' && selectedSelector && deviceId && (
          <div
            style={css.divider}
            onMouseDown={onDividerMouseDown('styles')}
          />
        )}

        {/* RIGHT: Computed Styles panel */}
        {viewMode === 'tree' && selectedSelector && deviceId && (
          <div style={{ ...css.panel, width: stylesWidth }}>
            <ComputedStylesPanel deviceId={deviceId} selector={selectedSelector} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───

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
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  urlBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 16px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  viewTabsWrap: {
    padding: '6px 16px',
    borderBottom: '1px solid #333',
    backgroundColor: '#252526',
    flexShrink: 0,
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
    minWidth: 0,
  },
  loadingWrap: {
    padding: '40px',
    textAlign: 'center',
  },
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
  arrow: { color: '#888', width: '14px', flexShrink: 0, fontSize: '10px', userSelect: 'none', cursor: 'pointer' },
  arrowPlaceholder: { width: '14px', flexShrink: 0, display: 'inline-block' },
  tag: { color: '#4ec9b0' },
  attr: { color: '#9cdcfe' },
  attrVal: { color: '#ce9178' },
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
    marginLeft: '6px',
    padding: 0,
    minHeight: 'auto',
    lineHeight: 1,
    fontSize: 11,
    opacity: 0.7,
    flexShrink: 0,
  },
};

const css: Record<string, CSSProperties> = {
  panel: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e1e1e',
    overflow: 'hidden',
  },
  header: {
    padding: '6px 10px',
    borderBottom: '1px solid #2d2d2d',
    backgroundColor: '#252526',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  table: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  divider: {
    width: 5,
    cursor: 'col-resize',
    backgroundColor: '#333',
    flexShrink: 0,
    transition: 'background-color 0.15s',
    zIndex: 10,
  },
};
