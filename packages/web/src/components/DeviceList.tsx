import { useMemo } from 'react';
import { useDevices } from '../hooks/useDevices.js';
import { useI18n } from '../i18n/index.js';
import type { Device } from '../types/index.js';

interface DeviceListProps {
  projectId?: string;
  onSelectDevice?: (device: Device) => void;
  selectedDeviceId?: string;
}

/** Parse UA string to a short browser/OS label */
function parseUA(ua: string): { platform: string; browser: string; icon: string } {
  if (!ua || ua.startsWith('ingest/')) return { platform: '', browser: ua, icon: '📱' };
  const chrome = ua.match(/Chrome\/(\d+)/);
  const safari = ua.match(/Safari\/(\d+)/);
  const firefox = ua.match(/Firefox\/(\d+)/);
  const edge = ua.match(/Edg\/(\d+)/);
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua);

  const platform = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Macintosh/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown';

  const browser = edge ? `Edge ${edge[1]}`
    : chrome && !safari ? `Chrome ${chrome[1]}`
    : safari && !chrome ? 'Safari'
    : firefox ? `Firefox ${firefox[1]}`
    : 'Browser';

  const icon = /iPhone|iPad/.test(ua) ? '📱'
    : /Android/.test(ua) ? '📱'
    : mobile ? '📱'
    : /Macintosh/.test(ua) ? '💻'
    : '🖥️';

  return { platform, browser, icon };
}

/** Extract a readable page label from a URL like "https://example.com/some/path" */
function parsePageLabel(url: string | undefined): { pathname: string; origin: string } {
  if (!url) return { pathname: '/', origin: '' };
  try {
    const u = new URL(url);
    return { pathname: u.pathname || '/', origin: u.hostname };
  } catch {
    return { pathname: url, origin: '' };
  }
}

function formatTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m 前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h 前`;
  return new Date(ms).toLocaleString();
}

export function DeviceList({ projectId, onSelectDevice, selectedDeviceId }: DeviceListProps) {
  const { devices, loading, selectedId, setSelectedId } = useDevices(projectId);
  const { t } = useI18n();

  const handleSelect = (device: Device) => {
    setSelectedId(device.deviceId);
    onSelectDevice?.(device);
  };

  // Group devices by projectId
  const grouped = useMemo(() => {
    const map = new Map<string, Device[]>();
    for (const device of devices) {
      const key = device.projectId || 'default';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(device);
    }
    for (const [, list] of map) {
      list.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
    }
    return map;
  }, [devices]);

  const currentSelectedId = selectedDeviceId !== undefined ? selectedDeviceId : selectedId;
  const hasMultipleProjects = grouped.size > 1;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>📡</span>
        <span style={styles.headerTitle}>{t.deviceList.title}</span>
        <span style={styles.headerCount}>{devices.length}</span>
      </div>

      {/* Body */}
      {loading ? (
        <div style={styles.center}><span style={styles.loadingText}>Loading…</span></div>
      ) : devices.length === 0 ? (
        <div style={styles.center}>
          <span style={styles.emptyIcon}>🔌</span>
          <span style={styles.emptyText}>{t.deviceList.empty}</span>
          <span style={styles.emptyHint}>等待设备连接…</span>
        </div>
      ) : (
        <div style={styles.list}>
          {[...grouped.entries()].map(([pid, groupDevices]) => (
            <div key={pid}>
              {hasMultipleProjects && (
                <div style={styles.groupHeader}>
                  <span style={styles.groupDot} />
                  <span style={styles.groupName}>{pid}</span>
                  <span style={styles.groupBadge}>{groupDevices.length}</span>
                </div>
              )}
              {groupDevices.map((device) => {
                const isSelected = currentSelectedId === device.deviceId;
                const ua = parseUA(device.ua);
                const page = parsePageLabel(device.url);
                return (
                  <div
                    key={device.deviceId}
                    onClick={() => handleSelect(device)}
                    title={device.url || device.ua}
                    style={{
                      ...styles.card,
                      ...(isSelected ? styles.cardSelected : styles.cardDefault),
                    }}
                  >
                    {/* Device icon + status */}
                    <div style={styles.cardLeft}>
                      <div style={{
                        ...styles.deviceIconWrap,
                        backgroundColor: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.07)',
                      }}>
                        <span style={styles.deviceIconEmoji}>{ua.icon}</span>
                      </div>
                      <span style={{
                        ...styles.onlineDot,
                        backgroundColor: device.online ? '#10b981' : '#475569',
                        boxShadow: device.online ? '0 0 0 2px rgba(16,185,129,0.25)' : 'none',
                      }} />
                    </div>

                    {/* Info */}
                    <div style={styles.cardBody}>
                      {/* Primary: page path */}
                      <div style={styles.cardPlatform}>{page.pathname}</div>
                      {/* Secondary: hostname + browser */}
                      <div style={styles.cardBrowser}>
                        {page.origin ? `${page.origin} · ` : ''}{ua.browser}
                      </div>
                      <div style={styles.cardMeta}>
                        <span style={styles.metaChip}>{device.screen}</span>
                        <span style={styles.metaChip}>{device.language}</span>
                        {device.activeTabs > 1 && (
                          <span style={{ ...styles.metaChip, ...styles.metaChipBlue }}>
                            {device.activeTabs} tabs
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: time + status */}
                    <div style={styles.cardRight}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: device.online ? 'rgba(16,185,129,0.15)' : 'rgba(71,85,105,0.3)',
                        color: device.online ? '#10b981' : '#64748b',
                      }}>
                        {device.online ? t.common.online : t.common.offline}
                      </span>
                      <span style={styles.timeText}>{formatTime(device.connectTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 16px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  headerIcon: {
    fontSize: '13px',
  },
  headerTitle: {
    flex: 1,
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
  },
  headerCount: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: '1px 7px',
    borderRadius: '10px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '6px',
    padding: '24px',
  },
  loadingText: {
    fontSize: '13px',
    color: '#475569',
  },
  emptyIcon: {
    fontSize: '32px',
    opacity: 0.3,
    marginBottom: '4px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 500,
  },
  emptyHint: {
    fontSize: '11px',
    color: '#334155',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 10px 4px',
    marginTop: '4px',
  },
  groupDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    backgroundColor: '#475569',
    flexShrink: 0,
  },
  groupName: {
    flex: 1,
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  groupBadge: {
    fontSize: '10px',
    color: '#475569',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '1px 6px',
  },
  // ── Device Card ───────────────────────────────
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    border: '1px solid transparent',
  },
  cardDefault: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: 'rgba(99,102,241,0.35)',
  },
  cardLeft: {
    position: 'relative' as const,
    flexShrink: 0,
  },
  deviceIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  },
  deviceIconEmoji: {
    fontSize: '18px',
  },
  onlineDot: {
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    border: '2px solid #1e293b',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardPlatform: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e2e8f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    marginBottom: '2px',
  },
  cardBrowser: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '4px',
  },
  cardMeta: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const,
  },
  metaChip: {
    fontSize: '10px',
    color: '#475569',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: '1px 5px',
    borderRadius: '3px',
  },
  metaChipBlue: {
    color: '#818cf8',
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '4px',
    flexShrink: 0,
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '10px',
    whiteSpace: 'nowrap' as const,
  },
  timeText: {
    fontSize: '10px',
    color: '#334155',
  },
};

