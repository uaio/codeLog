import { useState, useCallback } from 'react';
import {
  Button,
  Select,
  Space,
  Card,
  Statistic,
  Typography,
  Tag,
  Flex,
  Empty,
  Alert,
  List,
} from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  BugOutlined,
  DashboardOutlined,
  BulbOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { api } from '../api/client.js';

const { Text } = Typography;

interface AIAnalysisPanelProps {
  deviceId?: string;
}

interface AIAnalysisResult {
  deviceId: string;
  timestamp: number;
  summary: string;
  overallScore: number;
  issues: string[];
  recommendations: string[];
  raw: {
    errorCount: number;
    perfVitals: Array<{ name: string; value: number; rating: string }>;
    longTaskCount: number;
    health: any;
  };
}

const RATING_COLOR: Record<string, string> = {
  good: '#52c41a',
  'needs-improvement': '#faad14',
  poor: '#ff4d4f',
};

const RATING_LABEL: Record<string, string> = {
  good: '良好',
  'needs-improvement': '需改善',
  poor: '较差',
};

function formatVitalValue(name: string, value: number): string {
  if (name === 'CLS') return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

export function AIAnalysisPanel({ deviceId }: AIAnalysisPanelProps) {
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logLimit, setLogLimit] = useState(50);

  const runAnalysis = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError('');
    try {
      const [logsRes, perfRes, healthRes, storageRes] = await Promise.allSettled([
        api.get(`/api/devices/${deviceId}/logs?limit=${logLimit}&level=error`),
        api.get(`/api/devices/${deviceId}/performance`),
        api.get(`/api/devices/${deviceId}/health`),
        api.get(`/api/devices/${deviceId}/storage`),
      ]);

      const errors = logsRes.status === 'fulfilled' ? (logsRes.value ?? []) : [];
      const perf = perfRes.status === 'fulfilled' ? perfRes.value : null;
      const health = healthRes.status === 'fulfilled' ? healthRes.value : null;
      const storage = storageRes.status === 'fulfilled' ? storageRes.value : null;

      const issues: string[] = [];
      const recommendations: string[] = [];

      const errorCount = Array.isArray(errors) ? errors.length : 0;
      if (errorCount > 0) {
        issues.push(`发现 ${errorCount} 条 JS 错误`);
        (errors as any[]).slice(0, 3).forEach((e: any) => {
          issues.push(`  · ${String(e.message ?? '').slice(0, 120)}`);
        });
        recommendations.push('优先修复 JS 错误，这是影响用户体验的直接原因');
      }

      if (perf?.vitals?.length) {
        const poor = perf.vitals.filter((v: any) => v.rating === 'poor');
        const needsImprovement = perf.vitals.filter((v: any) => v.rating === 'needs-improvement');
        if (poor.length > 0) {
          issues.push(
            `${poor.length} 个 Web Vitals 指标较差: ${poor.map((v: any) => v.name).join(', ')}`,
          );
          recommendations.push('重点优化 LCP/CLS/INP 等核心 Web Vitals');
        }
        if (needsImprovement.length > 0) {
          issues.push(
            `${needsImprovement.length} 个 Web Vitals 指标需改善: ${needsImprovement.map((v: any) => v.name).join(', ')}`,
          );
        }
      }

      const longTaskCount = perf?.longTasks?.length ?? 0;
      if (longTaskCount > 5) {
        issues.push(`主线程存在 ${longTaskCount} 个长任务，可能导致卡顿`);
        recommendations.push('将耗时操作移至 Web Worker 或拆分为小任务');
      }

      if (health) {
        if ((health.memoryMB ?? 0) > 200) {
          issues.push(`内存占用较高: ${Number(health.memoryMB).toFixed(1)}MB`);
          recommendations.push('检查内存泄漏，避免持有大量引用');
        }
        if (health.uncompressedResources > 0) {
          issues.push(`${health.uncompressedResources} 个资源未压缩 (>100KB)`);
          recommendations.push('开启 gzip/brotli 压缩，减少资源体积');
        }
        if (health.uncachedResources > 10) {
          issues.push(`${health.uncachedResources} 个资源未命中缓存`);
          recommendations.push('合理配置 Cache-Control，减少重复下载');
        }
      }

      if (storage) {
        const lsSize = storage.localStorageSize ?? 0;
        if (lsSize > 3 * 1024 * 1024) {
          issues.push(`localStorage 占用 ${(lsSize / 1024 / 1024).toFixed(1)}MB，接近上限`);
          recommendations.push('清理过期 localStorage 数据，避免配额超限');
        }
      }

      if (recommendations.length === 0) recommendations.push('当前状态良好，继续保持');

      const overallScore = health?.score ?? 100;
      const summary =
        issues.length === 0
          ? '设备状态良好，未发现明显问题'
          : `发现 ${issues.length} 个问题，健康分 ${overallScore}/100`;

      setResult({
        deviceId,
        timestamp: Date.now(),
        summary,
        overallScore,
        issues,
        recommendations,
        raw: { errorCount, perfVitals: perf?.vitals ?? [], longTaskCount, health },
      });
    } catch (e: any) {
      setError(e.message ?? '分析失败');
    } finally {
      setLoading(false);
    }
  }, [deviceId, logLimit]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-analysis-${result.deviceId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Card size="small" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
        <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
          <Space>
            <RobotOutlined />
            <Text strong>智能分析</Text>
          </Space>
          <Space wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>分析错误日志条数：</Text>
            <Select
              size="small"
              value={logLimit}
              onChange={(val) => setLogLimit(val)}
              options={[
                { value: 20, label: '20 条' },
                { value: 50, label: '50 条' },
                { value: 100, label: '100 条' },
              ]}
              style={{ width: 90 }}
            />
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={runAnalysis}
              loading={loading}
              disabled={!deviceId}
            >
              开始分析
            </Button>
            {result && (
              <Button icon={<ExportOutlined />} onClick={handleExport}>
                导出
              </Button>
            )}
          </Space>
        </Flex>
      </Card>

      {!deviceId && (
        <Flex flex={1} align="center" justify="center">
          <Empty description="请先从左侧选择设备" />
        </Flex>
      )}

      {error && (
        <Alert type="error" message={error} style={{ margin: '12px 16px 0' }} showIcon closable />
      )}

      {result && (
        <Flex vertical flex={1} gap={14} style={{ overflow: 'auto', padding: 16 }}>
          {/* 总评 */}
          <Card>
            <Flex align="center" gap={16}>
              <Statistic
                title="健康分"
                value={result.overallScore}
                suffix="/ 100"
                valueStyle={{
                  color: result.overallScore >= 80 ? '#52c41a' : result.overallScore >= 50 ? '#faad14' : '#ff4d4f',
                }}
              />
              <Flex vertical>
                <Text strong style={{ fontSize: 15 }}>
                  {result.issues.length === 0 ? <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} /> : <WarningOutlined style={{ color: '#faad14', marginRight: 6 }} />}
                  {result.summary}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                  分析时间：{new Date(result.timestamp).toLocaleTimeString()}
                </Text>
              </Flex>
            </Flex>
          </Card>

          {/* Web Vitals 快览 */}
          {result.raw.perfVitals.length > 0 && (
            <Card title={<><DashboardOutlined /> Web Vitals</>} size="small">
              <Space wrap>
                {result.raw.perfVitals.map((v) => (
                  <Card
                    key={v.name}
                    size="small"
                    style={{ minWidth: 70, borderColor: RATING_COLOR[v.rating] ?? '#d9d9d9' }}
                  >
                    <Flex vertical align="center" gap={2}>
                      <Text strong style={{ color: RATING_COLOR[v.rating] ?? '#999' }}>{v.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{formatVitalValue(v.name, v.value)}</Text>
                      <Tag color={v.rating === 'good' ? 'success' : v.rating === 'poor' ? 'error' : 'warning'} style={{ fontSize: 10 }}>
                        {RATING_LABEL[v.rating] ?? v.rating}
                      </Tag>
                    </Flex>
                  </Card>
                ))}
              </Space>
            </Card>
          )}

          {/* 问题列表 */}
          {result.issues.length > 0 && (
            <Card title={<><WarningOutlined style={{ color: '#faad14' }} /> 发现的问题</>} size="small">
              <List
                size="small"
                dataSource={result.issues}
                renderItem={(issue) => (
                  <List.Item style={{ borderLeft: `3px solid ${issue.startsWith('  ·') ? '#faad14' : '#ff4d4f'}`, paddingLeft: issue.startsWith('  ·') ? 28 : 12 }}>
                    <Text>{issue.startsWith('  ·') ? issue : issue}</Text>
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* 优化建议 */}
          <Card title={<><BulbOutlined style={{ color: '#7c4dff' }} /> 优化建议</>} size="small">
            <List
              size="small"
              dataSource={result.recommendations}
              renderItem={(rec, i) => (
                <List.Item>
                  <Space>
                    <Tag color="purple">{i + 1}</Tag>
                    <Text>{rec}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          {/* 数据概览 */}
          <Card title={<><DatabaseOutlined /> 数据概览</>} size="small">
            <Space wrap size="middle">
              <Statistic title="JS 错误" value={result.raw.errorCount} prefix={<BugOutlined />} valueStyle={{ fontSize: 16 }} />
              <Statistic title="长任务" value={result.raw.longTaskCount} prefix={<ThunderboltOutlined />} valueStyle={{ fontSize: 16 }} />
              <Statistic
                title="内存"
                value={result.raw.health?.memoryMB != null ? `${Number(result.raw.health.memoryMB).toFixed(1)}MB` : 'N/A'}
                prefix={<DashboardOutlined />}
                valueStyle={{ fontSize: 16 }}
              />
              <Statistic title="大资源" value={result.raw.health?.uncompressedResources ?? 0} prefix={<DatabaseOutlined />} valueStyle={{ fontSize: 16 }} />
            </Space>
          </Card>
        </Flex>
      )}
    </Flex>
  );
}
