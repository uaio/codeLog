/**
 * Lighthouse 风格审计类型定义（SSOT）
 * 对齐 Google Lighthouse 评分方法论
 */

/** 审计项类别 ID */
export type CategoryId = 'performance' | 'accessibility' | 'best-practices' | 'seo';

/** 审计项评级 */
export type AuditRating = 'pass' | 'fail' | 'notApplicable';

/** Lighthouse 标准审计结果（score: 0/1/null） */
export interface LighthouseAuditResult {
  id: string;
  title: string;
  description: string;
  score: number | null; // 1=pass, 0=fail, null=notApplicable
  weight: number;       // A11y: 10/7/3, BP/SEO: 1
  value?: string;
  details?: Record<string, unknown>;
}

/** 类别评分结果（SDK 端采集时产出） */
export interface LighthouseCategoryResult {
  id: CategoryId;
  title: string;
  score: number; // 0-100，SDK 端预计算
  audits: LighthouseAuditResult[];
}

/** Performance 诊断审计项（保留已有格式兼容） */
export interface DiagnosticAuditItem {
  id: string;
  title: string;
  score: number; // 0-100
  rating: 'good' | 'needs-improvement' | 'poor';
  value: string;
  details?: Record<string, unknown>;
}

/** 完整审计报告（替代旧 PageAuditReport） */
export interface FullAuditReport {
  timestamp: number;
  url: string;
  userAgent: string;
  categories: LighthouseCategoryResult[];
  /** 已有的 Performance 诊断审计（DOM 规模、渲染阻塞等），保留供 Web 面板展示 */
  performanceDiagnostics?: DiagnosticAuditItem[];
}

/** 类别评分（服务端计算后，附加到 PerfRunScore.categories） */
export interface CategoryScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  audits: LighthouseAuditResult[];
}
