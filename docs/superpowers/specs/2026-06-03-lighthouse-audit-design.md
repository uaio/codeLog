# Lighthouse 风格全类别审计 — 设计文档

> 日期：2026-06-03
> 状态：待实施
> 范围：SDK 审计采集 + 服务端评分 + Web 面板展示

## 1. 目标

将 codeLog 性能跑分从当前的 6 个基础审计项扩展为 Lighthouse 风格的 4 类别审计体系，完全对齐 Lighthouse 评分方法论。

## 2. 行业标准依据

来源：

- [Lighthouse Scoring - GitHub](https://github.com/GoogleChrome/lighthouse/blob/master/docs/scoring.md)
- [Lighthouse Accessibility Scoring - Chrome Developers](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)
- [Lighthouse Performance Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)

### 2.1 四类别评分机制

| 类别 | 评分机制 | 细节 |
|------|----------|------|
| **Performance** | Log-normal 加权指标分 | FCP 10%, LCP 25%, TBT 30%, CLS 25%, INP 10% (codeLog 扩展: TBT 20%, FPS 10%) |
| **Accessibility** | 加权 pass/fail | 权重来自 axe 影响分级: weight 10 (critical) / 7 (serious) / 3 (minor) |
| **Best Practices** | 等权 pass/fail | 每项 ~6 分 |
| **SEO** | 等权 pass/fail | 每项 ~8 分 |

**关键原则：4 个类别各自独立评分 0-100，不合并为一个总分。** 与 Lighthouse 展示方式一致。

### 2.2 评分公式

```typescript
// Performance: log-normal 加权（已有，不变）
performanceScore = Σ(metricScore × adjustedWeight)

// Accessibility: 加权 pass/fail
// 仅 applicable 审计参与（notApplicable 排除）
accessibilityScore = Σ(passed ? weight : 0) / Σ(allApplicableWeights) × 100

// Best Practices: 等权 pass/fail
bpScore = passedCount / applicableCount × 100

// SEO: 等权 pass/fail
seoScore = passedCount / applicableCount × 100
```

## 3. 架构决策

**方案：SDK 端全量采集 + 服务端评分**

- 所有审计逻辑在 SDK（浏览器端）执行，因为审计依赖 DOM API、CSSOM、Performance API 等浏览器能力
- 服务端只负责评分计算和结果存储
- 符合当前架构（page-audit.ts 已在 SDK 端运行）
- 审计代码只在 `stopPerfRun` 时一次性运行，不影响日常性能

## 4. 审计项清单

### 4.1 Performance（已有，保持不变）

**指标评分（影响分数）：**

| 指标 | 控制点 median | 控制点 p10 | 权重 |
|------|-------------|-----------|------|
| FCP | 3000ms | 1800ms | 0.10 |
| LCP | 4000ms | 2500ms | 0.25 |
| CLS | 0.25 | 0.10 | 0.25 |
| TBT | 600ms | 200ms | 0.20 |
| INP | 500ms | 200ms | 0.10 |
| FPS | 45fps | 55fps | 0.10 |

**诊断审计（不影响分数）：**

已有 6 项保留：DOM 规模、渲染阻塞资源、图片优化、资源体积、资源压缩、字体加载。

### 4.2 Accessibility（新增，~39 项）

完全按照 [Lighthouse Accessibility 权重表](https://developer.chrome.com/docs/lighthouse/accessibility/scoring) 实现。

**权重 10（Critical）— 16 项：**

| ID | 审计项 | 实现方式 |
|----|--------|----------|
| `aria-allowed-attr` | ARIA 属性匹配角色 | 遍历 `[role]` 元素，按 role 检查合法 `aria-*` 属性 |
| `aria-hidden-body` | body 无 aria-hidden | 检查 `document.body` 的 `aria-hidden` |
| `aria-required-attr` | ARIA 角色有必要属性 | 按 role 字典检查必需属性（如 checkbox 需要 aria-checked） |
| `aria-required-children` | ARIA 角色有必要子角色 | 检查复合 widget（如 tablist/tab, menu/menuitem）的子元素 |
| `aria-required-parent` | ARIA 角色在合法父元素内 | 检查 role 嵌套关系（如 tabitem 必须在 tablist 内） |
| `aria-roles` | role 值有效 | 检查是否为合法 WAI-ARIA role |
| `aria-valid-attr-value` | ARIA 属性值合法 | 检查 id 引用存在、数值合法等 |
| `aria-valid-attr` | ARIA 属性名合法 | 检查无拼写错误的 `aria-*` |
| `button-name` | 按钮有可辨识名称 | 检查 textContent、aria-label、aria-labelledby、title |
| `image-alt` | 图片有 alt 属性 | 遍历所有 `<img>` 检查 `[alt]` |
| `input-image-alt` | image input 有 alt | 检查 `<input type="image">` 的 `[alt]` |
| `label` | 表单元素有关联 label | 检查 `<input>/<select>/<textarea>` 的 label 关联 |
| `meta-viewport` | viewport 不禁缩放 | 检查 maximum-scale < 5 和 user-scalable=no |
| `duplicate-id-aria` | ARIA 引用的 ID 唯一 | 检查 aria-describedby/aria-labelledby 等引用的 ID |
| `select-name` | select 有关联 label | 检查 `<select>` 的 label 关联 |
| `video-caption` | video 有字幕轨道 | 检查 `<video>` 内 `<track kind="captions">` |

**权重 7（Serious）— 18 项：**

| ID | 审计项 |
|----|--------|
| `accesskeys` | accesskey 值唯一 |
| `aria-hidden-focus` | aria-hidden 元素不含可聚焦后代 |
| `aria-input-field-name` | ARIA 输入字段有可访问名称 |
| `aria-toggle-field-name` | ARIA 开关字段有可访问名称 |
| `bypass` | 页面有跳过导航链接或 landmark 区域 |
| `color-contrast` | 文本与背景对比度足够（WCAG AA 4.5:1） |
| `document-title` | 页面有非空 `<title>` |
| `frame-title` | iframe 有 title 属性 |
| `heading-order` | 标题层级不跳级 |
| `html-has-lang` | `<html>` 有 lang 属性 |
| `html-lang-valid` | lang 属性值合法 |
| `link-name` | 链接有可辨识名称 |
| `list` | 列表结构正确（ul/ol 内只有 li/script/template） |
| `listitem` | li 在 ul/ol/menu 内 |
| `definition-list` | dl 结构正确 |
| `dlitem` | dt/dd 在 dl 内 |
| `tabindex` | 无 tabindex > 0 |
| `object-alt` | object 元素有替代文本 |

**权重 3（Minor）— 5 项：**

| ID | 审计项 |
|----|--------|
| `form-field-multiple-labels` | 表单字段无多个 label |
| `valid-lang` | lang 属性值是合法 BCP 47 |
| `skip-link-focusable` | 跳过导航链接可聚焦 |
| `document-has-main-landmark` | 页面有 main landmark |
| `th-has-data-cells` | 表头有对应数据单元格 |

### 4.3 Best Practices（新增，8 项）

等权 pass/fail：

| ID | 审计项 | 实现方式 |
|----|--------|----------|
| `is-on-https` | 使用 HTTPS | 检查 `location.protocol` |
| `console-errors` | 无控制台错误 | 采集 `window.onerror` + `unhandledrejection` + console.error 计数 |
| `no-document-write` | 无 document.write | 运行前覆盖 `document.write` 记录调用 |
| `no-vulnerable-libraries` | 无已知漏洞 JS 库 | 匹配 script src 中的版本号与已知漏洞列表子集 |
| `no-deprecated-apis` | 无废弃 API | 检测 `event.keyCode`、`document.execCommand`、`document.registerElement` 等 |
| `password-inputs-paste` | 密码输入允许粘贴 | 检查 `onpaste` 事件阻止、CSS user-select:none |
| `notification-permission` | 非用户手势未请求通知 | 检查 `Notification.permission` 为 denied 或默认 |
| `geolocation-permission` | 非用户手势未请求地理定位 | 运行时检测 |

### 4.4 SEO（新增，10 项）

等权 pass/fail：

| ID | 审计项 | 实现方式 |
|----|--------|----------|
| `document-title` | 标题存在且长度 10-60 字符 | 检查 `<title>` |
| `meta-description` | description 存在且长度 50-160 字符 | 检查 `<meta name="description">` |
| `http-status-code` | 页面可正常加载 | 检查 `performance.getEntriesByType('navigation')` |
| `link-text` | 链接文本具描述性 | 检查链接文本不在模糊列表中（"点击这里"等） |
| `meta-viewport` | viewport 正确配置 | 检查 `<meta name="viewport">` 含 width=device-width |
| `crawlable-anchors` | a 标签有 href 属性 | 遍历 `<a>` 检查 |
| `hreflang` | hreflang 标签正确 | 检查 `<link rel="alternate" hreflang>` 格式 |
| `canonical` | canonical URL 正确 | 检查 `<link rel="canonical">` |
| `robots-meta` | 未阻止索引 | 检查 `<meta name="robots">` 无 noindex |
| `structured-data` | 有 JSON-LD 结构化数据 | 检查 `<script type="application/ld+json">` |

## 5. 数据结构

### 5.1 审计结果

```typescript
interface LighthouseAuditResult {
  id: string;           // 审计项唯一标识
  title: string;        // 审计项标题
  description: string;  // 审计说明
  score: number | null; // 1=pass, 0=fail, null=notApplicable
  weight: number;       // 权重（A11y: 10/7/3, BP/SEO: 1）
  value?: string;       // 人类可读值（如 "3 个图片缺少 alt"）
  details?: any;        // 结构化详情
}
```

### 5.2 类别结果

```typescript
type CategoryId = 'performance' | 'accessibility' | 'best-practices' | 'seo';

interface LighthouseCategoryResult {
  id: CategoryId;
  title: string;
  score: number;                   // 0-100
  audits: LighthouseAuditResult[];
}
```

### 5.3 完整报告

```typescript
interface FullAuditReport {
  timestamp: number;
  url: string;
  userAgent: string;
  categories: LighthouseCategoryResult[];
}
```

### 5.4 PerfRunScore 扩展

```typescript
interface PerfRunScore {
  // 已有字段保持不变
  total: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  items: PerfScoreItem[];
  issues: string[];
  summary: string;

  // 新增：4 类别独立分数
  categories: Record<CategoryId, {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    audits: LighthouseAuditResult[];
  }>;
}
```

## 6. 数据流

```
SDK 端 stopPerfRun():
  1. 采集性能快照（已有 PerformanceCollector）
  2. 运行 runFullAudit():
     ├── auditAccessibility()  → ~39 项 pass/fail + axe 权重
     ├── auditBestPractices()  → 8 项 pass/fail 等权
     └── auditSEO()            → 10 项 pass/fail 等权
     (Performance 诊断审计沿用已有 6 项)
  3. 通过 DataBus → Reporter → WebSocket 发送 FullAuditReport

服务端 handlers.perf_run_raw():
  1. Performance 指标用 log-normal 评分（已有）
  2. Accessibility = Σ(passed×weight) / Σ(applicable×weight) × 100
  3. Best Practices = passed / applicable × 100
  4. SEO = passed / applicable × 100
  5. 各类别独立 grade (A-F)
  6. 存入 PerfRunSession，广播到 Web 面板

Web 面板 PerfRunPanel:
  ┌─────────────────────────────────────────┐
  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
  │  │  92  │ │  85  │ │ 100  │ │  90  │   │
  │  │ Perf │ │ A11y │ │  BP  │ │ SEO  │   │
  │  └──────┘ └──────┘ └──────┘ └──────┘   │
  │                                         │
  │  ── 详情 Tab ─────────────────────────── │
  │  [Performance] [Accessibility] [BP] [SEO]│
  │                                         │
  │  ✅ aria-allowed-attr    ARIA 属性匹配  │
  │  ❌ image-alt            图片缺少 alt    │
  │  ⚠️  color-contrast      对比度不足      │
  │  ...                                    │
  └─────────────────────────────────────────┘
```

## 7. 文件变更清单

### 7.1 新增文件

| 文件 | 说明 |
|------|------|
| `packages/sdk/src/interceptors/audits/accessibility.ts` | Accessibility ~39 项审计实现 |
| `packages/sdk/src/interceptors/audits/best-practices.ts` | Best Practices 8 项审计实现 |
| `packages/sdk/src/interceptors/audits/seo.ts` | SEO 10 项审计实现 |
| `packages/sdk/src/interceptors/audits/types.ts` | 共享类型定义（LighthouseAuditResult 等） |
| `packages/sdk/src/interceptors/audits/helpers.ts` | 共享工具函数（颜色对比度计算、ARIA role 字典等） |

### 7.2 修改文件

| 文件 | 变更说明 |
|------|----------|
| `packages/sdk/src/interceptors/page-audit.ts` | 重构：调用 `audits/` 各模块，统一入口函数 `runFullAudit()` |
| `packages/sdk/src/index.ts` | `stopPerfRun()` 调用 `runFullAudit()` 替代 `runPageAudit()` |
| `packages/sdk/src/types/index.ts` | 新增 `FullAuditReport`、`LighthouseCategoryResult` 等类型 |
| `packages/cli/src/core/perf-score.ts` | 扩展为 4 类别评分，增加 `scoreAccessibility()`、`scoreBestPractices()`、`scoreSEO()` |
| `packages/cli/src/store/perfRun.ts` | `PerfRunScore` 增加 `categories` 字段 |
| `packages/types/src/events/` | 同步新增类型 |
| `packages/web/src/components/PerfRunPanel.tsx` | 重写：4 类别仪表盘 + Tab 详情切换 |

### 7.3 不变文件

| 文件 | 原因 |
|------|------|
| `packages/sdk/src/interceptors/performance.ts` | 性能数据采集逻辑不变 |
| `packages/sdk/src/transport/reporter.ts` | 传输层不变，只传数据 |
| `packages/cli/src/ws/handlers.ts` | 处理流程不变，调用 `scorePerfRun()` 即可 |
| `packages/cli/src/core/__tests__/perf-score.test.ts` | 已有测试保持通过，新增测试覆盖 4 类别 |

## 8. 约束与限制

1. **移动端 API 限制**：部分 Lighthouse 审计（如 Service Worker、HTTP/2 推送）在移动端浏览器无法检测，标记为 `notApplicable`
2. **SDK 体积**：审计代码约增加 ~15KB（gzip 后 ~5KB），仅在 perf run 时加载执行
3. **颜色对比度**：无法读取背景图片/渐变下的文本颜色，仅检测纯色背景
4. **漏洞库检测**：使用精简版的已知漏洞列表（Top 50 常见库），不等同于完整 Snyk 扫描

## 9. 测试策略

1. **单元测试**：每个审计函数独立测试（pass/fail/notApplicable 场景）
2. **评分测试**：验证各类别评分公式正确性
3. **集成测试**：构建 → SDK 采集 → 服务端评分 → Web 面板展示 全流程
4. **回归测试**：确保已有 6 个 Performance 审计项和 log-normal 评分不变
