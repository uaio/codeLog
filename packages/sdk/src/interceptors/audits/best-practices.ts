/**
 * Best Practices 审计实现
 * 8 项审计，等权 pass/fail 评分
 */

import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import type { RuntimeAuditState } from './runtime-hooks.js';
import { VULNERABLE_LIBRARIES, isVersionBelow, t, isZhLang } from './helpers.js';
import type { BilingualText } from './helpers.js';

const TEXTS: Record<string, { title: BilingualText; description: BilingualText }> = {
  'bp-is-on-https': {
    title: { zh: '使用 HTTPS', en: 'Uses HTTPS' },
    description: { zh: 'HTTPS 提供安全的数据传输', en: 'HTTPS provides secure data transfer' },
  },
  'bp-console-errors': {
    title: { zh: '无控制台错误', en: 'No Console Errors' },
    description: { zh: '控制台错误可能影响页面功能', en: 'Console errors may affect page functionality' },
  },
  'bp-no-document-write': {
    title: { zh: '无 document.write', en: 'No document.write' },
    description: { zh: 'document.write 会阻塞页面解析', en: 'document.write blocks page parsing' },
  },
  'bp-no-vulnerable-libraries': {
    title: { zh: '无已知漏洞 JS 库', en: 'No Vulnerable JS Libraries' },
    description: { zh: '检测已知安全漏洞的 JavaScript 库', en: 'Detects JavaScript libraries with known vulnerabilities' },
  },
  'bp-no-deprecated-apis': {
    title: { zh: '无废弃 API', en: 'No Deprecated APIs' },
    description: { zh: '废弃 API 可能被移除', en: 'Deprecated APIs may be removed' },
  },
  'bp-password-inputs-paste': {
    title: { zh: '密码输入允许粘贴', en: 'Password Fields Allow Paste' },
    description: { zh: '阻止粘贴降低安全性', en: 'Preventing paste undermines security' },
  },
  'bp-notification-permission': {
    title: { zh: '通知权限未滥用', en: 'Notification Permission Not Abused' },
    description: { zh: '非用户手势触发的通知请求会打扰用户', en: 'Non-gesture permission requests disturb users' },
  },
  'bp-geolocation-permission': {
    title: { zh: '地理位置权限未滥用', en: 'Geolocation Permission Not Abused' },
    description: { zh: '非用户手势触发的定位请求会打扰用户', en: 'Non-gesture geolocation requests disturb users' },
  },
};

export function auditBestPractices(state: RuntimeAuditState): LighthouseCategoryResult {
  const audits: LighthouseAuditResult[] = [
    // 1. bp-is-on-https
    {
      id: 'bp-is-on-https',
      title: t(TEXTS['bp-is-on-https'].title),
      description: t(TEXTS['bp-is-on-https'].description),
      score:
        typeof location !== 'undefined' &&
        (location.protocol === 'https:' || location.hostname === 'localhost')
          ? 1
          : 0,
      weight: 1,
      value:
        typeof location !== 'undefined' &&
        (location.protocol === 'https:' || location.hostname === 'localhost')
          ? 'HTTPS'
          : location.protocol,
    },

    // 2. bp-console-errors
    {
      id: 'bp-console-errors',
      title: t(TEXTS['bp-console-errors'].title),
      description: t(TEXTS['bp-console-errors'].description),
      score: state.consoleErrorCount === 0 ? 1 : 0,
      weight: 1,
      value: state.consoleErrorCount > 0 ? `${state.consoleErrorCount} ${isZhLang() ? '个错误' : 'error(s)'}` : undefined,
    },

    // 3. bp-no-document-write
    {
      id: 'bp-no-document-write',
      title: t(TEXTS['bp-no-document-write'].title),
      description: t(TEXTS['bp-no-document-write'].description),
      score: state.documentWriteCount === 0 ? 1 : 0,
      weight: 1,
      value:
        state.documentWriteCount === 0 ? (isZhLang() ? '未使用' : 'Not used') : `${isZhLang() ? '调用了' : 'Called'} ${state.documentWriteCount} ${isZhLang() ? '次' : 'time(s)'}`,
    },

    // 4. bp-no-vulnerable-libraries
    auditVulnerableLibraries(),

    // 5. bp-no-deprecated-apis
    {
      id: 'bp-no-deprecated-apis',
      title: t(TEXTS['bp-no-deprecated-apis'].title),
      description: t(TEXTS['bp-no-deprecated-apis'].description),
      score: state.deprecatedApiCalls.length === 0 ? 1 : 0,
      weight: 1,
      value:
        state.deprecatedApiCalls.length === 0 ? (isZhLang() ? '未使用' : 'Not used') : `${isZhLang() ? '调用了' : 'Called'} ${state.deprecatedApiCalls.join(', ')}`,
      details:
        state.deprecatedApiCalls.length > 0
          ? { calls: state.deprecatedApiCalls }
          : undefined,
    },

    // 6. bp-password-inputs-paste
    auditPasswordInputsCanPaste(),

    // 7. bp-notification-permission
    {
      id: 'bp-notification-permission',
      title: t(TEXTS['bp-notification-permission'].title),
      description: t(TEXTS['bp-notification-permission'].description),
      score: !state.notificationRequestedWithoutGesture ? 1 : 0,
      weight: 1,
      value: state.notificationRequestedWithoutGesture ? (isZhLang() ? '检测到非用户手势请求' : 'Non-gesture request detected') : (isZhLang() ? '正常' : 'Normal'),
    },

    // 8. bp-geolocation-permission
    {
      id: 'bp-geolocation-permission',
      title: t(TEXTS['bp-geolocation-permission'].title),
      description: t(TEXTS['bp-geolocation-permission'].description),
      score: !state.geolocationRequestedWithoutGesture ? 1 : 0,
      weight: 1,
      value: state.geolocationRequestedWithoutGesture ? (isZhLang() ? '检测到非用户手势请求' : 'Non-gesture request detected') : (isZhLang() ? '正常' : 'Normal'),
    },
  ];

  // 等权 pass/fail 评分
  const applicable = audits.filter((a) => a.score !== null);
  const passed = applicable.filter((a) => a.score === 1).length;
  const score = applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0;

  return {
    id: 'best-practices',
    title: 'Best Practices',
    score,
    audits,
  };
}

// ─── 子审计函数 ─────────────────────────────────────────────

/** 检测已知漏洞 JS 库 */
function auditVulnerableLibraries(): LighthouseAuditResult {
  const isZh = isZhLang();
  const vulnerabilities: { library: string; version: string; minSafe: string }[] = [];

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const script of scripts) {
    const src = script.getAttribute('src') ?? '';
    for (const lib of VULNERABLE_LIBRARIES) {
      const match = src.match(lib.pattern);
      if (match) {
        const version = match[1];
        if (isVersionBelow(version, lib.minSafe)) {
          vulnerabilities.push({
            library: lib.name,
            version,
            minSafe: lib.minSafe,
          });
        }
      }
    }
  }

  return {
    id: 'bp-no-vulnerable-libraries',
    title: t(TEXTS['bp-no-vulnerable-libraries'].title),
    description: t(TEXTS['bp-no-vulnerable-libraries'].description),
    score: vulnerabilities.length === 0 ? 1 : 0,
    weight: 1,
    value: vulnerabilities.length === 0 ? (isZh ? '未检测到漏洞库' : 'No vulnerable libraries detected') : `${vulnerabilities.length} ${isZh ? '个漏洞库' : 'vulnerable librarie(s)'}`,
    details:
      vulnerabilities.length > 0 ? { vulnerabilities } : undefined,
  };
}

/** 检测密码输入框是否禁止粘贴 */
function auditPasswordInputsCanPaste(): LighthouseAuditResult {
  const isZh = isZhLang();
  const passwordInputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="password"]',
  );

  if (passwordInputs.length === 0) {
    return {
      id: 'bp-password-inputs-paste',
      title: t(TEXTS['bp-password-inputs-paste'].title),
      description: t(TEXTS['bp-password-inputs-paste'].description),
      score: null, // notApplicable
      weight: 1,
    };
  }

  const blocked: HTMLInputElement[] = [];
  for (const input of Array.from(passwordInputs)) {
    // 检查 onpaste 属性（内联事件处理器）
    const onpaste = input.getAttribute('onpaste');
    if (onpaste !== null && /return\s+false/i.test(onpaste)) {
      blocked.push(input);
      continue;
    }

    // 检查内联样式 user-select（已知限制：只能检测内联样式）
    const style = input.getAttribute('style') ?? '';
    if (style && /user-select\s*:\s*none/i.test(style)) {
      blocked.push(input);
    }
  }

  return {
    id: 'bp-password-inputs-paste',
    title: t(TEXTS['bp-password-inputs-paste'].title),
    description: t(TEXTS['bp-password-inputs-paste'].description),
    score: blocked.length === 0 ? 1 : 0,
    weight: 1,
    value: blocked.length === 0 ? (isZh ? '允许粘贴' : 'Paste allowed') : `${blocked.length} ${isZh ? '个密码框阻止粘贴' : 'password field(s) block paste'}`,
    details:
      blocked.length > 0
        ? {
            note: 'Only inline styles and onpaste attributes are checked; external CSS rules are not detected.',
            blockedCount: blocked.length,
          }
        : undefined,
  };
}
