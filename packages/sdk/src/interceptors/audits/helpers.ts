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
export function parseColor(color: string): [number, number, number] | null {
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
  const id = el.id;
  if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return true;
  if (el.closest('label')) return true;
  if (el.getAttribute('aria-labelledby')) return true;
  if (el.getAttribute('aria-label')?.trim()) return true;
  if (el.getAttribute('title')?.trim()) return true;
  return false;
}

/** 简易 BCP 47 验证 */
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

/** 已知漏洞 JS 库 */
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

// ─── 国际化工具 ───────────────────────────────────────────────

/** 检测当前语言是否为中文 */
export function isZhLang(): boolean {
  try {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem('codelog-lang');
    if (stored === 'en') return false;
    if (stored === 'zh') return true;
    return navigator.language.toLowerCase().startsWith('zh');
  } catch {
    return navigator.language.toLowerCase().startsWith('zh');
  }
}

/** 双语文本类型 */
export interface BilingualText {
  zh: string;
  en: string;
}

/** 根据当前语言选择中文或英文 */
export function t(text: BilingualText): string {
  return isZhLang() ? text.zh : text.en;
}
