import { useState, useEffect } from 'react';
import { DeviceList } from './components/DeviceList.js';
import { LogPanel } from './components/LogPanel.js';
import { NetworkPanel } from './components/NetworkPanel.js';
import { StoragePanel } from './components/StoragePanel.js';
import { DOMPanel } from './components/DOMPanel.js';
import { PerformancePanel } from './components/PerformancePanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { PerfRunPanel } from './components/PerfRunPanel.js';
import { MockPanel } from './components/MockPanel.js';
import { HealthPanel } from './components/HealthPanel.js';
import { AIAnalysisPanel } from './components/AIAnalysisPanel.js';
import { SystemPanel } from './components/SystemPanel.js';
import { IndexedDBPanel } from './components/IndexedDBPanel.js';
import { OfflineLogsPanel } from './components/OfflineLogsPanel.js';
import { ErrorPanel } from './components/ErrorPanel.js';
import { PluginsPanel } from './components/PluginsPanel.js';
import { TabFilter } from './components/TabFilter.js';
import { Tabs, type Tab } from './components/Tabs.js';
import { useI18n } from './i18n/index.js';
import { websocketManager } from './lib/websocketManager.js';
import type { Device } from './types/index.js';
import './styles/global.css';

function App() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState('console');
  const [wsState, setWsState] = useState(websocketManager.getConnectionState());
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [compareMode, setCompareMode] = useState(false);
  const [compareDevice, setCompareDevice] = useState<Device | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    return websocketManager.onStateChange(setWsState);
  }, []);

  // Subscribe to WebSocket messages to track unread counts per tab
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
      // Handle event envelope format
      const effectiveType =
        msgType === 'event' && msg?.data?.type ? String(msg.data.type) : msgType;
      const tab = tabForMessageType[effectiveType];
      if (tab) {
        setBadges((prev) => ({
          ...prev,
          [tab]: (prev[tab] ?? 0) + 1,
        }));
      }
      // Track error-level console logs for the error tab badge
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
    // Clear badge for the tab being activated
    setBadges((prev) => ({ ...prev, [tabId]: 0 }));
  };

  const tabs: Tab[] = [
    {
      id: 'console',
      label: t.tabs.console,
      icon: '📝',
      badge: badges['console'],
      content: selectedDevice ? (
        <LogPanel deviceId={selectedDevice.deviceId} tabId={selectedTabId} />
      ) : (
        <div style={styles.placeholder}>
          <div style={styles.placeholderIcon}>📱</div>
          <div style={styles.placeholderText}>{t.common.selectDevice}</div>
        </div>
      ),
    },
    {
      id: 'network',
      label: t.tabs.network,
      icon: '🌐',
      badge: badges['network'],
      content: <NetworkPanel deviceId={selectedDevice?.deviceId} tabId={selectedTabId} />,
    },
    {
      id: 'errors',
      label: '错误',
      icon: '🐛',
      badge: badges['errors'],
      content: <ErrorPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'storage',
      label: t.tabs.storage,
      icon: '💾',
      badge: badges['storage'],
      content: <StoragePanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'element',
      label: t.tabs.dom,
      icon: '🌲',
      badge: badges['dom'],
      content: <DOMPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'performance',
      label: t.tabs.perf,
      icon: '📊',
      content: <PerformancePanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'perf_run',
      label: t.tabs.perf,
      icon: '🏁',
      content: <PerfRunPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'mock',
      label: t.tabs.mock,
      icon: '🎭',
      content: <MockPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'health',
      label: t.tabs.health,
      icon: '🩺',
      content: <HealthPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'ai',
      label: t.tabs.analysis,
      icon: '🧠',
      content: <AIAnalysisPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'indexeddb',
      label: t.tabs.indexeddb,
      icon: '🗄️',
      badge: badges['indexeddb'],
      content: <IndexedDBPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'offline-logs',
      label: '离线日志',
      icon: '💾',
      content: <OfflineLogsPanel />,
    },
    {
      id: 'system',
      label: t.tabs.system,
      icon: '🖥️',
      content: <SystemPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'plugins',
      label: '插件',
      icon: '🔌',
      content: <PluginsPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'settings',
      label: t.tabs.settings,
      icon: '⚙️',
      content: <SettingsPanel deviceId={selectedDevice?.deviceId} />,
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>{t.common.title}</h1>
          <p style={styles.subtitle}>
            {selectedDevice
              ? `${selectedDevice.ua.slice(0, 50)}${selectedDevice.ua.length > 50 ? '...' : ''}`
              : t.common.selectDevice}
          </p>
        </div>
        <div style={styles.statusBadge}>
          <button
            style={{
              ...styles.compareBtn,
              backgroundColor: compareMode ? '#1890ff' : '#fff',
              color: compareMode ? '#fff' : '#666',
              borderColor: compareMode ? '#1890ff' : '#d9d9d9',
            }}
            title="Side-by-side device comparison"
            onClick={() => {
              setCompareMode((m) => !m);
              if (compareMode) setCompareDevice(null);
            }}
          >
            ⊞ Compare
          </button>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor:
                wsState === 'connected'
                  ? '#52c41a'
                  : wsState === 'connecting'
                    ? '#faad14'
                    : '#ff4d4f',
            }}
          />
          <span style={styles.statusText}>
            {wsState === 'connected'
              ? t.common.connected
              : wsState === 'connecting'
                ? t.common.connecting
                : t.common.disconnected}
          </span>
        </div>
      </div>

      <div style={styles.content}>
        <div style={compareMode ? styles.sidebarCompare : styles.sidebar}>
          {compareMode && <div style={styles.sidebarLabel}>Primary</div>}
          <DeviceList
            onSelectDevice={handleSelectDevice}
            selectedDeviceId={selectedDevice?.deviceId}
          />
          {compareMode && (
            <>
              <div style={{ ...styles.sidebarLabel, marginTop: '16px', borderTop: '1px solid #e8e8e8', paddingTop: '12px' }}>
                Compare
              </div>
              <DeviceList
                onSelectDevice={setCompareDevice}
                selectedDeviceId={compareDevice?.deviceId}
              />
            </>
          )}
        </div>

        <div style={compareMode ? styles.mainCompare : styles.main}>
          {/* Primary device panel */}
          <div style={compareMode ? styles.comparePane : undefined}>
            {compareMode && (
              <div style={styles.compareDeviceBadge}>
                {selectedDevice
                  ? `📱 ${selectedDevice.ua.slice(0, 40)}…`
                  : 'No device selected'}
              </div>
            )}
            <TabFilter
              deviceId={selectedDevice?.deviceId}
              value={selectedTabId}
              onChange={setSelectedTabId}
            />
            <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
          </div>

          {/* Compare device panel */}
          {compareMode && (
            <div style={styles.comparePane}>
              <div style={styles.compareDeviceBadge}>
                {compareDevice
                  ? `📱 ${compareDevice.ua.slice(0, 40)}…`
                  : 'Select a device to compare'}
              </div>
              <TabFilter
                deviceId={compareDevice?.deviceId}
                value={selectedTabId}
                onChange={setSelectedTabId}
              />
              <Tabs tabs={buildCompareTabs(compareDevice?.deviceId, t, selectedTabId)} activeTab={activeTab} onChange={handleTabChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '16px 24px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#333',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '4px 0 0 0',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid #e0e0e0',
    overflow: 'auto',
  },
  main: {
    flex: 1,
    padding: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
  },
  placeholderIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  placeholderText: {
    fontSize: '16px',
    fontWeight: 500,
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '12px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '12px',
    color: '#666',
    fontWeight: 500 as const,
  },
  compareBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #d9d9d9',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500 as const,
    transition: 'background 0.15s',
  },
  sidebarCompare: {
    width: '220px',
    borderRight: '1px solid #e0e0e0',
    overflow: 'auto',
    flexShrink: 0,
  },
  sidebarLabel: {
    fontSize: '11px',
    fontWeight: 600 as const,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '8px 12px 4px',
  },
  mainCompare: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    gap: '4px',
  },
  comparePane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    backgroundColor: '#fff',
  },
  compareDeviceBadge: {
    padding: '6px 12px',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '11px',
    color: '#666',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
};

function buildCompareTabs(deviceId: string | undefined, t: ReturnType<typeof useI18n>['t'], selectedTabId: string | null): Tab[] {
  return [
    { id: 'console', label: t.tabs.console, icon: '📝', content: <LogPanel deviceId={deviceId} tabId={selectedTabId} /> },
    { id: 'network', label: t.tabs.network, icon: '🌐', content: <NetworkPanel deviceId={deviceId} tabId={selectedTabId} /> },
    { id: 'storage', label: t.tabs.storage, icon: '💾', content: <StoragePanel deviceId={deviceId} /> },
    { id: 'element', label: t.tabs.dom, icon: '🏗️', content: <DOMPanel deviceId={deviceId} /> },
    { id: 'perf', label: t.tabs.perf, icon: '⚡', content: <PerformancePanel deviceId={deviceId} /> },
    { id: 'system', label: t.tabs.system, icon: '🖥️', content: <SystemPanel deviceId={deviceId} /> },
  ];
}

export default App;
