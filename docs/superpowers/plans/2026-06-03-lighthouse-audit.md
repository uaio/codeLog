# Lighthouse 风格全类别审计实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 codeLog 性能跑分从 6 个基础审计项扩展为 Lighthouse 风格 4 类别审计体系（Performance / Accessibility / Best Practices / SEO），完全对齐 Lighthouse 评分方法论。

**Architecture:** SDK 端执行所有浏览器端审计逻辑（DOM/CSSOM/ARIA 检查），服务端计算类别评分（加权 pass/fail），Web 面板以 4 个独立仪表盘展示。类型定义集中在 `@codelog/types` 作为 SSOT。

**Tech Stack:** TypeScript, Vitest (测试), React (Web 面板), WebSocket (数据传输)

**Design Spec:** `docs/superpowers/specs/2026-06-03-lighthouse-audit-design.md`

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `packages/types/src/audit.ts` | Lighthouse 审计共享类型（SSOT） |
| `packages/sdk/src/interceptors/audits/helpers.ts` | ARIA role 字典、WCAG 对比度计算等工具函数 |
| `packages/sdk/src/interceptors/audits/accessibility.ts` | Accessibility ~39 项审计 |
| `packages/sdk/src/interceptors/audits/best-practices.ts` | Best Practices 8 项审计 |
| `packages/sdk/src/interceptors/audits/seo.ts` | SEO 10 项审计 |
| `packages/sdk/src/interceptors/audits/runtime-hooks.ts` | 运行时 Hook 安装/状态管理 |
| `packages/cli/src/core/__tests__/category-score.test.ts` | 类别评分单元测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `packages/types/src/index.ts` | 导出 audit.ts 类型 |
| `packages/types/src/events/index.ts` | 扩展 PerfRunPayload 包含 categories |
| `packages/sdk/src/interceptors/page-audit.ts` | 重构为调用 audits/ 模块 |
| `packages/sdk/src/index.ts` | 初始化时安装运行时 Hook + stopPerfRun 使用 runFullAudit |
| `packages/sdk/src/types/index.ts` | PerfRunRawPayload.audit 类型变更 |
| `packages/cli/src/core/perf-score.ts` | 新增 scoreCategories() |
| `packages/cli/src/store/perfRun.ts` | PerfRunScore 增加 categories |
| `packages/cli/src/ws/handlers.ts` | handler 调用 scoreCategories |
| `packages/web/src/components/PerfRunPanel.tsx` | 4 类别仪表盘 + Tab 详情 |
| `packages/web/src/types/index.ts` | 同步类型变更 |

---

## Task 1: 共享类型定义 — `@codelog/types` 扩展

**Files:**
- Create: `packages/types/src/audit.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/src/events/index.ts`

- [ ] **Step 1: 创建 `packages/types/src/audit.ts`**

```typescript
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

/** 类别评分结果 */
export interface LighthouseCategoryResult {
  id: CategoryId;
  title: string;
  score: number; // 0-100
  audits: LighthouseAuditResult[];
}

/** Performance 诊断审计项（保留已有的 PageAuditReport 兼容格式） */
export interface DiagnosticAuditItem {
  id: string;
  title: string;
  score: number; // 0-100
  rating: 'good' | 'needs-improvement' | 'poor';
  value: string;
  details?: Record<string, unknown>;
}

/** 完整审计报告（替代 PageAuditReport） */
export interface FullAuditReport {
  timestamp: number;
  url: string;
  userAgent: string;
  categories: LighthouseCategoryResult[];
  /** 已有的 Performance 诊断审计（DOM 规模、渲染阻塞等 6 项），保留供 Web 面板展示 */
  performanceDiagnostics?: DiagnosticAuditItem[];
}

/** 类别评分（服务端计算后） */
export interface CategoryScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  audits: LighthouseAuditResult[];
}
```

- [ ] **Step 2: 在 `packages/types/src/index.ts` 中导出新类型**

在文件中找到导出块，添加:
```typescript
export type {
  CategoryId,
  AuditRating,
  LighthouseAuditResult,
  LighthouseCategoryResult,
  FullAuditReport,
  CategoryScore,
  DiagnosticAuditItem,
} from './audit.js';
```

- [ ] **Step 3: 扩展 `packages/types/src/events/index.ts` 中 PerfRunPayload**

在 `PerfRunPayload` 接口（约 line 230-243）的 `score` 对象内添加 `categories` 字段:

找到 `score:` 字段定义（在 `PerfRunPayload` 内），在其后添加:
```typescript
  categories?: Record<string, import('../audit.js').CategoryScore>;
```

- [ ] **Step 4: 构建验证**

Run: `pnpm --filter @codelog/types build`
Expected: 编译成功无错误

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/audit.ts packages/types/src/index.ts packages/types/src/events/index.ts
git commit -m "feat(types): add Lighthouse audit type definitions (SSOT)"
```

---

## Task 2: SDK 审计工具函数 — ARIA 字典和对比度计算

**Files:**
- Create: `packages/sdk/src/interceptors/audits/helpers.ts`

- [ ] **Step 1: 创建 helpers.ts**

包含以下内容：
1. **ARIA role 字典** — 合法 role 名称集合、每个 role 的 required attributes、required children、required parent
2. **WCAG 颜色对比度计算** — `getRelativeLuminance()`、`getContrastRatio()`、` meetsWCAGAA()`
3. **辅助函数** — `getAccessibleName()`、`hasLabel()`、`isValidBCP47()`

```typescript
/**
 * 审计工具函数：ARIA role 字典、WCAG 对比度计算、辅助函数
 */

// ─── ARIA Role 字典 ──────────────────────────────────────────

/**
 * 所有合法的 WAI-ARIA 具体 role（不含 abstract role）。
 * Abstract role（command, composite, input, landmark, range, section,
 * sectionhead, select, structure, widget, window）不应出现在元素上，
 * 由 auditAriaRoles() 单独检测。
 */
export const VALID_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner',
  'blockquote', 'button', 'caption', 'cell', 'checkbox',
  'code', 'columnheader', 'combobox', 'comment',
  'complementary', 'contentinfo', 'definition',
  'deleted', 'dialog', 'directory', 'document', 'emphasis',
  'feed', 'figure', 'form', 'generic', 'grid', 'gridcell',
  'group', 'heading', 'img', 'inserted',
  'link', 'list', 'listitem', 'log',
  'main', 'mark', 'marquee', 'math', 'menu',
  'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'meter', 'navigation', 'none', 'note', 'option',
  'paragraph', 'presentation', 'progressbar', 'radio',
  'radiogroup', 'region', 'row',
  'rowgroup', 'rowheader', 'scrollbar', 'search',
  'searchbox', 'separator',
  'slider', 'spinbutton', 'status', 'strong',
  'subscript', 'superscript', 'switch', 'tab', 'table',
  'tablist', 'tabpanel', 'term', 'textbox', 'time',
  'timer', 'toolbar', 'tooltip', 'tree', 'treegrid',
  'treeitem',
]);

/** Abstract role — 不应在元素上使用 */
export const ABSTRACT_ROLES = new Set([
  'command', 'composite', 'input', 'landmark', 'range',
  'roletype', 'section', 'sectionhead', 'select', 'structure',
  'widget', 'window',
]);

/** 每个 role 的必需 aria-* 属性 */
export const REQUIRED_ATTRS: Record<string, string[]> = {
  checkbox: ['aria-checked'],
  combobox: ['aria-expanded'],
  heading: ['aria-level'],
  menuitemcheckbox: ['aria-checked'],
  menuitemradio: ['aria-checked'],
  option: ['aria-selected'],
  radio: ['aria-checked'],
  slider: ['aria-valuemax', 'aria-valuemin', 'aria-valuenow'],
  spinbutton: ['aria-valuemax', 'aria-valuemin', 'aria-valuenow'],
  switch: ['aria-checked'],
  scrollbar: ['aria-controls', 'aria-orientation', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow'],
  tablist: ['aria-orientation'],
  treegrid: ['aria-readonly'],
};

/** 每个 role 允许的 aria-* 属性（省略则允许所有合法 aria-*） */
export const ALLOWED_ATTRS: Record<string, Set<string>> = {
  checkbox: new Set(['aria-checked', 'aria-readonly', 'aria-required']),
  radio: new Set(['aria-checked', 'aria-readonly', 'aria-required']),
  switch: new Set(['aria-checked', 'aria-readonly', 'aria-required']),
};

/** 每个 role 的必需子 role */
export const REQUIRED_CHILDREN: Record<string, string[]> = {
  listbox: ['option'],
  menu: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
  menubar: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
  tablist: ['tab'],
  tree: ['treeitem'],
  treegrid: ['treeitem', 'row'],
  radiogroup: ['radio'],
  grid: ['row', 'rowgroup'],
  table: ['row', 'rowgroup'],
};

/** 每个 role 的必需父 role */
export const REQUIRED_PARENT: Record<string, string[]> = {
  listitem: ['list'],
  menuitem: ['menu', 'menubar'],
  menuitemcheckbox: ['menu', 'menubar'],
  menuitemradio: ['menu', 'menubar'],
  option: ['listbox'],
  row: ['grid', 'table', 'treegrid', 'rowgroup'],
  rowgroup: ['grid', 'table', 'treegrid'],
  tab: ['tablist'],
  tabpanel: ['tablist'],
  treeitem: ['tree', 'treegrid'],
  gridcell: ['row'],
  cell: ['row'],
  columnheader: ['row'],
  rowheader: ['row'],
};

/** 所有合法的 aria-* 属性名 */
export const VALID_ARIA_ATTRS = new Set([
  'aria-activedescendant', 'aria-atomic', 'aria-autocomplete',
  'aria-brailleroledescription', 'aria-busy', 'aria-checked',
  'aria-colcount', 'aria-colindex', 'aria-colindextext', 'aria-colspan',
  'aria-controls', 'aria-current', 'aria-describedby',
  'aria-description', 'aria-details', 'aria-disabled',
  'aria-dropeffect', 'aria-errormessage', 'aria-expanded',
  'aria-flowto', 'aria-grabbed', 'aria-haspopup',
  'aria-hidden', 'aria-invalid', 'aria-keyshortcuts',
  'aria-label', 'aria-labelledby', 'aria-level',
  'aria-live', 'aria-modal', 'aria-multiline',
  'aria-multiselectable', 'aria-orientation', 'aria-owns',
  'aria-placeholder', 'aria-posinset', 'aria-pressed',
  'aria-readonly', 'aria-relevant', 'aria-required',
  'aria-roledescription', 'aria-rowcount', 'aria-rowindex',
  'aria-rowindextext', 'aria-rowspan', 'aria-selected',
  'aria-setsize', 'aria-sort', 'aria-valuemax',
  'aria-valuemin', 'aria-valuenow', 'aria-valuetext',
]);

// ─── WCAG 对比度 ────────────────────────────────────────────

/** 将 RGB 颜色解析为 [r, g, b] */
function parseColor(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

/** WCAG 2.0 相对亮度计算 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** 对比度比率 */
export function getContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 检查对比度是否满足 WCAG AA 标准（普通文本 4.5:1，大文本 3:1） */
export function meetsWCAGAA(fgColor: string, bgColor: string, isLargeText = false): boolean | null {
  const fg = parseColor(fgColor);
  const bg = parseColor(bgColor);
  if (!fg || !bg) return null;
  const fgLum = getRelativeLuminance(...fg);
  const bgLum = getRelativeLuminance(...bg);
  const ratio = getContrastRatio(fgLum, bgLum);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// ─── 辅助函数 ───────────────────────────────────────────────

/** 获取元素的可访问名称 */
export function getAccessibleName(el: Element): string {
  // 优先级：aria-labelledby > aria-label > text content > title > placeholder
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent?.trim() ?? '';
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  const text = el.textContent?.trim();
  if (text) return text;
  const title = el.getAttribute('title');
  if (title) return title.trim();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();
  }
  return '';
}

/** 检查表单元素是否有关联 label */
export function hasAssociatedLabel(el: HTMLElement): boolean {
  // 方式 1: <label for="id">
  const id = el.id;
  if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return true;
  // 方式 2: <label> 包裹
  if (el.closest('label')) return true;
  // 方式 3: aria-labelledby
  if (el.getAttribute('aria-labelledby')) return true;
  // 方式 4: aria-label
  if (el.getAttribute('aria-label')?.trim()) return true;
  // 方式 5: title
  if (el.getAttribute('title')?.trim()) return true;
  return false;
}

/** 简易 BCP 47 验证（主标签 + 可选子标签） */
export function isValidBCP47(lang: string): boolean {
  return /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,8})*$/.test(lang);
}

/** 模糊链接文本列表 */
export const VAGUE_LINK_TEXTS = new Set([
  'click here', 'click', 'here', 'more', 'read more', 'learn more',
  'link', 'this', 'go', 'download', 'open', 'close',
  '点击这里', '点击', '这里', '更多', '查看更多', '了解更多',
  '链接', '下载', '打开', '关闭',
]);

/** 已知漏洞 JS 库（版本号检测） */
export const VULNERABLE_LIBRARIES: { pattern: RegExp; name: string; minSafe: string }[] = [
  { pattern: /jquery[/.-](\d+\.\d+\.\d+)/i, name: 'jQuery', minSafe: '3.5.0' },
  { pattern: /angular(?:\.min)?\.js[/?](\d+\.\d+\.\d+)/i, name: 'AngularJS', minSafe: '1.8.3' },
  { pattern: /lodash[/.-](\d+\.\d+\.\d+)/i, name: 'Lodash', minSafe: '4.17.21' },
  { pattern: /moment(?:\.min)?\.js[/?](\d+\.\d+\.\d+)/i, name: 'Moment.js', minSafe: '2.29.4' },
  { pattern: /bootstrap[/.-](\d+\.\d+\.\d+)/i, name: 'Bootstrap', minSafe: '4.6.2' },
  { pattern: /react(?:\.production\.min)?\.js[/?](\d+\.\d+\.\d+)/i, name: 'React', minSafe: '16.14.0' },
  { pattern: /axios[/.-](\d+\.\d+\.\d+)/i, name: 'Axios', minSafe: '0.21.2' },
];

/** 比较语义版本号：true 表示 version < minSafe */
export function isVersionBelow(version: string, minSafe: string): boolean {
  const v = version.split('.').map(Number);
  const m = minSafe.split('.').map(Number);
  for (let i = 0; i < Math.max(v.length, m.length); i++) {
    const vi = v[i] ?? 0;
    const mi = m[i] ?? 0;
    if (vi < mi) return true;
    if (vi > mi) return false;
  }
  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/interceptors/audits/helpers.ts
git commit -m "feat(sdk): add audit helper functions (ARIA dict, WCAG contrast, utils)"
```

---

## Task 3: 运行时 Hook — SDK 初始化时安装

**Files:**
- Create: `packages/sdk/src/interceptors/audits/runtime-hooks.ts`

- [ ] **Step 1: 创建 runtime-hooks.ts**

```typescript
/**
 * 运行时审计 Hook
 * 在 SDK 初始化时安装，监控 document.write、控制台错误、废弃 API 等
 */

export interface RuntimeAuditState {
  documentWriteCount: number;
  consoleErrorCount: number;
  deprecatedApiCalls: string[];
  notificationRequestedWithoutGesture: boolean;
  geolocationRequestedWithoutGesture: boolean;
}

let state: RuntimeAuditState;
let installed = false;

export function getRuntimeAuditState(): RuntimeAuditState {
  return state;
}

/** 重置状态（每次跑分后调用） */
export function resetRuntimeAuditState(): void {
  state = {
    documentWriteCount: 0,
    consoleErrorCount: 0,
    deprecatedApiCalls: [],
    notificationRequestedWithoutGesture: false,
    geolocationRequestedWithoutGesture: false,
  };
}

/** 安装所有运行时 Hook */
export function installRuntimeAuditHooks(): void {
  if (installed) return;
  resetRuntimeAuditState();

  // Hook document.write / document.writeln
  const origWrite = document.write.bind(document);
  const origWriteln = document.writeln.bind(document);
  document.write = function (...args: string[]) {
    state.documentWriteCount++;
    return origWrite(...args);
  };
  document.writeln = function (...args: string[]) {
    state.documentWriteCount++;
    return origWriteln(...args);
  };

  // ⚠️ 不覆盖 console.error — SDK 已有 console 拦截器在运行。
  // 改为监听 window.onerror / unhandledrejection 事件统计错误数量。
  // 对于 console.error 调用，SDK 的 console 拦截器会将错误通过 DataBus 广播，
  // 在 stopPerfRun 时通过 DataBus 监听 'console' 事件统计 error 级别日志。
  window.addEventListener('error', () => { state.consoleErrorCount++; });
  window.addEventListener('unhandledrejection', () => { state.consoleErrorCount++; });

  // Hook 废弃 API: document.execCommand
  const origExecCommand = document.execCommand.bind(document);
  document.execCommand = function (command: string, ...args: any[]) {
    state.deprecatedApiCalls.push(`document.execCommand("${command}")`);
    return origExecCommand(command, ...args);
  };

  // Hook Notification.requestPermission
  if (typeof Notification !== 'undefined' && Notification.requestPermission) {
    const origRequestPermission = Notification.requestPermission.bind(Notification);
    let userGestureActive = false;
    document.addEventListener('click', () => { userGestureActive = true; }, true);
    document.addEventListener('keydown', () => { userGestureActive = true; }, true);
    document.addEventListener('pointerdown', () => { userGestureActive = true; }, true);

    Notification.requestPermission = function (...args: any[]) {
      if (!userGestureActive) {
        state.notificationRequestedWithoutGesture = true;
      }
      userGestureActive = false;
      return origRequestPermission(...args);
    };
  }

  // Hook navigator.geolocation.getCurrentPosition
  if (navigator.geolocation?.getCurrentPosition) {
    const origGetGeo = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    let geoUserGesture = false;
    document.addEventListener('click', () => { geoUserGesture = true; }, true);
    document.addEventListener('keydown', () => { geoUserGesture = true; }, true);

    navigator.geolocation.getCurrentPosition = function (...args: any[]) {
      if (!geoUserGesture) {
        state.geolocationRequestedWithoutGesture = true;
      }
      geoUserGesture = false;
      return origGetGeo(...args);
    };
  }

  installed = true;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/interceptors/audits/runtime-hooks.ts
git commit -m "feat(sdk): add runtime audit hooks (document.write, console, deprecated APIs)"
```

---

## Task 4: Accessibility 审计 — ~39 项 pass/fail

**Files:**
- Create: `packages/sdk/src/interceptors/audits/accessibility.ts`

- [ ] **Step 1: 创建 accessibility.ts**

实现 ~39 项 A11y 审计。每个审计函数签名：
```typescript
(el?: Element) => { passed: boolean; value?: string; details?: any } | null  // null = notApplicable
```

主函数 `auditAccessibility(): LighthouseCategoryResult` 遍历所有审计函数，按 Lighthouse 权重计算评分。

文件结构：
```typescript
import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import {
  VALID_ROLES, REQUIRED_ATTRS, ALLOWED_ATTRS, REQUIRED_CHILDREN,
  REQUIRED_PARENT, VALID_ARIA_ATTRS, getAccessibleName, hasAssociatedLabel,
  isValidBCP47, meetsWCAGAA,
} from './helpers.js';

type AuditFn = () => LighthouseAuditResult | null;

// ─── 权重 10（Critical）─────────────────────

function auditAriaAllowedAttr(): LighthouseAuditResult { ... }
function auditAriaHiddenBody(): LighthouseAuditResult { ... }
function auditAriaRequiredAttr(): LighthouseAuditResult { ... }
function auditAriaRequiredChildren(): LighthouseAuditResult { ... }
function auditAriaRequiredParent(): LighthouseAuditResult { ... }
function auditAriaRoles(): LighthouseAuditResult { ... }
function auditAriaValidAttrValue(): LighthouseAuditResult { ... }
function auditAriaValidAttr(): LighthouseAuditResult { ... }
function auditButtonName(): LighthouseAuditResult { ... }
function auditImageAlt(): LighthouseAuditResult { ... }
function auditInputImageAlt(): LighthouseAuditResult { ... }
function auditLabel(): LighthouseAuditResult { ... }
function auditMetaViewport(): LighthouseAuditResult { ... }
function auditDuplicateIdAria(): LighthouseAuditResult { ... }
function auditSelectName(): LighthouseAuditResult { ... }
function auditVideoCaption(): LighthouseAuditResult { ... }

// ─── 权重 7（Serious）───────────────────────

function auditAccesskeys(): LighthouseAuditResult { ... }
function auditAriaHiddenFocus(): LighthouseAuditResult { ... }
function auditAriaInputFieldName(): LighthouseAuditResult { ... }
function auditAriaToggleFieldName(): LighthouseAuditResult { ... }
function auditBypass(): LighthouseAuditResult { ... }
function auditColorContrast(): LighthouseAuditResult { ... }
function auditDocumentTitle(): LighthouseAuditResult { ... }
function auditFrameTitle(): LighthouseAuditResult { ... }
function auditHeadingOrder(): LighthouseAuditResult { ... }
function auditHtmlHasLang(): LighthouseAuditResult { ... }
function auditHtmlLangValid(): LighthouseAuditResult { ... }
function auditLinkName(): LighthouseAuditResult { ... }
function auditList(): LighthouseAuditResult { ... }
function auditListitem(): LighthouseAuditResult { ... }
function auditDefinitionList(): LighthouseAuditResult { ... }
function auditDlitem(): LighthouseAuditResult { ... }
function auditTabindex(): LighthouseAuditResult { ... }
function auditObjectAlt(): LighthouseAuditResult { ... }

// ─── 权重 3（Minor）─────────────────────────

function auditFormFieldMultipleLabels(): LighthouseAuditResult { ... }
function auditValidLang(): LighthouseAuditResult { ... }
function auditSkipLinkFocusable(): LighthouseAuditResult { ... }
function auditDocumentHasMainLandmark(): LighthouseAuditResult { ... }
function auditThHasDataCells(): LighthouseAuditResult { ... }

// ─── 主函数 ─────────────────────────────────

export function auditAccessibility(): LighthouseCategoryResult {
  const audits: LighthouseAuditResult[] = [];

  // 权重 10
  for (const fn of [auditAriaAllowedAttr, auditAriaHiddenBody, ...]) {
    const r = fn();
    if (r) audits.push(r);
  }
  // 权重 7
  for (const fn of [auditAccesskeys, auditAriaHiddenFocus, ...]) {
    const r = fn();
    if (r) audits.push(r);
  }
  // 权重 3
  for (const fn of [auditFormFieldMultipleLabels, ...]) {
    const r = fn();
    if (r) audits.push(r);
  }

  // 计算类别分数
  const applicable = audits.filter(a => a.score !== null);
  const totalWeight = applicable.reduce((s, a) => s + a.weight, 0);
  const passedWeight = applicable.filter(a => a.score === 1).reduce((s, a) => s + a.weight, 0);
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;

  return { id: 'accessibility', title: 'Accessibility', score, audits };
}
```

> 实施者注意：每个 `audit*()` 函数约 10-25 行，使用 `document.querySelectorAll()` / `document.querySelector()` 遍历 DOM 元素检查。详细实现参照设计文档 4.2 节中每个审计项的 "实现方式" 描述。

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/interceptors/audits/accessibility.ts
git commit -m "feat(sdk): add Accessibility audits (~39 items, Lighthouse-aligned weights)"
```

---

## Task 5: Best Practices 审计 — 8 项

**Files:**
- Create: `packages/sdk/src/interceptors/audits/best-practices.ts`

- [ ] **Step 1: 创建 best-practices.ts**

```typescript
import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import { getRuntimeAuditState, type RuntimeAuditState } from './runtime-hooks.js';
import { VULNERABLE_LIBRARIES, isVersionBelow } from './helpers.js';

export function auditBestPractices(state: RuntimeAuditState): LighthouseCategoryResult {
  const audits: LighthouseAuditResult[] = [
    auditIsOnHttps(),
    auditConsoleErrors(state),
    auditNoDocumentWrite(state),
    auditNoVulnerableLibraries(),
    auditNoDeprecatedApis(state),
    auditPasswordInputsPaste(),
    auditNotificationPermission(state),
    auditGeolocationPermission(state),
  ].filter((a): a is LighthouseAuditResult => a !== null);

  const applicable = audits.filter(a => a.score !== null);
  const passed = applicable.filter(a => a.score === 1).length;
  const score = applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0;

  return { id: 'best-practices', title: 'Best Practices', score, audits };
}

function auditIsOnHttps(): LighthouseAuditResult {
  const isHttps = location.protocol === 'https:' || location.hostname === 'localhost';
  return {
    id: 'bp-is-on-https', title: '使用 HTTPS',
    description: 'HTTPS 提供安全的数据传输',
    score: isHttps ? 1 : 0, weight: 1,
    value: isHttps ? 'HTTPS' : location.protocol,
  };
}

function auditConsoleErrors(state: RuntimeAuditState): LighthouseAuditResult {
  return {
    id: 'bp-console-errors', title: '无控制台错误',
    description: '控制台错误可能影响页面功能',
    score: state.consoleErrorCount === 0 ? 1 : 0, weight: 1,
    value: `${state.consoleErrorCount} 个错误`,
  };
}

function auditNoDocumentWrite(state: RuntimeAuditState): LighthouseAuditResult {
  return {
    id: 'bp-no-document-write', title: '无 document.write',
    description: 'document.write 会阻塞页面解析',
    score: state.documentWriteCount === 0 ? 1 : 0, weight: 1,
    value: state.documentWriteCount === 0 ? '未使用' : `调用了 ${state.documentWriteCount} 次`,
  };
}

function auditNoVulnerableLibraries(): LighthouseAuditResult {
  const vulnerable: string[] = [];
  document.querySelectorAll('script[src]').forEach((el) => {
    const src = (el as HTMLScriptElement).src;
    for (const lib of VULNERABLE_LIBRARIES) {
      const match = src.match(lib.pattern);
      if (match && isVersionBelow(match[1], lib.minSafe)) {
        vulnerable.push(`${lib.name} ${match[1]} (安全版本 >= ${lib.minSafe})`);
      }
    }
  });
  return {
    id: 'bp-no-vulnerable-libraries', title: '无已知漏洞 JS 库',
    description: '检测已知安全漏洞的 JavaScript 库',
    score: vulnerable.length === 0 ? 1 : 0, weight: 1,
    value: vulnerable.length === 0 ? '未检测到漏洞库' : `${vulnerable.length} 个漏洞库`,
    details: { vulnerable },
  };
}

function auditNoDeprecatedApis(state: RuntimeAuditState): LighthouseAuditResult {
  return {
    id: 'bp-no-deprecated-apis', title: '无废弃 API',
    description: '废弃 API 可能被移除',
    score: state.deprecatedApiCalls.length === 0 ? 1 : 0, weight: 1,
    value: state.deprecatedApiCalls.length === 0 ? '未使用' : `调用了 ${state.deprecatedApiCalls.join(', ')}`,
  };
}

function auditPasswordInputsPaste(): LighthouseAuditResult {
  const passwords = document.querySelectorAll('input[type="password"]');
  let blocked = 0;
  passwords.forEach((el) => {
    const input = el as HTMLInputElement;
    if (input.onpaste !== null || input.style.userSelect === 'none') blocked++;
  });
  return {
    id: 'bp-password-inputs-paste', title: '密码输入允许粘贴',
    description: '阻止粘贴降低安全性',
    score: blocked === 0 ? 1 : 0, weight: 1,
    value: blocked === 0 ? '允许粘贴' : `${blocked} 个密码框阻止粘贴`,
  };
}

function auditNotificationPermission(state: RuntimeAuditState): LighthouseAuditResult {
  return {
    id: 'bp-notification-permission', title: '通知权限未滥用',
    description: '非用户手势触发的通知请求会打扰用户',
    score: !state.notificationRequestedWithoutGesture ? 1 : 0, weight: 1,
    value: state.notificationRequestedWithoutGesture ? '检测到非用户手势请求' : '正常',
  };
}

function auditGeolocationPermission(state: RuntimeAuditState): LighthouseAuditResult {
  return {
    id: 'bp-geolocation-permission', title: '地理位置权限未滥用',
    description: '非用户手势触发的地理位置请求会打扰用户',
    score: !state.geolocationRequestedWithoutGesture ? 1 : 0, weight: 1,
    value: state.geolocationRequestedWithoutGesture ? '检测到非用户手势请求' : '正常',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/interceptors/audits/best-practices.ts
git commit -m "feat(sdk): add Best Practices audits (8 items, equal weight)"
```

---

## Task 6: SEO 审计 — 10 项

**Files:**
- Create: `packages/sdk/src/interceptors/audits/seo.ts`

- [ ] **Step 1: 创建 seo.ts**

```typescript
import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import { VAGUE_LINK_TEXTS } from './helpers.js';

export function auditSEO(): LighthouseCategoryResult {
  const audits: LighthouseAuditResult[] = [
    auditSeoDocumentTitle(),
    auditSeoMetaDescription(),
    auditSeoHttpStatusCode(),
    auditSeoLinkText(),
    auditSeoMetaViewport(),
    auditSeoCrawlableAnchors(),
    auditSeoHreflang(),
    auditSeoCanonical(),
    auditSeoRobotsMeta(),
    auditSeoStructuredData(),
  ].filter((a): a is LighthouseAuditResult => a !== null);

  const applicable = audits.filter(a => a.score !== null);
  const passed = applicable.filter(a => a.score === 1).length;
  const score = applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0;

  return { id: 'seo', title: 'SEO', score, audits };
}

function auditSeoDocumentTitle(): LighthouseAuditResult {
  const title = document.title?.trim() ?? '';
  const len = title.length;
  const hasTitle = len > 0;
  const goodLength = len >= 10 && len <= 60;
  return {
    id: 'seo-document-title', title: '页面标题',
    description: '标题应存在且长度 10-60 字符',
    score: hasTitle && goodLength ? 1 : 0, weight: 1,
    value: hasTitle ? `${len} 字符` : '缺失',
  };
}

function auditSeoMetaDescription(): LighthouseAuditResult {
  const desc = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
  const len = desc.length;
  const hasDesc = len > 0;
  const goodLength = len >= 50 && len <= 160;
  return {
    id: 'seo-meta-description', title: 'Meta Description',
    description: '描述应存在且长度 50-160 字符',
    score: hasDesc && goodLength ? 1 : 0, weight: 1,
    value: hasDesc ? `${len} 字符` : '缺失',
  };
}

function auditSeoHttpStatusCode(): LighthouseAuditResult {
  // 页面能执行 JS 即说明加载成功，检查 Navigation Timing
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav && 'responseStatus' in nav) {
      const status = (nav as any).responseStatus;
      const ok = status >= 200 && status < 400;
      return {
        id: 'seo-http-status-code', title: 'HTTP 状态码',
        description: '页面应返回成功状态码',
        score: ok ? 1 : 0, weight: 1,
        value: `${status}`,
      };
    }
  } catch { /* API not available */ }
  // Fallback: 页面能运行 JS 则视为 200
  return {
    id: 'seo-http-status-code', title: 'HTTP 状态码',
    description: '页面应返回成功状态码',
    score: 1, weight: 1,
    value: '页面可正常执行（视为 200）',
  };
}

function auditSeoLinkText(): LighthouseAuditResult {
  const links = document.querySelectorAll('a[href]');
  let vagueCount = 0;
  links.forEach((el) => {
    const text = el.textContent?.trim().toLowerCase() ?? '';
    if (text && VAGUE_LINK_TEXTS.has(text)) vagueCount++;
  });
  return {
    id: 'seo-link-text', title: '链接文本具描述性',
    description: '链接文本应清晰说明目标',
    score: vagueCount === 0 ? 1 : 0, weight: 1,
    value: vagueCount === 0 ? '所有链接文本描述清晰' : `${vagueCount} 个模糊链接文本`,
  };
}

function auditSeoMetaViewport(): LighthouseAuditResult {
  const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
  const hasDeviceWidth = /width\s*=\s*device-width/i.test(viewport);
  return {
    id: 'seo-meta-viewport', title: 'Viewport 配置',
    description: '应设置 width=device-width',
    score: hasDeviceWidth ? 1 : 0, weight: 1,
    value: hasDeviceWidth ? '已正确配置' : viewport || '缺失',
  };
}

function auditSeoCrawlableAnchors(): LighthouseAuditResult {
  const anchors = document.querySelectorAll('a');
  let uncrawlable = 0;
  anchors.forEach((el) => {
    const href = el.getAttribute('href');
    if (!href || href.trim() === '' || href.startsWith('javascript:')) uncrawlable++;
  });
  return {
    id: 'seo-crawlable-anchors', title: '可爬取的链接',
    description: '链接应有有效的 href 属性',
    score: uncrawlable === 0 ? 1 : 0, weight: 1,
    value: uncrawlable === 0 ? '所有链接可爬取' : `${uncrawlable} 个不可爬取的链接`,
  };
}

function auditSeoHreflang(): LighthouseAuditResult {
  const hreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
  if (hreflangs.length === 0) {
    return {
      id: 'seo-hreflang', title: 'Hreflang 标签',
      description: '多语言页面应有 hreflang 标签',
      score: null, weight: 1,
      value: '未设置（单语言页面可忽略）',
    };
  }
  // 简易检查：hreflang 值看起来像 BCP 47
  let invalid = 0;
  hreflangs.forEach((el) => {
    const lang = el.getAttribute('hreflang') ?? '';
    if (lang !== 'x-default' && !/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,8})*$/.test(lang)) invalid++;
  });
  return {
    id: 'seo-hreflang', title: 'Hreflang 标签',
    description: 'hreflang 值应为合法 BCP 47',
    score: invalid === 0 ? 1 : 0, weight: 1,
    value: invalid === 0 ? `${hreflangs.length} 个标签正确` : `${invalid} 个无效`,
  };
}

function auditSeoCanonical(): LighthouseAuditResult {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    return {
      id: 'seo-canonical', title: 'Canonical URL',
      description: '建议设置 canonical URL 避免重复内容',
      score: null, weight: 1,
      value: '未设置',
    };
  }
  const href = canonical.getAttribute('href') ?? '';
  try { new URL(href, location.href); } catch {
    return {
      id: 'seo-canonical', title: 'Canonical URL',
      description: 'canonical URL 应为合法 URL',
      score: 0, weight: 1, value: `无效 URL: ${href.slice(0, 100)}`,
    };
  }
  return {
    id: 'seo-canonical', title: 'Canonical URL',
    description: 'canonical URL 应为合法 URL',
    score: 1, weight: 1, value: href.slice(0, 100),
  };
}

function auditSeoRobotsMeta(): LighthouseAuditResult {
  const robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    return {
      id: 'seo-robots-meta', title: 'Robots Meta',
      description: '未设置 robots meta 标签（默认允许索引）',
      score: 1, weight: 1, value: '未设置（允许索引）',
    };
  }
  const content = robots.getAttribute('content') ?? '';
  const hasNoindex = /noindex/i.test(content);
  return {
    id: 'seo-robots-meta', title: 'Robots Meta',
    description: '页面应允许搜索引擎索引',
    score: !hasNoindex ? 1 : 0, weight: 1,
    value: content || '空',
  };
}

function auditSeoStructuredData(): LighthouseAuditResult {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  let valid = 0;
  scripts.forEach((el) => {
    try { JSON.parse(el.textContent ?? ''); valid++; } catch { /* invalid */ }
  });
  return {
    id: 'seo-structured-data', title: '结构化数据 (JSON-LD)',
    description: '结构化数据帮助搜索引擎理解页面内容',
    score: valid > 0 ? 1 : 0, weight: 1,
    value: valid > 0 ? `${valid} 个有效的 JSON-LD 块` : '未检测到',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/interceptors/audits/seo.ts
git commit -m "feat(sdk): add SEO audits (10 items, equal weight)"
```

---

## Task 7: 重构 page-audit.ts — 统一入口

**Files:**
- Modify: `packages/sdk/src/interceptors/page-audit.ts`

- [ ] **Step 1: 重构 page-audit.ts**

保留已有的 6 项 Performance 诊断审计函数和 `runPageAudit()` 不变（它们仍被直接使用）。在文件末尾添加新的 `runFullAudit()` 函数，整合 4 个类别。

**⚠️ 关键：已有的 6 项 Performance 诊断审计（DOM 规模、渲染阻塞、图片优化、资源体积、压缩、字体）必须保留。** `runFullAudit()` 在返回的 `FullAuditReport` 中增加一个额外的 `performanceDiagnostics` 字段来携带这些诊断项，这样服务端可以将其存储在 `PerfRunSession` 中供 Web 面板展示。

首先扩展 `FullAuditReport` 类型（在 Task 1 的 `packages/types/src/audit.ts` 中）：

```typescript
// 在 FullAuditReport 接口中添加:
export interface FullAuditReport {
  timestamp: number;
  url: string;
  userAgent: string;
  categories: LighthouseCategoryResult[];
  performanceDiagnostics?: AuditItem[]; // 保留已有的 Performance 诊断项
}
```

然后在 page-audit.ts 中：

```typescript
// 在文件顶部添加 import
import type { FullAuditReport, LighthouseCategoryResult } from '@codelog/types';
import { auditAccessibility } from './audits/accessibility.js';
import { auditBestPractices } from './audits/best-practices.js';
import { auditSEO } from './audits/seo.ts';
import { getRuntimeAuditState, resetRuntimeAuditState } from './audits/runtime-hooks.js';

// ... 保留所有已有的 AuditItem 接口和 audit* 函数不变 ...
// ... 保留 runPageAudit() 不变 ...

/**
 * 新入口：运行完整的 Lighthouse 风格 4 类别审计
 *
 * 同时运行已有的 Performance 诊断审计（runPageAudit），
 * 结果存入 performanceDiagnostics 字段供 Web 面板展示。
 */
export function runFullAudit(): FullAuditReport {
  const runtimeState = getRuntimeAuditState();

  // 运行已有的 Performance 诊断审计
  const legacyAudit = runPageAudit();

  const categories: LighthouseCategoryResult[] = [
    auditAccessibility(),
    auditBestPractices(runtimeState),
    auditSEO(),
    // Performance 类别的分数由服务端 log-normal 计算，这里不重复
  ];

  // 跑分完成后重置运行时状态
  resetRuntimeAuditState();

  return {
    timestamp: Date.now(),
    url: location.href,
    userAgent: navigator.userAgent,
    categories,
    performanceDiagnostics: legacyAudit.audits,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/interceptors/page-audit.ts
git commit -m "refactor(sdk): add runFullAudit() entry point, preserve Performance diagnostics"
```

---

## Task 8: SDK 集成 — index.ts 修改

**Files:**
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/sdk/src/types/index.ts`

- [ ] **Step 1: 修改 SDK types — PerfRunRawPayload.audit 类型**

在 `packages/sdk/src/types/index.ts` 中：
- 添加 `import type { FullAuditReport } from '@codelog/types';`
- 将 `PerfRunRawPayload.audit?: PageAuditReport` 改为 `audit?: FullAuditReport`

- [ ] **Step 2: 修改 SDK index.ts**

在 `packages/sdk/src/index.ts` 中：

1. 添加 import:
```typescript
import { installRuntimeAuditHooks, resetRuntimeAuditState } from './interceptors/audits/runtime-hooks.js';
```

2. 在 SDK 构造函数（`constructor`）末尾添加:
```typescript
// 安装运行时审计 Hook（document.write 监控、废弃 API 检测等）
installRuntimeAuditHooks();
```

3. 在 `stopPerfRun()` 方法中，将 `runPageAudit()` 调用替换为 `runFullAudit()`：
```typescript
// 旧代码：
// const audit = runPageAudit();
// 新代码：
const audit = runFullAudit();
```

4. 在 SDK 的 `destroy()` 方法中添加清理（确保 destroy → init 不会跳过 Hook）：
```typescript
// 在 destroy() 方法中添加：
resetRuntimeAuditState();
```
> 注意：`installRuntimeAuditHooks()` 使用 `installed` 标志防止重复安装。`resetRuntimeAuditState()` 只重置计数器，不卸载 Hook（因为卸载覆盖的 `document.write` 等方法不可靠）。如果 SDK 被 destroy 后重新 init，Hook 仍保留但计数器被重置，这是可接受的。
```

- [ ] **Step 3: 构建验证**

Run: `pnpm --filter @codelog/types build && pnpm --filter @codelog/sdk build`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/index.ts packages/sdk/src/types/index.ts
git commit -m "feat(sdk): integrate Lighthouse audit system into perf run flow"
```

---

## Task 9: 服务端评分扩展 — categories 评分

**Files:**
- Modify: `packages/cli/src/store/perfRun.ts` — PerfRunScore 添加 categories 字段
- Modify: `packages/cli/src/core/perf-score.ts` — 新增 scoreCategories + 扩展 scorePerfRun 签名
- Modify: `packages/cli/src/ws/handlers.ts` — handler 传入 audit 参数

> **⚠️ 类型同步说明**：categories 字段需要在 3 处同步添加：
> 1. `@codelog/types` 的 `PerfRunPayload.score`（Task 1 Step 3，已处理）
> 2. CLI 本地的 `PerfRunScore`（本 Task Step 1）
> 3. Web 本地的 `PerfRunScore`（Task 11 Step 1）
>
> 这是因为当前项目历史原因，3 处各有独立的类型定义。未来应统一到 `@codelog/types`。

- [ ] **Step 1: 扩展 CLI 本地 PerfRunScore 类型**

在 `packages/cli/src/store/perfRun.ts` 中（`PerfRunScore` 接口在 line 12-18）：
- 在文件顶部添加 import:
```typescript
import type { CategoryScore } from '@codelog/types';
```
- 在 `PerfRunScore` 接口的 `summary` 字段后添加:
```typescript
  categories?: Record<string, CategoryScore>;
```
- 同时将 `PerfRunSession.audit` 的类型从 `any` 改为 `FullAuditReport | undefined`（从 `@codelog/types` 导入）

- [ ] **Step 2: 添加 scoreCategories 函数 + 扩展 scorePerfRun 签名**

在 `packages/cli/src/core/perf-score.ts` 中：

1. 在文件顶部 import 区域添加:
```typescript
import type { FullAuditReport, CategoryScore } from '@codelog/types';
```

2. 在 `scorePerfRun` 函数（当前签名 `line 188: export function scorePerfRun(snapshot: PerformancePayload): PerfRunScore`）之前添加新的 `scoreCategories` 函数:

```typescript
/**
 * 从 FullAuditReport 计算各类别评分
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
```

3. 修改 `scorePerfRun` 签名，添加可选 `audit` 参数并合并结果:
```typescript
// 旧签名：
// export function scorePerfRun(snapshot: PerformancePayload): PerfRunScore {
// 新签名：
export function scorePerfRun(snapshot: PerformancePayload, audit?: FullAuditReport): PerfRunScore {
  // ... 已有的评分逻辑完全不变 ...

  // 在 return 语句之前添加:
  const categories = scoreCategories(audit);

  // 修改 return 对象，添加 categories 字段:
  return { total, grade, items, issues, summary, categories };
}
```

- [ ] **Step 3: 修改 handlers.ts 调用**

在 `packages/cli/src/ws/handlers.ts` 的 `perf_run_raw` handler 中，找到 `scorePerfRun` 调用（约 line 150），添加第二个参数:

```typescript
// 旧代码（line 150）：
// const score = scorePerfRun(raw.snapshot ?? { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] });
// 新代码：
const score = scorePerfRun(
  raw.snapshot ?? { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
  raw.audit,
);
```

- [ ] **Step 4: 运行已有测试验证回归**

Run: `pnpm --filter @codelog/cli test`
Expected: 已有的 8 个 perf-score 测试全部通过（因为 audit 参数是可选的，不传时 categories 为空对象 `{}`）

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/store/perfRun.ts packages/cli/src/core/perf-score.ts packages/cli/src/ws/handlers.ts
git commit -m "feat(cli): add category scoring for A11y/BP/SEO in perf run handler"
```

---

## Task 10: 类别评分单元测试

**Files:**
- Create: `packages/cli/src/core/__tests__/category-score.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest';
import type { FullAuditReport, LighthouseAuditResult } from '@codelog/types';

// 注意：需要从构建产物导入
import { scorePerfRun } from '../perf-score.js';

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
        makeAudit('bp-1', 1, 1), // pass
        makeAudit('bp-2', 1, 1), // pass
        makeAudit('bp-3', 0, 1), // fail
        makeAudit('bp-4', 1, 1), // pass
      ],
    }]);
    const result = scorePerfRun(
      { vitals: [], samples: [], longTasks: [], resources: [], interactions: [] },
      report,
    );
    // 3/4 = 75
    expect(result.categories!['best-practices'].score).toBe(75);
    expect(result.categories!['best-practices'].grade).toBe('B');
  });

  it('SEO 等权评分正确', () => {
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
    // 2/2 = 100 (notApplicable 不计入)
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
```

- [ ] **Step 2: 运行测试**

Run: `pnpm --filter @codelog/cli test`
Expected: 所有测试通过（已有 8 个 + 新增 6 个）

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/core/__tests__/category-score.test.ts
git commit -m "test(cli): add category scoring unit tests"
```

---

## Task 11: Web 面板 — 4 类别仪表盘 + Tab 详情

**Files:**
- Modify: `packages/web/src/components/PerfRunPanel.tsx`
- Modify: `packages/web/src/types/index.ts`

> **⚠️ 向后兼容**：旧版 SDK 发来的跑分数据不包含 `categories` 字段。Web 面板必须处理 `session.score.categories` 为 `undefined` 的情况，此时 fallback 到当前的纯 Performance 展示模式。

- [ ] **Step 1: 更新 Web 类型**

在 `packages/web/src/types/index.ts` 的 `PerfRunScore` 接口（line 184-190）中，在 `summary` 字段后添加:
```typescript
  categories?: Record<string, {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    audits: Array<{
      id: string;
      title: string;
      description: string;
      score: number | null;
      weight: number;
      value?: string;
      details?: any;
    }>;
  }>;
```

同时在 `PerfRunSession` 接口（line 192-201）中添加 `audit` 字段（当前缺失）:
```typescript
  audit?: any; // FullAuditReport，旧版数据可能为 undefined
```

- [ ] **Step 2: 重写 PerfRunPanel.tsx**

UI 布局：
1. **顶部**：当 `session.score.categories` 存在时显示 4 个类别仪表盘；否则显示当前的单一 Performance 仪表盘（向后兼容）
2. **下方 Tab**：4 个 Tab 切换各类别审计详情
3. **审计列表**：每个审计项显示 ✅ pass / ❌ fail / ⚠️ N/A，带标题、值、描述

关键代码结构：
```typescript
const CATEGORY_LABELS: Record<string, string> = {
  'performance': 'Performance',
  'accessibility': 'Accessibility',
  'best-practices': 'Best Practices',
  'seo': 'SEO',
};

// 新增状态
const [activeCategoryTab, setActiveCategoryTab] = useState<string>('performance');
const hasCategories = !!session?.score?.categories && Object.keys(session.score.categories).length > 0;

// 向后兼容：有 categories 时显示 4 仪表盘，否则显示单一 Performance 仪表盘
{hasCategories ? (
  <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
    <CategoryGauge label="Performance" score={session.score.total} grade={session.score.grade} />
    {Object.entries(session.score.categories).map(([id, cat]) => (
      <CategoryGauge key={id} label={CATEGORY_LABELS[id]} score={cat.score} grade={cat.grade} />
    ))}
  </div>
) : (
  // 旧版 fallback：仅显示 Performance 总分
  <ScoreCircle score={session?.score?.total ?? 0} color={gradeColor(session?.score?.grade)} />
)}

// Tab 切换 + 审计列表（仅当有 categories 时显示）
{hasCategories && (
  <div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <TabButton active={activeCategoryTab === 'performance'} onClick={() => setActiveCategoryTab('performance')}>Performance</TabButton>
      {Object.keys(session.score.categories!).map(id => (
        <TabButton key={id} active={activeCategoryTab === id} onClick={() => setActiveCategoryTab(id)}>
          {CATEGORY_LABELS[id]}
        </TabButton>
      ))}
    </div>
    {activeCategoryTab === 'performance' ? (
      // Performance: 显示已有的指标卡片 + issues
      <>{/* 保留当前已有的 metrics grid 和 issues 列表 */}</>
    ) : (
      <AuditList audits={session.score.categories![activeCategoryTab]?.audits ?? []} />
    )}
  </div>
)}
```

- [ ] **Step 3: 验证 Web 构建**

Run: `pnpm --filter @codelog/web build`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/PerfRunPanel.tsx packages/web/src/types/index.ts
git commit -m "feat(web): add 4-category gauge and tab detail with backward compat"
```

---

## Task 12: 全量构建 + 回归测试

**Files:** 无新增

- [ ] **Step 1: 全量构建**

Run: `pnpm build`
Expected: 所有包构建成功

- [ ] **Step 2: 运行所有测试**

Run: `pnpm test`
Expected: 所有测试通过（包含已有的 perf-score 测试 + 新增 category-score 测试）

- [ ] **Step 3: 启动服务器验证**

Run: `pnpm start`
Expected: 服务器在 38291 端口启动

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve build/test issues from Lighthouse audit integration"
```

---

## 依赖关系

```
Task 1 (types)
  └→ Task 2 (helpers) ──→ Task 4 (A11y) ──→ Task 7 (page-audit) ──→ Task 8 (SDK index) ──→ Task 12 (build)
  └→ Task 3 (runtime-hooks) ──→ Task 5 (BP)   ──┘                          │
  └→ Task 6 (SEO) ───────────────────────────┘                              │
  └→ Task 9 (server scoring) ──→ Task 10 (tests) ──→ Task 12              │
  └→ Task 11 (web panel) ──→ Task 12                                       │
```

**并行可能性**：Task 2/3 可并行，Task 4/5/6 可并行，Task 9/10/11 可并行。

## 风险与回退

1. **ARIA role 字典体积过大**：如果超过 10KB gzip，考虑只保留最常见的 30 个 role
2. **颜色对比度在移动端 WebView 不可靠**：标记为 `notApplicable` 而非给错误分数
3. **运行时 Hook 与第三方库冲突**：Hook 使用 `.bind()` 保留原始引用，减少副作用
