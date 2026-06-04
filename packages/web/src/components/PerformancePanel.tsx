import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Card,
  Statistic,
  Tag,
  Table,
  Space,
  Typography,
  Flex,
  Segmented,
  Spin,
  Empty,
} from 'antd';
import {
  BarChartOutlined,
  TrophyOutlined,
  AimOutlined,
  CodeOutlined,
  WarningOutlined,
  InboxOutlined,
  InteractionOutlined,
  TagOutlined,
  DashboardOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import { usePerformance } from '../hooks/usePerformance.js';
import { useI18n } from '../i18n/index.js';
import { api } from '../api/client.js';
import type {
  WebVital,
  PerformanceSample,
  LongTask,
  ResourceTiming,
  InteractionTiming,
  UserMark,
} from '../types/index.js';

const { Text } = Typography;

interface PerformancePanelProps {
  deviceId?: string;
}

// Google Web Vitals 阈值
const VITAL_THRESHOLDS: Record<string, { good: number; poor: number; unit: string; desc: string }> =
  {
    LCP: { good: 2500, poor: 4000, unit: 'ms', desc: 'Largest Contentful Paint' },
    FID: { good: 100, poor: 300, unit: 'ms', desc: 'First Input Delay' },
    INP: { good: 200, poor: 500, unit: 'ms', desc: 'Interaction to Next Paint' },
    CLS: { good: 0.1, poor: 0.25, unit: '', desc: 'Cumulative Layout Shift' },
    FCP: { good: 1800, poor: 3000, unit: 'ms', desc: 'First Contentful Paint' },
    TTFB: { good: 800, poor: 1800, unit: 'ms', desc: 'Time to First Byte' },
  };

const RATING_TAG_COLOR: Record<string, string> = {
  good: 'success',
  'needs-improvement': 'warning',
  poor: 'error',
};

function VitalCard({ vital }: { vital: WebVital }) {
  const meta = VITAL_THRESHOLDS[vital.name];
  const formatted = meta?.unit === 'ms' ? `${vital.value.toFixed(0)}ms` : vital.value.toFixed(3);
  const { t } = useI18n();
  const ratingLabel: Record<string, string> = {
    good: t.perfPanel.ratingGood,
    'needs-improvement': t.perfPanel.ratingNeedsImprovement,
    poor: t.perfPanel.ratingPoor,
  };

  return (
    <Card size="small" style={{ borderTop: `3px solid var(--ant-color-${RATING_TAG_COLOR[vital.rating]})` }}>
      <Statistic
        title={<Text strong style={{ letterSpacing: 0.5 }}>{vital.name}</Text>}
        value={formatted}
        valueStyle={{ fontSize: 20 }}
      />
      <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tag color={RATING_TAG_COLOR[vital.rating]}>{ratingLabel[vital.rating]}</Tag>
        {meta && <Text type="secondary" style={{ fontSize: 10 }}>{meta.desc}</Text>}
      </div>
    </Card>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: 'var(--ant-color-bg-elevated)', border: '1px solid var(--ant-color-border)', borderRadius: 4, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontSize: 12 }}>
          {p.name}:{' '}
          <strong>
            {p.value}
            {p.dataKey === 'fps' ? ' fps' : ' MB'}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function PerformancePanel({ deviceId }: PerformancePanelProps) {
  const { report, loading } = usePerformance(deviceId);
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    if (!deviceId) return;
    let timer: ReturnType<typeof setInterval>;
    const fetchHealth = async () => {
      setHealthLoading(true);
      try {
        const data = await api.get(`/api/devices/${deviceId}/health`);
        setHealthData(data);
      } catch { /* ignore */ }
      setHealthLoading(false);
    };
    fetchHealth();
    timer = setInterval(fetchHealth, 10000);
    return () => clearInterval(timer);
  }, [deviceId]);

  if (!deviceId) {
    return (
      <Flex vertical align="center" justify="center" style={{ height: '100%' }} gap={12}>
        <BarChartOutlined style={{ fontSize: 48, opacity: 0.3 }} />
        <Text type="secondary">从左侧选择设备查看性能数据</Text>
      </Flex>
    );
  }

  const samples: PerformanceSample[] = report?.samples ?? [];
  const longTasks: LongTask[] = report?.longTasks ?? [];
  const resources: ResourceTiming[] = report?.resources ?? [];
  const interactions: InteractionTiming[] = report?.interactions ?? [];
  const userMarks: UserMark[] = report?.marks ?? [];

  const chartData = samples.map((s) => ({
    time: formatTime(s.timestamp),
    fps: s.fps,
    heapUsed: s.heapUsed,
    heapTotal: s.heapTotal,
  }));

  const latestSample = samples[samples.length - 1];
  const hasMemory = samples.some((s) => s.heapUsed !== undefined);

  // Resource filter
  const resourceTypes = [
    'all',
    ...Array.from(new Set(resources.map((r) => r.initiatorType))).sort(),
  ];
  const filteredResources =
    resourceFilter === 'all'
      ? [...resources].sort((a, b) => b.duration - a.duration).slice(0, 50)
      : resources
          .filter((r) => r.initiatorType === resourceFilter)
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 50);

  function formatBytes(b: number): string {
    if (b === 0) return '(cache)';
    if (b < 1024) return `${b}B`;
    return `${(b / 1024).toFixed(1)}KB`;
  }

  // Long Tasks table columns
  const longTaskColumns = [
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (v: number) => `${v.toFixed(0)}ms`,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      render: (v: number) => (
        <Text style={{ color: v > 200 ? '#ff4d4f' : '#faad14', fontWeight: 600 }}>{v}ms</Text>
      ),
    },
    {
      title: '来源',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
  ];

  // Resource Timing table columns
  const resourceColumns = [
    {
      title: 'URL',
      dataIndex: 'name',
      key: 'name',
      width: '50%',
      render: (v: string) => (
        <Text code style={{ fontSize: 11 }} ellipsis title={v}>
          {v.replace(/^https?:\/\/[^/]+/, '').slice(0, 60) || v.slice(0, 60)}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'initiatorType',
      key: 'initiatorType',
      render: (v: string) => <Text style={{ fontSize: 11, color: '#9cdcfe' }}>{v}</Text>,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      render: (v: number) => (
        <Text style={{ color: v > 1000 ? '#ff4d4f' : v > 300 ? '#faad14' : '#52c41a', fontWeight: 600 }}>
          {v}ms
        </Text>
      ),
    },
    {
      title: '大小',
      dataIndex: 'transferSize',
      key: 'transferSize',
      render: (v: number) => <Text type="secondary" style={{ fontSize: 11 }}>{formatBytes(v)}</Text>,
    },
  ];

  // Interaction table columns
  const interactionColumns = [
    {
      title: '交互类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Text style={{ color: '#9cdcfe' }}>{v}</Text>,
    },
    {
      title: '延迟',
      dataIndex: 'duration',
      key: 'duration',
      render: (v: number) => (
        <Text style={{ color: v > 200 ? '#ff4d4f' : v > 100 ? '#faad14' : '#52c41a', fontWeight: 600 }}>
          {v}ms
        </Text>
      ),
    },
    {
      title: '目标元素',
      dataIndex: 'target',
      key: 'target',
      render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v || '—'}</Text>,
    },
    {
      title: '触发时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (v: number) => <Text type="secondary" style={{ fontSize: 11 }}>{v.toFixed(0)}ms</Text>,
    },
  ];

  // User Marks table columns
  const userMarkColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => (
        <Text style={{ color: v === 'measure' ? '#9cdcfe' : '#ce9178', fontSize: 11 }}>{v}</Text>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: '45%',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '起始 (ms)',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (v: number) => <Text type="secondary" style={{ fontSize: 11 }}>{v.toFixed(1)}</Text>,
    },
    {
      title: '耗时 (ms)',
      dataIndex: 'duration',
      key: 'duration',
      render: (v: number | null) => (
        <Text style={{ color: v != null ? '#52c41a' : undefined, fontSize: 11 }}>
          {v != null ? `${v.toFixed(1)}ms` : '—'}
        </Text>
      ),
    },
  ];

  return (
    <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ant-color-border-secondary)', flexShrink: 0 }}>
        <Flex align="center" gap={12}>
          <Text strong style={{ fontSize: 14 }}>Performance</Text>
          {loading && (
            <Space>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>加载中</Text>
            </Space>
          )}
          {latestSample && (
            <Tag color="success" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#52c41a', display: 'inline-block' }} />
              LIVE · {latestSample.fps} fps
              {latestSample.heapUsed !== undefined && ` · 内存 ${latestSample.heapUsed} MB`}
            </Tag>
          )}
        </Flex>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Health Summary */}
        <Card
          size="small"
          title={<Space><HeartOutlined />Health</Space>}
          style={{ marginBottom: 0 }}
        >
          {healthLoading ? (
            <Spin size="small" />
          ) : healthData ? (
            <Flex gap={16} wrap="wrap">
              <Statistic
                title="Status"
                value={healthData.status === 'healthy' ? 'Healthy' : healthData.status === 'warning' ? 'Warning' : 'Critical'}
                valueStyle={{ color: healthData.status === 'healthy' ? '#52c41a' : healthData.status === 'warning' ? '#faad14' : '#ff4d4f', fontSize: 14 }}
              />
              {healthData.metrics && Object.entries(healthData.metrics).map(([key, val]: [string, any]) => (
                <Statistic
                  key={key}
                  title={key}
                  value={typeof val === 'number' ? (key.toLowerCase().includes('duration') || key.toLowerCase().includes('time') ? `${val}ms` : key.toLowerCase().includes('memory') ? `${val}MB` : val) : String(val)}
                  valueStyle={{ fontSize: 14 }}
                />
              ))}
            </Flex>
          ) : (
            <Typography.Text type="secondary">No health data available</Typography.Text>
          )}
        </Card>

        {/* Web Vitals 卡片 */}
        <Card
          size="small"
          title={
            <Space>
              <TrophyOutlined />
              Core Web Vitals
            </Space>
          }
        >
          {!report || report.vitals.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">等待设备上报 Web Vitals（需页面交互才能触发部分指标）</Text>}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {report.vitals.map((v) => (
                <VitalCard key={v.name} vital={v} />
              ))}
            </div>
          )}
        </Card>

        {/* FPS 折线图 */}
        <Card
          size="small"
          title={
            <Space>
              <AimOutlined />
              FPS（帧率）
            </Space>
          }
        >
          {chartData.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">等待采样数据（每 3 秒采集一次）...</Text>}
            />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#888', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis domain={[0, 70]} tick={{ fill: '#888', fontSize: 11 }} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={60}
                  stroke="#52c41a66"
                  strokeDasharray="4 2"
                  label={{ value: '60fps', fill: '#52c41a', fontSize: 10 }}
                />
                <ReferenceLine
                  y={30}
                  stroke="#faad1466"
                  strokeDasharray="4 2"
                  label={{ value: '30fps', fill: '#faad14', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="fps"
                  name="FPS"
                  stroke="#4fc3f7"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* 内存折线图（仅 Chrome 支持） */}
        {hasMemory && (
          <Card
            size="small"
            title={
              <Space>
                <CodeOutlined />
                JS 堆内存（MB，仅 Chrome）
              </Space>
            }
          >
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#888', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#888', fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="heapUsed"
                  name="已用"
                  stroke="#ce93d8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="heapTotal"
                  name="分配"
                  stroke="#5c6bc0"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Long Tasks */}
        <Card
          size="small"
          title={
            <Space>
              <WarningOutlined />
              Long Tasks（主线程阻塞 &gt;50ms）
              {longTasks.length > 0 && <Tag>{longTasks.length}</Tag>}
            </Space>
          }
        >
          {longTasks.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">暂无 Long Task（&gt;50ms 阻塞任务，需浏览器支持 longtask API）</Text>}
            />
          ) : (
            <Table
              dataSource={[...longTasks].sort((a, b) => b.duration - a.duration).slice(0, 30).map((item, i) => ({ ...item, key: i }))}
              columns={longTaskColumns}
              size="small"
              pagination={false}
              scroll={{ y: 240 }}
            />
          )}
        </Card>

        {/* Resource Timing */}
        <Card
          size="small"
          title={
            <Space>
              <InboxOutlined />
              资源加载（耗时 Top 50）
              {resources.length > 0 && <Tag>{resources.length} 条</Tag>}
            </Space>
          }
          extra={
            resources.length > 0 ? (
              <Segmented
                size="small"
                value={resourceFilter}
                onChange={(val) => setResourceFilter(val as string)}
                options={resourceTypes.map((t) => ({ label: t, value: t }))}
              />
            ) : null
          }
        >
          {filteredResources.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">暂无资源加载数据</Text>}
            />
          ) : (
            <Table
              dataSource={filteredResources.map((item, i) => ({ ...item, key: i }))}
              columns={resourceColumns}
              size="small"
              pagination={false}
              scroll={{ y: 240 }}
            />
          )}
        </Card>

        {/* Interactions */}
        {interactions.length > 0 && (
          <Card
            size="small"
            title={
              <Space>
                <InteractionOutlined />
                交互延迟（近 {Math.min(interactions.length, 30)} 次）
                <Tag>{interactions.length}</Tag>
              </Space>
            }
          >
            <Table
              dataSource={[...interactions].reverse().slice(0, 30).map((item, i) => ({ ...item, key: i }))}
              columns={interactionColumns}
              size="small"
              pagination={false}
              scroll={{ y: 240 }}
            />
          </Card>
        )}

        {/* User Timing Marks & Measures */}
        {userMarks.length > 0 && (
          <Card
            size="small"
            title={
              <Space>
                <TagOutlined />
                自定义标记 (performance.mark / measure)
                <Tag>{userMarks.length}</Tag>
              </Space>
            }
          >
            <Table
              dataSource={[...userMarks].slice(-50).reverse().map((item, i) => ({ ...item, key: i }))}
              columns={userMarkColumns}
              size="small"
              pagination={false}
              scroll={{ y: 240 }}
            />
          </Card>
        )}

        {/* 无数据兜底 */}
        {!loading && !report && (
          <Flex vertical align="center" justify="center" gap={10} style={{ padding: '60px 0' }}>
            <DashboardOutlined style={{ fontSize: 32, opacity: 0.3 }} />
            <Text type="secondary">等待设备接入并上报性能数据...</Text>
          </Flex>
        )}
      </div>
    </Flex>
  );
}
