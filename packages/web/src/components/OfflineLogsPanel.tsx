import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  List,
  Empty,
  Popconfirm,
  Tag,
  Typography,
  Space,
  Flex,
  Alert,
  Spin,
  Tooltip,
} from 'antd';
import {
  InboxOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { api } from '../api/client.js';
import type { SavedLogSessionMeta, SavedLogSession } from '../types/index.js';
import { LogReplayPanel } from './LogReplayPanel.js';

const { Text } = Typography;

function levelColor(level: string): string {
  switch (level) {
    case 'error': return '#ff4d4f';
    case 'warn': return '#faad14';
    case 'info': return '#597ef7';
    default: return '#52c41a';
  }
}

export function OfflineLogsPanel() {
  const [sessions, setSessions] = useState<SavedLogSessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SavedLogSession | null>(null);
  const [replaySession, setReplaySession] = useState<SavedLogSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listSavedLogs();
      setSessions(list);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleOpen = async (id: string) => {
    setLoadingSession(true);
    try {
      const session = await api.getSavedLog(id);
      setSelectedSession(session);
    } catch {
      setError('Failed to load session');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteSavedLog(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedSession?.id === id) setSelectedSession(null);
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  if (replaySession) {
    return <LogReplayPanel session={replaySession} onClose={() => setReplaySession(null)} />;
  }

  if (selectedSession) {
    return (
      <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
        <Flex align="center" gap={8} style={{ padding: '10px 16px', borderBottom: '1px solid var(--ant-color-border, #424242)', flexShrink: 0 }}>
          <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => setSelectedSession(null)}>
            Back
          </Button>
          <Text type="secondary" style={{ flex: 1, fontSize: 12 }}>
            {selectedSession.deviceId.slice(0, 8)}… · {formatDate(selectedSession.startTime)}
          </Text>
          <Button icon={<CaretRightOutlined />} size="small" onClick={() => setReplaySession(selectedSession)}>
            Replay
          </Button>
        </Flex>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <List
            size="small"
            dataSource={selectedSession.logs}
            locale={{ emptyText: <Empty description="No log entries in this session" /> }}
            renderItem={(entry) => {
              const level = (entry as any).level ?? 'log';
              return (
                <List.Item
                  style={{
                    borderLeft: `3px solid ${levelColor(level)}`,
                    paddingLeft: 12,
                  }}
                >
                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>
                      {formatDate((entry as any).timestamp ?? 0)}
                    </Text>
                    <Tag
                      color={level === 'error' ? 'error' : level === 'warn' ? 'warning' : level === 'info' ? 'processing' : 'success'}
                      style={{ fontSize: 10, fontWeight: 600, minWidth: 36, textAlign: 'center' }}
                    >
                      {level.toUpperCase()}
                    </Tag>
                    <Text code style={{ fontSize: 12, wordBreak: 'break-word' }}>
                      {(entry as any).message}
                    </Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        </div>
      </Flex>
    );
  }

  return (
    <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Flex align="center" gap={8} style={{ padding: '10px 16px', borderBottom: '1px solid var(--ant-color-border, #424242)', flexShrink: 0 }}>
        <Space>
          <InboxOutlined />
          <Text strong>Saved Log Sessions</Text>
        </Space>
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} size="small" onClick={loadList} loading={loading}>
          Refresh
        </Button>
      </Flex>

      {error && (
        <Alert type="error" message={error} closable style={{ margin: '0 0' }} />
      )}

      {loadingSession && (
        <Flex align="center" justify="center" style={{ padding: '8px 16px' }}>
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>Loading session…</Text>
        </Flex>
      )}

      {!loading && sessions.length === 0 && !error && (
        <Flex flex={1} align="center" justify="center" style={{ padding: '32px 16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary">
                No saved sessions yet. Use <Text code>codeLog.uploadLogs()</Text> or{' '}
                <Text code>codeLog.flushOfflineBuffer()</Text> to save.
              </Text>
            }
          />
        </Flex>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <List
          dataSource={sessions}
          renderItem={(s) => (
            <List.Item
              actions={[
                <Tooltip title="View" key="view">
                  <Button type="link" icon={<EyeOutlined />} size="small" onClick={() => handleOpen(s.id)}>
                    View
                  </Button>
                </Tooltip>,
                <Popconfirm
                  key="delete"
                  title="Delete this saved session?"
                  onConfirm={() => handleDelete(s.id)}
                  okText="Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="link" danger icon={<DeleteOutlined />} size="small">
                    Delete
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Text code style={{ fontSize: 12 }}>{s.deviceId.slice(0, 12)}…</Text>
                }
                description={
                  <Space size={12} wrap>
                    <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(s.startTime)}</Text>
                    <Text style={{ fontSize: 11, color: '#1890ff' }}>{s.entryCount} entries</Text>
                    {s.projectId && <Tag color="purple" style={{ fontSize: 10 }}>{s.projectId}</Tag>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </Flex>
  );
}
