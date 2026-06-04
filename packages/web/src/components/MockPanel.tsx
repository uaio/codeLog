import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Flex,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
  Empty,
  Spin,
  message,
  Card,
} from 'antd';
import {
  SwapOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface MockPanelProps {
  deviceId?: string;
}

interface MockRule {
  id: string;
  pattern: string;
  method?: string;
  status: number;
  body?: string;
  delay?: number;
  headers?: Record<string, string>;
  createdAt: number;
  enabled: boolean;
  matchCount: number;
}

interface MockRuleForm {
  pattern: string;
  method: string;
  status: number;
  body: string;
  delay: number;
  headersText: string;
}

const defaultForm: MockRuleForm = {
  pattern: '',
  method: 'GET',
  status: 200,
  body: '{"ok":true}',
  delay: 0,
  headersText: '',
};

export function MockPanel({ deviceId }: MockPanelProps) {
  const [form] = Form.useForm<MockRuleForm>();
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<MockRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();

  // 加载已有规则
  const loadRules = useCallback(async () => {
    if (!deviceId) return;
    setLoadingRules(true);
    try {
      const data = await api.get(`/api/devices/${deviceId}/mocks`);
      setRules(Array.isArray(data) ? data : []);
    } catch {
      setRules([]);
    } finally {
      setLoadingRules(false);
    }
  }, [deviceId]);

  useEffect(() => {
    setRules([]);
    loadRules();
  }, [loadRules]);

  const handleSubmit = useCallback(async () => {
    if (!deviceId) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      // Parse headersText: "Key: Value\nKey2: Value2"
      const headers: Record<string, string> = {};
      for (const line of values.headersText.split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
      await api.post(`/api/devices/${deviceId}/mocks`, {
        pattern: values.pattern,
        method: values.method || undefined,
        status: Number(values.status),
        headers,
        body: values.body,
        delay: values.delay > 0 ? values.delay : undefined,
      });
      messageApi.success('Mock 规则已添加到设备');
      form.resetFields();
      setModalOpen(false);
      loadRules();
    } catch (e: any) {
      if (e.message) {
        messageApi.error('失败: ' + e.message);
      }
    } finally {
      setSaving(false);
    }
  }, [deviceId, form, loadRules, messageApi]);

  const handleRemoveRule = useCallback(
    async (mockId: string) => {
      if (!deviceId) return;
      try {
        await api.delete(`/api/devices/${deviceId}/mocks/${mockId}`);
        setRules((prev) => prev.filter((r) => r.id !== mockId));
      } catch (e: any) {
        messageApi.error('删除失败: ' + e.message);
      }
    },
    [deviceId, messageApi],
  );

  const handleToggleRule = useCallback(
    async (mockId: string) => {
      if (!deviceId) return;
      try {
        const result = await api.patch(`/api/devices/${deviceId}/mocks/${mockId}`, {});
        if (result?.rule) {
          setRules((prev) => prev.map((r) => r.id === mockId ? { ...r, enabled: result.rule.enabled } : r));
        }
      } catch (e: any) {
        messageApi.error('切换失败: ' + e.message);
      }
    },
    [deviceId, messageApi],
  );

  const handleClearAll = useCallback(async () => {
    if (!deviceId) return;
    try {
      await api.delete(`/api/devices/${deviceId}/mocks`);
      setRules([]);
      messageApi.success('已清空所有 Mock 规则');
    } catch (e: any) {
      messageApi.error('失败: ' + e.message);
    }
  }, [deviceId, messageApi]);

  const handleExport = useCallback(() => {
    if (rules.length === 0) return;
    const exportable = rules.map(({ pattern, method, status, body, delay, headers }) => ({
      pattern,
      method: method || 'GET',
      status,
      body: body ?? '',
      ...(delay ? { delay } : {}),
      ...(headers && Object.keys(headers).length ? { headers } : {}),
    }));
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock-rules-${deviceId ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rules, deviceId]);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !deviceId) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error('文件格式不正确，需要 JSON 数组');
        let successCount = 0;
        for (const rule of imported) {
          if (!rule.pattern) continue;
          await api.post(`/api/devices/${deviceId}/mocks`, {
            pattern: rule.pattern,
            method: rule.method ?? 'GET',
            status: Number(rule.status ?? 200),
            headers: rule.headers ?? {},
            body: rule.body ?? '',
            delay: rule.delay ?? undefined,
          });
          successCount++;
        }
        messageApi.success(`已导入 ${successCount} 条规则`);
        loadRules();
      } catch (err: any) {
        messageApi.error('导入失败: ' + err.message);
      } finally {
        if (importInputRef.current) importInputRef.current.value = '';
      }
    },
    [deviceId, loadRules, messageApi],
  );

  // Table columns
  const columns = [
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 60,
      render: (enabled: boolean, record: MockRule) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={() => handleToggleRule(record.id)}
        />
      ),
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (v: string) => <Tag color="blue">{v || 'ANY'}</Tag>,
    },
    {
      title: 'Pattern',
      dataIndex: 'pattern',
      key: 'pattern',
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }} ellipsis title={v}>{v}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 70,
      render: (v: number) => (
        <Text style={{ color: v >= 400 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{v}</Text>
      ),
    },
    {
      title: '命中',
      dataIndex: 'matchCount',
      key: 'matchCount',
      width: 70,
      render: (v: number) => v > 0 ? <Tag color="purple">{v}次</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: '延迟',
      dataIndex: 'delay',
      key: 'delay',
      width: 80,
      render: (v: number) => v && v > 0 ? <Tag color="orange">{v}ms</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: unknown, record: MockRule) => (
        <Popconfirm
          title="确认删除此规则？"
          onConfirm={() => handleRemoveRule(record.id)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  if (!deviceId) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: '100%' }} gap={12}>
        <SwapOutlined style={{ fontSize: 48, opacity: 0.3 }} />
        <Text type="secondary">请选择设备后使用 Mock</Text>
      </Flex>
    );
  }

  return (
    <Flex vertical style={{ height: '100%', overflow: 'auto', padding: 16, maxWidth: 700 }}>
      {contextHolder}

      {/* Header */}
      <Flex align="center" justify="space-between" style={{ marginBottom: 16 }}>
        <Space>
          <SwapOutlined />
          <Text strong style={{ fontSize: 16 }}>API Mock</Text>
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setModalOpen(true);
            }}
          >
            {t.mockPanel.addRule}
          </Button>
          <Popconfirm
            title={t.mockPanel.clearAllConfirm}
            onConfirm={handleClearAll}
            okText="清空"
            cancelText="取消"
          >
            <Button
              danger
              disabled={rules.length === 0}
              icon={<DeleteOutlined />}
            >
              {t.mockPanel.clearAll}
            </Button>
          </Popconfirm>
          <Button
            icon={<ExportOutlined />}
            disabled={rules.length === 0}
            onClick={handleExport}
            title="导出规则为 JSON 文件"
          >
            导出
          </Button>
          <Button
            icon={<ImportOutlined />}
            onClick={() => importInputRef.current?.click()}
            title="从 JSON 文件导入规则"
          >
            导入
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </Space>
      </Flex>

      {/* 规则列表 */}
      <Card size="small">
        {loadingRules && rules.length === 0 ? (
          <Flex justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : rules.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary">暂无 Mock 规则，点击上方按钮添加</Text>}
          />
        ) : (
          <Table
            dataSource={rules.map((r) => ({ ...r, key: r.id }))}
            columns={columns}
            size="small"
            pagination={false}
          />
        )}
      </Card>

      {/* 使用说明 */}
      <Card size="small" style={{ marginTop: 16 }}>
        <Paragraph type="secondary" style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 0 }}>
          <div>Mock 规则会直接推送到设备端，由 SDK 拦截 fetch 请求</div>
          <div>URL 匹配支持正则表达式，如 <Text code>/api/.*</Text></div>
          <div>关闭 App 后规则自动清除</div>
        </Paragraph>
      </Card>

      {/* 添加规则 Modal */}
      <Modal
        title={<Space><PlusOutlined /> {t.mockPanel.addRule}</Space>}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="添加"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={defaultForm}
        >
          <Form.Item
            name="pattern"
            label="URL 匹配规则（支持正则）"
            rules={[{ required: true, message: '请输入 URL 匹配规则' }]}
          >
            <Input placeholder="/api/user" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="method" label="Method" style={{ width: 140 }}>
              <Select>
                <Select.Option value="GET">GET</Select.Option>
                <Select.Option value="POST">POST</Select.Option>
                <Select.Option value="PUT">PUT</Select.Option>
                <Select.Option value="DELETE">DELETE</Select.Option>
                <Select.Option value="PATCH">PATCH</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Status Code" style={{ width: 140 }}>
              <InputNumber min={100} max={599} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item name="body" label="Response Body (JSON)">
            <TextArea rows={4} style={{ fontFamily: 'monospace' }} />
          </Form.Item>

          <Form.Item name="delay" label="延迟 (ms)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>

          <Form.Item name="headersText" label="响应 Headers（每行 Key: Value，可选）">
            <TextArea
              rows={2}
              placeholder={'X-Custom-Header: value\nAnother-Header: value2'}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
