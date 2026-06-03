/**
 * Best Practices 审计实现
 * 8 项审计，等权 pass/fail 评分
 */

import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import type { RuntimeAuditState } from './runtime-hooks.js';
import { VULNERABLE_LIBRARIES, isVersionBelow } from './helpers.js';

export function auditBestPractices(state: RuntimeAuditState): LighthouseCategoryResult {
  const audits: LighthouseAuditResult[] = [
    // 1. bp-is-on-https
    {
      id: 'bp-is-on-https',
      title: 'Uses HTTPS',
      description:
        'All sites should be served over HTTPS, even those that do not collect sensitive data. HTTPS prevents intruders from tampering with or passively listening in on the communications between your app and your users.',
      score:
        typeof location !== 'undefined' &&
        (location.protocol === 'https:' || location.hostname === 'localhost')
          ? 1
          : 0,
      weight: 1,
    },

    // 2. bp-console-errors
    {
      id: 'bp-console-errors',
      title: 'No browser errors logged to the console',
      description:
        'Errors logged to the console indicate unresolved problems. They can also break application logic.',
      score: state.consoleErrorCount === 0 ? 1 : 0,
      weight: 1,
      value: state.consoleErrorCount > 0 ? `${state.consoleErrorCount} error(s)` : undefined,
    },

    // 3. bp-no-document-write
    {
      id: 'bp-no-document-write',
      title: 'Avoids document.write()',
      description:
        'For users on slow connections, external scripts dynamically injected via document.write() can delay page load by tens of seconds.',
      score: state.documentWriteCount === 0 ? 1 : 0,
      weight: 1,
      value:
        state.documentWriteCount > 0 ? `${state.documentWriteCount} call(s)` : undefined,
    },

    // 4. bp-no-vulnerable-libraries
    auditVulnerableLibraries(),

    // 5. bp-no-deprecated-apis
    {
      id: 'bp-no-deprecated-apis',
      title: 'Avoids deprecated APIs',
      description:
        'Deprecated APIs will eventually be removed from the browser. Using them may break your application.',
      score: state.deprecatedApiCalls.length === 0 ? 1 : 0,
      weight: 1,
      value:
        state.deprecatedApiCalls.length > 0
          ? state.deprecatedApiCalls.join(', ')
          : undefined,
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
      title: 'Requests the notification permission on user gesture',
      description:
        'Using the Notification API requires a user gesture. Sites that request permission without a user gesture annoy their users and erode trust.',
      score: !state.notificationRequestedWithoutGesture ? 1 : 0,
      weight: 1,
    },

    // 8. bp-geolocation-permission
    {
      id: 'bp-geolocation-permission',
      title: 'Requests the geolocation permission on user gesture',
      description:
        'Using the Geolocation API requires a user gesture. Sites that request permission without a user gesture annoy their users and erode trust.',
      score: !state.geolocationRequestedWithoutGesture ? 1 : 0,
      weight: 1,
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
    title: 'Avoids vulnerable JavaScript libraries',
    description:
      'Some third-party scripts may contain known security vulnerabilities that are easily identified and exploited by attackers.',
    score: vulnerabilities.length === 0 ? 1 : 0,
    weight: 1,
    value:
      vulnerabilities.length > 0
        ? `${vulnerabilities.length} vulnerable librar(y|ies) found`
        : undefined,
    details:
      vulnerabilities.length > 0 ? { vulnerabilities } : undefined,
  };
}

/** 检测密码输入框是否禁止粘贴 */
function auditPasswordInputsCanPaste(): LighthouseAuditResult {
  const passwordInputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="password"]',
  );

  if (passwordInputs.length === 0) {
    return {
      id: 'bp-password-inputs-paste',
      title: 'Allows users to paste into password fields',
      description:
        'Preventing password pasting undermines good security policy. Users should be able to paste into password fields.',
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
    title: 'Allows users to paste into password fields',
    description:
      'Preventing password pasting undermines good security policy. Users should be able to paste into password fields.',
    score: blocked.length === 0 ? 1 : 0,
    weight: 1,
    value: blocked.length > 0 ? `${blocked.length} input(s) block pasting` : undefined,
    details:
      blocked.length > 0
        ? {
            note: 'Only inline styles and onpaste attributes are checked; external CSS rules are not detected.',
            blockedCount: blocked.length,
          }
        : undefined,
  };
}
