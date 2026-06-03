import { describe, it, expect } from 'vitest';
import { scorePerfRun } from '../perf-score.js';
import type { FullAuditReport, LighthouseAuditResult } from '@codelog/types';

function makeAudit(id: string, score: number | null, weight: number): LighthouseAuditResult {
  return { id, title: id, description: '', score, weight };
}

function makeReport(categories: { id: string; audits: LighthouseAuditResult[] }[]): FullAuditReport {
  return {
    timestamp: Date.now(),
    url: 'https://example.com',
    userAgent: 'test',
    categories: categories.map(c => ({
      id: c.id as any,
      title: c.id,
      score: 0,
      audits: c.audits,
    })),
  };
}

describe('scoreCategories — Lighthouse category scoring', () => {
  it('空审计报告应返回空 categories', () => {
    const result = scorePerfRun(
      { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
      undefined,
    );
    expect(result.categories).toEqual({});
  });

  it('Accessibility 加权评分正确', () => {
    const report = makeReport([{
      id: 'accessibility',
      audits: [
        makeAudit('a1', 1, 10), // pass, weight 10
        makeAudit('a2', 0, 10), // fail, weight 10
        makeAudit('a3', 1, 7),  // pass, weight 7
        makeAudit('a4', null, 3), // notApplicable, weight 3
      ],
    }]);
    const result = scorePerfRun(
      { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
      report,
    );
    // 总权重 = 10+10+7 = 27, 通过权重 = 10+7 = 17, score = 17/27*100 ≈ 63
    expect(result.categories?.accessibility).toBeDefined();
    expect(result.categories!.accessibility.score).toBeGreaterThanOrEqual(60);
    expect(result.categories!.accessibility.score).toBeLessThanOrEqual(65);
    expect(result.categories!.accessibility.grade).toBe('C');
  });

  it('Best Practices 等权评分正确', () => {
    const report = makeReport([{
      id: 'best-practices',
      audits: [
        makeAudit('bp-1', 1, 1),
        makeAudit('bp-2', 1, 1),
        makeAudit('bp-3', 0, 1),
        makeAudit('bp-4', 1, 1),
      ],
    }]);
    const result = scorePerfRun(
      { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
      report,
    );
    expect(result.categories!['best-practices'].score).toBe(75);
    expect(result.categories!['best-practices'].grade).toBe('B');
  });

  it('SEO 等权评分正确，notApplicable 不计入', () => {
    const report = makeReport([{
      id: 'seo',
      audits: [
        makeAudit('seo-1', 1, 1),
        makeAudit('seo-2', 1, 1),
        makeAudit('seo-3', null, 1), // notApplicable
      ],
    }]);
    const result = scorePerfRun(
      { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
      report,
    );
    expect(result.categories!.seo.score).toBe(100);
    expect(result.categories!.seo.grade).toBe('A');
  });

  it('多类别同时计算', () => {
    const report = makeReport([
      { id: 'accessibility', audits: [makeAudit('a1', 1, 10)] },
      { id: 'best-practices', audits: [makeAudit('bp-1', 0, 1)] },
      { id: 'seo', audits: [makeAudit('seo-1', 1, 1), makeAudit('seo-2', 1, 1)] },
    ]);
    const result = scorePerfRun(
      { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
      report,
    );
    expect(result.categories!.accessibility.score).toBe(100);
    expect(result.categories!['best-practices'].score).toBe(0);
    expect(result.categories!.seo.score).toBe(100);
  });

  it('全部 notApplicable 的类别不计入结果', () => {
    const report = makeReport([{
      id: 'seo',
      audits: [makeAudit('seo-1', null, 1), makeAudit('seo-2', null, 1)],
    }]);
    const result = scorePerfRun(
      { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
      report,
    );
    expect(result.categories!.seo).toBeUndefined();
  });
});
