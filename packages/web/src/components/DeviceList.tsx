import { useMemo } from 'react';
import { List, Badge, Typography, Tag, Tooltip, Space, Spin, Empty, Flex } from 'antd';
import {
  ApiOutlined,
  MobileOutlined,
  LaptopOutlined,
  DesktopOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { useDevices } from '../hooks/useDevices.js';
import { useI18n } from '../i18n/index.js';
import type { Device } from '../types/index.js';

const { Text } = Typography;

interface DeviceListProps {
  projectId?: string;
  onSelectDevice?: (device: Device) => void;
  selectedDeviceId?: string;
}

/** Parse UA string to a short browser/OS label */
function parseUA(ua: string): { platform: string; browser: string; icon: React.ReactNode } {
  if (!ua || ua.startsWith('ingest/')) return { platform: '', browser: ua, icon: <MobileOutlined /> };
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

  const icon = /iPhone|iPad/.test(ua) ? <MobileOutlined />
    : /Android/.test(ua) ? <MobileOutlined />
    : mobile ? <MobileOutlined />
    : /Macintosh/.test(ua) ? <LaptopOutlined />
    : <DesktopOutlined />;

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Flex align="center" gap={8} style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <ApiOutlined style={{ fontSize: 13 }} />
        <Text strong style={{ flex: 1, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#94a3b8' }}>
          {t.deviceList.title}
        </Text>
        <Tag>{devices.length}</Tag>
      </Flex>

      {/* Body */}
      {loading ? (
        <Flex vertical align="center" justify="center" flex={1}>
          <Spin />
        </Flex>
      ) : devices.length === 0 ? (
        <Flex vertical align="center" justify="center" flex={1} gap={6} style={{ padding: 24 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Flex vertical align="center" gap={4}>
                <Text type="secondary">{t.deviceList.empty}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>等待设备连接…</Text>
              </Flex>
            }
          />
        </Flex>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          <List
            split={false}
            dataSource={[...grouped.entries()]}
            renderItem={([pid, groupDevices]) => (
              <>
                {hasMultipleProjects && (
                  <Flex align="center" gap={6} style={{ padding: '8px 10px 4px', marginTop: 4 }}>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} type="secondary">
                      {pid}
                    </Text>
                    <Tag>{groupDevices.length}</Tag>
                  </Flex>
                )}
                {groupDevices.map((device) => {
                  const isSelected = currentSelectedId === device.deviceId;
                  const ua = parseUA(device.ua);
                  const page = parsePageLabel(device.url);
                  return (
                    <List.Item
                      key={device.deviceId}
                      onClick={() => handleSelect(device)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: isSelected ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
                        backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                        marginBottom: 4,
                      }}
                    >
                      <Flex align="center" gap={10} style={{ width: '100%' }}>
                        {/* Device icon + status badge */}
                        <Badge status={device.online ? 'success' : 'default'} offset={[-4, 30]}>
                          <Flex
                            align="center"
                            justify="center"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.07)',
                              fontSize: 18,
                            }}
                          >
                            {ua.icon}
                          </Flex>
                        </Badge>

                        {/* Info */}
                        <Flex vertical flex={1} style={{ minWidth: 0 }}>
                          <Text strong ellipsis style={{ fontSize: 13, marginBottom: 2 }}>
                            {page.pathname}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11, marginBottom: 4 }}>
                            {page.origin ? `${page.origin} · ` : ''}{ua.browser}
                          </Text>
                          <Space size={4} wrap>
                            <Tag style={{ fontSize: 10 }}>{device.screen}</Tag>
                            <Tag style={{ fontSize: 10 }}>{device.language}</Tag>
                            {device.activeTabs > 1 && (
                              <Tag color="blue" style={{ fontSize: 10 }}>{device.activeTabs} tabs</Tag>
                            )}
                            <Tooltip title={`Page ID: ${device.deviceId} · Click to copy`}>
                              <Tag
                                color="blue"
                                style={{ fontSize: 10, cursor: 'pointer', fontFamily: 'monospace' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard?.writeText(device.deviceId);
                                }}
                              >
                                <CopyOutlined /> #{device.deviceId.slice(-8)}
                              </Tag>
                            </Tooltip>
                          </Space>
                        </Flex>

                        {/* Right: time + status */}
                        <Flex vertical align="flex-end" gap={4}>
                          <Tag color={device.online ? 'success' : 'default'}>
                            {device.online ? t.common.online : t.common.offline}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 10 }}>{formatTime(device.connectTime)}</Text>
                        </Flex>
                      </Flex>
                    </List.Item>
                  );
                })}
              </>
            )}
          />
        </div>
      )}
    </div>
  );
}
