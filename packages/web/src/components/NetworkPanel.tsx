import { CSSProperties, useState, useMemo, useCallback } from 'react';
import { api } from '../api/client.js';
import {
  CheckOutlined,
  CopyOutlined,
  GlobalOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Empty } from 'antd';
import { useNetworkRequests } from '../hooks/useNetworkRequests.js';
import { useI18n } from '../i18n/index.js';
import type { NetworkRequest } from '../types/index.js';

interface NetworkPanelProps {
  deviceId?: string;
  tabId?: string | null;
}

function statusColor(status?: number): string {
  if (!status) return 'var(--ant-color-text-secondary, #999)';
  if (status < 300) return '#52c41a';
  if (status < 400) return '#faad14';
  return '#ff4d4f';
}

function methodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#1890ff',
    POST: '#52c41a',
    PUT: '#faad14',
    DELETE: '#ff4d4f',
    PATCH: '#722ed1',
    OPTIONS: 'var(--ant-color-text-secondary, #999)',
    HEAD: 'var(--ant-color-text-secondary, #999)',
  };
  return colors[method.toUpperCase()] || 'var(--ant-color-text-secondary, #666)';
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function RequestDetail({ request, onClose }: { request: NetworkRequest; onClose: () => void }) {
  const [tab, setTab] = useState<'headers' | 'request' | 'response' | 'timing'>('headers');
  const [curlCopied, setCurlCopied] = useState(false);
  const { t } = useI18n();

  const handleResend = () => {
    if (request.type !== 'fetch' && request.type !== 'xhr') return;
    const method = request.method.toUpperCase();
    const init: RequestInit = {
      method,
      headers: request.requestHeaders,
    };
    if (method !== 'GET' && method !== 'HEAD' && request.requestBody) {
      init.body = request.requestBody;
    }
    fetch(request.url, init)
      .then((res) => res.text().then((body) => alert(`Resend ${res.status}:\n${body.slice(0, 300)}`)))
      .catch((e) => alert(`Resend failed: ${e}`));
  };

  const handleCopyCurl = useCallback(() => {
    const method = request.method.toUpperCase();
    const parts: string[] = [`curl -X ${method}`];
    if (request.requestHeaders) {
      for (const [k, v] of Object.entries(request.requestHeaders)) {
        parts.push(`  -H '${k}: ${String(v).replace(/'/g, "'\\''")}'`);
      }
    }
    if (method !== 'GET' && method !== 'HEAD' && request.requestBody) {
      const body = String(request.requestBody).replace(/'/g, "'\\''");
      parts.push(`  --data-raw '${body}'`);
    }
    parts.push(`  '${request.url}'`);
    const curl = parts.join(' \\\n');
    navigator.clipboard.writeText(curl).then(() => {
      setCurlCopied(true);
      setTimeout(() => setCurlCopied(false), 1500);
    }).catch(() => {/* ignore */});
  }, [request]);

  return (
    <div style={detailStyles.container}>
      <div style={detailStyles.header}>
        <span style={{ ...detailStyles.method, color: methodColor(request.method) }}>
          {request.method}
        </span>
        <span style={detailStyles.url} title={request.url}>
          {request.url}
        </span>
        {(request.type === 'fetch' || request.type === 'xhr') && (
          <button onClick={handleResend} style={detailStyles.resendBtn} title="Resend request">
            &#8617; 重发
          </button>
        )}
        {(request.type === 'fetch' || request.type === 'xhr') && (
          <button onClick={handleCopyCurl} style={detailStyles.resendBtn} title="Copy as cURL">
            {curlCopied
              ? <><CheckOutlined style={{ marginRight: 2 }} />cURL</>
              : <><CopyOutlined style={{ marginRight: 2 }} />cURL</>}
          </button>
        )}
        <button onClick={onClose} style={detailStyles.closeBtn}>
          &#10005;
        </button>
      </div>

      <div style={detailStyles.meta}>
        <span>
          {t.networkPanel.status}:{' '}
          <b style={{ color: statusColor(request.status) }}>{request.status || 'pending'}</b>
        </span>
        <span>
          {t.networkPanel.duration}: <b>{formatDuration(request.duration)}</b>
        </span>
        <span>
          Size: <b>{formatSize(request.responseSize)}</b>
        </span>
        <span>
          {t.networkPanel.type}: {request.type.toUpperCase()}
        </span>
        {request.error && (
          <span style={{ color: '#ff4d4f' }}>
            {t.common.error}: {request.error}
          </span>
        )}
      </div>

      {/* Timing phases breakdown */}
      {request.timingPhases && (
        <div style={detailStyles.timingBar}>
          {(['dns', 'tcp', 'ssl', 'request', 'response'] as const).map((phase) => {
            const ms = request.timingPhases?.[phase];
            if (!ms || ms <= 0) return null;
            const total = request.timingPhases?.total ?? request.duration ?? 1;
            const pct = Math.max(2, (ms / total) * 100);
            const colors: Record<string, string> = { dns: '#722ed1', tcp: '#1890ff', ssl: '#13c2c2', request: '#52c41a', response: '#fa8c16' };
            return (
              <span
                key={phase}
                title={`${phase}: ${ms.toFixed(1)}ms`}
                style={{ display: 'inline-block', width: `${pct}%`, backgroundColor: colors[phase], height: 8, borderRadius: 2, marginRight: 1 }}
              />
            );
          })}
          <div style={detailStyles.timingLegend}>
            {(['dns', 'tcp', 'ssl', 'request', 'response'] as const).map((phase) => {
              const ms = request.timingPhases?.[phase];
              if (!ms || ms <= 0) return null;
              const colors: Record<string, string> = { dns: '#722ed1', tcp: '#1890ff', ssl: '#13c2c2', request: '#52c41a', response: '#fa8c16' };
              return (
                <span key={phase} style={{ color: colors[phase], marginRight: 8, fontSize: 11 }}>
                  {phase}: {ms.toFixed(1)}ms
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div style={detailStyles.tabs}>
        {(['headers', 'request', 'response', 'timing'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            style={{
              ...detailStyles.tab,
              ...(tab === tabKey ? detailStyles.activeTab : {}),
            }}
          >
            {tabKey === 'headers'
              ? t.networkPanel.headers
              : tabKey === 'request'
                ? t.networkPanel.requestBody
                : tabKey === 'response'
                  ? t.networkPanel.responseBody
                  : 'Timing'}
          </button>
        ))}
      </div>

      <div style={detailStyles.body}>
        {tab === 'headers' && (
          <div>
            {request.requestHeaders && Object.keys(request.requestHeaders).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={detailStyles.sectionTitle}>Request Headers</div>
                {Object.entries(request.requestHeaders).map(([k, v]) => (
                  <div key={k} style={detailStyles.headerRow}>
                    <span style={detailStyles.headerKey}>{k}:</span> {v}
                  </div>
                ))}
              </div>
            )}
            {request.responseHeaders && Object.keys(request.responseHeaders).length > 0 && (
              <div>
                <div style={detailStyles.sectionTitle}>Response Headers</div>
                {Object.entries(request.responseHeaders).map(([k, v]) => (
                  <div key={k} style={detailStyles.headerRow}>
                    <span style={detailStyles.headerKey}>{k}:</span> {v}
                  </div>
                ))}
              </div>
            )}
            {!request.requestHeaders && !request.responseHeaders && (
              <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>{t.common.noData}</div>
            )}
          </div>
        )}
        {tab === 'request' && (
          <pre style={detailStyles.pre}>{request.requestBody || '(empty)'}</pre>
        )}
        {tab === 'response' && (
          <pre style={detailStyles.pre}>{request.responseBody || '(empty)'}</pre>
        )}
        {tab === 'timing' && (
          <div style={{ padding: 12, fontSize: 12 }}>
            {request.timingPhases ? (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--ant-color-border, #424242)' }}>阶段</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--ant-color-border, #424242)' }}>时间 (ms)</th>
                    <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--ant-color-border, #424242)' }}>占比</th>
                  </tr>
                </thead>
                <tbody>
                  {(['dns', 'tcp', 'ssl', 'request', 'response'] as const).map((phase) => {
                    const ms = request.timingPhases?.[phase];
                    if (ms === undefined) return null;
                    const total = request.timingPhases?.total ?? request.duration ?? 1;
                    const pct = total > 0 ? Math.min(100, (ms / total) * 100) : 0;
                    const colors: Record<string, string> = { dns: '#722ed1', tcp: '#1890ff', ssl: '#13c2c2', request: '#52c41a', response: '#fa8c16' };
                    const labels: Record<string, string> = { dns: 'DNS Lookup', tcp: 'TCP Connect', ssl: 'SSL/TLS', request: 'Request Sent', response: 'Content Download' };
                    return (
                      <tr key={phase}>
                        <td style={{ padding: '4px 8px', color: colors[phase] }}>{labels[phase]}</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: 'monospace' }}>{ms.toFixed(2)}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: colors[phase], borderRadius: 4 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {request.timingPhases.total !== undefined && (
                    <tr style={{ borderTop: '1px solid var(--ant-color-border, #424242)', fontWeight: 'bold' }}>
                      <td style={{ padding: '4px 8px' }}>Total</td>
                      <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: 'monospace' }}>{request.timingPhases.total.toFixed(2)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--ant-color-text-secondary)' }}>No timing data (PerformanceResourceTiming unavailable)</div>
            )}
            {request.initiator && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 6 }}>请求发起位置</div>
                <pre style={{ ...detailStyles.pre, fontSize: 11, maxHeight: 120 }}>{request.initiator}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── WebSocket grouped view ──────────────────────────────────────────────────

interface WsConnection {
  id: string;
  url: string;
  status: 'open' | 'closed' | 'error';
  openTime?: number;
  closeTime?: number;
  messageCount: number;
  frames: NetworkRequest[];
}

function WsFrameList({ frames }: { frames: NetworkRequest[] }) {
  const [selectedFrame, setSelectedFrame] = useState<NetworkRequest | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {frames.length === 0 && (
          <div style={{ padding: 20, color: 'var(--ant-color-text-secondary)', textAlign: 'center', fontSize: 12 }}>暂无消息帧</div>
        )}
        {frames.map((f) => {
          const isSend = f.wsDirection === 'send';
          const isEvent = f.wsEventType !== 'message';
          const body = f.wsEventType === 'message'
            ? (f.wsDirection === 'send' ? f.requestBody : f.responseBody) ?? ''
            : f.wsEventType ?? '';
          return (
            <div
              key={f.id}
              onClick={() => setSelectedFrame(selectedFrame?.id === f.id ? null : f)}
              style={{
                padding: '5px 10px',
                borderBottom: '1px solid var(--ant-color-border-secondary, #303030)',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                backgroundColor: selectedFrame?.id === f.id ? 'rgba(24,144,255,0.08)' : isEvent ? 'rgba(250,173,20,0.06)' : 'transparent',
              }}
            >
              <span style={{ color: isSend ? '#1890ff' : '#52c41a', fontWeight: 'bold', flexShrink: 0, width: 14 }}>
                {isEvent ? '●' : isSend ? '↑' : '↓'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: selectedFrame?.id === f.id ? 'pre-wrap' : 'nowrap', wordBreak: 'break-all', color: isEvent ? '#d48806' : 'var(--ant-color-text)' }}>
                {body || '(empty)'}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--ant-color-text-secondary)', fontSize: 11 }}>
                {f.timestamp ? new Date(f.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WsGroupView({ requests, searchText }: { requests: NetworkRequest[]; searchText: string }) {
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);

  const wsRequests = useMemo(
    () => requests.filter((r) => r.type === 'ws' && (!searchText || r.url.toLowerCase().includes(searchText.toLowerCase()))),
    [requests, searchText],
  );

  const connections = useMemo<WsConnection[]>(() => {
    const map = new Map<string, WsConnection>();
    for (const r of wsRequests) {
      const connId = r.wsConnectionId ?? r.id;
      if (!map.has(connId)) {
        map.set(connId, { id: connId, url: r.url, status: 'open', messageCount: 0, frames: [] });
      }
      const conn = map.get(connId)!;
      if (r.wsEventType === 'open') {
        conn.openTime = r.timestamp;
      } else if (r.wsEventType === 'close') {
        conn.status = 'closed';
        conn.closeTime = r.timestamp;
        conn.messageCount = r.messageCount ?? conn.messageCount;
        conn.frames.push(r);
      } else if (r.wsEventType === 'error') {
        conn.status = 'error';
        conn.frames.push(r);
      } else if (r.wsEventType === 'message') {
        conn.messageCount++;
        conn.frames.push(r);
      }
    }
    return Array.from(map.values());
  }, [wsRequests]);

  const selectedConn = connections.find((c) => c.id === selectedConnId) ?? null;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Connection list */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--ant-color-border, #424242)', overflow: 'auto' }}>
        {connections.length === 0 && (
          <div style={{ padding: 20, color: 'var(--ant-color-text-secondary)', textAlign: 'center', fontSize: 12 }}>暂无 WebSocket 连接</div>
        )}
        {connections.map((conn) => (
          <div
            key={conn.id}
            onClick={() => setSelectedConnId(conn.id === selectedConnId ? null : conn.id)}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--ant-color-border-secondary, #303030)',
              cursor: 'pointer',
              backgroundColor: selectedConnId === conn.id ? 'rgba(24,144,255,0.08)' : 'transparent',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                backgroundColor: conn.status === 'open' ? '#52c41a' : conn.status === 'error' ? '#ff4d4f' : '#bbb',
              }} />
              <span style={{ fontWeight: 'bold', color: 'var(--ant-color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(() => { try { return new URL(conn.url).pathname || '/'; } catch { return conn.url; } })()}
              </span>
            </div>
            <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 14 }}>
              {conn.url}
            </div>
            <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 11, paddingLeft: 14, marginTop: 2 }}>
              {conn.messageCount} 条消息 &middot; {conn.status}
              {conn.closeTime && conn.openTime ? ` · ${conn.closeTime - conn.openTime}ms` : ''}
            </div>
          </div>
        ))}
      </div>
      {/* Frame list */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selectedConn ? (
          <WsFrameList frames={selectedConn.frames} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
            选择一个连接查看消息帧
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main NetworkPanel ──────────────────────────────────────────────────────

export function NetworkPanel({ deviceId, tabId }: NetworkPanelProps) {
  const { requests, clearRequests, loading } = useNetworkRequests(deviceId, 500, tabId);
  const [selected, setSelected] = useState<NetworkRequest | null>(null);
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const { t } = useI18n();
  const [networkThrottle, setNetworkThrottle] = useState<string>('none');

  const handleNetworkThrottle = useCallback(async (preset: string) => {
    if (!deviceId) return;
    setNetworkThrottle(preset);
    try {
      await api.post(`/api/devices/${deviceId}/network-throttle`, { preset });
    } catch { /* ignore */ }
  }, [deviceId]);

  const isWsGroupMode = filterType === 'ws';

  const filteredRequests = useMemo(() => {
    if (isWsGroupMode) return requests; // WsGroupView handles its own filtering
    return requests.filter((req) => {
      if (filterMethod !== 'ALL' && req.method.toUpperCase() !== filterMethod) return false;
      if (filterType !== 'all' && req.type !== filterType) return false;
      if (filterStatus === 'success' && (req.status === undefined || req.status >= 400))
        return false;
      if (filterStatus === 'error' && req.status !== undefined && req.status < 400 && !req.error)
        return false;
      if (searchText && !req.url.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [requests, filterMethod, filterType, filterStatus, searchText, isWsGroupMode]);

  // Waterfall timing: compute scale based on all filtered requests
  const waterfallScale = useMemo(() => {
    const timed = filteredRequests.filter((r) => r.timestamp && r.duration);
    if (timed.length === 0) return null;
    const minTs = Math.min(...timed.map((r) => r.timestamp));
    const maxEnd = Math.max(...timed.map((r) => r.timestamp + (r.duration ?? 0)));
    const totalSpan = Math.max(maxEnd - minTs, 1);
    return { minTs, totalSpan };
  }, [filteredRequests]);

  if (!deviceId) {
    return (
      <Empty
        image={<GlobalOutlined style={{ fontSize: 48, color: '#bbb' }} />}
        description={t.common.selectDevice}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      />
    );
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t.networkPanel.searchPlaceholder}
          style={styles.searchInput}
        />
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          style={styles.select}
        >
          <option value="ALL">{t.networkPanel.allMethods}</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="WS">WS</option>
          <option value="SSE">SSE</option>
          <option value="BEACON">BEACON</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Types</option>
          <option value="fetch">fetch</option>
          <option value="xhr">xhr</option>
          <option value="ws">ws</option>
          <option value="sse">sse</option>
          <option value="beacon">beacon</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={styles.select}
        >
          <option value="all">{t.networkPanel.allStatus}</option>
          <option value="success">Success (&lt;400)</option>
          <option value="error">{t.networkPanel.errorOnly}</option>
        </select>
        <select
          value={networkThrottle}
          onChange={(e) => handleNetworkThrottle(e.target.value)}
          disabled={!deviceId}
          style={{
            ...styles.select,
            ...(networkThrottle !== 'none' ? { backgroundColor: 'rgba(250,173,20,0.1)', color: '#fa8c16' } : {}),
          }}
          title="网络节流"
        >
          <option value="none">正常</option>
          <option value="3g">3G</option>
          <option value="2g">2G</option>
          <option value="offline">离线</option>
        </select>
        <button onClick={clearRequests} style={styles.clearBtn} title={t.common.clear}>
          <DeleteOutlined />
        </button>
        <span style={styles.count}>{isWsGroupMode ? requests.filter(r => r.type === 'ws').length : filteredRequests.length}</span>
      </div>

      <div style={styles.body}>
        {isWsGroupMode ? (
          <WsGroupView requests={requests} searchText={searchText} />
        ) : (
          <>
            {/* Request List */}
            <div style={styles.list}>
              {loading && <div style={styles.loadingHint}>{t.common.loading}</div>}
              {!loading && filteredRequests.length === 0 && (
                <div style={styles.emptyHint}>{t.common.noData}</div>
              )}
              {filteredRequests.map((req) => {
                  // Compute waterfall bar position/width as percentages
                  let waterfallLeft = 0;
                  let waterfallWidth = 2;
                  if (waterfallScale && req.timestamp && req.duration) {
                    waterfallLeft = ((req.timestamp - waterfallScale.minTs) / waterfallScale.totalSpan) * 100;
                    waterfallWidth = Math.max(2, (req.duration / waterfallScale.totalSpan) * 100);
                    if (waterfallLeft + waterfallWidth > 100) waterfallWidth = 100 - waterfallLeft;
                  }
                  return (
                    <div
                      key={req.id}
                      onClick={() => setSelected(req)}
                      style={{
                        ...styles.row,
                        ...(selected?.id === req.id ? styles.rowSelected : {}),
                        ...(req.error ? styles.rowError : {}),
                      }}
                    >
                      <span style={{ ...styles.method, color: methodColor(req.method) }}>{req.method}</span>
                      <span style={{ ...styles.status, color: statusColor(req.status) }}>
                        {req.type === 'ws' && req.wsDirection === 'send' ? '↑' :
                         req.type === 'ws' && req.wsDirection === 'receive' ? '↓' :
                         req.type === 'sse' ? '⟶' :
                         req.status || '—'}
                      </span>
                      <span style={styles.url} title={req.url}>
                        {formatUrl(req.url)}
                      </span>
                      <span style={styles.size}>{formatSize(req.responseSize)}</span>
                      <span style={styles.duration}>{formatDuration(req.duration)}</span>
                      <span style={styles.type}>{req.type}</span>
                      {waterfallScale && (
                        <span style={styles.waterfall}>
                          <span
                            style={{
                              position: 'absolute',
                              left: `${waterfallLeft}%`,
                              width: `${waterfallWidth}%`,
                              top: '20%',
                              height: '60%',
                              backgroundColor: req.error ? '#ff4d4f' : statusColor(req.status),
                              borderRadius: '2px',
                              opacity: 0.75,
                            }}
                          />
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Detail Panel */}
            {selected && <RequestDetail request={selected} onClose={() => setSelected(null)} />}
          </>
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderBottom: '1px solid var(--ant-color-border, #424242)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    padding: '4px 8px',
    border: '1px solid var(--ant-color-border, #424242)',
    borderRadius: 4,
    fontSize: 12,
    minWidth: 120,
  },
  select: {
    padding: '4px 6px',
    border: '1px solid var(--ant-color-border, #424242)',
    borderRadius: 4,
    fontSize: 12,
    backgroundColor: 'var(--ant-color-bg-container, #1f1f1f)',
  },
  clearBtn: {
    padding: '4px 8px',
    border: '1px solid var(--ant-color-border, #424242)',
    borderRadius: 4,
    backgroundColor: 'var(--ant-color-bg-container, #1f1f1f)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'inline-flex',
    alignItems: 'center',
  },
  count: {
    fontSize: 11,
    color: 'var(--ant-color-text-secondary)',
    whiteSpace: 'nowrap',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    overflow: 'auto',
    minWidth: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderBottom: '1px solid var(--ant-color-border-secondary, #303030)',
    cursor: 'pointer',
    fontSize: 12,
    transition: 'background-color 0.15s',
  },
  rowSelected: {
    backgroundColor: 'rgba(24,144,255,0.08)',
  },
  rowError: {
    backgroundColor: 'rgba(255,77,79,0.08)',
  },
  method: {
    fontWeight: 'bold',
    fontSize: 11,
    width: 50,
    flexShrink: 0,
  },
  status: {
    width: 32,
    flexShrink: 0,
    fontWeight: 'bold',
    fontSize: 11,
  },
  url: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--ant-color-text)',
  },
  duration: {
    width: 56,
    flexShrink: 0,
    textAlign: 'right',
    color: 'var(--ant-color-text-secondary)',
    fontSize: 11,
  },
  size: {
    width: 52,
    flexShrink: 0,
    textAlign: 'right',
    color: 'var(--ant-color-text-secondary)',
    fontSize: 11,
  },
  type: {
    width: 36,
    flexShrink: 0,
    textAlign: 'right',
    color: 'var(--ant-color-text-secondary)',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  waterfall: {
    position: 'relative',
    flex: '0 0 80px',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  loadingHint: {
    padding: 20,
    textAlign: 'center',
    color: 'var(--ant-color-text-secondary)',
    fontSize: 13,
  },
  emptyHint: {
    padding: 40,
    textAlign: 'center',
    color: 'var(--ant-color-text-secondary)',
    fontSize: 13,
  },
};

const detailStyles: Record<string, CSSProperties> = {
  container: {
    width: 380,
    borderLeft: '1px solid var(--ant-color-border, #424242)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderBottom: '1px solid var(--ant-color-border, #424242)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  method: {
    fontWeight: 'bold',
    fontSize: 12,
    flexShrink: 0,
  },
  url: {
    flex: 1,
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--ant-color-text)',
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: 'var(--ant-color-text-secondary)',
    padding: '2px 6px',
  },
  resendBtn: {
    border: '1px solid #1890ff',
    background: 'rgba(24,144,255,0.08)',
    color: '#1890ff',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
  },
  meta: {
    display: 'flex',
    gap: 12,
    padding: '6px 12px',
    fontSize: 11,
    color: 'var(--ant-color-text-secondary)',
    borderBottom: '1px solid var(--ant-color-border-secondary, #303030)',
    flexWrap: 'wrap',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--ant-color-border, #424242)',
  },
  tab: {
    flex: 1,
    padding: '6px 8px',
    fontSize: 11,
    border: 'none',
    borderBottom: '2px solid transparent',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: 'var(--ant-color-text-secondary)',
  },
  activeTab: {
    color: '#1890ff',
    borderBottomColor: '#1890ff',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    fontSize: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 11,
    color: 'var(--ant-color-text)',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerRow: {
    fontSize: 11,
    lineHeight: 1.8,
    wordBreak: 'break-all',
  },
  headerKey: {
    color: '#722ed1',
    fontWeight: 500,
  },
  pre: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 8,
    borderRadius: 4,
    maxHeight: 400,
    overflow: 'auto',
  },
  timingBar: {
    padding: '6px 12px',
    borderBottom: '1px solid var(--ant-color-border-secondary, #303030)',
  },
  timingLegend: {
    marginTop: 4,
    fontSize: 11,
    color: 'var(--ant-color-text-secondary)',
    display: 'flex',
    flexWrap: 'wrap',
  },
};
