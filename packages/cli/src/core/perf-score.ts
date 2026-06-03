/**
 * 服务端跑分算法 — 移植 Lighthouse Log-Normal 评分曲线
 *
 * 评分方法论对齐 Google Lighthouse (v12)：
 * - 使用 log-normal CDF 曲线将原始指标值映射为 0-100 分
 * - 控制点来自 HTTP Archive 真实数据（median → 50 分，p10 → 90 分）
 * - 缺失数据的指标不参与评分，权重按比例重分配给有数据的指标
 *
 * 参考：
 * - https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
 * - https://googlechrome.github.io/lighthouse/scorecalc/
 */
import type {
  PerfRunScore,
  PerfScoreItem,
} from '../store/perfRun.js';
import type { FullAuditReport, CategoryScore } from '@codelog/types';

// ─── 原始数据类型 ─────────────────────────────────────────────────────

interface PerformanceSample { fps: number }
interface LongTask { duration: number }
interface ResourceTiming { duration: number }
interface WebVital { name: string; value: number }

interface PerformancePayload {
  vitals: WebVital[];
  samples: PerformanceSample[];
  longTasks: LongTask[];
  resources: ResourceTiming[];
  interactions?: unknown[];
}

// ─── Lighthouse 评分曲线核心 ──────────────────────────────────────────

/**
 * 误差函数近似 (Abramowitz and Stegun 7.1.26)
 * 用于计算 log-normal CDF
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

/**
 * 标准正态 CDF
 */
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Lighthouse 风格 log-normal 评分曲线
 *
 * 给定一个原始指标值 value，以及两个控制点：
 *   - median: 50% 的网站达到此值 → 得分 50
 *   - p10:    10% 的网站优于此值 → 得分 90
 *
 * 返回 0-100 的分数（越高越好）
 */
function computeLogNormalScore(median: number, p10: number, value: number): number {
  if (value <= 0) return 100; // 防御：0 或负值视为完美
  const lnMedian = Math.log(median);
  const lnP10 = Math.log(p10);

  // 从两个控制点反推 log-normal 的 μ 和 σ
  // log-normal CDF: F(x) = Φ((ln(x) - μ) / σ)
  // F(median) = 0.5  →  (ln(median) - μ) / σ = 0   →  μ = ln(median)
  // F(p10) = 0.9     →  (ln(p10) - μ) / σ = Φ⁻¹(0.9) ≈ 1.2816
  const mu = lnMedian;
  const sigma = (lnP10 - mu) / 1.2816; // Φ⁻¹(0.9) ≈ 1.2816

  // 注意：对于"越低越好"的指标，score = 1 - CDF(value)
  // 对于"越高越好"的指标，score = CDF(value)
  const cdf = normalCDF((Math.log(value) - mu) / Math.abs(sigma || 1));

  // Web 性能指标都是"越低越好"，所以用 1 - CDF
  const score = (1 - cdf) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 反转版本：用于"越高越好"的指标（如 FPS）
 */
function computeLogNormalScoreInverted(median: number, p90: number, value: number): number {
  if (value <= 0) return 0;
  const lnMedian = Math.log(median);
  const lnP90 = Math.log(p90);

  const mu = lnMedian;
  const sigma = (lnP90 - mu) / 1.2816;

  const cdf = normalCDF((Math.log(value) - mu) / Math.abs(sigma || 1));
  const score = cdf * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Lighthouse 控制点（mobile, HTTP Archive 数据）────────────────────

/**
 * 每个指标的控制点：
 *   median  → 50% 分位数（得分 50）
 *   p10     → 10% 分位数（得分 90，即"优秀"门槛）
 *   weight  → Lighthouse v12 权重
 *
 * 来源：https://googlechrome.github.io/lighthouse/scorecalc/
 */
const METRIC_PARAMS: Record<string, {
  median: number;
  p10: number;
  weight: number;
  unit: string;
  label: string;
  /** true = 越低越好（默认），false = 越高越好（如 FPS） */
  lowerIsBetter: boolean;
}> = {
  FCP: {
    median: 3000, p10: 1800, weight: 0.10,
    unit: 'ms', label: 'First Contentful Paint', lowerIsBetter: true,
  },
  LCP: {
    median: 4000, p10: 2500, weight: 0.25,
    unit: 'ms', label: 'Largest Contentful Paint', lowerIsBetter: true,
  },
  CLS: {
    median: 0.25, p10: 0.10, weight: 0.25,
    unit: '', label: 'Cumulative Layout Shift', lowerIsBetter: true,
  },
  TBT: {
    median: 600, p10: 200, weight: 0.20,
    unit: 'ms', label: 'Total Blocking Time', lowerIsBetter: true,
  },
  INP: {
    median: 500, p10: 200, weight: 0.10,
    unit: 'ms', label: 'Interaction to Next Paint', lowerIsBetter: true,
  },
  FPS: {
    // codeLog 自有指标：FPS，越高越好
    // median=45 → 50 分，p90=55 → 90 分
    median: 45, p10: 55, weight: 0.10,
    unit: 'fps', label: 'Frames Per Second', lowerIsBetter: false,
  },
};

// ─── 工具函数 ──────────────────────────────────────────────────────────

function rating(score: number): 'good' | 'needs-improvement' | 'poor' {
  if (score >= 90) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
}

function gradeFromScore(total: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (total >= 90) return 'A';
  if (total >= 75) return 'B';
  if (total >= 50) return 'C';
  if (total >= 30) return 'D';
  return 'F';
}

// ─── 类别评分（A11y/BP/SEO）───────────────────────────────────────────

/**
 * 从 FullAuditReport 计算各类别评分
 *
 * - Accessibility: 加权 pass/fail（权重来自 axe 影响分级 10/7/3）
 * - Best Practices: 等权 pass/fail
 * - SEO: 等权 pass/fail
 */
export function scoreCategories(report: FullAuditReport | undefined): Record<string, CategoryScore> {
  const result: Record<string, CategoryScore> = {};
  if (!report?.categories) return result;

  for (const category of report.categories) {
    const applicable = category.audits.filter(a => a.score !== null);
    if (applicable.length === 0) continue;

    let score: number;
    if (category.id === 'accessibility') {
      // 加权 pass/fail
      const totalWeight = applicable.reduce((s, a) => s + a.weight, 0);
      const passedWeight = applicable.filter(a => a.score === 1).reduce((s, a) => s + a.weight, 0);
      score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
    } else {
      // 等权 pass/fail（best-practices, seo）
      const passed = applicable.filter(a => a.score === 1).length;
      score = Math.round((passed / applicable.length) * 100);
    }

    result[category.id] = { score, grade: gradeFromScore(score), audits: category.audits };
  }

  return result;
}

/**
 * 计算长任务总阻塞时间（Total Blocking Time）
 * TBT = Σ(max(task.duration - 50, 0))
 */
function computeTBT(longTasks: LongTask[]): number {
  return longTasks.reduce((sum, t) => sum + Math.max(t.duration - 50, 0), 0);
}

/**
 * 计算 FPS 平均值
 */
function computeAvgFPS(samples: PerformanceSample[]): number | null {
  if (!samples.length) return null;
  return Math.round(samples.reduce((s, x) => s + x.fps, 0) / samples.length);
}

// ─── 主评分函数 ───────────────────────────────────────────────────────

export function scorePerfRun(snapshot: PerformancePayload, audit?: FullAuditReport): PerfRunScore {
  const vitalsMap = new Map(snapshot.vitals.map((v) => [v.name, v.value]));

  // 提取原始值
  const rawValues: Record<string, number | null> = {
    FCP: vitalsMap.get('FCP') ?? null,
    LCP: vitalsMap.get('LCP') ?? null,
    CLS: vitalsMap.get('CLS') ?? null,
    TBT: snapshot.longTasks.length > 0 ? computeTBT(snapshot.longTasks) : null,
    INP: vitalsMap.get('INP') ?? null,
    FPS: computeAvgFPS(snapshot.samples),
  };

  // 计算每个指标的分数
  const metricScores: Record<string, number | null> = {};
  for (const [key, params] of Object.entries(METRIC_PARAMS)) {
    const raw = rawValues[key];
    if (raw === null || raw === undefined) {
      metricScores[key] = null;
    } else if (params.lowerIsBetter) {
      metricScores[key] = computeLogNormalScore(params.median, params.p10, raw);
    } else {
      metricScores[key] = computeLogNormalScoreInverted(params.median, params.p10, raw);
    }
  }

  // 动态权重：仅有数据的指标参与评分
  const activeKeys = Object.keys(METRIC_PARAMS).filter((k) => metricScores[k] !== null);
  const activeWeightSum = activeKeys.reduce((s, k) => s + METRIC_PARAMS[k].weight, 0);

  // 构建 items
  const items: PerfScoreItem[] = Object.entries(METRIC_PARAMS).map(([key, params]) => {
    const score = metricScores[key];
    const hasIt = score !== null;
    const adjustedWeight = hasIt ? params.weight / (activeWeightSum || 1) : 0;
    const rawVal = rawValues[key];

    // value 的显示
    let displayValue: number | null = rawVal;
    if (key === 'TBT' && rawVal !== null) {
      displayValue = Math.round(rawVal);
    }

    return {
      name: key,
      score: hasIt ? score! : 0,
      weight: Math.round(adjustedWeight * 1000) / 1000, // 保留 3 位小数
      value: displayValue,
      unit: params.unit,
      rating: hasIt ? rating(score!) : 'unknown' as 'good' | 'needs-improvement' | 'poor',
    };
  });

  // 加权总分
  const total = Math.round(items.reduce((s, i) => s + i.score * i.weight, 0));
  const grade = gradeFromScore(total);

  // 生成 issues
  const issues: string[] = [];
  for (const item of items) {
    if (item.weight === 0 || item.value === null) continue; // 跳过无数据指标
    if (item.rating === 'poor') {
      switch (item.name) {
        case 'FCP': issues.push(`FCP 过高 (${item.value}ms)，首次内容渲染慢，建议优化关键渲染路径`); break;
        case 'LCP': issues.push(`LCP 过高 (${item.value}ms)，最大内容元素加载慢，建议预加载关键资源`); break;
        case 'CLS': issues.push(`CLS 过高 (${item.value})，页面布局频繁抖动，建议为图片/广告位指定尺寸`); break;
        case 'TBT': issues.push(`总阻塞时间过长 (${item.value}ms)，主线程阻塞严重，建议拆分长任务`); break;
        case 'INP': issues.push(`INP 过高 (${item.value}ms)，交互响应慢，建议优化事件处理`); break;
        case 'FPS': issues.push(`FPS 过低 (均值 ${item.value}fps)，页面动画卡顿，建议减少重排重绘`); break;
      }
    } else if (item.rating === 'needs-improvement') {
      switch (item.name) {
        case 'FCP': issues.push(`FCP 需改善 (${item.value}ms)，建议内联关键 CSS`); break;
        case 'LCP': issues.push(`LCP 需改善 (${item.value}ms)，建议优化最大元素加载`); break;
        case 'CLS': issues.push(`CLS 需改善 (${item.value})，注意动态内容的布局偏移`); break;
        case 'TBT': issues.push(`存在阻塞 (${item.value}ms)，建议使用 requestIdleCallback`); break;
        case 'FPS': issues.push(`FPS 偏低 (均值 ${item.value}fps)，建议优化渲染性能`); break;
      }
    }
  }

  const summaries: Record<string, string> = {
    A: '性能优秀，可直接上线',
    B: '性能良好，有优化空间',
    C: '性能一般，建议优化',
    D: '性能较差，需要优化',
    F: '性能极差，亟需修复',
  };

  return { total, grade, items, issues, summary: summaries[grade], categories: scoreCategories(audit) };
}
