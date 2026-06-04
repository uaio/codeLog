import { useState, useEffect, useMemo } from 'react';
import { ConfigProvider, theme, Layout, Badge, Space, Typography, Tabs as AntTabs } from 'antd';
import type { TabsProps } from 'antd';
import {
  CodeOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  SwapOutlined,
  TableOutlined,
  InboxOutlined,
  DesktopOutlined,
  CameraOutlined,
  AppstoreOutlined,
  SettingOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import { useI18n } from './i18n/index.js';
import { DeviceList } from './components/DeviceList.js';
import { LogPanel } from './components/LogPanel.js';
import { NetworkPanel } from './components/NetworkPanel.js';
import { StoragePanel } from './components/StoragePanel.js';
import { DOMPanel } from './components/DOMPanel.js';
import { PerformancePanel } from './components/PerformancePanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { MockPanel } from './components/MockPanel.js';
import { SystemPanel } from './components/SystemPanel.js';
import { IndexedDBPanel } from './components/IndexedDBPanel.js';
import { OfflineLogsPanel } from './components/OfflineLogsPanel.js';
import { PluginsPanel } from './components/PluginsPanel.js';
import { ScreenshotPanel } from './components/ScreenshotPanel.js';
import { TabFilter } from './components/TabFilter.js';
import { websocketManager } from './lib/websocketManager.js';
import type { Device } from './types/index.js';
import './styles/global.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function App() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState('console');
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const { t } = useI18n();

  useEffect(() => {
    const tabForMessageType: Record<string, string> = {
      log: 'console',
      network: 'network',
      storage: 'storage',
      dom: 'dom',
      performance: 'perf',
      indexeddb: 'indexeddb',
    };
    const unsubscribe = websocketManager.subscribe((msg: any) => {
      const msgType: string = msg?.type ?? '';
      const effectiveType =
        msgType === 'event' && msg?.data?.type ? String(msg.data.type) : msgType;
      const tab = tabForMessageType[effectiveType];
      if (tab) {
        setBadges((prev) => ({ ...prev, [tab]: (prev[tab] ?? 0) + 1 }));
      }
    });
    return unsubscribe;
  }, []);

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setBadges((prev) => ({ ...prev, [tabId]: 0 }));
  };

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: 'console',
        label: <Badge count={badges['console'] || 0} size="small" offset={[6, -2]}><Space size={4}><CodeOutlined />{t.tabs.console}</Space></Badge>,
        children: selectedDevice ? (
          <LogPanel deviceId={selectedDevice.deviceId} tabId={selectedTabId} />
        ) : (
          <EmptyPlaceholder text={t.common.selectDevice} hint={t.common.selectDeviceHint} />
        ),
      },
      {
        key: 'network',
        label: <Badge count={badges['network'] || 0} size="small" offset={[6, -2]}><Space size={4}><GlobalOutlined />{t.tabs.network}</Space></Badge>,
        children: <NetworkPanel deviceId={selectedDevice?.deviceId} tabId={selectedTabId} />,
      },
      {
        key: 'storage',
        label: <Badge count={badges['storage'] || 0} size="small" offset={[6, -2]}><Space size={4}><DatabaseOutlined />{t.tabs.storage}</Space></Badge>,
        children: <StoragePanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'element',
        label: <Space size={4}><ApartmentOutlined />{t.tabs.dom}</Space>,
        children: <DOMPanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'performance',
        label: <Space size={4}><BarChartOutlined />{t.tabs.perf}</Space>,
        children: <PerformancePanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'mock',
        label: <Space size={4}><SwapOutlined />{t.tabs.mock}</Space>,
        children: <MockPanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'indexeddb',
        label: <Badge count={badges['indexeddb'] || 0} size="small" offset={[6, -2]}><Space size={4}><TableOutlined />{t.tabs.indexeddb}</Space></Badge>,
        children: <IndexedDBPanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'offline-logs',
        label: <Space size={4}><InboxOutlined />{t.tabs.offlineLogs}</Space>,
        children: <OfflineLogsPanel />,
      },
      {
        key: 'system',
        label: <Space size={4}><DesktopOutlined />{t.tabs.system}</Space>,
        children: <SystemPanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'screenshot',
        label: <Space size={4}><CameraOutlined />{t.tabs.screenshot}</Space>,
        children: <ScreenshotPanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'plugins',
        label: <Space size={4}><AppstoreOutlined />{t.tabs.plugins}</Space>,
        children: <PluginsPanel deviceId={selectedDevice?.deviceId} />,
      },
      {
        key: 'settings',
        label: <Space size={4}><SettingOutlined />{t.tabs.settings}</Space>,
        children: <SettingsPanel deviceId={selectedDevice?.deviceId} />,
      },
    ],
    [t, selectedDevice, selectedTabId, badges],
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#1890ff', borderRadius: 6 },
      }}
    >
      <Layout style={{ height: '100vh' }}>
        <Header style={{
          display: 'flex', alignItems: 'center',
          padding: '0 20px', height: 48, lineHeight: '48px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          zIndex: 10,
        }}>
          <Text strong style={{ color: '#f8fafc', fontSize: 15, margin: 0 }}>远程调试</Text>
        </Header>

        <Layout>
          <Sider width={260} style={{ background: '#1e293b', borderRight: '1px solid #0f172a', overflow: 'auto' }}>
            <DeviceList onSelectDevice={handleSelectDevice} selectedDeviceId={selectedDevice?.deviceId} />
          </Sider>

          <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TabFilter deviceId={selectedDevice?.deviceId} value={selectedTabId} onChange={setSelectedTabId} />
            <AntTabs
              activeKey={activeTab}
              onChange={(k) => handleTabChange(k)}
              items={tabItems}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              tabBarStyle={{ margin: 0, padding: '0 16px', background: '#141414', flexShrink: 0 }}
              tabBarGutter={20}
            />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

function EmptyPlaceholder({ text, hint }: { text: string; hint: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#888' }}>
      <MobileOutlined style={{ fontSize: 48, opacity: 0.4 }} />
      <Text type="secondary" strong>{text}</Text>
      <Text type="secondary" style={{ fontSize: 13 }}>{hint}</Text>
    </div>
  );
}

export default App;
