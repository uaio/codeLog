import { useState, useEffect, CSSProperties } from 'react';
import { MobileOutlined, AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';
import { Empty, Button } from 'antd';
import { api } from '../api/client.js';

interface PluginInfo {
  name: string;
  panelTitle?: string;
  panelIcon?: string;
  version?: string;
  state: 'enabled' | 'disabled';
}

interface PluginsPanelProps {
  deviceId?: string;
}

export function PluginsPanel({ deviceId }: PluginsPanelProps) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPlugins(id);
      setPlugins(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!deviceId) {
      setPlugins([]);
      return;
    }
    void load(deviceId);
  }, [deviceId]);

  if (!deviceId) {
    return (
      <Empty
        image={<MobileOutlined style={{ fontSize: 48, color: '#64748b' }} />}
        description="请先选择设备"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      />
    );
  }

  if (loading) return <div style={styles.empty}>加载中...</div>;
  if (error) return <div style={styles.empty}>加载失败: {error}</div>;

  if (plugins.length === 0) {
    return (
      <Empty
        image={<AppstoreOutlined style={{ fontSize: 48, color: '#64748b' }} />}
        description={
          <span>
            该设备未注册任何插件
            <br />
            <span style={{ fontSize: 12, color: '#475569' }}>通过 SDK 的 plugins 选项注册自定义插件</span>
          </span>
        }
        style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>已安装插件 ({plugins.length})</span>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => void load(deviceId!)}
          style={{ background: 'transparent', borderColor: '#334155', color: '#94a3b8' }}
        >
          刷新
        </Button>
      </div>
      <div style={styles.list}>
        {plugins.map((plugin) => (
          <div key={plugin.name} style={styles.card}>
            <div style={styles.cardLeft}>
              <span style={styles.icon}>
                <AppstoreOutlined style={{ fontSize: 24, color: '#94a3b8' }} />
              </span>
              <div style={styles.info}>
                <span style={styles.name}>{plugin.panelTitle ?? plugin.name}</span>
                {plugin.name !== (plugin.panelTitle ?? plugin.name) && (
                  <span style={styles.techName}>{plugin.name}</span>
                )}
                {plugin.version && <span style={styles.version}>v{plugin.version}</span>}
              </div>
            </div>
            <span
              style={{
                ...styles.badge,
                background: plugin.state === 'enabled' ? '#22c55e22' : '#6b728022',
                color: plugin.state === 'enabled' ? '#16a34a' : '#6b7280',
              }}
            >
              {plugin.state === 'enabled' ? '已启用' : '已禁用'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0f172a',
    color: '#e2e8f0',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid #1e293b',
  },
  toolbarTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#94a3b8',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1e293b',
    borderRadius: '8px',
    padding: '12px 16px',
    border: '1px solid #334155',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  icon: {
    fontSize: '24px',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  techName: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  version: {
    fontSize: '11px',
    color: '#7c3aed',
  },
  badge: {
    fontSize: '12px',
    padding: '2px 10px',
    borderRadius: '999px',
    fontWeight: 500,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '8px',
    color: '#64748b',
    fontSize: '14px',
  },
};
