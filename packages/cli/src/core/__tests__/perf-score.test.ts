import { describe, it, expect } from 'vitest';
import { scorePerfRun } from '../perf-score.js';

describe('scorePerfRun — Lighthouse log-normal scoring', () => {
  it('空数据应得 0 分', () => {
    const result = scorePerfRun({
      vitals: [], samples: [], longTasks: [], resources: [], interactions: [],
    });
    expect(result.total).toBe(0);
    expect(result.grade).toBe('F');
    // 所有指标无数据
    expect(result.items.every((i) => i.weight === 0)).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('优秀性能应得高分 (A)', () => {
    const result = scorePerfRun({
      vitals: [
        { name: 'LCP', value: 1200 },
        { name: 'FCP', value: 800 },
        { name: 'CLS', value: 0.05 },
        { name: 'INP', value: 80 },
      ],
      samples: [
        { ts: Date.now(), fps: 60 },
        { ts: Date.now() - 3000, fps: 59 },
      ],
      longTasks: [],
      resources: [],
      interactions: [],
    });
    expect(result.total).toBeGreaterThanOrEqual(90);
    expect(result.grade).toBe('A');
    // 所有有数据的指标都应是 good
    const active = result.items.filter((i) => i.weight > 0);
    expect(active.every((i) => i.rating === 'good')).toBe(true);
  });

  it('差性能应得低分 (D 或 F)', () => {
    const result = scorePerfRun({
      vitals: [
        { name: 'LCP', value: 6000 },
        { name: 'FCP', value: 4000 },
        { name: 'CLS', value: 0.5 },
        { name: 'INP', value: 800 },
      ],
      samples: [
        { ts: Date.now(), fps: 20 },
        { ts: Date.now() - 3000, fps: 15 },
      ],
      longTasks: [
        { startTime: 1000, duration: 300 },
        { startTime: 3000, duration: 400 },
        { startTime: 5000, duration: 500 },
      ],
      resources: [],
      interactions: [],
    });
    expect(result.total).toBeLessThanOrEqual(30);
    expect(result.grade).toMatch(/^[DF]$/);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('部分数据时，缺失指标的权重应为 0', () => {
    const result = scorePerfRun({
      vitals: [{ name: 'LCP', value: 3000 }],
      samples: [{ ts: Date.now(), fps: 55 }],
      longTasks: [],
      resources: [],
      interactions: [],
    });
    // 只有 LCP 和 FPS 有数据
    const active = result.items.filter((i) => i.weight > 0);
    const inactive = result.items.filter((i) => i.weight === 0);
    expect(active.map((i) => i.name)).toContain('LCP');
    expect(active.map((i) => i.name)).toContain('FPS');
    expect(inactive.map((i) => i.name)).toContain('FCP');
    expect(inactive.map((i) => i.name)).toContain('CLS');
    expect(inactive.map((i) => i.name)).toContain('TBT');
    expect(inactive.map((i) => i.name)).toContain('INP');
    // 活跃指标权重之和应为 1
    const weightSum = active.reduce((s, i) => s + i.weight, 0);
    expect(Math.abs(weightSum - 1)).toBeLessThan(0.01);
  });

  it('LCP median 值应得约 50 分', () => {
    const result = scorePerfRun({
      vitals: [{ name: 'LCP', value: 4000 }], // LCP median = 4000
      samples: [],
      longTasks: [],
      resources: [],
      interactions: [],
    });
    const lcp = result.items.find((i) => i.name === 'LCP')!;
    expect(lcp.score).toBeGreaterThanOrEqual(45);
    expect(lcp.score).toBeLessThanOrEqual(55);
  });

  it('LCP p10 值应得约 90 分', () => {
    const result = scorePerfRun({
      vitals: [{ name: 'LCP', value: 2500 }], // LCP p10 = 2500
      samples: [],
      longTasks: [],
      resources: [],
      interactions: [],
    });
    const lcp = result.items.find((i) => i.name === 'LCP')!;
    expect(lcp.score).toBeGreaterThanOrEqual(85);
    expect(lcp.score).toBeLessThanOrEqual(95);
  });

  it('TBT 应使用长任务总阻塞时间计算', () => {
    // 3 个长任务各 200ms → TBT = 3*(200-50) = 450ms，在 median=600 附近
    const result = scorePerfRun({
      vitals: [],
      samples: [],
      longTasks: [
        { startTime: 0, duration: 200 },
        { startTime: 1000, duration: 200 },
        { startTime: 2000, duration: 200 },
      ],
      resources: [],
      interactions: [],
    });
    const tbt = result.items.find((i) => i.name === 'TBT')!;
    expect(tbt.value).toBe(450);
    expect(tbt.weight).toBeGreaterThan(0);
  });

  it('grade 分级正确', () => {
    const cases: Array<{ total: number; grade: string }> = [];

    // A: >= 90
    const good = scorePerfRun({
      vitals: [{ name: 'LCP', value: 1000 }, { name: 'FCP', value: 500 }, { name: 'CLS', value: 0.01 }, { name: 'INP', value: 50 }],
      samples: [{ ts: Date.now(), fps: 60 }],
      longTasks: [], resources: [], interactions: [],
    });
    cases.push({ total: good.total, grade: good.grade });
    expect(good.grade).toBe('A');

    // F: total <= 30
    const bad = scorePerfRun({
      vitals: [{ name: 'LCP', value: 8000 }, { name: 'FCP', value: 5000 }, { name: 'CLS', value: 0.8 }, { name: 'INP', value: 1000 }],
      samples: [{ ts: Date.now(), fps: 10 }],
      longTasks: [{ startTime: 0, duration: 600 }],
      resources: [], interactions: [],
    });
    cases.push({ total: bad.total, grade: bad.grade });
    expect(bad.grade).toBe('F');
  });
});
