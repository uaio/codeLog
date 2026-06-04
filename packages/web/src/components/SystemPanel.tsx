import { useState, useEffect, useCallback } from 'react';
import { Tag, Button, Collapse, Typography, Descriptions, Flex } from 'antd';
import { DesktopOutlined, ReloadOutlined, MobileOutlined, GlobalOutlined, InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';

interface SystemPanelProps { deviceId?: string; }

export function SystemPanel({ deviceId }: SystemPanelProps) {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const fetchInfo = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const data = await api.getSystemInfo(deviceId);
      setInfo(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [deviceId]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  if (!deviceId) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: '100%' }} gap={12}>
        <MobileOutlined style={{ fontSize: 48, opacity: 0.3 }} />
        <Typography.Text type="secondary">{t.common.selectDevice}</Typography.Text>
      </Flex>
    );
  }

  if (!info) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: '100%' }} gap={12}>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchInfo}>
          {t.common.refresh}
        </Button>
        <Typography.Text type="secondary">点击刷新获取系统信息</Typography.Text>
      </Flex>
    );
  }

  const browserMeta = [
    { label: 'Browser', value: info.browserName ?? info.ua?.split(' ')[0] },
    { label: 'OS', value: info.platform },
    { label: 'Language', value: info.language },
    { label: 'Cookie', value: info.cookieEnabled ? 'Enabled' : 'Disabled', color: info.cookieEnabled ? 'success' : 'error' },
    { label: 'Online', value: info.onLine ? 'Online' : 'Offline', color: info.onLine ? 'success' : 'warning' },
    { label: 'Screen', value: `${info.screen?.width}x${info.screen?.height} @${info.pixelRatio}x` },
    { label: 'Viewport', value: `${info.viewport?.width}x${info.viewport?.height}` },
    { label: 'URL', value: info.url },
  ];

  const networkItems = info.connection ? [
    { label: 'Type', value: info.connection.effectiveType },
    { label: 'Downlink', value: `${info.connection.downlink} Mbps` },
    { label: 'RTT', value: `${info.connection.rtt} ms` },
    { label: 'Save Data', value: info.connection.saveData ? 'Yes' : 'No', color: info.connection.saveData ? 'warning' : undefined },
  ] : [];

  const features = info.features ? Object.entries(info.features).map(([k, v]) => ({ name: k, supported: v })) : [];

  return (
    <Flex vertical style={{ height: '100%', overflow: 'auto', padding: 16, gap: 16 }}>
      <Flex justify="space-between" align="center">
        <Typography.Text strong style={{ fontSize: 14 }}>
          <DesktopOutlined style={{ marginRight: 8 }} />System
        </Typography.Text>
        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={fetchInfo}>
          {t.common.refresh}
        </Button>
      </Flex>

      {/* Browser / Platform - compact tags */}
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
          <GlobalOutlined style={{ marginRight: 4 }} />Browser / Platform
        </Typography.Text>
        <Flex wrap="wrap" gap="small">
          {browserMeta.filter(m => m.value != null).map(m => (
            <Tag key={m.label} color={m.color} style={{ margin: 0 }}>
              {m.label}: {String(m.value).length > 50 ? String(m.value).slice(0, 50) + '…' : String(m.value)}
            </Tag>
          ))}
        </Flex>
      </div>

      {/* Network */}
      {networkItems.length > 0 && (
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            <GlobalOutlined style={{ marginRight: 4 }} />Network
          </Typography.Text>
          <Flex wrap="wrap" gap="small">
            {networkItems.map(m => (
              <Tag key={m.label} color={m.color} style={{ margin: 0 }}>
                {m.label}: {String(m.value)}
              </Tag>
            ))}
          </Flex>
        </div>
      )}

      {/* Browser Features */}
      {features.length > 0 && (
        <Collapse
          size="small"
          items={[{
            key: 'features',
            label: <Typography.Text type="secondary" style={{ fontSize: 12 }}><InfoCircleOutlined style={{ marginRight: 4 }} />Browser Features ({features.length})</Typography.Text>,
            children: (
              <Descriptions size="small" column={2} bordered>
                {features.map(f => (
                  <Descriptions.Item key={f.name} label={f.name}>
                    {f.supported ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ),
          }]}
        />
      )}
    </Flex>
  );
}
