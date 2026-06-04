import { useState, useCallback } from 'react';
import {
  Tabs,
  Table,
  Button,
  Input,
  Modal,
  Form,
  Space,
  Typography,
  Statistic,
  Popconfirm,
  Empty,
  Spin,
  Tooltip,
  Tag,
  Flex,
  App,
} from 'antd';
import {
  DatabaseOutlined,
  ReloadOutlined,
  PlusOutlined,
  ClearOutlined,
  DeleteOutlined,
  InboxOutlined,
  SearchOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useStorage } from '../hooks/useStorage.js';
import { useI18n } from '../i18n/index.js';
import { api } from '../api/client.js';
import type { CookieEntry } from '../types/index.js';

interface StoragePanelProps {
  deviceId?: string;
}

type StorageTab = 'localStorage' | 'sessionStorage' | 'cookies';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export function StoragePanel({ deviceId }: StoragePanelProps) {
  const { snapshot, loading, refresh } = useStorage(deviceId);
  const [activeTab, setActiveTab] = useState<StorageTab>('localStorage');
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [setLoading, setSetLoading] = useState(false);
  // Inline edit state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Cookie edit state
  const [editingCookie, setEditingCookie] = useState<string | null>(null);
  const [editCookieValue, setEditCookieValue] = useState('');
  const { message } = App.useApp();
  const { t } = useI18n();

  const storageType = activeTab === 'sessionStorage' ? 'session' : 'local';

  // ── Handlers ──

  const handleDeleteKey = useCallback(
    async (key: string) => {
      if (!deviceId) return;
      try {
        await api.post(`/api/devices/${deviceId}/storage/delete`, { key, storageType });
        setTimeout(refresh, 300);
      } catch {
        message.error('删除失败');
      }
    },
    [deviceId, storageType, refresh, message],
  );

  const handleDeleteCookie = useCallback(
    async (cookieName: string) => {
      if (!deviceId) return;
      try {
        await api.post(`/api/devices/${deviceId}/storage/delete`, {
          key: cookieName,
          storageType: 'cookie',
        });
        setTimeout(refresh, 600);
      } catch {
        message.error('删除失败');
      }
    },
    [deviceId, refresh, message],
  );

  const handleEditKey = useCallback(
    async (key: string, value: string) => {
      if (!deviceId) return;
      try {
        await api.post(`/api/devices/${deviceId}/storage/set`, { key, value, storageType });
        setEditingKey(null);
        setTimeout(refresh, 300);
      } catch {
        message.error('保存失败');
      }
    },
    [deviceId, storageType, refresh, message],
  );

  const handleEditCookieValue = useCallback(
    async (cookie: CookieEntry, newValue: string) => {
      if (!deviceId) return;
      try {
        await api.post(`/api/devices/${deviceId}/storage/set`, {
          key: cookie.name,
          value: newValue,
          storageType: 'cookie',
          path: cookie.path ?? '/',
          domain: cookie.domain,
          expires: cookie.expires,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
        });
        setEditingCookie(null);
        setTimeout(refresh, 600);
      } catch {
        message.error('保存失败');
      }
    },
    [deviceId, refresh, message],
  );

  const handleAddItem = useCallback(async () => {
    if (!deviceId) return;
    const values = addForm.getFieldsValue();
    if (!values.key?.trim()) return;
    setSetLoading(true);
    try {
      const st = activeTab === 'cookies' ? 'cookie' : storageType;
      const body: Record<string, unknown> = {
        key: values.key.trim(),
        value: values.value ?? '',
        storageType: st,
      };
      if (activeTab === 'cookies') {
        body.path = '/';
      }
      await api.post(`/api/devices/${deviceId}/storage/set`, body);
      setTimeout(refresh, 300);
      addForm.resetFields();
      setAddModalOpen(false);
    } catch {
      message.error('写入失败');
    } finally {
      setSetLoading(false);
    }
  }, [deviceId, activeTab, storageType, refresh, addForm, message]);

  const handleClearStorage = useCallback(async () => {
    if (!deviceId) return;
    try {
      if (activeTab === 'cookies') {
        const entries = snapshot?.cookieEntries ?? [];
        await Promise.all(
          entries.map((c) =>
            api.post(`/api/devices/${deviceId}/storage/delete`, {
              key: c.name,
              storageType: 'cookie',
            }),
          ),
        );
      } else {
        await api.post(`/api/devices/${deviceId}/storage/clear`, { storageType });
      }
      setTimeout(refresh, 300);
    } catch {
      message.error('清空失败');
    }
  }, [deviceId, activeTab, storageType, snapshot, refresh, message]);

  // ── No device placeholder ──

  if (!deviceId) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: '100%' }}>
        <DatabaseOutlined style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }} />
        <Typography.Text type="secondary">从左侧选择一个设备查看存储</Typography.Text>
      </Flex>
    );
  }

  // ── KV Table columns (localStorage / sessionStorage) ──

  const getKVColumns = () => [
    {
      title: 'Key',
      dataIndex: 'key',
      width: '35%',
      render: (key: string) => (
        <Typography.Text code style={{ color: '#d56161' }}>
          {key}
        </Typography.Text>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      render: (value: string, record: { key: string }) => {
        const isEditing = editingKey === record.key;
        if (isEditing) {
          return (
            <Input.TextArea
              autoFocus
              size="small"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleEditKey(record.key, editValue);
                }
              }}
              onBlur={() => handleEditKey(record.key, editValue)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingKey(null);
                }
              }}
              rows={2}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          );
        }
        return (
          <Typography.Text
            style={{ fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', wordBreak: 'break-all' }}
            ellipsis={{ tooltip: value }}
            onClick={() => {
              setEditingKey(record.key);
              setEditValue(value);
            }}
          >
            {value}
          </Typography.Text>
        );
      },
    },
    {
      title: '',
      width: 60,
      render: (_: unknown, record: { key: string }) => (
        <Popconfirm
          title={`确认删除 "${record.key}"？`}
          onConfirm={() => handleDeleteKey(record.key)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ── Cookie Table columns ──

  const getCookieColumns = () => [
    {
      title: 'Name',
      dataIndex: 'name',
      width: '18%',
      render: (name: string) => (
        <Typography.Text code style={{ color: '#d56161' }}>
          {name}
        </Typography.Text>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      width: '22%',
      render: (value: string, record: CookieEntry) => {
        const isEditing = editingCookie === record.name;
        if (isEditing) {
          return (
            <Input
              autoFocus
              size="small"
              value={editCookieValue}
              onChange={(e) => setEditCookieValue(e.target.value)}
              onPressEnter={() => handleEditCookieValue(record, editCookieValue)}
              onBlur={() => handleEditCookieValue(record, editCookieValue)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingCookie(null);
              }}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          );
        }
        return (
          <Typography.Text
            style={{ fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' }}
            ellipsis={{ tooltip: value }}
            onClick={() => {
              setEditingCookie(record.name);
              setEditCookieValue(value ?? '');
            }}
          >
            {value}
          </Typography.Text>
        );
      },
    },
    { title: 'Path', dataIndex: 'path', width: '10%', render: (v: string) => v ?? '/' },
    { title: 'Domain', dataIndex: 'domain', width: '14%', render: (v: string) => v ?? '' },
    {
      title: 'Expires',
      dataIndex: 'expires',
      width: '18%',
      render: (v: string) =>
        v ? new Date(v).toLocaleString() : <Typography.Text type="secondary">Session</Typography.Text>,
    },
    {
      title: 'Secure',
      dataIndex: 'secure',
      width: '8%',
      render: (v: boolean) =>
        v ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null,
    },
    { title: 'SameSite', dataIndex: 'sameSite', width: '10%', render: (v: string) => v ?? '' },
    {
      title: '',
      width: 60,
      render: (_: unknown, record: CookieEntry) => (
        <Popconfirm
          title={`确认删除 "${record.name}"？`}
          onConfirm={() => handleDeleteCookie(record.name)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ── Render helpers ──

  const renderKVTable = (data: Record<string, string>, totalSize?: number) => {
    const q = searchQuery.toLowerCase();
    const allEntries = Object.entries(data);
    const filteredEntries = allEntries.filter(
      ([k, v]) => !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q),
    );
    const totalCount = allEntries.length;

    if (totalCount === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
    }
    if (filteredEntries.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配结果" />;
    }

    const dataSource = filteredEntries.map(([key, value]) => ({ key, value }));

    return (
      <>
        {totalSize !== undefined && (
          <Flex justify="space-between" align="center" style={{ padding: '8px 16px' }}>
            <Statistic
              title="总大小"
              value={totalSize}
              formatter={(val) => formatSize(val as number)}
              valueStyle={{ fontSize: 13 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {filteredEntries.length} / {totalCount} 条记录
            </Typography.Text>
          </Flex>
        )}
        <Table
          dataSource={dataSource}
          columns={getKVColumns()}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ y: 'calc(100vh - 380px)' }}
        />
      </>
    );
  };

  const renderCookies = (raw: string, entries?: CookieEntry[]) => {
    const q = searchQuery.toLowerCase();

    // Prefer rich cookieEntry list
    if (entries && entries.length > 0) {
      const filtered = entries.filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q),
      );

      return (
        <>
          <Flex justify="space-between" align="center" style={{ padding: '8px 16px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {filtered.length} / {entries.length} 条 Cookie
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              via cookieStore API · 点击 Value 可编辑
            </Typography.Text>
          </Flex>
          <Table
            dataSource={filtered}
            columns={getCookieColumns()}
            rowKey="name"
            size="small"
            pagination={false}
            scroll={{ x: 900, y: 'calc(100vh - 380px)' }}
          />
        </>
      );
    }

    // Fallback: parse raw document.cookie string
    if (!raw || raw.trim() === '') {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Cookie" />;
    }

    const allFallback = raw
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf('=');
        if (idx === -1) return { key: c, value: '' };
        return { key: c.slice(0, idx).trim(), value: c.slice(idx + 1).trim() };
      });

    const fallbackEntries = allFallback.filter(
      ({ key, value }) => !q || key.toLowerCase().includes(q) || value.toLowerCase().includes(q),
    );

    const dataSource = fallbackEntries.map((item) => ({ key: item.key, value: item.value }));
    return (
      <>
        <Flex justify="space-between" align="center" style={{ padding: '8px 16px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {fallbackEntries.length} / {allFallback.length} 条 Cookie
          </Typography.Text>
        </Flex>
        <Table
          dataSource={dataSource}
          columns={getKVColumns()}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ y: 'calc(100vh - 380px)' }}
        />
      </>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Flex justify="center" align="center" style={{ padding: '60px 20px' }}>
          <Spin tip="加载中..." />
        </Flex>
      );
    }
    if (!snapshot) {
      return (
        <Empty
          image={<InboxOutlined style={{ fontSize: 36, opacity: 0.5 }} />}
          description="等待设备上报存储数据，点击「刷新」获取"
        />
      );
    }
    if (activeTab === 'localStorage') {
      return renderKVTable(snapshot.localStorage, snapshot.localStorageSize);
    }
    if (activeTab === 'sessionStorage') {
      return renderKVTable(snapshot.sessionStorage, snapshot.sessionStorageSize);
    }
    return renderCookies(snapshot.cookies, snapshot.cookieEntries);
  };

  // ── Tab items ──

  const tabItems = [
    {
      key: 'localStorage',
      label: (
        <Space>
          localStorage
          {snapshot && (
            <Tag>{Object.keys(snapshot.localStorage).length}</Tag>
          )}
        </Space>
      ),
    },
    {
      key: 'sessionStorage',
      label: (
        <Space>
          sessionStorage
          {snapshot && (
            <Tag>{Object.keys(snapshot.sessionStorage).length}</Tag>
          )}
        </Space>
      ),
    },
    {
      key: 'cookies',
      label: (
        <Space>
          Cookies
          {snapshot && (
            <Tag>
              {snapshot.cookieEntries?.length ??
                snapshot.cookies?.split(';').filter(Boolean).length ??
                0}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical style={{ height: '100%' }}>
      {/* Header */}
      <Flex justify="space-between" align="center" style={{ padding: '12px 20px', flexShrink: 0 }}>
        <Space>
          <DatabaseOutlined />
          <Typography.Text strong>存储</Typography.Text>
        </Space>
        <Space>
          {snapshot && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              更新于 {formatTime(snapshot.timestamp)}
            </Typography.Text>
          )}
          <Tooltip title="刷新">
            <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={refresh}>
              刷新
            </Button>
          </Tooltip>
        </Space>
      </Flex>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as StorageTab);
          setSearchQuery('');
          setEditingKey(null);
          setEditingCookie(null);
        }}
        items={tabItems}
        size="small"
        style={{ paddingLeft: 16, paddingRight: 16, flexShrink: 0 }}
      />

      {/* Toolbar: Search + Actions */}
      <Flex gap={8} align="center" style={{ padding: '8px 16px', flexShrink: 0 }}>
        <Input
          placeholder="搜索 key / value..."
          prefix={<SearchOutlined />}
          allowClear
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 240 }}
        />
        <div style={{ flex: 1 }} />
        <Button
          size="small"
          type="primary"
          ghost
          icon={<PlusOutlined />}
          onClick={() => {
            addForm.resetFields();
            setAddModalOpen(true);
          }}
        >
          写入
        </Button>
        <Popconfirm
          title={t.storagePanel.clearConfirm}
          onConfirm={handleClearStorage}
          okText="清空"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<ClearOutlined />}>
            清空
          </Button>
        </Popconfirm>
      </Flex>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>{renderContent()}</div>

      {/* Add Modal */}
      <Modal
        title={activeTab === 'cookies' ? '设 Cookie' : '写入存储'}
        open={addModalOpen}
        onOk={handleAddItem}
        onCancel={() => setAddModalOpen(false)}
        confirmLoading={setLoading}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" size="small">
          <Form.Item
            label={activeTab === 'cookies' ? 'Cookie Name' : 'Key'}
            name="key"
            rules={[{ required: true, message: '请输入 Key' }]}
          >
            <Input placeholder={activeTab === 'cookies' ? 'Cookie Name' : 'Key'} />
          </Form.Item>
          <Form.Item label="Value" name="value">
            <Input.TextArea rows={3} placeholder="Value" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
