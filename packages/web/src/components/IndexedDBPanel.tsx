import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tabs,
  Table,
  Button,
  Select,
  Space,
  Typography,
  Empty,
  Spin,
  Modal,
  Input,
  Flex,
  Tag,
  Popconfirm,
  Descriptions,
  Tooltip,
} from 'antd';
import {
  TableOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  DownOutlined,
  RightOutlined,
  DatabaseOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { api } from '../api/client.js';
import { websocketManager } from '../lib/websocketManager.js';
import type { IDBOperationEntry } from '../types/index.js';

interface IndexedDBPanelProps {
  deviceId?: string;
}

// ── Types for the database browser ───────────────────────────────────────────

interface IDBIndexInfo {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

interface IDBStoreSchema {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IDBIndexInfo[];
  count: number;
}

interface IDBDatabaseInfo {
  name: string;
  version: number;
  stores: IDBStoreSchema[];
}

interface IDBSnapshot {
  databases: IDBDatabaseInfo[];
  ts: number;
}

interface IDBStoreData {
  dbName: string;
  storeName: string;
  page: number;
  pageSize: number;
  total: number;
  records: unknown[];
  keys?: unknown[];
  keyPath?: string | string[] | null;
  reqId: string;
}

// ── Operation tag color map ──────────────────────────────────────────────────

const OP_TAG_COLOR: Record<string, string> = {
  get: 'blue',
  getAll: 'purple',
  put: 'success',
  add: 'cyan',
  delete: 'error',
  clear: 'warning',
  count: 'orange',
  openCursor: 'default',
};

// ── Tab: Operations Log ───────────────────────────────────────────────────────

function OperationsLog({ deviceId }: { deviceId: string }) {
  const [entries, setEntries] = useState<IDBOperationEntry[]>([]);
  const [selected, setSelected] = useState<IDBOperationEntry | null>(null);
  const [filterDB, setFilterDB] = useState<string>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterOp, setFilterOp] = useState<string>('all');
  const appendRef = useRef<(e: IDBOperationEntry) => void>(() => {});

  appendRef.current = (entry: IDBOperationEntry) => {
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > 500 ? next.slice(-500) : next;
    });
  };

  useEffect(() => {
    api.getIndexedDB(deviceId).then(setEntries).catch(() => setEntries([]));

    const unsub = websocketManager.subscribe((msg: any) => {
      if (msg.type === 'event' && msg.deviceId === deviceId && msg.envelope?.type === 'indexeddb') {
        appendRef.current({ ...msg.envelope.data, deviceId, tabId: msg.envelope.tabId });
      }
    });
    return unsub;
  }, [deviceId]);

  const dbNames = Array.from(new Set(entries.map((e) => e.dbName)));
  const storeNames = Array.from(
    new Set(
      entries
        .filter((e) => filterDB === 'all' || e.dbName === filterDB)
        .map((e) => e.storeName),
    ),
  );

  const filtered = entries.filter((e) => {
    if (filterDB !== 'all' && e.dbName !== filterDB) return false;
    if (filterStore !== 'all' && e.storeName !== filterStore) return false;
    if (filterOp !== 'all' && e.operation !== filterOp) return false;
    return true;
  });

  const columns = [
    {
      title: 'Operation',
      dataIndex: 'operation',
      width: 100,
      render: (op: string) => (
        <Tag color={OP_TAG_COLOR[op] || 'default'} style={{ fontFamily: 'monospace', fontSize: 11 }}>
          {op}
        </Tag>
      ),
    },
    { title: 'Database', dataIndex: 'dbName', width: 120, ellipsis: true },
    { title: 'Store', dataIndex: 'storeName', ellipsis: true },
    {
      title: 'Duration',
      dataIndex: 'duration',
      width: 80,
      align: 'right' as const,
      render: (v: number | undefined) => (v !== undefined ? `${v}ms` : '-'),
    },
    {
      title: 'Error',
      dataIndex: 'error',
      width: 60,
      render: (v: string | undefined) =>
        v ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : null,
    },
    {
      title: '',
      width: 50,
      render: (_: unknown, record: IDBOperationEntry) => (
        <Button type="link" size="small" onClick={() => setSelected(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Flex vertical style={{ flex: 1, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Flex gap={8} align="center" style={{ padding: '8px 12px', flexShrink: 0 }}>
        <Select
          value={filterDB}
          onChange={(val) => {
            setFilterDB(val);
            setFilterStore('all');
          }}
          size="small"
          style={{ width: 140 }}
          options={[{ value: 'all', label: 'All DBs' }, ...dbNames.map((db) => ({ value: db, label: db }))]}
        />
        <Select
          value={filterStore}
          onChange={setFilterStore}
          size="small"
          style={{ width: 140 }}
          options={[{ value: 'all', label: 'All Stores' }, ...storeNames.map((st) => ({ value: st, label: st }))]}
        />
        <Select
          value={filterOp}
          onChange={setFilterOp}
          size="small"
          style={{ width: 120 }}
          options={[
            { value: 'all', label: 'All Ops' },
            ...['get', 'getAll', 'put', 'add', 'delete', 'clear', 'count', 'openCursor'].map((op) => ({
              value: op,
              label: op,
            })),
          ]}
        />
        <Popconfirm title="确认清空所有日志？" onConfirm={() => setEntries([])} okText="清空" cancelText="取消">
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
        <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
          {filtered.length}
        </Typography.Text>
      </Flex>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 IndexedDB 操作记录" />
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={false}
            onRow={(record) => ({
              onClick: () => setSelected(record),
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </div>

      {/* Detail modal */}
      <Modal
        title={
          <Space>
            <Tag color={OP_TAG_COLOR[selected?.operation || ''] || 'default'}>
              {selected?.operation}
            </Tag>
            <Typography.Text type="secondary">
              {selected?.dbName} / {selected?.storeName}
            </Typography.Text>
          </Space>
        }
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        width={520}
        destroyOnClose
      >
        {selected && (
          <Flex vertical>
            {selected.error && (
              <Tag color="error" icon={<ExclamationCircleOutlined />} style={{ marginBottom: 8 }}>
                {selected.error}
              </Tag>
            )}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Operation">{selected.operation}</Descriptions.Item>
              <Descriptions.Item label="Database">{selected.dbName}</Descriptions.Item>
              <Descriptions.Item label="Store">{selected.storeName}</Descriptions.Item>
              {selected.key !== undefined && (
                <Descriptions.Item label="Key">
                  <Typography.Text code style={{ fontSize: 11 }}>
                    {JSON.stringify(selected.key)}
                  </Typography.Text>
                </Descriptions.Item>
              )}
              {selected.value !== undefined && (
                <Descriptions.Item label="Value">
                  <Input.TextArea
                    readOnly
                    value={JSON.stringify(selected.value, null, 2)}
                    rows={4}
                    style={{ fontFamily: 'monospace', fontSize: 11 }}
                  />
                </Descriptions.Item>
              )}
              {selected.result !== undefined && (
                <Descriptions.Item label="Result">
                  <Input.TextArea
                    readOnly
                    value={JSON.stringify(selected.result, null, 2)}
                    rows={4}
                    style={{ fontFamily: 'monospace', fontSize: 11 }}
                  />
                </Descriptions.Item>
              )}
              {selected.duration !== undefined && (
                <Descriptions.Item label="Duration">{selected.duration}ms</Descriptions.Item>
              )}
              <Descriptions.Item label="Time">
                {new Date(selected.timestamp).toLocaleTimeString()}
              </Descriptions.Item>
            </Descriptions>
          </Flex>
        )}
      </Modal>
    </Flex>
  );
}

// ── Tab: Database Browser ─────────────────────────────────────────────────────

function DatabaseBrowser({ deviceId }: { deviceId: string }) {
  const [snapshot, setSnapshot] = useState<IDBSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<{ dbName: string; storeName: string } | null>(null);
  const [storeData, setStoreData] = useState<IDBStoreData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedDBs, setExpandedDBs] = useState<Set<string>>(new Set());
  const pendingReqRef = useRef<string | null>(null);
  // Record edit
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<{ index: number; json: string; key?: unknown } | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const requestSnapshot = useCallback(() => {
    if (!deviceId) return;
    setLoading(true);
    websocketManager.send({ type: 'request_idb_snapshot', deviceId });

    const start = Date.now();
    const TIMEOUT = 10_000;
    const poll = () => {
      if (Date.now() - start > TIMEOUT) {
        setLoading(false);
        return;
      }
      api
        .getIDBSnapshot(deviceId)
        .then((data) => {
          if (data && (snapshot === null || data.ts > (snapshot?.ts ?? 0))) {
            setSnapshot(data);
            setLoading(false);
            setExpandedDBs(new Set(data.databases.map((d: IDBDatabaseInfo) => d.name)));
          } else {
            setTimeout(poll, 600);
          }
        })
        .catch(() => setTimeout(poll, 600));
    };
    setTimeout(poll, 800);
  }, [deviceId, snapshot]);

  useEffect(() => {
    const unsub = websocketManager.subscribe((msg: any) => {
      if (msg.type === 'event' && msg.deviceId === deviceId && msg.envelope?.type === 'idb_snapshot') {
        setSnapshot(msg.envelope.data);
        setLoading(false);
        setExpandedDBs(new Set(msg.envelope.data.databases.map((d: IDBDatabaseInfo) => d.name)));
      }
      if (
        msg.type === 'event' &&
        msg.deviceId === deviceId &&
        msg.envelope?.type === 'idb_store_data' &&
        msg.envelope.data.reqId === pendingReqRef.current
      ) {
        setStoreData(msg.envelope.data);
        setDataLoading(false);
        pendingReqRef.current = null;
      }
    });
    return unsub;
  }, [deviceId]);

  const loadStoreData = useCallback(
    (dbName: string, storeName: string, page = 0) => {
      const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingReqRef.current = reqId;
      setSelectedStore({ dbName, storeName });
      setDataLoading(true);
      websocketManager.send({
        type: 'request_idb_store_data',
        deviceId,
        dbName,
        storeName,
        page,
        pageSize: 50,
        reqId,
      });

      const start = Date.now();
      const poll = () => {
        if (Date.now() - start > 8_000 || pendingReqRef.current !== reqId) return;
        api
          .getIDBStoreData(deviceId, reqId)
          .then((data) => {
            if (data) {
              setStoreData(data);
              setDataLoading(false);
              pendingReqRef.current = null;
            } else {
              setTimeout(poll, 600);
            }
          })
          .catch(() => setTimeout(poll, 600));
      };
      setTimeout(poll, 800);
    },
    [deviceId],
  );

  const toggleDB = (dbName: string) => {
    setExpandedDBs((prev) => {
      const next = new Set(prev);
      if (next.has(dbName)) next.delete(dbName);
      else next.add(dbName);
      return next;
    });
  };

  const handleClearStore = (dbName: string, storeName: string, _count: number) => {
    websocketManager.send({ type: 'idb_clear_store', deviceId, dbName, storeName });
    if (selectedStore?.dbName === dbName && selectedStore?.storeName === storeName) {
      setStoreData(null);
    }
    setTimeout(requestSnapshot, 1500);
  };

  const handleSaveRecord = () => {
    if (!editRecord || !selectedStore) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(editText);
    } catch {
      setEditError('JSON 格式错误，请检查后重试');
      return;
    }
    setSaving(true);
    websocketManager.send({
      type: 'idb_put_record',
      deviceId,
      dbName: selectedStore.dbName,
      storeName: selectedStore.storeName,
      key: editRecord.key,
      value: parsed,
    });
    setTimeout(() => {
      setSaving(false);
      setEditModalOpen(false);
      setEditRecord(null);
      loadStoreData(selectedStore.dbName, selectedStore.storeName, storeData?.page ?? 0);
    }, 600);
  };

  // Build record table columns dynamically from first record keys
  const getRecordColumns = () => {
    if (!storeData || storeData.records.length === 0) return [];

    const first = storeData.records[0] as Record<string, unknown> | null;
    const keys = first && typeof first === 'object' ? Object.keys(first) : ['Value'];

    return [
      {
        title: '#',
        width: 50,
        render: (_: unknown, __: unknown, idx: number) => (
          <Typography.Text type="secondary">{storeData.page * storeData.pageSize + idx}</Typography.Text>
        ),
      },
      ...keys.slice(0, 5).map((k) => ({
        title: k,
        dataIndex: k,
        ellipsis: true as const,
        render: (v: unknown) => {
          const str = typeof v === 'string' ? v : JSON.stringify(v);
          return (
            <Typography.Text style={{ fontFamily: 'monospace', fontSize: 11 }} ellipsis={{ tooltip: str }}>
              {str}
            </Typography.Text>
          );
        },
      })),
      {
        title: '',
        width: 80,
        render: (_: unknown, record: unknown, idx: number) => {
          const json = (() => {
            try {
              return JSON.stringify(record, null, 2);
            } catch {
              return String(record);
            }
          })();
          return (
            <Space size={4}>
              <Tooltip title="编辑记录">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditRecord({
                      index: storeData.page * storeData.pageSize + idx,
                      json,
                      key: storeData.keys?.[idx],
                    });
                    setEditText(json);
                    setEditError('');
                    setEditModalOpen(true);
                  }}
                />
              </Tooltip>
              <Tooltip title="查看完整 JSON">
                <Button
                  type="text"
                  size="small"
                  icon={<UnorderedListOutlined />}
                  onClick={() => {
                    setEditRecord({
                      index: storeData.page * storeData.pageSize + idx,
                      json,
                      key: storeData.keys?.[idx],
                    });
                    setEditText(json);
                    setEditError('');
                    setEditModalOpen(true);
                  }}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ];
  };

  return (
    <Flex style={{ flex: 1, overflow: 'hidden' }}>
      {/* Left: DB tree */}
      <Flex vertical style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--ant-color-border)', overflow: 'auto', background: 'var(--ant-color-bg-layout)' }}>
        <Flex justify="space-between" align="center" style={{ padding: '8px 12px', flexShrink: 0 }}>
          <Typography.Text strong style={{ fontSize: 12 }}>
            数据库
          </Typography.Text>
          <Tooltip title="刷新数据库结构">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={requestSnapshot}
            />
          </Tooltip>
        </Flex>

        {!snapshot && !loading && (
          <Flex justify="center" style={{ padding: '16px 12px' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击刷新加载数据库结构" />
          </Flex>
        )}
        {loading && !snapshot && (
          <Flex justify="center" style={{ padding: '16px' }}>
            <Spin />
          </Flex>
        )}

        {snapshot?.databases.map((db) => (
          <div key={db.name}>
            <Flex
              align="center"
              gap={4}
              style={{ padding: '5px 8px', cursor: 'pointer', borderBottom: '1px solid var(--ant-color-border-secondary)' }}
              onClick={() => toggleDB(db.name)}
            >
              {expandedDBs.has(db.name) ? (
                <DownOutlined style={{ fontSize: 10 }} />
              ) : (
                <RightOutlined style={{ fontSize: 10 }} />
              )}
              <DatabaseOutlined style={{ fontSize: 13 }} />
              <Typography.Text strong ellipsis style={{ flex: 1, fontSize: 12 }}>
                {db.name}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                v{db.version}
              </Typography.Text>
            </Flex>

            {expandedDBs.has(db.name) &&
              db.stores.map((store) => (
                <Flex
                  key={store.name}
                  align="center"
                  gap={4}
                  style={{
                    padding: '4px 8px 4px 24px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--ant-color-border-secondary)',
                    background:
                      selectedStore?.dbName === db.name && selectedStore?.storeName === store.name
                        ? 'var(--ant-color-primary-bg)'
                        : undefined,
                  }}
                  onClick={() => loadStoreData(db.name, store.name, 0)}
                >
                  <TableOutlined style={{ fontSize: 12 }} />
                  <Typography.Text ellipsis style={{ flex: 1, fontSize: 11 }}>
                    {store.name}
                  </Typography.Text>
                  <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{store.count}</Tag>
                  <Popconfirm
                    title={`确认清空 "${db.name}" 中的 "${store.name}"？共 ${store.count} 条记录将被删除，此操作不可撤销。`}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleClearStore(db.name, store.name, store.count);
                    }}
                    okText="清空"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 12 }}
                    />
                  </Popconfirm>
                </Flex>
              ))}
          </div>
        ))}
      </Flex>

      {/* Right: Records table */}
      <Flex vertical style={{ flex: 1, overflow: 'hidden' }}>
        {!selectedStore && (
          <Flex vertical align="center" justify="center" style={{ flex: 1 }}>
            <Empty image={<BarChartOutlined style={{ fontSize: 28, opacity: 0.3 }} />} description="选择左侧 Store 查看数据" />
          </Flex>
        )}

        {selectedStore && (
          <>
            <Flex align="center" gap={8} style={{ padding: '8px 12px', flexShrink: 0 }}>
              <Typography.Text strong style={{ fontSize: 12 }}>
                {selectedStore.dbName} /{' '}
                <Typography.Text type="success">{selectedStore.storeName}</Typography.Text>
              </Typography.Text>
              {storeData && (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  共 {storeData.total} 条
                </Typography.Text>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <Space size={4}>
                  {storeData && storeData.page > 0 && (
                    <Button
                      size="small"
                      onClick={() => loadStoreData(selectedStore.dbName, selectedStore.storeName, storeData.page - 1)}
                    >
                      上一页
                    </Button>
                  )}
                  {storeData && (storeData.page + 1) * storeData.pageSize < storeData.total && (
                    <Button
                      size="small"
                      onClick={() => loadStoreData(selectedStore.dbName, selectedStore.storeName, storeData.page + 1)}
                    >
                      下一页
                    </Button>
                  )}
                </Space>
              </div>
            </Flex>

            {dataLoading && (
              <Flex justify="center" align="center" style={{ flex: 1 }}>
                <Spin tip="加载中..." />
              </Flex>
            )}

            {!dataLoading && storeData && storeData.records.length === 0 && (
              <Flex vertical align="center" justify="center" style={{ flex: 1 }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Store 为空" />
              </Flex>
            )}

            {!dataLoading && storeData && storeData.records.length > 0 && (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <Table
                  dataSource={storeData.records as Record<string, unknown>[]}
                  columns={getRecordColumns()}
                  rowKey={(_, idx) => String(idx ?? 0)}
                  size="small"
                  pagination={false}
                />
              </div>
            )}
          </>
        )}
      </Flex>

      {/* Record Edit Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>编辑记录</span>
            {editRecord && editRecord.key !== undefined && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                key: {JSON.stringify(editRecord.key)}
              </Typography.Text>
            )}
          </Space>
        }
        open={editModalOpen}
        onOk={handleSaveRecord}
        onCancel={() => {
          setEditModalOpen(false);
          setEditRecord(null);
        }}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        {editError && (
          <Tag color="error" style={{ marginBottom: 8 }}>
            {editError}
          </Tag>
        )}
        <Input.TextArea
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            setEditError('');
          }}
          rows={10}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </Flex>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function IndexedDBPanel({ deviceId }: IndexedDBPanelProps) {
  const [activeTab, setActiveTab] = useState<'ops' | 'browser'>('ops');

  if (!deviceId) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: '100%', gap: 8 }}>
        <DatabaseOutlined style={{ fontSize: 32, opacity: 0.3 }} />
        <Typography.Text type="secondary">请先选择设备</Typography.Text>
      </Flex>
    );
  }

  const tabItems = [
    {
      key: 'ops',
      label: (
        <Space>
          <UnorderedListOutlined />
          操作日志
        </Space>
      ),
    },
    {
      key: 'browser',
      label: (
        <Space>
          <DatabaseOutlined />
          数据库浏览器
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical style={{ height: '100%' }}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'ops' | 'browser')}
        items={tabItems}
        size="small"
        style={{ paddingLeft: 16, paddingRight: 16, flexShrink: 0, marginBottom: 0 }}
      />
      {activeTab === 'ops' ? <OperationsLog deviceId={deviceId} /> : <DatabaseBrowser deviceId={deviceId} />}
    </Flex>
  );
}
