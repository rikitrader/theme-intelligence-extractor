/**
 * Theme Intelligence Extractor - Crawler Module
 * Handles URL fetching, link extraction, and rate-limited crawling
 */

import {
  CrawlResult,
  CrawledPage,
  CrawlSession,
  ExtractorConfig,
} from './types.js';

// ============================================================================
// URL Utilities
// ============================================================================

export function normalizeUrl(url: string, baseUrl?: string): string | null {
  try {
    if (baseUrl) {
      return new URL(url, baseUrl).href;
    }
    return new URL(url).href;
  } catch {
    return null;
  }
}

export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const u1 = new URL(url1);
    const u2 = new URL(url2);
    return u1.origin === u2.origin;
  } catch {
    return false;
  }
}

export function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// ============================================================================
// HTML Parsing (Regex-based, no external deps)
// ============================================================================

export function extractLinks(html: string, baseUrl: string): {
  cssLinks: string[];
  jsLinks: string[];
  internalLinks: string[];
} {
  const cssLinks: Set<string> = new Set();
  const jsLinks: Set<string> = new Set();
  const internalLinks: Set<string> = new Set();

  // Extract stylesheet links
  const stylesheetRegex = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  const hrefRegex = /href=["']([^"']+)["']/i;

  let match;
  while ((match = stylesheetRegex.exec(html)) !== null) {
    const hrefMatch = hrefRegex.exec(match[0]);
    if (hrefMatch) {
      const normalized = normalizeUrl(hrefMatch[1], baseUrl);
      if (normalized) cssLinks.add(normalized);
    }
  }

  // Also check for <link href="..."> with type="text/css"
  const linkTypeRegex = /<link[^>]+type=["']text\/css["'][^>]*>/gi;
  while ((match = linkTypeRegex.exec(html)) !== null) {
    const hrefMatch = hrefRegex.exec(match[0]);
    if (hrefMatch) {
      const normalized = normalizeUrl(hrefMatch[1], baseUrl);
      if (normalized) cssLinks.add(normalized);
    }
  }

  // Extract inline style URLs (for CSS imports)
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((match = styleTagRegex.exec(html)) !== null) {
    const importRegex = /@import\s+(?:url\()?["']?([^"')]+)["']?\)?/gi;
    let importMatch;
    while ((importMatch = importRegex.exec(match[1])) !== null) {
      const normalized = normalizeUrl(importMatch[1], baseUrl);
      if (normalized) cssLinks.add(normalized);
    }
  }

  // Extract script sources
  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = scriptRegex.exec(html)) !== null) {
    const normalized = normalizeUrl(match[1], baseUrl);
    if (normalized) jsLinks.add(normalized);
  }

  // Extract anchor links (internal navigation)
  const anchorRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>/gi;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    // Skip external protocols, mailto, tel, javascript
    if (/^(mailto:|tel:|javascript:|data:|#)/i.test(href)) continue;

    const normalized = normalizeUrl(href, baseUrl);
    if (normalized && isSameOrigin(normalized, baseUrl)) {
      // Remove query strings and fragments for deduplication
      try {
        const url = new URL(normalized);
        url.search = '';
        url.hash = '';
        internalLinks.add(url.href);
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return {
    cssLinks: Array.from(cssLinks),
    jsLinks: Array.from(jsLinks),
    internalLinks: Array.from(internalLinks),
  };
}

// ============================================================================
// Robots.txt Checking
// ============================================================================

export async function checkRobotsTxt(
  baseUrl: string
): Promise<{ allowed: boolean; warning?: string }> {
  const origin = getOrigin(baseUrl);
  if (!origin) return { allowed: true };

  const robotsUrl = `${origin}/robots.txt`;

  try {
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'ThemeIntelligenceExtractor/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // No robots.txt or error = assume allowed
      return { allowed: true };
    }

    const text = await response.text();

    // Simple robots.txt parsing - look for Disallow: /
    const lines = text.split('\n');
    let inUserAgentBlock = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.replace('user-agent:', '').trim();
        inUserAgentBlock = agent === '*' || agent.includes('bot');
      } else if (inUserAgentBlock && trimmed.startsWith('disallow:')) {
        const path = trimmed.replace('disallow:', '').trim();
        if (path === '/' || path === '/*') {
          return {
            allowed: false,
            warning: `robots.txt disallows crawling: ${path}`,
          };
        }
      }
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: true,
      warning: `Could not fetch robots.txt: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

// ============================================================================
// Fetch with Retry
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ThemeIntelligenceExtractor/1.0 (Design Token Analysis)',
          'Accept': 'text/html,text/css,application/javascript,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(30000),
        redirect: 'follow',
      });

      // Retry on rate limit or server errors
      if (response.status === 429 || response.status >= 500) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`[Crawler] ${response.status} for ${url}, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`[Crawler] Error fetching ${url}: ${lastError.message}, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// ============================================================================
// Single Page Fetch
// ============================================================================

export async function fetchPage(url: string): Promise<CrawlResult> {
  try {
    const response = await fetchWithRetry(url);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      return {
        url,
        finalUrl: response.url,
        status: response.status,
        contentType,
        html: '',
        cssLinks: [],
        jsLinks: [],
        internalLinks: [],
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const links = extractLinks(html, response.url);

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      contentType,
      html,
      ...links,
    };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      status: 0,
      contentType: '',
      html: '',
      cssLinks: [],
      jsLinks: [],
      internalLinks: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// CSS Fetching
// ============================================================================

export async function fetchCSS(url: string): Promise<string | null> {
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// ============================================================================
// Main Crawler
// ============================================================================

export async function crawl(config: ExtractorConfig): Promise<CrawlSession> {
  const startTime = Date.now();
  const visited = new Set<string>();
  const queue: string[] = [config.themeUrl];
  const pages: CrawledPage[] = [];
  const cssContents = new Map<string, string>();
  const allCssLinks = new Set<string>();
  let totalRequests = 0;
  let failedRequests = 0;

  // Check robots.txt first
  const robotsCheck = await checkRobotsTxt(config.themeUrl);
  const robotsTxtStatus = robotsCheck.allowed ? 'allowed' : 'blocked';

  if (!robotsCheck.allowed) {
    console.warn(`[Crawler] Warning: ${robotsCheck.warning}`);
    // Continue anyway but warn - we don't bypass, just inform
  }

  // BFS crawl
  while (queue.length > 0 && pages.length < config.maxPages) {
    const url = queue.shift()!;

    // Skip if already visited
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl || visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    // Same-origin check
    if (config.sameOriginOnly && !isSameOrigin(normalizedUrl, config.themeUrl)) {
      continue;
    }

    console.log(`[Crawler] Fetching (${pages.length + 1}/${config.maxPages}): ${normalizedUrl}`);
    totalRequests++;

    const result = await fetchPage(normalizedUrl);

    if (result.error) {
      failedRequests++;
      console.warn(`[Crawler] Failed: ${result.error}`);
    }

    // Store page result
    pages.push({
      url: result.url,
      finalUrl: result.finalUrl,
      status: result.status,
      headers: {},
      htmlSnippet: result.html.slice(0, 2000),
      fullHtml: result.html,
      cssLinks: result.cssLinks,
      jsLinks: result.jsLinks,
      internalLinks: result.internalLinks,
      crawledAt: new Date().toISOString(),
      error: result.error,
    });

    // Collect CSS links
    result.cssLinks.forEach((link) => allCssLinks.add(link));

    // Add internal links to queue
    for (const link of result.internalLinks) {
      if (!visited.has(link)) {
        queue.push(link);
      }
    }

    // Rate limiting - 500ms between requests
    await sleep(500);
  }

  // Fetch CSS files if requested
  if (config.includeAssets) {
    console.log(`[Crawler] Fetching ${allCssLinks.size} CSS files...`);

    for (const cssUrl of allCssLinks) {
      totalRequests++;
      const css = await fetchCSS(cssUrl);
      if (css) {
        cssContents.set(cssUrl, css);
      } else {
        failedRequests++;
      }
      await sleep(300);
    }
  }

  return {
    startUrl: config.themeUrl,
    pages,
    cssContents,
    robotsTxtStatus,
    robotsTxtWarning: robotsCheck.warning,
    totalRequests,
    failedRequests,
    crawlDuration: Date.now() - startTime,
  };
}
