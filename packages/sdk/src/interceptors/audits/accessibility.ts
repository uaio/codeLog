/**
 * Accessibility 审计 — ~39 项 Lighthouse 风格审计
 * 权重：10 (Critical) / 7 (Serious) / 3 (Minor)
 */

import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import {
  VALID_ROLES, ABSTRACT_ROLES, REQUIRED_ATTRS, REQUIRED_CHILDREN,
  REQUIRED_PARENT, VALID_ARIA_ATTRS, getAccessibleName, hasAssociatedLabel,
  isValidBCP47, meetsWCAGAA,
} from './helpers.js';
import { t, isZhLang } from './helpers.js';
import type { BilingualText } from './helpers.js';

const TEXTS: Record<string, { title: BilingualText; description: BilingualText }> = {
  // Weight 10 (Critical)
  'aria-allowed-attr': { title: { zh: 'ARIA 属性匹配角色', en: 'ARIA Attributes Match Role' }, description: { zh: 'ARIA 属性应与元素角色匹配', en: 'ARIA attributes should match element roles' } },
  'aria-hidden-body': { title: { zh: 'body 无 aria-hidden', en: 'No aria-hidden on body' }, description: { zh: 'body 元素不应设置 aria-hidden', en: 'Body element should not have aria-hidden' } },
  'aria-required-attr': { title: { zh: 'ARIA 必需属性', en: 'Required ARIA Attributes' }, description: { zh: '元素角色应具有必需的 ARIA 属性', en: 'Element roles must have required ARIA attributes' } },
  'aria-required-children': { title: { zh: 'ARIA 必需子角色', en: 'Required ARIA Children' }, description: { zh: '复合控件应包含必需的子角色', en: 'Composite widgets must contain required child roles' } },
  'aria-required-parent': { title: { zh: 'ARIA 必需父角色', en: 'Required ARIA Parent' }, description: { zh: '角色应在合法的父元素内', en: 'Roles must be inside valid parent elements' } },
  'aria-roles': { title: { zh: 'ARIA 角色有效', en: 'Valid ARIA Roles' }, description: { zh: '使用的 ARIA 角色应为合法值', en: 'ARIA roles used should be valid values' } },
  'aria-valid-attr-value': { title: { zh: 'ARIA 属性值有效', en: 'Valid ARIA Attribute Values' }, description: { zh: 'ARIA 属性值应为合法值', en: 'ARIA attribute values should be valid' } },
  'aria-valid-attr': { title: { zh: 'ARIA 属性名有效', en: 'Valid ARIA Attribute Names' }, description: { zh: 'ARIA 属性名不应有拼写错误', en: 'ARIA attribute names should not be misspelled' } },
  'button-name': { title: { zh: '按钮有可辨识名称', en: 'Button Has Discernible Name' }, description: { zh: '所有按钮应有可辨识的文本', en: 'All buttons must have discernible text' } },
  'image-alt': { title: { zh: '图片有 alt 属性', en: 'Image Elements Have alt' }, description: { zh: '所有 img 元素应具有 alt 属性', en: 'All img elements must have alt attributes' } },
  'input-image-alt': { title: { zh: '图片按钮有 alt', en: 'Image Input Has alt' }, description: { zh: 'input[type=image] 应有 alt 属性', en: 'input[type=image] must have alt attribute' } },
  'label': { title: { zh: '表单元素有关联标签', en: 'Form Elements Have Labels' }, description: { zh: '表单控件应有关联的 label', en: 'Form controls must have associated labels' } },
  'meta-viewport': { title: { zh: 'viewport 未禁用缩放', en: 'Viewport Does Not Disable Zoom' }, description: { zh: '不应设置 user-scalable=no 或 maximum-scale<5', en: 'Should not set user-scalable=no or maximum-scale<5' } },
  'duplicate-id-aria': { title: { zh: 'ARIA 引用 ID 唯一', en: 'ARIA Reference IDs Are Unique' }, description: { zh: 'aria-describedby 等引用的 ID 应唯一', en: 'IDs referenced by aria-describedby etc. must be unique' } },
  'select-name': { title: { zh: '选择框有关联标签', en: 'Select Has Associated Label' }, description: { zh: 'select 元素应有关联的 label', en: 'select elements must have associated labels' } },
  'video-caption': { title: { zh: '视频有字幕', en: 'Video Has Captions' }, description: { zh: 'video 元素应包含字幕轨道', en: 'video elements must contain caption tracks' } },
  // Weight 7 (Serious)
  'accesskeys': { title: { zh: 'accesskey 值唯一', en: 'accesskey Values Are Unique' }, description: { zh: '每个 accesskey 值应唯一', en: 'Each accesskey value should be unique' } },
  'aria-hidden-focus': { title: { zh: 'aria-hidden 不含焦点元素', en: 'aria-hidden Does Not Contain Focusable' }, description: { zh: 'aria-hidden 元素不应包含可聚焦后代', en: 'aria-hidden elements must not contain focusable descendants' } },
  'aria-input-field-name': { title: { zh: 'ARIA 输入字段有名称', en: 'ARIA Input Fields Have Names' }, description: { zh: 'ARIA 输入角色应有可访问名称', en: 'ARIA input roles must have accessible names' } },
  'aria-toggle-field-name': { title: { zh: 'ARIA 开关字段有名称', en: 'ARIA Toggle Fields Have Names' }, description: { zh: 'ARIA 开关角色应有可访问名称', en: 'ARIA toggle roles must have accessible names' } },
  'bypass': { title: { zh: '页面有跳过导航', en: 'Page Has Bypass Navigation' }, description: { zh: '页面应有跳过导航链接或 landmark', en: 'Page should have skip links or landmarks' } },
  'color-contrast': { title: { zh: '文本对比度足够', en: 'Sufficient Color Contrast' }, description: { zh: '文本与背景对比度应满足 WCAG AA 标准', en: 'Text-background contrast should meet WCAG AA' } },
  'document-title': { title: { zh: '页面有标题', en: 'Document Has Title' }, description: { zh: '页面应有非空的 title 元素', en: 'Page must have a non-empty title element' } },
  'frame-title': { title: { zh: 'iframe 有标题', en: 'iframe Has Title' }, description: { zh: '所有 iframe 应有 title 属性', en: 'All iframes must have title attributes' } },
  'heading-order': { title: { zh: '标题层级有序', en: 'Heading Levels Do Not Skip' }, description: { zh: '标题层级不应跳级', en: 'Heading levels should not skip' } },
  'html-has-lang': { title: { zh: 'html 有 lang 属性', en: 'html Has lang Attribute' }, description: { zh: 'html 元素应有 lang 属性', en: 'html element must have a lang attribute' } },
  'html-lang-valid': { title: { zh: 'lang 属性值有效', en: 'Valid lang Attribute' }, description: { zh: 'lang 属性值应为合法 BCP 47', en: 'lang attribute should be valid BCP 47' } },
  'link-name': { title: { zh: '链接有可辨识名称', en: 'Link Has Discernible Name' }, description: { zh: '所有链接应有可辨识的文本', en: 'All links must have discernible text' } },
  'list': { title: { zh: '列表结构正确', en: 'Proper List Structure' }, description: { zh: 'ul/ol 内应只包含 li 等允许的子元素', en: 'ul/ol should only contain allowed children' } },
  'listitem': { title: { zh: '列表项在列表内', en: 'List Items In Lists' }, description: { zh: 'li 应在 ul/ol/menu 内', en: 'li elements must be inside ul/ol/menu' } },
  'definition-list': { title: { zh: '定义列表结构正确', en: 'Proper Definition List' }, description: { zh: 'dl 内应只包含 dt/dd 等允许的子元素', en: 'dl should only contain allowed children' } },
  'dlitem': { title: { zh: '定义项在 dl 内', en: 'Definition Items In dl' }, description: { zh: 'dt/dd 应在 dl 内', en: 'dt/dd must be inside dl' } },
  'tabindex': { title: { zh: '无 tabindex>0', en: 'No tabindex>0' }, description: { zh: '不应使用 tabindex 大于 0 的值', en: 'Should not use tabindex values greater than 0' } },
  'object-alt': { title: { zh: 'object 有替代文本', en: 'Object Has Alternate Text' }, description: { zh: 'object 元素应有替代文本', en: 'object elements should have alternate text' } },
  // Weight 3 (Minor)
  'form-field-multiple-labels': { title: { zh: '表单字段无多个标签', en: 'No Multiple Labels' }, description: { zh: '表单字段不应被多个 label 关联', en: 'Form fields should not have multiple labels' } },
  'valid-lang': { title: { zh: 'lang 属性值有效', en: 'Valid lang Attributes' }, description: { zh: '所有 lang 属性值应为合法 BCP 47', en: 'All lang attributes should be valid BCP 47' } },
  'skip-link-focusable': { title: { zh: '跳过链接可聚焦', en: 'Skip Link Is Focusable' }, description: { zh: '跳过导航链接应可通过键盘聚焦', en: 'Skip navigation link should be keyboard focusable' } },
  'document-has-main-landmark': { title: { zh: '页面有 main 地标', en: 'Page Has Main Landmark' }, description: { zh: '页面应有 main 元素或 role="main"', en: 'Page should have a main element or role="main"' } },
  'th-has-data-cells': { title: { zh: '表头有数据单元格', en: 'Header Cells Have Data Cells' }, description: { zh: '表头 th 应有关联的 td 单元格', en: 'th elements should have associated td cells' } },
};

// ─── 权重 10（Critical）— 16 项 ────────────────────────────────

function auditAriaAllowedAttr(): LighthouseAuditResult | null {
  const elements = document.querySelectorAll('[role]');
  /** 全局 aria 属性 — 任何 role 都允许 */
  const GLOBAL_ARIA = new Set([
    'aria-atomic', 'aria-busy', 'aria-controls', 'aria-current',
    'aria-describedby', 'aria-description', 'aria-details',
    'aria-disabled', 'aria-dropeffect', 'aria-flowto', 'aria-grabbed',
    'aria-haspopup', 'aria-hidden', 'aria-invalid', 'aria-keyshortcuts',
    'aria-label', 'aria-labelledby', 'aria-live', 'aria-owns',
    'aria-placeholder', 'aria-readonly', 'aria-relevant', 'aria-required',
    'aria-roledescription', 'aria-errormessage',
  ]);
  /** role 特有允许的 aria 属性 */
  const ROLE_ATTRS: Record<string, string[]> = {
    checkbox: ['aria-checked'],
    combobox: ['aria-expanded', 'aria-autocomplete'],
    heading: ['aria-level'],
    slider: ['aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext'],
    spinbutton: ['aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext'],
    textbox: ['aria-autocomplete', 'aria-multiline'],
    scrollbar: ['aria-controls', 'aria-orientation', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow'],
    radio: ['aria-checked'],
    switch: ['aria-checked'],
    menuitemcheckbox: ['aria-checked'],
    menuitemradio: ['aria-checked'],
    option: ['aria-selected'],
    tablist: ['aria-orientation'],
    grid: ['aria-readonly', 'aria-multiselectable'],
    treegrid: ['aria-readonly'],
    separator: ['aria-orientation', 'aria-valuenow'],
  };
  let fail = 0;
  elements.forEach(el => {
    const role = el.getAttribute('role')!;
    const roleSpecific = ROLE_ATTRS[role];
    if (!roleSpecific) return; // 无特殊限制的 role 跳过
    for (const attr of el.getAttributeNames()) {
      if (!attr.startsWith('aria-')) continue;
      if (GLOBAL_ARIA.has(attr) || roleSpecific.includes(attr)) continue;
      fail++;
    }
  });
  const isZh = isZhLang();
  return {
    id: 'aria-allowed-attr', title: t(TEXTS['aria-allowed-attr'].title),
    description: t(TEXTS['aria-allowed-attr'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '处违规' : 'violation(s)'}` : undefined,
  };
}

function auditAriaHiddenBody(): LighthouseAuditResult | null {
  const hidden = document.body.getAttribute('aria-hidden');
  return {
    id: 'aria-hidden-body', title: t(TEXTS['aria-hidden-body'].title),
    description: t(TEXTS['aria-hidden-body'].description),
    score: hidden !== 'true' ? 1 : 0, weight: 10,
  };
}

function auditAriaRequiredAttr(): LighthouseAuditResult | null {
  let fail = 0;
  for (const [role, attrs] of Object.entries(REQUIRED_ATTRS)) {
    document.querySelectorAll(`[role="${role}"]`).forEach(el => {
      for (const attr of attrs) {
        if (!el.hasAttribute(attr)) fail++;
      }
    });
  }
  const isZh = isZhLang();
  return {
    id: 'aria-required-attr', title: t(TEXTS['aria-required-attr'].title),
    description: t(TEXTS['aria-required-attr'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个缺失属性' : 'missing attribute(s)'}` : undefined,
  };
}

function auditAriaRequiredChildren(): LighthouseAuditResult | null {
  let fail = 0;
  for (const [parentRole, childRoles] of Object.entries(REQUIRED_CHILDREN)) {
    document.querySelectorAll(`[role="${parentRole}"]`).forEach(el => {
      const hasChild = Array.from(el.children).some(child => {
        const cr = child.getAttribute('role');
        return cr && childRoles.includes(cr);
      });
      if (!hasChild) fail++;
    });
  }
  const isZh = isZhLang();
  return {
    id: 'aria-required-children', title: t(TEXTS['aria-required-children'].title),
    description: t(TEXTS['aria-required-children'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '处违规' : 'violation(s)'}` : undefined,
  };
}

function auditAriaRequiredParent(): LighthouseAuditResult | null {
  let fail = 0;
  for (const [childRole, parentRoles] of Object.entries(REQUIRED_PARENT)) {
    document.querySelectorAll(`[role="${childRole}"]`).forEach(el => {
      const parentRole = el.parentElement?.getAttribute('role');
      if (!parentRole || !parentRoles.includes(parentRole)) fail++;
    });
  }
  const isZh = isZhLang();
  return {
    id: 'aria-required-parent', title: t(TEXTS['aria-required-parent'].title),
    description: t(TEXTS['aria-required-parent'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '处违规' : 'violation(s)'}` : undefined,
  };
}

function auditAriaRoles(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('[role]').forEach(el => {
    const role = el.getAttribute('role')!;
    if (!VALID_ROLES.has(role) || ABSTRACT_ROLES.has(role)) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'aria-roles', title: t(TEXTS['aria-roles'].title),
    description: t(TEXTS['aria-roles'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个无效角色' : 'invalid role(s)'}` : undefined,
  };
}

function auditAriaValidAttrValue(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('*').forEach(el => {
    for (const attr of el.getAttributeNames()) {
      if (!attr.startsWith('aria-')) continue;
      const val = el.getAttribute(attr)!;
      if (!val.trim()) { fail++; continue; }
      // Check ID references exist
      if ((attr === 'aria-labelledby' || attr === 'aria-describedby' || attr === 'aria-owns' || attr === 'aria-controls' || attr === 'aria-flowto' || attr === 'aria-activedescendant') && val) {
        for (const id of val.split(/\s+/)) {
          if (!document.getElementById(id)) fail++;
        }
      }
    }
  });
  const isZh = isZhLang();
  return {
    id: 'aria-valid-attr-value', title: t(TEXTS['aria-valid-attr-value'].title),
    description: t(TEXTS['aria-valid-attr-value'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个无效值' : 'invalid value(s)'}` : undefined,
  };
}

function auditAriaValidAttr(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('*').forEach(el => {
    for (const attr of el.getAttributeNames()) {
      if (attr.startsWith('aria-') && !VALID_ARIA_ATTRS.has(attr)) fail++;
    }
  });
  const isZh = isZhLang();
  return {
    id: 'aria-valid-attr', title: t(TEXTS['aria-valid-attr'].title),
    description: t(TEXTS['aria-valid-attr'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个无效属性' : 'invalid attr(s)'}` : undefined,
  };
}

function auditButtonName(): LighthouseAuditResult | null {
  const buttons = document.querySelectorAll('button');
  if (buttons.length === 0) return null;
  let fail = 0;
  buttons.forEach(btn => {
    if (!getAccessibleName(btn)) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'button-name', title: t(TEXTS['button-name'].title),
    description: t(TEXTS['button-name'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个按钮无名称' : 'button(s) without name'}` : undefined,
  };
}

function auditImageAlt(): LighthouseAuditResult | null {
  const imgs = document.querySelectorAll('img');
  if (imgs.length === 0) return null;
  let fail = 0;
  imgs.forEach(img => {
    if (!img.hasAttribute('alt')) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'image-alt', title: t(TEXTS['image-alt'].title),
    description: t(TEXTS['image-alt'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '张图片缺少 alt' : 'image(s) missing alt'}` : undefined,
  };
}

function auditInputImageAlt(): LighthouseAuditResult | null {
  const inputs = document.querySelectorAll('input[type="image"]');
  if (inputs.length === 0) return null;
  let fail = 0;
  inputs.forEach(input => {
    if (!input.hasAttribute('alt')) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'input-image-alt', title: t(TEXTS['input-image-alt'].title),
    description: t(TEXTS['input-image-alt'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个输入缺少 alt' : 'input(s) missing alt'}` : undefined,
  };
}

function auditLabel(): LighthouseAuditResult | null {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="image"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
  if (inputs.length === 0) return null;
  let fail = 0;
  inputs.forEach(el => {
    if (!hasAssociatedLabel(el as HTMLElement)) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'label', title: t(TEXTS['label'].title),
    description: t(TEXTS['label'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个元素无标签' : 'element(s) without label'}` : undefined,
  };
}

function auditMetaViewport(): LighthouseAuditResult | null {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return null;
  const content = meta.getAttribute('content') ?? '';
  const maxScale = content.match(/maximum-scale\s*=\s*([\d.]+)/);
  const userScalable = content.match(/user-scalable\s*=\s*(\w+)/);
  const fail = (maxScale && parseFloat(maxScale[1]) < 5) ||
    (userScalable && userScalable[1].toLowerCase() === 'no');
  return {
    id: 'meta-viewport', title: t(TEXTS['meta-viewport'].title),
    description: t(TEXTS['meta-viewport'].description),
    score: fail ? 0 : 1, weight: 10,
  };
}

function auditDuplicateIdAria(): LighthouseAuditResult | null {
  let fail = 0;
  const idRefs = new Set<string>();
  document.querySelectorAll('[aria-describedby], [aria-labelledby]').forEach(el => {
    const attrs = ['aria-describedby', 'aria-labelledby'];
    attrs.forEach(attr => {
      const val = el.getAttribute(attr);
      if (val) val.split(/\s+/).forEach(id => idRefs.add(id));
    });
  });
  for (const id of idRefs) {
    const matches = document.querySelectorAll(`[id="${CSS.escape(id)}"]`);
    if (matches.length > 1) fail++;
  }
  const isZh = isZhLang();
  return {
    id: 'duplicate-id-aria', title: t(TEXTS['duplicate-id-aria'].title),
    description: t(TEXTS['duplicate-id-aria'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个重复 ID' : 'duplicate ID(s)'}` : undefined,
  };
}

function auditSelectName(): LighthouseAuditResult | null {
  const selects = document.querySelectorAll('select');
  if (selects.length === 0) return null;
  let fail = 0;
  selects.forEach(sel => {
    if (!hasAssociatedLabel(sel as HTMLElement)) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'select-name', title: t(TEXTS['select-name'].title),
    description: t(TEXTS['select-name'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个选择框无标签' : 'select(s) without label'}` : undefined,
  };
}

function auditVideoCaption(): LighthouseAuditResult | null {
  const videos = document.querySelectorAll('video');
  if (videos.length === 0) return null;
  let fail = 0;
  videos.forEach(video => {
    if (!video.querySelector('track[kind="captions"]')) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'video-caption', title: t(TEXTS['video-caption'].title),
    description: t(TEXTS['video-caption'].description),
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} ${isZh ? '个视频无字幕' : 'video(s) without captions'}` : undefined,
  };
}

// ─── 权重 7（Serious）— 18 项 ────────────────────────────────

function auditAccesskeys(): LighthouseAuditResult | null {
  const elements = document.querySelectorAll('[accesskey]');
  if (elements.length === 0) return null;
  const seen = new Set<string>();
  let fail = 0;
  elements.forEach(el => {
    const key = el.getAttribute('accesskey');
    if (key) {
      if (seen.has(key)) fail++;
      seen.add(key);
    }
  });
  const isZh = isZhLang();
  return {
    id: 'accesskeys', title: t(TEXTS['accesskeys'].title),
    description: t(TEXTS['accesskeys'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个重复 accesskey' : 'duplicate accesskey(s)'}` : undefined,
  };
}

function auditAriaHiddenFocus(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
    const focusable = el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
    if (focusable.length > 0) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'aria-hidden-focus', title: t(TEXTS['aria-hidden-focus'].title),
    description: t(TEXTS['aria-hidden-focus'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '处违规' : 'violation(s)'}` : undefined,
  };
}

function auditAriaInputFieldName(): LighthouseAuditResult | null {
  const inputRoles = ['textbox', 'combobox', 'searchbox', 'spinbutton', 'slider'];
  let fail = 0;
  inputRoles.forEach(role => {
    document.querySelectorAll(`[role="${role}"]`).forEach(el => {
      if (!getAccessibleName(el)) fail++;
    });
  });
  const isZh = isZhLang();
  return {
    id: 'aria-input-field-name', title: t(TEXTS['aria-input-field-name'].title),
    description: t(TEXTS['aria-input-field-name'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个字段无名称' : 'field(s) without name'}` : undefined,
  };
}

function auditAriaToggleFieldName(): LighthouseAuditResult | null {
  const toggleRoles = ['checkbox', 'radio', 'switch'];
  let fail = 0;
  toggleRoles.forEach(role => {
    document.querySelectorAll(`[role="${role}"]`).forEach(el => {
      if (!getAccessibleName(el)) fail++;
    });
  });
  const isZh = isZhLang();
  return {
    id: 'aria-toggle-field-name', title: t(TEXTS['aria-toggle-field-name'].title),
    description: t(TEXTS['aria-toggle-field-name'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个字段无名称' : 'field(s) without name'}` : undefined,
  };
}

function auditBypass(): LighthouseAuditResult | null {
  const landmarks = document.querySelector('main, [role="main"], header, [role="banner"], footer, [role="contentinfo"], nav, [role="navigation"], aside, [role="complementary"]');
  const skipLink = document.querySelector('a[href^="#"]');
  const pass = !!landmarks || !!skipLink;
  return {
    id: 'bypass', title: t(TEXTS['bypass'].title),
    description: t(TEXTS['bypass'].description),
    score: pass ? 1 : 0, weight: 7,
  };
}

function auditColorContrast(): LighthouseAuditResult | null {
  let fail = 0;
  const textElements = document.querySelectorAll('p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6, div, button');
  textElements.forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    const text = el.textContent?.trim();
    if (!text) return;
    const style = getComputedStyle(el);
    const fg = style.color;
    const bg = style.backgroundColor;
    if (!fg || !bg) return;
    if (fg.includes('transparent') || bg.includes('transparent') ||
      fg.includes('rgba(0, 0, 0, 0)') || bg.includes('rgba(0, 0, 0, 0)')) return;
    const result = meetsWCAGAA(fg, bg);
    if (result === false) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'color-contrast', title: t(TEXTS['color-contrast'].title),
    description: t(TEXTS['color-contrast'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个元素对比度不足' : 'element(s) with low contrast'}` : undefined,
  };
}

function auditDocumentTitle(): LighthouseAuditResult | null {
  const title = document.title?.trim();
  return {
    id: 'document-title', title: t(TEXTS['document-title'].title),
    description: t(TEXTS['document-title'].description),
    score: !!title ? 1 : 0, weight: 7,
  };
}

function auditFrameTitle(): LighthouseAuditResult | null {
  const frames = document.querySelectorAll('iframe');
  if (frames.length === 0) return null;
  let fail = 0;
  frames.forEach(frame => {
    const title = frame.getAttribute('title')?.trim();
    if (!title) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'frame-title', title: t(TEXTS['frame-title'].title),
    description: t(TEXTS['frame-title'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个框架无标题' : 'frame(s) without title'}` : undefined,
  };
}

function auditHeadingOrder(): LighthouseAuditResult | null {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) return null;
  let fail = 0;
  let lastLevel = 0;
  headings.forEach(h => {
    const level = parseInt(h.tagName[1]);
    if (lastLevel > 0 && level > lastLevel + 1) fail++;
    lastLevel = level;
  });
  const isZh = isZhLang();
  return {
    id: 'heading-order', title: t(TEXTS['heading-order'].title),
    description: t(TEXTS['heading-order'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '处跳级' : 'skipped level(s)'}` : undefined,
  };
}

function auditHtmlHasLang(): LighthouseAuditResult | null {
  const html = document.documentElement;
  const lang = html.getAttribute('lang')?.trim();
  return {
    id: 'html-has-lang', title: t(TEXTS['html-has-lang'].title),
    description: t(TEXTS['html-has-lang'].description),
    score: !!lang ? 1 : 0, weight: 7,
  };
}

function auditHtmlLangValid(): LighthouseAuditResult | null {
  const lang = document.documentElement.getAttribute('lang')?.trim();
  if (!lang) return null;
  return {
    id: 'html-lang-valid', title: t(TEXTS['html-lang-valid'].title),
    description: t(TEXTS['html-lang-valid'].description),
    score: isValidBCP47(lang) ? 1 : 0, weight: 7,
    value: `lang="${lang}"`,
  };
}

function auditLinkName(): LighthouseAuditResult | null {
  const links = document.querySelectorAll('a[href]');
  if (links.length === 0) return null;
  let fail = 0;
  links.forEach(a => {
    if (!getAccessibleName(a)) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'link-name', title: t(TEXTS['link-name'].title),
    description: t(TEXTS['link-name'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个链接无名称' : 'link(s) without name'}` : undefined,
  };
}

function auditList(): LighthouseAuditResult | null {
  const lists = document.querySelectorAll('ul, ol');
  if (lists.length === 0) return null;
  let fail = 0;
  lists.forEach(list => {
    Array.from(list.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (tag !== 'li' && tag !== 'script' && tag !== 'template') fail++;
    });
  });
  const isZh = isZhLang();
  return {
    id: 'list', title: t(TEXTS['list'].title),
    description: t(TEXTS['list'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个非法子元素' : 'invalid child(ren)'}` : undefined,
  };
}

function auditListitem(): LighthouseAuditResult | null {
  const items = document.querySelectorAll('li');
  if (items.length === 0) return null;
  let fail = 0;
  items.forEach(li => {
    const parent = li.parentElement?.tagName.toLowerCase();
    if (parent !== 'ul' && parent !== 'ol' && parent !== 'menu') fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'listitem', title: t(TEXTS['listitem'].title),
    description: t(TEXTS['listitem'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个孤立 <li>' : 'orphan <li>(s)'}` : undefined,
  };
}

function auditDefinitionList(): LighthouseAuditResult | null {
  const dls = document.querySelectorAll('dl');
  if (dls.length === 0) return null;
  let fail = 0;
  dls.forEach(dl => {
    Array.from(dl.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (tag !== 'dt' && tag !== 'dd' && tag !== 'script' && tag !== 'template' && tag !== 'div') fail++;
    });
  });
  const isZh = isZhLang();
  return {
    id: 'definition-list', title: t(TEXTS['definition-list'].title),
    description: t(TEXTS['definition-list'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个非法子元素' : 'invalid child(ren)'}` : undefined,
  };
}

function auditDlitem(): LighthouseAuditResult | null {
  const items = document.querySelectorAll('dt, dd');
  if (items.length === 0) return null;
  let fail = 0;
  items.forEach(item => {
    if (item.parentElement?.tagName.toLowerCase() !== 'dl') fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'dlitem', title: t(TEXTS['dlitem'].title),
    description: t(TEXTS['dlitem'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个孤立项' : 'orphan item(s)'}` : undefined,
  };
}

function auditTabindex(): LighthouseAuditResult | null {
  const elements = document.querySelectorAll('[tabindex]');
  let fail = 0;
  elements.forEach(el => {
    const idx = parseInt(el.getAttribute('tabindex')!);
    if (idx > 0) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'tabindex', title: t(TEXTS['tabindex'].title),
    description: t(TEXTS['tabindex'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个元素 tabindex > 0' : 'element(s) with tabindex > 0'}` : undefined,
  };
}

function auditObjectAlt(): LighthouseAuditResult | null {
  const objects = document.querySelectorAll('object');
  if (objects.length === 0) return null;
  let fail = 0;
  objects.forEach(obj => {
    const title = obj.getAttribute('title')?.trim();
    const ariaLabel = obj.getAttribute('aria-label')?.trim();
    if (!title && !ariaLabel) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'object-alt', title: t(TEXTS['object-alt'].title),
    description: t(TEXTS['object-alt'].description),
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} ${isZh ? '个 object 无替代文本' : 'object(s) without alt text'}` : undefined,
  };
}

// ─── 权重 3（Minor）— 5 项 ───────────────────────────────────

function auditFormFieldMultipleLabels(): LighthouseAuditResult | null {
  const inputs = document.querySelectorAll('input, select, textarea');
  if (inputs.length === 0) return null;
  let fail = 0;
  inputs.forEach(input => {
    const id = input.id;
    if (!id) return;
    const labels = document.querySelectorAll(`label[for="${CSS.escape(id)}"]`);
    if (labels.length > 1) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'form-field-multiple-labels', title: t(TEXTS['form-field-multiple-labels'].title),
    description: t(TEXTS['form-field-multiple-labels'].description),
    score: fail === 0 ? 1 : 0, weight: 3,
    value: fail > 0 ? `${fail} ${isZh ? '个字段有多标签' : 'field(s) with multiple labels'}` : undefined,
  };
}

function auditValidLang(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('[lang]').forEach(el => {
    const lang = el.getAttribute('lang')!;
    if (!isValidBCP47(lang)) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'valid-lang', title: t(TEXTS['valid-lang'].title),
    description: t(TEXTS['valid-lang'].description),
    score: fail === 0 ? 1 : 0, weight: 3,
    value: fail > 0 ? `${fail} ${isZh ? '个无效 lang' : 'invalid lang(s)'}` : undefined,
  };
}

function auditSkipLinkFocusable(): LighthouseAuditResult | null {
  const skipLink = document.querySelector('a[href^="#"]');
  if (!skipLink) return null;
  const targetId = skipLink.getAttribute('href')!.slice(1);
  if (!targetId) return null;
  const isZh = isZhLang();
  const target = document.getElementById(targetId);
  if (!target) {
    return {
      id: 'skip-link-focusable', title: t(TEXTS['skip-link-focusable'].title),
      description: t(TEXTS['skip-link-focusable'].description),
      score: 0, weight: 3,
      value: isZh ? `目标 #${targetId} 未找到` : `target #${targetId} not found`,
    };
  }
  const tabIndex = target.getAttribute('tabindex');
  const focusable = tabIndex !== '-1';
  return {
    id: 'skip-link-focusable', title: t(TEXTS['skip-link-focusable'].title),
    description: t(TEXTS['skip-link-focusable'].description),
    score: focusable ? 1 : 0, weight: 3,
  };
}

function auditDocumentHasMainLandmark(): LighthouseAuditResult | null {
  const main = document.querySelector('main, [role="main"]');
  return {
    id: 'document-has-main-landmark', title: t(TEXTS['document-has-main-landmark'].title),
    description: t(TEXTS['document-has-main-landmark'].description),
    score: main ? 1 : 0, weight: 3,
  };
}

function auditThHasDataCells(): LighthouseAuditResult | null {
  const ths = document.querySelectorAll('th');
  if (ths.length === 0) return null;
  let fail = 0;
  ths.forEach(th => {
    const table = th.closest('table');
    if (!table) return;
    const tds = table.querySelectorAll('td');
    if (tds.length === 0) fail++;
  });
  const isZh = isZhLang();
  return {
    id: 'th-has-data-cells', title: t(TEXTS['th-has-data-cells'].title),
    description: t(TEXTS['th-has-data-cells'].description),
    score: fail === 0 ? 1 : 0, weight: 3,
    value: fail > 0 ? `${fail} ${isZh ? '个表格无数据单元格' : 'table(s) without data cells'}` : undefined,
  };
}

// ─── 主函数 ──────────────────────────────────────────────────

export function auditAccessibility(): LighthouseCategoryResult {
  const auditFns: (() => LighthouseAuditResult | null)[] = [
    // Weight 10 — Critical (16)
    auditAriaAllowedAttr,
    auditAriaHiddenBody,
    auditAriaRequiredAttr,
    auditAriaRequiredChildren,
    auditAriaRequiredParent,
    auditAriaRoles,
    auditAriaValidAttrValue,
    auditAriaValidAttr,
    auditButtonName,
    auditImageAlt,
    auditInputImageAlt,
    auditLabel,
    auditMetaViewport,
    auditDuplicateIdAria,
    auditSelectName,
    auditVideoCaption,
    // Weight 7 — Serious (18)
    auditAccesskeys,
    auditAriaHiddenFocus,
    auditAriaInputFieldName,
    auditAriaToggleFieldName,
    auditBypass,
    auditColorContrast,
    auditDocumentTitle,
    auditFrameTitle,
    auditHeadingOrder,
    auditHtmlHasLang,
    auditHtmlLangValid,
    auditLinkName,
    auditList,
    auditListitem,
    auditDefinitionList,
    auditDlitem,
    auditTabindex,
    auditObjectAlt,
    // Weight 3 — Minor (5)
    auditFormFieldMultipleLabels,
    auditValidLang,
    auditSkipLinkFocusable,
    auditDocumentHasMainLandmark,
    auditThHasDataCells,
  ];

  const audits: LighthouseAuditResult[] = [];
  for (const fn of auditFns) {
    const result = fn();
    if (result) audits.push(result);
  }

  const applicable = audits.filter(a => a.score !== null);
  const totalWeight = applicable.reduce((s, a) => s + a.weight, 0);
  const passedWeight = applicable.filter(a => a.score === 1).reduce((s, a) => s + a.weight, 0);
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;

  return { id: 'accessibility', title: 'Accessibility', score, audits };
}
