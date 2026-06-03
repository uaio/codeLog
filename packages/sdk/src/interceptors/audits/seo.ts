/**
 * SEO 审计：10 项等权 pass/fail 审计
 * 对齐 Lighthouse SEO 类别
 */

import type { LighthouseAuditResult, LighthouseCategoryResult } from '@codelog/types';
import { VAGUE_LINK_TEXTS } from './helpers.js';

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

  // 1. seo-document-title
  {
    const title = document.title ?? '';
    const len = title.trim().length;
    const pass = len >= 10 && len <= 60;
    audits.push(
      audit(
        'seo-document-title',
        'Document has a title',
        `Title should be 10-60 characters. Current: ${len} characters.`,
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
        'Document has a meta description',
        `Meta description should be 50-160 characters. Current: ${len} characters.`,
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
            'Page has successful HTTP status code',
            `HTTP status ${status}. Expected 200-399.`,
            pass ? 1 : 0,
            { statusCode: status },
          ),
        );
      } else {
        // API 不可用时 fallback 为 pass（页面能执行 JS 即视为 200）
        audits.push(
          audit(
            'seo-http-status-code',
            'Page has successful HTTP status code',
            'Navigation API unavailable; assumed 200 because JS is executing.',
            1,
          ),
        );
      }
    } catch {
      audits.push(
        audit(
          'seo-http-status-code',
          'Page has successful HTTP status code',
          'Navigation API unavailable; assumed 200 because JS is executing.',
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
        'Links have descriptive text',
        vagueLinks.length > 0
          ? `Found ${vagueLinks.length} link(s) with vague text: ${vagueLinks.slice(0, 5).join(', ')}`
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
        'Has a meta viewport tag with width=device-width',
        pass
          ? 'Viewport meta tag includes width=device-width.'
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
        'Links are crawlable',
        nonCrawlable.length > 0
          ? `Found ${nonCrawlable.length} non-crawlable anchor(s).`
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
          'Document has valid hreflang',
          'No hreflang tags found.',
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
          'Document has valid hreflang',
          invalidValues.length > 0
            ? `Invalid hreflang value(s): ${invalidValues.join(', ')}`
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
          'Document has a valid canonical link',
          'No canonical link found.',
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
          'Document has a valid canonical link',
          isValid ? 'Canonical URL is valid.' : `Canonical URL is invalid: ${href}`,
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
          'Page is not blocked from indexing',
          'No robots meta tag found; page is indexable by default.',
          1,
        ),
      );
    } else {
      const content = robotsMeta.getAttribute('content') ?? '';
      const pass = !content.toLowerCase().includes('noindex');
      audits.push(
        audit(
          'seo-robots-meta',
          'Page is not blocked from indexing',
          pass
            ? 'Robots meta tag does not contain noindex.'
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
          'Page has valid structured data',
          'No structured data (JSON-LD) found.',
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
          'Page has valid structured data',
          pass
            ? `All ${ldScripts.length} JSON-LD script(s) parsed successfully.`
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
