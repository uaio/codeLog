import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import type { SystemInfo } from '../types/index.js';

interface SystemPanelProps {
  deviceId?: string;
}

export function SystemPanel({ deviceId }: SystemPanelProps) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSystemInfo(id);
      setInfo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!deviceId) {
      setInfo(null);
      return;
    }
    void load(deviceId);
  }, [deviceId]);

  if (!deviceId) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📱</div>
        <div>请先选择设备</div>
      </div>
    );
  }

  if (loading) return <div style={styles.empty}>加载中...</div>;
  if (error) return <div style={styles.empty}>加载失败: {error}</div>;
  if (!info)
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>ℹ️</div>
        <div>等待设备上报系统信息...</div>
        <div style={styles.emptyHint}>系统信息会在 SDK 初始化后自动上报</div>
      </div>
    );

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>系统信息</span>
        <button
          style={styles.refreshBtn}
          onClick={() => void load(deviceId)}
          disabled={loading}
        >
          {loading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>
      <Section title="🖥️ 浏览器 / 平台">
        <Row label="User Agent" value={info.userAgent} mono />
        <Row label="Platform" value={info.platform} />
        <Row label="语言" value={`${info.language}  (${info.languages.join(', ')})`} />
        {info.vendor && <Row label="Vendor" value={info.vendor} />}
        <Row label="Cookie" value={info.cookieEnabled ? '✅ 启用' : '❌ 禁用'} />
      </Section>

      <Section title="📐 屏幕">
        <Row label="分辨率" value={`${info.screen.width} × ${info.screen.height}`} />
        <Row
          label="可用区域"
          value={`${info.screen.availWidth} × ${info.screen.availHeight}`}
        />
        <Row label="像素比" value={`${info.screen.pixelRatio}x`} />
        <Row label="颜色深度" value={`${info.screen.colorDepth} bit`} />
        {info.screen.orientation && <Row label="屏幕方向" value={info.screen.orientation} />}
      </Section>

      <Section title="🔧 硬件">
        {info.hardware.cpuCores !== undefined && (
          <Row label="CPU 核心" value={`${info.hardware.cpuCores} 核`} />
        )}
        {info.hardware.memory !== undefined && (
          <Row label="设备内存" value={`${info.hardware.memory} GB`} />
        )}
        {info.hardware.maxTouchPoints !== undefined && (
          <Row label="触控点数" value={String(info.hardware.maxTouchPoints)} />
        )}
      </Section>

      <Section title="🌐 网络">
        {info.connection ? (
          <>
            {info.connection.type && <Row label="连接类型" value={info.connection.type} />}
            {info.connection.effectiveType && (
              <Row label="有效速度" value={info.connection.effectiveType} />
            )}
            {info.connection.downlink !== undefined && (
              <Row label="下行带宽" value={`${info.connection.downlink} Mbps`} />
            )}
            {info.connection.rtt !== undefined && (
              <Row label="RTT 延迟" value={`${info.connection.rtt} ms`} />
            )}
            {info.connection.saveData !== undefined && (
              <Row label="省流模式" value={info.connection.saveData ? '✅ 开启' : '❌ 关闭'} />
            )}
          </>
        ) : (
          <Row label="Network Information API" value="不支持" muted />
        )}
      </Section>

      {info.battery && (
        <Section title="🔋 电池">
          <Row label="充电状态" value={info.battery.charging ? '⚡ 充电中' : '🔋 放电中'} />
          <Row label="电量" value={<BatteryBar level={info.battery.level} />} />
          {info.battery.chargingTime !== undefined && (
            <Row label="充满时间" value={formatSeconds(info.battery.chargingTime)} />
          )}
          {info.battery.dischargingTime !== undefined && (
            <Row label="剩余时间" value={formatSeconds(info.battery.dischargingTime)} />
          )}
        </Section>
      )}

      <Section title="🕐 时区">
        <Row label="时区" value={info.timezone} />
        <Row label="UTC 偏移" value={`UTC${info.timezoneOffset <= 0 ? '+' : '-'}${Math.abs(info.timezoneOffset / 60)}h`} />
      </Section>

      <Section title="🔬 浏览器特性">
        <FeatureGrid features={info.features} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span
        style={{
          ...styles.rowValue,
          fontFamily: mono ? 'monospace' : undefined,
          color: muted ? '#bbb' : undefined,
          fontSize: mono ? '11px' : undefined,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BatteryBar({ level }: { level: number }) {
  const color = level > 50 ? '#52c41a' : level > 20 ? '#faad14' : '#ff4d4f';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        style={{
          display: 'inline-block',
          width: '60px',
          height: '12px',
          background: '#f0f0f0',
          borderRadius: '3px',
          overflow: 'hidden',
          border: '1px solid #d9d9d9',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${level}%`,
            height: '100%',
            background: color,
            transition: 'width 0.3s',
          }}
        />
      </span>
      <span>{level}%</span>
    </span>
  );
}

function FeatureGrid({ features }: { features: SystemInfo['features'] }) {
  const entries = Object.entries(features) as [string, boolean][];
  const labels: Record<string, string> = {
    webGL: 'WebGL',
    webGL2: 'WebGL2',
    webP: 'WebP',
    serviceWorker: 'Service Worker',
    webWorker: 'Web Worker',
    indexedDB: 'IndexedDB',
    webSocket: 'WebSocket',
    webRTC: 'WebRTC',
    geolocation: 'Geolocation',
    notifications: 'Notifications',
    vibration: 'Vibration',
    bluetooth: 'Bluetooth',
    usb: 'USB',
    paymentRequest: 'Payment',
    clipboard: 'Clipboard',
    share: 'Web Share',
    pdfViewer: 'PDF Viewer',
  };
  return (
    <div style={styles.featureGrid}>
      {entries.map(([key, supported]) => (
        <div key={key} style={styles.featureItem}>
          <span style={{ color: supported ? '#52c41a' : '#ff4d4f', marginRight: '4px' }}>
            {supported ? '✅' : '❌'}
          </span>
          <span style={{ fontSize: '11px', color: supported ? '#333' : '#999' }}>
            {labels[key] || key}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatSeconds(s: number): string {
  if (!isFinite(s)) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const styles = {
  container: {
    padding: '16px',
    overflowY: 'auto' as const,
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    gap: '8px',
  },
  emptyIcon: {
    fontSize: '32px',
  },
  emptyHint: {
    fontSize: '12px',
    color: '#bbb',
  },
  section: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  sectionTitle: {
    padding: '10px 16px',
    fontWeight: 600,
    fontSize: '13px',
    color: '#333',
    borderBottom: '1px solid #f0f0f0',
    background: '#fafafa',
  },
  sectionBody: {
    padding: '4px 0',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '7px 16px',
    borderBottom: '1px solid #f9f9f9',
    gap: '16px',
  },
  rowLabel: {
    fontSize: '12px',
    color: '#666',
    flexShrink: 0,
    minWidth: '100px',
  },
  rowValue: {
    fontSize: '12px',
    color: '#333',
    textAlign: 'right' as const,
    flex: 1,
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
    padding: '12px 16px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '4px',
  },
  toolbarTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  },
  refreshBtn: {
    padding: '4px 12px',
    fontSize: '12px',
    background: '#f0f0f0',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    cursor: 'pointer',
  } as const,
};
