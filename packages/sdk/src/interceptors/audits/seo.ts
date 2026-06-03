/**
 * SEO 审计：10 项等权 pass/fail 审计
 * 对齐 Lighthouse SEO 类别
 */

import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import { VAGUE_LINK_TEXTS, t, isZhLang } from './helpers.js';
import type { BilingualText } from './helpers.js';

/** SEO 审计文案（中英文） */
const TEXTS: Record<string, { title: BilingualText; description: BilingualText }> = {
  'seo-document-title': {
    title: { zh: '页面标题', en: 'Document Title' },
    description: { zh: '标题应存在且长度 10-60 字符', en: 'Title should exist and be 10-60 characters' },
  },
  'seo-meta-description': {
    title: { zh: 'Meta 描述', en: 'Meta Description' },
    description: { zh: '描述应存在且长度 50-160 字符', en: 'Description should exist and be 50-160 characters' },
  },
  'seo-http-status-code': {
    title: { zh: 'HTTP 状态码', en: 'HTTP Status Code' },
    description: { zh: '页面应返回成功状态码', en: 'Page should return a successful status code' },
  },
  'seo-link-text': {
    title: { zh: '链接文本', en: 'Link Text' },
    description: { zh: '链接文本应清晰描述目标', en: 'Link text should clearly describe the target' },
  },
  'seo-meta-viewport': {
    title: { zh: 'Viewport 配置', en: 'Meta Viewport' },
    description: { zh: '应设置 width=device-width', en: 'Should include width=device-width' },
  },
  'seo-crawlable-anchors': {
    title: { zh: '可爬取链接', en: 'Crawlable Anchors' },
    description: { zh: '链接应有有效的 href 属性', en: 'Links should have valid href attributes' },
  },
  'seo-hreflang': {
    title: { zh: 'Hreflang 标签', en: 'Hreflang Tags' },
    description: { zh: 'hreflang 值应为合法 BCP 47', en: 'hreflang values should be valid BCP 47' },
  },
  'seo-canonical': {
    title: { zh: 'Canonical URL', en: 'Canonical URL' },
    description: { zh: 'canonical URL 应为合法 URL', en: 'canonical URL should be a valid URL' },
  },
  'seo-robots-meta': {
    title: { zh: 'Robots Meta', en: 'Robots Meta' },
    description: { zh: '页面应允许搜索引擎索引', en: 'Page should allow search engine indexing' },
  },
  'seo-structured-data': {
    title: { zh: '结构化数据', en: 'Structured Data' },
    description: { zh: '结构化数据帮助搜索引擎理解页面', en: 'Structured data helps search engines understand the page' },
  },
};

/** 创建一个审计结果 */
function audit(
  id: string,
  title: string,
  description: string,
  score: number | null,
  details?: Record<string, unknown>,
): LighthouseAuditResult {
  return { id, title, description, score, weight: 1, ...(details ? { details } : {}) };
}

/**
 * 执行 SEO 审计，返回类别评分结果
 */
export function auditSEO(): LighthouseCategoryResult {
  const audits: LighthouseAuditResult[] = [];
  const isZh = isZhLang();

  // 1. seo-document-title
  {
    const title = document.title ?? '';
    const len = title.trim().length;
    const pass = len >= 10 && len <= 60;
    audits.push(
      audit(
        'seo-document-title',
        t(TEXTS['seo-document-title'].title),
        isZh
          ? `标题应为 10-60 字符，当前 ${len} 字符`
          : `Title should be 10-60 characters. Current: ${len} characters.`,
        pass ? 1 : 0,
        { value: title, length: len },
      ),
    );
  }

  // 2. seo-meta-description
  {
    const meta = document.querySelector('meta[name="description"]');
    const content = meta?.getAttribute('content') ?? '';
    const len = content.trim().length;
    const pass = len >= 50 && len <= 160;
    audits.push(
      audit(
        'seo-meta-description',
        t(TEXTS['seo-meta-description'].title),
        isZh
          ? `描述应为 50-160 字符，当前 ${len} 字符`
          : `Meta description should be 50-160 characters. Current: ${len} characters.`,
        pass ? 1 : 0,
        { value: content, length: len },
      ),
    );
  }

  // 3. seo-http-status-code
  {
    let pass = true;
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const status = navEntries[0]?.responseStatus;
      if (status !== undefined) {
        pass = status >= 200 && status <= 399;
        audits.push(
          audit(
            'seo-http-status-code',
            t(TEXTS['seo-http-status-code'].title),
            isZh
              ? `HTTP 状态码 ${status}，期望 200-399`
              : `HTTP status ${status}. Expected 200-399.`,
            pass ? 1 : 0,
            { statusCode: status },
          ),
        );
      } else {
        // API 不可用时 fallback 为 pass（页面能执行 JS 即视为 200）
        audits.push(
          audit(
            'seo-http-status-code',
            t(TEXTS['seo-http-status-code'].title),
            isZh
              ? 'Navigation API 不可用，因页面 JS 正在执行，假定状态码 200'
              : 'Navigation API unavailable; assumed 200 because JS is executing.',
            1,
          ),
        );
      }
    } catch {
      audits.push(
        audit(
          'seo-http-status-code',
          t(TEXTS['seo-http-status-code'].title),
          isZh
            ? 'Navigation API 不可用，因页面 JS 正在执行，假定状态码 200'
            : 'Navigation API unavailable; assumed 200 because JS is executing.',
          1,
        ),
      );
    }
  }

  // 4. seo-link-text
  {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const vagueLinks: string[] = [];
    let pass = true;
    for (const el of links) {
      const text = el.textContent?.trim().toLowerCase() ?? '';
      if (text && VAGUE_LINK_TEXTS.has(text)) {
        pass = false;
        vagueLinks.push(text);
      }
    }
    audits.push(
      audit(
        'seo-link-text',
        t(TEXTS['seo-link-text'].title),
        vagueLinks.length > 0
          ? isZh
            ? `发现 ${vagueLinks.length} 个模糊链接文本：${vagueLinks.slice(0, 5).join(', ')}`
            : `Found ${vagueLinks.length} link(s) with vague text: ${vagueLinks.slice(0, 5).join(', ')}`
          : isZh
            ? '所有链接文本均清晰描述'
            : 'All links have descriptive text.',
        pass ? 1 : 0,
        { vagueCount: vagueLinks.length, examples: vagueLinks.slice(0, 5) },
      ),
    );
  }

  // 5. seo-meta-viewport
  {
    const viewport = document.querySelector('meta[name="viewport"]');
    const content = viewport?.getAttribute('content') ?? '';
    const pass = /width\s*=\s*device-width/i.test(content);
    audits.push(
      audit(
        'seo-meta-viewport',
        t(TEXTS['seo-meta-viewport'].title),
        pass
          ? isZh
            ? 'Viewport 标签已包含 width=device-width'
            : 'Viewport meta tag includes width=device-width.'
          : isZh
            ? 'Viewport 标签缺失或未包含 width=device-width'
            : 'Viewport meta tag is missing or does not include width=device-width.',
        pass ? 1 : 0,
        { content },
      ),
    );
  }

  // 6. seo-crawlable-anchors
  {
    const anchors = Array.from(document.querySelectorAll('a'));
    const nonCrawlable: string[] = [];
    let pass = true;
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href || href.trim() === '' || href.startsWith('javascript:')) {
        pass = false;
        nonCrawlable.push(href ?? '(empty)');
      }
    }
    audits.push(
      audit(
        'seo-crawlable-anchors',
        t(TEXTS['seo-crawlable-anchors'].title),
        nonCrawlable.length > 0
          ? isZh
            ? `发现 ${nonCrawlable.length} 个不可爬取的链接`
            : `Found ${nonCrawlable.length} non-crawlable anchor(s).`
          : isZh
            ? '所有链接均可爬取'
            : 'All anchors are crawlable.',
        pass ? 1 : 0,
        { nonCrawlableCount: nonCrawlable.length, examples: nonCrawlable.slice(0, 5) },
      ),
    );
  }

  // 7. seo-hreflang
  {
    const hreflangs = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'));
    if (hreflangs.length === 0) {
      audits.push(
        audit(
          'seo-hreflang',
          t(TEXTS['seo-hreflang'].title),
          isZh
            ? '未发现 hreflang 标签'
            : 'No hreflang tags found.',
          null, // notApplicable
        ),
      );
    } else {
      let pass = true;
      const invalidValues: string[] = [];
      for (const el of hreflangs) {
        const val = el.getAttribute('hreflang') ?? '';
        if (val === 'x-default') continue;
        if (!/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,8})*$/.test(val)) {
          pass = false;
          invalidValues.push(val);
        }
      }
      audits.push(
        audit(
          'seo-hreflang',
          t(TEXTS['seo-hreflang'].title),
          invalidValues.length > 0
            ? isZh
              ? `无效的 hreflang 值：${invalidValues.join(', ')}`
              : `Invalid hreflang value(s): ${invalidValues.join(', ')}`
            : isZh
              ? '所有 hreflang 值均为合法 BCP 47'
              : 'All hreflang values are valid BCP 47.',
          pass ? 1 : 0,
          { total: hreflangs.length, invalidValues },
        ),
      );
    }
  }

  // 8. seo-canonical
  {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      audits.push(
        audit(
          'seo-canonical',
          t(TEXTS['seo-canonical'].title),
          isZh
            ? '未发现 canonical 链接'
            : 'No canonical link found.',
          null, // notApplicable
        ),
      );
    } else {
      const href = canonical.getAttribute('href') ?? '';
      let isValid = false;
      try {
        new URL(href, document.baseURI);
        isValid = true;
      } catch {
        isValid = false;
      }
      audits.push(
        audit(
          'seo-canonical',
          t(TEXTS['seo-canonical'].title),
          isValid
            ? isZh
              ? 'Canonical URL 合法'
              : 'Canonical URL is valid.'
            : isZh
              ? `Canonical URL 无效：${href}`
              : `Canonical URL is invalid: ${href}`,
          isValid ? 1 : 0,
          { href },
        ),
      );
    }
  }

  // 9. seo-robots-meta
  {
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      // 没有 meta robots 时默认允许索引 → pass
      audits.push(
        audit(
          'seo-robots-meta',
          t(TEXTS['seo-robots-meta'].title),
          isZh
            ? '未发现 robots meta 标签，页面默认可被索引'
            : 'No robots meta tag found; page is indexable by default.',
          1,
        ),
      );
    } else {
      const content = robotsMeta.getAttribute('content') ?? '';
      const pass = !content.toLowerCase().includes('noindex');
      audits.push(
        audit(
          'seo-robots-meta',
          t(TEXTS['seo-robots-meta'].title),
          pass
            ? isZh
              ? 'Robots meta 标签不包含 noindex'
              : 'Robots meta tag does not contain noindex.'
            : isZh
              ? 'Robots meta 标签包含 noindex，页面可能不被索引'
              : 'Robots meta tag contains noindex, page may not be indexed.',
          pass ? 1 : 0,
          { content },
        ),
      );
    }
  }

  // 10. seo-structured-data
  {
    const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    if (ldScripts.length === 0) {
      audits.push(
        audit(
          'seo-structured-data',
          t(TEXTS['seo-structured-data'].title),
          isZh
            ? '未发现结构化数据（JSON-LD）'
            : 'No structured data (JSON-LD) found.',
          null, // notApplicable
        ),
      );
    } else {
      let pass = true;
      let parseErrors = 0;
      for (const script of ldScripts) {
        try {
          JSON.parse(script.textContent ?? '');
        } catch {
          pass = false;
          parseErrors++;
        }
      }
      audits.push(
        audit(
          'seo-structured-data',
          t(TEXTS['seo-structured-data'].title),
          pass
            ? isZh
              ? `全部 ${ldScripts.length} 个 JSON-LD 脚本解析成功`
              : `All ${ldScripts.length} JSON-LD script(s) parsed successfully.`
            : isZh
              ? `${parseErrors}/${ldScripts.length} 个 JSON-LD 脚本解析失败`
              : `${parseErrors} of ${ldScripts.length} JSON-LD script(s) failed to parse.`,
          pass ? 1 : 0,
          { total: ldScripts.length, parseErrors },
        ),
      );
    }
  }

  // 等权评分计算
  const applicable = audits.filter((a) => a.score !== null);
  const passed = applicable.filter((a) => a.score === 1).length;
  const score = applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0;

  return {
    id: 'seo',
    title: 'SEO',
    score,
    audits,
  };
}
