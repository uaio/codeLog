import { useState, useEffect, useMemo } from 'react';
import { ConfigProvider, theme, Layout, Button, Badge, Space, Typography, Tooltip, Tabs as AntTabs } from 'antd';
import type { TabsProps } from 'antd';
import {
  CodeOutlined,
  GlobalOutlined,
  BugOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  SwapOutlined,
  RobotOutlined,
  TableOutlined,
  InboxOutlined,
  DesktopOutlined,
  CameraOutlined,
  AppstoreOutlined,
  SettingOutlined,
  WifiOutlined,
  LoadingOutlined,
  DisconnectOutlined,
  TranslationOutlined,
  MobileOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { DeviceList } from './components/DeviceList.js';
import { LogPanel } from './components/LogPanel.js';
import { NetworkPanel } from './components/NetworkPanel.js';
import { StoragePanel } from './components/StoragePanel.js';
import { DOMPanel } from './components/DOMPanel.js';
import { PerformancePanel } from './components/PerformancePanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { MockPanel } from './components/MockPanel.js';
import { AIAnalysisPanel } from './components/AIAnalysisPanel.js';
import { SystemPanel } from './components/SystemPanel.js';
import { IndexedDBPanel } from './components/IndexedDBPanel.js';
import { OfflineLogsPanel } from './components/OfflineLogsPanel.js';
import { ErrorPanel } from './components/ErrorPanel.js';
import { PluginsPanel } from './components/PluginsPanel.js';
import { ScreenshotPanel } from './components/ScreenshotPanel.js';
import { TabFilter } from './components/TabFilter.js';
import { useI18n } from './i18n/index.js';
import { websocketManager } from './lib/websocketManager.js';
import type { Device } from './types/index.js';
import './styles/global.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function App() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState('console');
  const [wsState, setWsState] = useState(websocketManager.getConnectionState());
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const { t, setLang, lang } = useI18n();

  useEffect(() => {
    return websocketManager.onStateChange(setWsState);
  }, []);

  useEffect(() => {
    const tabForMessageType: Record<string, string> = {
      log: 'console',
      network: 'network',
      storage: 'storage',
      dom: 'dom',
      performance: 'perf',
      indexeddb: 'indexeddb',
    };
    const errorPrefixes = ['[Uncaught Error]', '[Unhandled Promise Rejection]', '[Resource Error]'];
    const unsubscribe = websocketManager.subscribe((msg: any) => {
      const msgType: string = msg?.type ?? '';
      const effectiveType =
        msgType === 'event' && msg?.data?.type ? String(msg.data.type) : msgType;
      const tab = tabForMessageType[effectiveType];
      if (tab) {
        setBadges((prev) => ({ ...prev, [tab]: (prev[tab] ?? 0) + 1 }));
      }
      if (effectiveType === 'log' && msg?.data) {
        const logData = msg.data;
        const isError =
          logData.level === 'error' ||
          errorPrefixes.some((p: string) => String(logData.message ?? '').startsWith(p));
        if (isError) {
          setBadges((prev) => ({ ...prev, errors: (prev['errors'] ?? 0) + 1 }));
        }
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
        key: 'errors',
        label: <Badge count={badges['errors'] || 0} size="small" offset={[6, -2]}><Space size={4}><BugOutlined />{t.tabs.errors}</Space></Badge>,
        children: <ErrorPanel deviceId={selectedDevice?.deviceId} />,
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
        key: 'ai',
        label: <Space size={4}><RobotOutlined />{t.tabs.analysis}</Space>,
        children: <AIAnalysisPanel deviceId={selectedDevice?.deviceId} />,
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

  const wsIcon = wsState === 'connected' ? <WifiOutlined /> : wsState === 'connecting' ? <LoadingOutlined /> : <DisconnectOutlined />;
  const wsText = wsState === 'connected' ? t.common.connected : wsState === 'connecting' ? t.common.connecting : t.common.disconnected;
  const wsColor = wsState === 'connected' ? '#10b981' : wsState === 'connecting' ? '#f59e0b' : '#ef4444';

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#1890ff', borderRadius: 6 },
      }}
    >
      <Layout style={{ height: '100vh' }}>
        <Header style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '0 20px', height: 48, lineHeight: '48px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          zIndex: 10,
        }}>
          <Space size={8}>
            <ReloadOutlined style={{ fontSize: 16, color: '#f8fafc' }} />
            <Text strong style={{ color: '#f8fafc', fontSize: 15, margin: 0 }}>codeLog</Text>
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{t.common.brandSub}</Text>
          </Space>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {selectedDevice && (
              <Space size={6} style={{
                padding: '4px 12px', borderRadius: 20,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <Text ellipsis style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, maxWidth: 400 }}>
                  {selectedDevice.ua}
                </Text>
              </Space>
            )}
          </div>

          <Space size={8}>
            <Tooltip title={wsText}>
              <span style={{ color: wsColor }}>
                {wsIcon} <Text style={{ color: 'inherit', fontSize: 12 }}>{wsText}</Text>
              </span>
            </Tooltip>
            <Button
              type="text" size="small" icon={<TranslationOutlined />}
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              {t.common.langToggle}
            </Button>
          </Space>
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
