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
  return {
    id: 'aria-allowed-attr', title: '[aria-*] attributes match their roles',
    description: 'ARIA attributes should be valid for the element\'s role.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} violation(s)` : undefined,
  };
}

function auditAriaHiddenBody(): LighthouseAuditResult | null {
  const hidden = document.body.getAttribute('aria-hidden');
  return {
    id: 'aria-hidden-body', title: '[aria-hidden] is not used on <body>',
    description: 'aria-hidden="true" should not be on document.body.',
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
  return {
    id: 'aria-required-attr', title: '[role] elements have required aria-* attributes',
    description: 'Elements with ARIA roles must have required attributes.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} missing attribute(s)` : undefined,
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
  return {
    id: 'aria-required-children', title: 'ARIA composite widgets contain required children',
    description: 'Elements with ARIA roles must contain required child elements.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} violation(s)` : undefined,
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
  return {
    id: 'aria-required-parent', title: 'ARIA roles are nested within required parents',
    description: 'Elements with ARIA roles must be contained by required parent roles.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} violation(s)` : undefined,
  };
}

function auditAriaRoles(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('[role]').forEach(el => {
    const role = el.getAttribute('role')!;
    if (!VALID_ROLES.has(role) || ABSTRACT_ROLES.has(role)) fail++;
  });
  return {
    id: 'aria-roles', title: '[role] values are valid',
    description: 'ARIA roles must be valid, non-abstract roles.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} invalid role(s)` : undefined,
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
  return {
    id: 'aria-valid-attr-value', title: 'ARIA attribute values are valid',
    description: 'ARIA attributes must have valid values.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} invalid value(s)` : undefined,
  };
}

function auditAriaValidAttr(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('*').forEach(el => {
    for (const attr of el.getAttributeNames()) {
      if (attr.startsWith('aria-') && !VALID_ARIA_ATTRS.has(attr)) fail++;
    }
  });
  return {
    id: 'aria-valid-attr', title: 'ARIA attribute names are valid',
    description: 'ARIA attributes must be valid attribute names.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} invalid attr(s)` : undefined,
  };
}

function auditButtonName(): LighthouseAuditResult | null {
  const buttons = document.querySelectorAll('button');
  if (buttons.length === 0) return null;
  let fail = 0;
  buttons.forEach(btn => {
    if (!getAccessibleName(btn)) fail++;
  });
  return {
    id: 'button-name', title: 'Buttons have discernible names',
    description: 'All <button> elements must have accessible names.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} button(s) without name` : undefined,
  };
}

function auditImageAlt(): LighthouseAuditResult | null {
  const imgs = document.querySelectorAll('img');
  if (imgs.length === 0) return null;
  let fail = 0;
  imgs.forEach(img => {
    if (!img.hasAttribute('alt')) fail++;
  });
  return {
    id: 'image-alt', title: 'Images have [alt] attributes',
    description: 'All <img> elements must have an alt attribute.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} image(s) missing alt` : undefined,
  };
}

function auditInputImageAlt(): LighthouseAuditResult | null {
  const inputs = document.querySelectorAll('input[type="image"]');
  if (inputs.length === 0) return null;
  let fail = 0;
  inputs.forEach(input => {
    if (!input.hasAttribute('alt')) fail++;
  });
  return {
    id: 'input-image-alt', title: 'Image <input> elements have [alt] text',
    description: 'All <input type="image"> must have alt text.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} input(s) missing alt` : undefined,
  };
}

function auditLabel(): LighthouseAuditResult | null {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="image"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
  if (inputs.length === 0) return null;
  let fail = 0;
  inputs.forEach(el => {
    if (!hasAssociatedLabel(el as HTMLElement)) fail++;
  });
  return {
    id: 'label', title: 'Form elements have associated labels',
    description: 'All form inputs must have associated labels.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} element(s) without label` : undefined,
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
    id: 'meta-viewport', title: '[user-scalable] is not disabled',
    description: 'Zooming should not be disabled via maximum-scale < 5 or user-scalable=no.',
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
  return {
    id: 'duplicate-id-aria', title: 'ARIA ID references are unique',
    description: 'IDs referenced by aria-describedby/aria-labelledby must be unique in the document.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} duplicate ID(s)` : undefined,
  };
}

function auditSelectName(): LighthouseAuditResult | null {
  const selects = document.querySelectorAll('select');
  if (selects.length === 0) return null;
  let fail = 0;
  selects.forEach(sel => {
    if (!hasAssociatedLabel(sel as HTMLElement)) fail++;
  });
  return {
    id: 'select-name', title: 'Select elements have associated labels',
    description: 'All <select> elements must have accessible names.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} select(s) without label` : undefined,
  };
}

function auditVideoCaption(): LighthouseAuditResult | null {
  const videos = document.querySelectorAll('video');
  if (videos.length === 0) return null;
  let fail = 0;
  videos.forEach(video => {
    if (!video.querySelector('track[kind="captions"]')) fail++;
  });
  return {
    id: 'video-caption', title: 'Videos have captions',
    description: 'All <video> elements must contain a <track kind="captions">.',
    score: fail === 0 ? 1 : 0, weight: 10,
    value: fail > 0 ? `${fail} video(s) without captions` : undefined,
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
  return {
    id: 'accesskeys', title: '[accesskey] values are unique',
    description: 'accesskey attribute values must be unique.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} duplicate accesskey(s)` : undefined,
  };
}

function auditAriaHiddenFocus(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
    const focusable = el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
    if (focusable.length > 0) fail++;
  });
  return {
    id: 'aria-hidden-focus', title: '[aria-hidden] elements do not contain focusable elements',
    description: 'Elements with aria-hidden="true" must not contain focusable descendants.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} violation(s)` : undefined,
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
  return {
    id: 'aria-input-field-name', title: 'ARIA input fields have accessible names',
    description: 'ARIA textbox, combobox, searchbox, etc. must have accessible names.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} field(s) without name` : undefined,
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
  return {
    id: 'aria-toggle-field-name', title: 'ARIA toggle fields have accessible names',
    description: 'ARIA checkbox, radio, switch must have accessible names.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} field(s) without name` : undefined,
  };
}

function auditBypass(): LighthouseAuditResult | null {
  const landmarks = document.querySelector('main, [role="main"], header, [role="banner"], footer, [role="contentinfo"], nav, [role="navigation"], aside, [role="complementary"]');
  const skipLink = document.querySelector('a[href^="#"]');
  const pass = !!landmarks || !!skipLink;
  return {
    id: 'bypass', title: 'Page has bypass mechanisms',
    description: 'Page should have landmarks or skip links for keyboard users.',
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
  return {
    id: 'color-contrast', title: 'Text meets WCAG AA contrast requirements',
    description: 'Text must have sufficient contrast ratio (4.5:1 for normal text).',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} element(s) with low contrast` : undefined,
  };
}

function auditDocumentTitle(): LighthouseAuditResult | null {
  const title = document.title?.trim();
  return {
    id: 'document-title', title: 'Document has a <title> element',
    description: 'The page must have a non-empty <title>.',
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
  return {
    id: 'frame-title', title: 'Frames have [title] attributes',
    description: 'All <iframe> elements must have title attributes.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} frame(s) without title` : undefined,
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
  return {
    id: 'heading-order', title: 'Heading levels do not skip',
    description: 'Heading levels should increase by one at a time.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} skipped level(s)` : undefined,
  };
}

function auditHtmlHasLang(): LighthouseAuditResult | null {
  const html = document.documentElement;
  const lang = html.getAttribute('lang')?.trim();
  return {
    id: 'html-has-lang', title: '<html> element has [lang] attribute',
    description: 'The <html> element must have a lang attribute.',
    score: !!lang ? 1 : 0, weight: 7,
  };
}

function auditHtmlLangValid(): LighthouseAuditResult | null {
  const lang = document.documentElement.getAttribute('lang')?.trim();
  if (!lang) return null;
  return {
    id: 'html-lang-valid', title: '<html> [lang] is valid BCP 47',
    description: 'The lang attribute must be a valid BCP 47 language tag.',
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
  return {
    id: 'link-name', title: 'Links have discernible names',
    description: 'All <a> elements with href must have accessible names.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} link(s) without name` : undefined,
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
  return {
    id: 'list', title: 'Lists contain only <li> elements',
    description: '<ul>/<ol> should only contain <li>, <script>, or <template> children.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} invalid child(ren)` : undefined,
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
  return {
    id: 'listitem', title: '<li> elements are within <ul>/<ol>',
    description: 'List items must be contained in <ul>, <ol>, or <menu>.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} orphan <li>(s)` : undefined,
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
  return {
    id: 'definition-list', title: '<dl> elements contain only <dt>/<dd>',
    description: 'Definition lists should only contain <dt>, <dd>, <script>, <template>, or <div>.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} invalid child(ren)` : undefined,
  };
}

function auditDlitem(): LighthouseAuditResult | null {
  const items = document.querySelectorAll('dt, dd');
  if (items.length === 0) return null;
  let fail = 0;
  items.forEach(item => {
    if (item.parentElement?.tagName.toLowerCase() !== 'dl') fail++;
  });
  return {
    id: 'dlitem', title: '<dt>/<dd> are within <dl>',
    description: 'Definition terms and descriptions must be in a <dl>.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} orphan item(s)` : undefined,
  };
}

function auditTabindex(): LighthouseAuditResult | null {
  const elements = document.querySelectorAll('[tabindex]');
  let fail = 0;
  elements.forEach(el => {
    const idx = parseInt(el.getAttribute('tabindex')!);
    if (idx > 0) fail++;
  });
  return {
    id: 'tabindex', title: 'No element has [tabindex] > 0',
    description: 'Avoid tabindex values greater than zero as they disrupt tab order.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} element(s) with tabindex > 0` : undefined,
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
  return {
    id: 'object-alt', title: '<object> elements have alternate text',
    description: '<object> elements must have title or aria-label.',
    score: fail === 0 ? 1 : 0, weight: 7,
    value: fail > 0 ? `${fail} object(s) without alt text` : undefined,
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
  return {
    id: 'form-field-multiple-labels', title: 'Form fields are not wrapped in multiple labels',
    description: 'No form field should have more than one associated <label>.',
    score: fail === 0 ? 1 : 0, weight: 3,
    value: fail > 0 ? `${fail} field(s) with multiple labels` : undefined,
  };
}

function auditValidLang(): LighthouseAuditResult | null {
  let fail = 0;
  document.querySelectorAll('[lang]').forEach(el => {
    const lang = el.getAttribute('lang')!;
    if (!isValidBCP47(lang)) fail++;
  });
  return {
    id: 'valid-lang', title: 'lang attributes are valid BCP 47',
    description: 'All lang attribute values must be valid BCP 47 tags.',
    score: fail === 0 ? 1 : 0, weight: 3,
    value: fail > 0 ? `${fail} invalid lang(s)` : undefined,
  };
}

function auditSkipLinkFocusable(): LighthouseAuditResult | null {
  const skipLink = document.querySelector('a[href^="#"]');
  if (!skipLink) return null;
  const targetId = skipLink.getAttribute('href')!.slice(1);
  if (!targetId) return null;
  const target = document.getElementById(targetId);
  if (!target) {
    return {
      id: 'skip-link-focusable', title: 'Skip link target is focusable',
      description: 'The first skip link should point to a focusable target.',
      score: 0, weight: 3,
      value: `target #${targetId} not found`,
    };
  }
  const tabIndex = target.getAttribute('tabindex');
  const focusable = tabIndex !== '-1';
  return {
    id: 'skip-link-focusable', title: 'Skip link target is focusable',
    description: 'The first skip link should point to a focusable target.',
    score: focusable ? 1 : 0, weight: 3,
  };
}

function auditDocumentHasMainLandmark(): LighthouseAuditResult | null {
  const main = document.querySelector('main, [role="main"]');
  return {
    id: 'document-has-main-landmark', title: 'Page has a main landmark',
    description: 'The page should contain a <main> or role="main" landmark.',
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
  return {
    id: 'th-has-data-cells', title: 'Table headers have data cells',
    description: 'Each table with <th> should also have <td> data cells.',
    score: fail === 0 ? 1 : 0, weight: 3,
    value: fail > 0 ? `${fail} table(s) without data cells` : undefined,
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
