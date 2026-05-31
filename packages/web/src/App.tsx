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
import { ScreenshotPanel } from './components/ScreenshotPanel.js';
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
          <div style={styles.placeholderHint}>从左侧选择一个设备开始调试</div>
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
      label: '性能跑分',
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
      icon: '📦',
      content: <OfflineLogsPanel />,
    },
    {
      id: 'system',
      label: t.tabs.system,
      icon: '🖥️',
      content: <SystemPanel deviceId={selectedDevice?.deviceId} />,
    },
    {
      id: 'screenshot',
      label: '截图',
      icon: '📷',
      content: <ScreenshotPanel deviceId={selectedDevice?.deviceId} />,
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

  const wsColors = {
    connected: { dot: '#10b981', bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
    connecting: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
    disconnected: { dot: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
  };
  const wsColor = wsColors[wsState] ?? wsColors.disconnected;

  return (
    <div style={styles.container}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerBrand}>
          <span style={styles.brandIcon}>📡</span>
          <span style={styles.brandName}>codeLog</span>
          <span style={styles.brandDivider} />
          <span style={styles.brandSub}>Remote Debugger</span>
        </div>

        <div style={styles.headerCenter}>
          {selectedDevice && (
            <div style={styles.deviceChip}>
              <span style={styles.deviceChipDot} />
              <span style={styles.deviceChipText}>
                {selectedDevice.ua.slice(0, 60)}{selectedDevice.ua.length > 60 ? '…' : ''}
              </span>
            </div>
          )}
        </div>

        <div style={{ ...styles.statusPill, backgroundColor: wsColor.bg }}>
          <span style={{ ...styles.statusPulse, backgroundColor: wsColor.dot }} />
          <span style={{ ...styles.statusLabel, color: wsColor.text }}>
            {wsState === 'connected'
              ? t.common.connected
              : wsState === 'connecting'
                ? t.common.connecting
                : t.common.disconnected}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={styles.body}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <DeviceList
            onSelectDevice={handleSelectDevice}
            selectedDeviceId={selectedDevice?.deviceId}
          />
        </aside>

        {/* Main panel */}
        <main style={styles.main}>
          <TabFilter
            deviceId={selectedDevice?.deviceId}
            value={selectedTabId}
            onChange={setSelectedTabId}
          />
          <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  // ── Header ──────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    height: '52px',
    padding: '0 20px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.2)',
    flexShrink: 0,
    zIndex: 10,
  },
  headerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  brandIcon: {
    fontSize: '18px',
  },
  brandName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: '-0.3px',
  },
  brandDivider: {
    width: '1px',
    height: '14px',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  brandSub: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 400,
  },
  headerCenter: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  deviceChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '20px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    maxWidth: '500px',
  },
  deviceChipDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    flexShrink: 0,
  },
  deviceChipText: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '20px',
    flexShrink: 0,
  },
  statusPulse: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
  },
  statusLabel: {
    fontSize: '12px',
    fontWeight: 600,
  },
  // ── Body ────────────────────────────────────────
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '260px',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#1e293b',
    borderRight: '1px solid #0f172a',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#f8fafc',
  },
  // ── Placeholder ──────────────────────────────────
  placeholder: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '8px',
    color: '#94a3b8',
  },
  placeholderIcon: {
    fontSize: '56px',
    opacity: 0.4,
    marginBottom: '8px',
  },
  placeholderText: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#64748b',
  },
  placeholderHint: {
    fontSize: '13px',
    color: '#94a3b8',
  },
};

export default App;
