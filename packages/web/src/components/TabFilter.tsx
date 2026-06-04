import { useState, useCallback, useEffect } from 'react';
import { Select, Space, Typography } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useI18n } from '../i18n/index.js';

const { Text } = Typography;

interface TabFilterProps {
  deviceId?: string;
  value: string | null;
  onChange: (tabId: string | null) => void;
}

/**
 * Discovers active browser tabs for a device and allows filtering by tab.
 * Listens to WebSocket events to auto-discover tabIds.
 */
export function TabFilter({ deviceId, value, onChange }: TabFilterProps) {
  const [knownTabs, setKnownTabs] = useState<Set<string>>(new Set());
  const { t } = useI18n();

  // Reset when device changes
  useEffect(() => {
    setKnownTabs(new Set());
    onChange(null);
  }, [deviceId]);

  const handleMessage = useCallback(
    (message: any) => {
      if (!deviceId) return;
      if (message.type === 'event' && message.deviceId === deviceId) {
        const tabId = message.envelope?.tabId;
        if (tabId) {
          setKnownTabs((prev) => {
            if (prev.has(tabId)) return prev;
            const next = new Set(prev);
            next.add(tabId);
            return next;
          });
        }
      }
    },
    [deviceId],
  );

  useWebSocket(handleMessage);

  if (knownTabs.size <= 1) return null;

  return (
    <Space size={6} style={{ padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <FolderOutlined style={{ color: '#666' }} />
      <Text type="secondary" strong style={{ fontSize: 12 }}>Tab:</Text>
      <Select
        size="small"
        value={value ?? '__all__'}
        onChange={(val) => onChange(val === '__all__' ? null : val)}
        options={[
          { value: '__all__', label: t.common.all ?? 'All' },
          ...Array.from(knownTabs).map((tabId) => ({
            value: tabId,
            label: tabId.replace('tab-', '#'),
          })),
        ]}
        style={{ minWidth: 120, fontSize: 12 }}
      />
    </Space>
  );
}
