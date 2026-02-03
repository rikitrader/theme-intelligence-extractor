/**
 * Theme Intelligence Extractor - Extraction Module
 * Heuristic-based extraction of design tokens, stack signals, and patterns
 */

import {
  CrawlSession,
  CrawledPage,
  StackSignal,
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  DesignTokens,
  TypographyScale,
  ComponentPattern,
  AccessibilitySignal,
  LayoutInfo,
  ExtractionResult,
  ExtractedValue,
  SourceInfo,
} from './types.js';

// ============================================================================
// Stack Detection
// ============================================================================

interface StackDetector {
  name: string;
  category: StackSignal['category'];
  patterns: { regex: RegExp; weight: number; description: string }[];
}

const STACK_DETECTORS: StackDetector[] = [
  {
    name: 'Next.js',
    category: 'framework',
    patterns: [
      { regex: /__NEXT_DATA__/i, weight: 0.9, description: '__NEXT_DATA__ script' },
      { regex: /\/_next\//i, weight: 0.8, description: '/_next/ assets' },
      { regex: /next\/head/i, weight: 0.7, description: 'next/head import' },
      { regex: /data-nscript/i, weight: 0.6, description: 'Next.js script attribute' },
    ],
  },
  {
    name: 'React',
    category: 'framework',
    patterns: [
      { regex: /data-reactroot/i, weight: 0.9, description: 'data-reactroot attribute' },
      { regex: /__REACT_DEVTOOLS/i, weight: 0.8, description: 'React DevTools' },
      { regex: /react(?:\.min)?\.js/i, weight: 0.7, description: 'React bundle' },
      { regex: /react-dom/i, weight: 0.6, description: 'react-dom reference' },
    ],
  },
  {
    name: 'Vue.js',
    category: 'framework',
    patterns: [
      { regex: /data-v-[a-f0-9]+/i, weight: 0.9, description: 'Vue scoped style attribute' },
      { regex: /__VUE__/i, weight: 0.8, description: '__VUE__ global' },
      { regex: /vue(?:\.min)?\.js/i, weight: 0.7, description: 'Vue bundle' },
    ],
  },
  {
    name: 'Nuxt',
    category: 'framework',
    patterns: [
      { regex: /__NUXT__/i, weight: 0.9, description: '__NUXT__ data' },
      { regex: /\/_nuxt\//i, weight: 0.8, description: '/_nuxt/ assets' },
    ],
  },
  {
    name: 'Svelte',
    category: 'framework',
    patterns: [
      { regex: /svelte-[a-z0-9]+/i, weight: 0.8, description: 'Svelte class pattern' },
      { regex: /__svelte/i, weight: 0.9, description: '__svelte marker' },
    ],
  },
  {
    name: 'Tailwind CSS',
    category: 'css-framework',
    patterns: [
      { regex: /tailwindcss/i, weight: 0.9, description: 'tailwindcss reference' },
      { regex: /--tw-[a-z-]+/i, weight: 0.85, description: 'Tailwind CSS variable' },
      { regex: /\bclass="[^"]*(?:bg-|text-|flex|grid|p-|m-|w-|h-)[^"]*"/i, weight: 0.6, description: 'Tailwind utility classes' },
      { regex: /\b(?:sm:|md:|lg:|xl:|2xl:)[a-z]/i, weight: 0.7, description: 'Tailwind breakpoint prefix' },
    ],
  },
  {
    name: 'shadcn/ui',
    category: 'ui-library',
    patterns: [
      { regex: /@radix-ui/i, weight: 0.8, description: '@radix-ui import' },
      { regex: /\bcn\s*\(/i, weight: 0.6, description: 'cn() utility function' },
      { regex: /data-\[state=/i, weight: 0.7, description: 'Radix state attribute' },
      { regex: /class-variance-authority/i, weight: 0.8, description: 'CVA import' },
    ],
  },
  {
    name: 'Bootstrap',
    category: 'css-framework',
    patterns: [
      { regex: /bootstrap(?:\.min)?\.css/i, weight: 0.9, description: 'Bootstrap CSS' },
      { regex: /\bclass="[^"]*(?:container|row|col-)[^"]*"/i, weight: 0.7, description: 'Bootstrap grid classes' },
      { regex: /\bbtn-(?:primary|secondary|success|danger)/i, weight: 0.8, description: 'Bootstrap button classes' },
    ],
  },
  {
    name: 'Material UI',
    category: 'ui-library',
    patterns: [
      { regex: /@mui\//i, weight: 0.9, description: '@mui/ import' },
      { regex: /MuiButton|MuiCard|MuiTypography/i, weight: 0.8, description: 'MUI component class' },
      { regex: /__emotion/i, weight: 0.5, description: 'Emotion (MUI styling)' },
    ],
  },
  {
    name: 'Chakra UI',
    category: 'ui-library',
    patterns: [
      { regex: /@chakra-ui/i, weight: 0.9, description: '@chakra-ui import' },
      { regex: /chakra-/i, weight: 0.7, description: 'Chakra class prefix' },
    ],
  },
  {
    name: 'Vite',
    category: 'build-tool',
    patterns: [
      { regex: /@vite/i, weight: 0.8, description: '@vite reference' },
      { regex: /vite\.config/i, weight: 0.9, description: 'Vite config' },
    ],
  },
  {
    name: 'Webpack',
    category: 'build-tool',
    patterns: [
      { regex: /webpackJsonp/i, weight: 0.8, description: 'Webpack runtime' },
      { regex: /__webpack_require__/i, weight: 0.9, description: 'Webpack require' },
    ],
  },
];

export function detectStack(session: CrawlSession): StackSignal[] {
  const signals: Map<string, StackSignal> = new Map();

  // Combine all HTML and CSS content for analysis
  const allContent = [
    ...session.pages.map((p) => p.fullHtml),
    ...Array.from(session.cssContents.values()),
  ].join('\n');

  for (const detector of STACK_DETECTORS) {
    const evidence: string[] = [];
    const sourceUrls: Set<string> = new Set();
    let maxConfidence = 0;

    for (const pattern of detector.patterns) {
      if (pattern.regex.test(allContent)) {
        evidence.push(pattern.description);
        maxConfidence = Math.max(maxConfidence, pattern.weight);

        // Find which pages contain this pattern
        for (const page of session.pages) {
          if (pattern.regex.test(page.fullHtml)) {
            sourceUrls.add(page.finalUrl);
          }
        }
        for (const [url, css] of session.cssContents) {
          if (pattern.regex.test(css)) {
            sourceUrls.add(url);
          }
        }
      }
    }

    if (evidence.length > 0) {
      // Boost confidence if multiple patterns match
      const confidenceBoost = Math.min(0.1 * (evidence.length - 1), 0.15);
      const finalConfidence = Math.min(maxConfidence + confidenceBoost, 1);

      signals.set(detector.name, {
        name: detector.name,
        category: detector.category,
        confidence: finalConfidence,
        evidence,
        sourceUrls: Array.from(sourceUrls),
      });
    }
  }

  // Sort by confidence descending
  return Array.from(signals.values()).sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// CSS Variable Extraction
// ============================================================================

const CSS_VAR_REGEX = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
const COLOR_REGEX = /#([a-fA-F0-9]{3,8})\b|rgba?\s*\([^)]+\)|hsla?\s*\([^)]+\)/gi;
const FONT_FAMILY_REGEX = /font-family\s*:\s*([^;}\n]+)/gi;
const FONT_SIZE_REGEX = /font-size\s*:\s*([^;}\n]+)/gi;
const BORDER_RADIUS_REGEX = /border-radius\s*:\s*([^;}\n]+)/gi;
const BOX_SHADOW_REGEX = /box-shadow\s*:\s*([^;}\n]+)/gi;

function getColorFormat(value: string): ColorToken['format'] {
  if (value.startsWith('#')) return 'hex';
  if (value.startsWith('rgba')) return 'rgba';
  if (value.startsWith('rgb')) return 'rgb';
  if (value.startsWith('hsla')) return 'hsla';
  if (value.startsWith('hsl')) return 'hsl';
  return 'named';
}

function inferColorUsage(name: string): ColorToken['usage'] {
  const lowerName = name.toLowerCase();
  if (/background|bg/i.test(lowerName)) return 'background';
  if (/foreground|fg|text/i.test(lowerName)) return 'foreground';
  if (/primary/i.test(lowerName)) return 'primary';
  if (/secondary/i.test(lowerName)) return 'secondary';
  if (/accent/i.test(lowerName)) return 'accent';
  if (/border/i.test(lowerName)) return 'border';
  return 'unknown';
}

export function extractCSSVariables(
  css: string,
  sourceUrl: string
): ExtractedValue[] {
  const variables: ExtractedValue[] = [];
  let match;

  CSS_VAR_REGEX.lastIndex = 0;
  while ((match = CSS_VAR_REGEX.exec(css)) !== null) {
    const [fullMatch, name, value] = match;
    variables.push({
      value: `--${name}: ${value.trim()}`,
      sourceType: 'css',
      sourceUrl,
      sampleSnippet: fullMatch.slice(0, 100),
      confidence: 0.9,
    });
  }

  return variables;
}

export function extractColors(
  css: string,
  sourceUrl: string
): ColorToken[] {
  const colors: Map<string, ColorToken> = new Map();

  // Extract from CSS variables first (more semantic)
  let match;
  CSS_VAR_REGEX.lastIndex = 0;
  while ((match = CSS_VAR_REGEX.exec(css)) !== null) {
    const [fullMatch, name, value] = match;
    const trimmedValue = value.trim();

    // Check if value is a color
    if (COLOR_REGEX.test(trimmedValue)) {
      COLOR_REGEX.lastIndex = 0;
      const colorMatch = COLOR_REGEX.exec(trimmedValue);
      if (colorMatch) {
        const colorValue = colorMatch[0];
        if (!colors.has(colorValue)) {
          colors.set(colorValue, {
            name: `--${name}`,
            value: colorValue,
            format: getColorFormat(colorValue),
            usage: inferColorUsage(name),
            source: {
              sourceType: 'css',
              sourceUrl,
              sampleSnippet: fullMatch.slice(0, 80),
              confidence: 0.85,
            },
          });
        }
      }
    }
  }

  return Array.from(colors.values());
}

export function extractTypography(
  css: string,
  sourceUrl: string
): TypographyToken[] {
  const tokens: TypographyToken[] = [];
  const seenFonts = new Set<string>();

  // Extract font-family declarations
  let match;
  FONT_FAMILY_REGEX.lastIndex = 0;
  while ((match = FONT_FAMILY_REGEX.exec(css)) !== null) {
    const value = match[1].trim();
    if (!seenFonts.has(value)) {
      seenFonts.add(value);
      tokens.push({
        name: 'font-family',
        fontFamily: value,
        source: {
          sourceType: 'css',
          sourceUrl,
          sampleSnippet: match[0].slice(0, 80),
          confidence: 0.8,
        },
      });
    }
  }

  return tokens;
}

export function extractRadii(css: string, sourceUrl: string): RadiusToken[] {
  const radii: Map<string, RadiusToken> = new Map();

  // From CSS variables
  let match;
  CSS_VAR_REGEX.lastIndex = 0;
  while ((match = CSS_VAR_REGEX.exec(css)) !== null) {
    const [fullMatch, name, value] = match;
    if (/radius/i.test(name)) {
      const key = `--${name}`;
      if (!radii.has(key)) {
        radii.set(key, {
          name: key,
          value: value.trim(),
          source: {
            sourceType: 'css',
            sourceUrl,
            sampleSnippet: fullMatch.slice(0, 80),
            confidence: 0.85,
          },
        });
      }
    }
  }

  // From direct border-radius declarations
  BORDER_RADIUS_REGEX.lastIndex = 0;
  while ((match = BORDER_RADIUS_REGEX.exec(css)) !== null) {
    const value = match[1].trim();
    if (!radii.has(value) && !value.startsWith('var(')) {
      radii.set(value, {
        name: 'border-radius',
        value,
        source: {
          sourceType: 'css',
          sourceUrl,
          sampleSnippet: match[0].slice(0, 80),
          confidence: 0.7,
        },
      });
    }
  }

  return Array.from(radii.values());
}

export function extractShadows(css: string, sourceUrl: string): ShadowToken[] {
  const shadows: Map<string, ShadowToken> = new Map();

  // From CSS variables
  let match;
  CSS_VAR_REGEX.lastIndex = 0;
  while ((match = CSS_VAR_REGEX.exec(css)) !== null) {
    const [fullMatch, name, value] = match;
    if (/shadow/i.test(name)) {
      const key = `--${name}`;
      if (!shadows.has(key)) {
        shadows.set(key, {
          name: key,
          value: value.trim(),
          source: {
            sourceType: 'css',
            sourceUrl,
            sampleSnippet: fullMatch.slice(0, 80),
            confidence: 0.85,
          },
        });
      }
    }
  }

  // From direct box-shadow declarations
  BOX_SHADOW_REGEX.lastIndex = 0;
  while ((match = BOX_SHADOW_REGEX.exec(css)) !== null) {
    const value = match[1].trim();
    if (value !== 'none' && !value.startsWith('var(') && !shadows.has(value)) {
      shadows.set(value, {
        name: 'box-shadow',
        value,
        source: {
          sourceType: 'css',
          sourceUrl,
          sampleSnippet: match[0].slice(0, 80),
          confidence: 0.7,
        },
      });
    }
  }

  return Array.from(shadows.values());
}

// ============================================================================
// Typography Scale Extraction
// ============================================================================

export function extractTypographyScale(
  session: CrawlSession
): TypographyScale {
  const headings: TypographyScale['headings'] = [];
  const fontFamilies: ExtractedValue[] = [];
  const seenFonts = new Set<string>();

  // Combine all CSS
  const allCSS = [
    ...session.pages.flatMap((p) => {
      const styleMatches = p.fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
      return styleMatches.map((m) => m.replace(/<\/?style[^>]*>/gi, ''));
    }),
    ...Array.from(session.cssContents.values()),
  ].join('\n');

  // Extract heading styles
  const headingRegex = /\b(h[1-6])\s*\{([^}]+)\}/gi;
  let match;
  while ((match = headingRegex.exec(allCSS)) !== null) {
    const tag = match[1].toLowerCase();
    const styles = match[2];

    const fontSize = styles.match(/font-size\s*:\s*([^;]+)/i)?.[1]?.trim();
    const fontWeight = styles.match(/font-weight\s*:\s*([^;]+)/i)?.[1]?.trim();
    const lineHeight = styles.match(/line-height\s*:\s*([^;]+)/i)?.[1]?.trim();
    const fontFamily = styles.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.trim();

    headings.push({
      tag,
      fontSize,
      fontWeight,
      lineHeight,
      fontFamily,
      source: {
        sourceType: 'css',
        sourceUrl: session.startUrl,
        sampleSnippet: match[0].slice(0, 100),
        confidence: 0.8,
      },
    });
  }

  // Extract all font families
  FONT_FAMILY_REGEX.lastIndex = 0;
  while ((match = FONT_FAMILY_REGEX.exec(allCSS)) !== null) {
    const value = match[1].trim();
    if (!seenFonts.has(value)) {
      seenFonts.add(value);
      fontFamilies.push({
        value,
        sourceType: 'css',
        sourceUrl: session.startUrl,
        sampleSnippet: match[0].slice(0, 80),
        confidence: 0.75,
      });
    }
  }

  // Extract body text info
  const bodyRegex = /\bbody\s*\{([^}]+)\}/gi;
  let bodyText: TypographyScale['bodyText'] = null;
  while ((match = bodyRegex.exec(allCSS)) !== null) {
    const styles = match[1];
    bodyText = {
      fontSize: styles.match(/font-size\s*:\s*([^;]+)/i)?.[1]?.trim(),
      lineHeight: styles.match(/line-height\s*:\s*([^;]+)/i)?.[1]?.trim(),
      fontFamily: styles.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.trim(),
      source: {
        sourceType: 'css',
        sourceUrl: session.startUrl,
        sampleSnippet: match[0].slice(0, 100),
        confidence: 0.8,
      },
    };
  }

  return { headings, bodyText, fontFamilies };
}

// ============================================================================
// Component Pattern Detection
// ============================================================================

export function detectComponentPatterns(
  session: CrawlSession
): ComponentPattern[] {
  const patterns: ComponentPattern[] = [];
  const allHTML = session.pages.map((p) => p.fullHtml).join('\n');
  const allCSS = Array.from(session.cssContents.values()).join('\n');

  // Common component class patterns
  const componentPatterns: { type: ComponentPattern['type']; patterns: RegExp[] }[] = [
    {
      type: 'button',
      patterns: [
        /\.btn[^{]*\{/gi,
        /\.button[^{]*\{/gi,
        /\[class\*="btn"\]/gi,
      ],
    },
    {
      type: 'card',
      patterns: [
        /\.card[^{]*\{/gi,
        /\.card-body/gi,
        /\.card-header/gi,
      ],
    },
    {
      type: 'nav',
      patterns: [
        /\.nav[^{]*\{/gi,
        /\.navbar[^{]*\{/gi,
        /\.navigation[^{]*\{/gi,
      ],
    },
    {
      type: 'hero',
      patterns: [
        /\.hero[^{]*\{/gi,
        /\.hero-section/gi,
        /\.banner[^{]*\{/gi,
      ],
    },
    {
      type: 'form',
      patterns: [
        /\.form[^{]*\{/gi,
        /\.form-group/gi,
        /\.form-control/gi,
      ],
    },
    {
      type: 'input',
      patterns: [
        /\.input[^{]*\{/gi,
        /input\[type/gi,
        /\.text-field/gi,
      ],
    },
    {
      type: 'modal',
      patterns: [
        /\.modal[^{]*\{/gi,
        /\.dialog[^{]*\{/gi,
        /\[role="dialog"\]/gi,
      ],
    },
  ];

  for (const { type, patterns: regexPatterns } of componentPatterns) {
    const classPatterns: string[] = [];
    let hasHoverState = false;
    let hasFocusState = false;
    let hasActiveState = false;

    for (const regex of regexPatterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(allCSS)) !== null) {
        classPatterns.push(match[0].replace(/\{$/, '').trim());
      }
    }

    if (classPatterns.length > 0) {
      // Check for state styles
      const baseClass = classPatterns[0].replace(/^\./, '').split(/[^a-zA-Z0-9_-]/)[0];
      hasHoverState = new RegExp(`\\.${baseClass}[^{]*:hover`, 'i').test(allCSS);
      hasFocusState = new RegExp(`\\.${baseClass}[^{]*:focus`, 'i').test(allCSS);
      hasActiveState = new RegExp(`\\.${baseClass}[^{]*:active`, 'i').test(allCSS);

      patterns.push({
        name: type,
        type,
        classPatterns: [...new Set(classPatterns)].slice(0, 5),
        hasHoverState,
        hasFocusState,
        hasActiveState,
        source: {
          sourceType: 'css',
          sourceUrl: session.startUrl,
          sampleSnippet: classPatterns[0],
          confidence: 0.7,
        },
      });
    }
  }

  return patterns;
}

// ============================================================================
// Accessibility Signal Detection
// ============================================================================

export function detectAccessibilitySignals(
  session: CrawlSession
): AccessibilitySignal[] {
  const signals: AccessibilitySignal[] = [];
  const allHTML = session.pages.map((p) => p.fullHtml).join('\n');
  const allCSS = Array.from(session.cssContents.values()).join('\n');

  // Skip link detection
  const hasSkipLink = /skip[- ]?(?:to[- ]?)?(?:main|content|navigation)/i.test(allHTML);
  signals.push({
    feature: 'Skip Links',
    present: hasSkipLink,
    details: hasSkipLink ? 'Skip navigation link detected' : undefined,
    source: {
      sourceType: 'html',
      sourceUrl: session.startUrl,
      sampleSnippet: 'skip-to-content pattern',
      confidence: hasSkipLink ? 0.9 : 0.5,
    },
  });

  // Focus-visible styling
  const hasFocusVisible = /:focus-visible/i.test(allCSS);
  const hasFocusOutline = /:focus[^}]*outline/i.test(allCSS);
  signals.push({
    feature: 'Focus Visible Styling',
    present: hasFocusVisible || hasFocusOutline,
    details: hasFocusVisible
      ? 'Uses :focus-visible pseudo-class'
      : hasFocusOutline
      ? 'Custom focus outline styling'
      : undefined,
    source: {
      sourceType: 'css',
      sourceUrl: session.startUrl,
      sampleSnippet: ':focus-visible or :focus outline',
      confidence: hasFocusVisible ? 0.9 : hasFocusOutline ? 0.7 : 0.4,
    },
  });

  // ARIA usage
  const ariaCount = (allHTML.match(/aria-[a-z]+=/gi) || []).length;
  signals.push({
    feature: 'ARIA Attributes',
    present: ariaCount > 5,
    details: `Found ${ariaCount} ARIA attributes`,
    source: {
      sourceType: 'html',
      sourceUrl: session.startUrl,
      sampleSnippet: `${ariaCount} aria-* attributes`,
      confidence: ariaCount > 20 ? 0.9 : ariaCount > 5 ? 0.7 : 0.4,
    },
  });

  // Alt text on images
  const imgTags = allHTML.match(/<img[^>]*>/gi) || [];
  const imgWithAlt = imgTags.filter((img) => /alt=/i.test(img)).length;
  const altCoverage = imgTags.length > 0 ? imgWithAlt / imgTags.length : 1;
  signals.push({
    feature: 'Image Alt Text',
    present: altCoverage > 0.8,
    details: `${imgWithAlt}/${imgTags.length} images have alt text (${Math.round(altCoverage * 100)}%)`,
    source: {
      sourceType: 'html',
      sourceUrl: session.startUrl,
      sampleSnippet: 'img alt attribute coverage',
      confidence: altCoverage > 0.9 ? 0.9 : altCoverage > 0.7 ? 0.7 : 0.5,
    },
  });

  // Semantic HTML
  const hasSemanticNav = /<nav[\s>]/i.test(allHTML);
  const hasSemanticMain = /<main[\s>]/i.test(allHTML);
  const hasSemanticHeader = /<header[\s>]/i.test(allHTML);
  const hasSemanticFooter = /<footer[\s>]/i.test(allHTML);
  const semanticCount = [hasSemanticNav, hasSemanticMain, hasSemanticHeader, hasSemanticFooter].filter(Boolean).length;

  signals.push({
    feature: 'Semantic HTML',
    present: semanticCount >= 3,
    details: `Uses ${semanticCount}/4 semantic landmarks (nav, main, header, footer)`,
    source: {
      sourceType: 'html',
      sourceUrl: session.startUrl,
      sampleSnippet: 'semantic HTML elements',
      confidence: semanticCount >= 3 ? 0.85 : semanticCount >= 2 ? 0.6 : 0.4,
    },
  });

  return signals;
}

// ============================================================================
// Layout Information Extraction
// ============================================================================

export function extractLayoutInfo(session: CrawlSession): LayoutInfo {
  const allCSS = Array.from(session.cssContents.values()).join('\n');
  const containerWidths: ExtractedValue[] = [];
  const breakpoints: ExtractedValue[] = [];
  const gridEvidence: string[] = [];
  let gridSystem: LayoutInfo['gridSystem'] = 'unknown';

  // Container widths
  const containerRegex = /\.container[^{]*\{[^}]*max-width\s*:\s*([^;]+)/gi;
  let match;
  while ((match = containerRegex.exec(allCSS)) !== null) {
    containerWidths.push({
      value: match[1].trim(),
      sourceType: 'css',
      sourceUrl: session.startUrl,
      sampleSnippet: match[0].slice(0, 80),
      confidence: 0.8,
    });
  }

  // Breakpoints from media queries
  const mediaQueryRegex = /@media[^{]*\(\s*(?:min|max)-width\s*:\s*([^)]+)\)/gi;
  const seenBreakpoints = new Set<string>();
  while ((match = mediaQueryRegex.exec(allCSS)) !== null) {
    const bp = match[1].trim();
    if (!seenBreakpoints.has(bp)) {
      seenBreakpoints.add(bp);
      breakpoints.push({
        value: bp,
        sourceType: 'css',
        sourceUrl: session.startUrl,
        sampleSnippet: match[0].slice(0, 60),
        confidence: 0.85,
      });
    }
  }

  // Grid system detection
  if (/display\s*:\s*grid/i.test(allCSS)) {
    gridSystem = 'css-grid';
    gridEvidence.push('CSS Grid (display: grid)');
  }
  if (/display\s*:\s*flex/i.test(allCSS)) {
    if (gridSystem === 'unknown') gridSystem = 'flexbox';
    gridEvidence.push('Flexbox (display: flex)');
  }
  if (/\.col-(?:xs|sm|md|lg|xl)-\d+/i.test(allCSS)) {
    gridSystem = 'bootstrap-grid';
    gridEvidence.push('Bootstrap grid classes');
  }

  return {
    containerWidths,
    breakpoints,
    gridSystem,
    gridEvidence,
  };
}

// ============================================================================
// Main Extraction Function
// ============================================================================

export function extract(session: CrawlSession): ExtractionResult {
  const stackSignals = detectStack(session);
  const typographyScale = extractTypographyScale(session);
  const componentPatterns = detectComponentPatterns(session);
  const accessibilitySignals = detectAccessibilitySignals(session);
  const layout = extractLayoutInfo(session);

  // Aggregate tokens from all CSS
  const allColors: ColorToken[] = [];
  const allTypography: TypographyToken[] = [];
  const allRadii: RadiusToken[] = [];
  const allShadows: ShadowToken[] = [];
  const allCustomProperties: ExtractedValue[] = [];

  // From inline styles in HTML
  for (const page of session.pages) {
    const styleMatches = page.fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    for (const styleTag of styleMatches) {
      const css = styleTag.replace(/<\/?style[^>]*>/gi, '');
      allColors.push(...extractColors(css, page.finalUrl));
      allTypography.push(...extractTypography(css, page.finalUrl));
      allRadii.push(...extractRadii(css, page.finalUrl));
      allShadows.push(...extractShadows(css, page.finalUrl));
      allCustomProperties.push(...extractCSSVariables(css, page.finalUrl));
    }
  }

  // From external CSS files
  for (const [url, css] of session.cssContents) {
    allColors.push(...extractColors(css, url));
    allTypography.push(...extractTypography(css, url));
    allRadii.push(...extractRadii(css, url));
    allShadows.push(...extractShadows(css, url));
    allCustomProperties.push(...extractCSSVariables(css, url));
  }

  // Deduplicate tokens
  const uniqueColors = deduplicateByValue(allColors, (c) => c.value);
  const uniqueTypography = deduplicateByValue(allTypography, (t) => t.fontFamily || '');
  const uniqueRadii = deduplicateByValue(allRadii, (r) => r.value);
  const uniqueShadows = deduplicateByValue(allShadows, (s) => s.value);
  const uniqueProps = deduplicateByValue(allCustomProperties, (p) => p.value);

  // Generate risks and notes
  const risks: string[] = [];
  const notes: string[] = [];

  // Check for potential issues
  if (uniqueColors.length > 50) {
    risks.push('Large color palette detected (50+ colors) - may indicate inconsistent design tokens');
  }
  if (stackSignals.some((s) => s.name === 'Bootstrap') && stackSignals.some((s) => s.name === 'Tailwind CSS')) {
    risks.push('Multiple CSS frameworks detected (Bootstrap + Tailwind) - may cause style conflicts');
  }
  if (session.cssContents.size === 0 && session.pages.length > 0) {
    notes.push('No external CSS files were fetched - tokens extracted from inline styles only');
  }
  if (session.robotsTxtStatus === 'blocked') {
    risks.push('robots.txt blocks crawling - results may be incomplete');
  }

  // Spacing tokens (simplified - would need more sophisticated analysis)
  const spacingTokens: SpacingToken[] = [];

  return {
    stackSignals,
    tokens: {
      colors: uniqueColors,
      typography: uniqueTypography,
      spacing: spacingTokens,
      radii: uniqueRadii,
      shadows: uniqueShadows,
      customProperties: uniqueProps,
    },
    typographyScale,
    componentPatterns,
    accessibilitySignals,
    layout,
    risks,
    notes,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function deduplicateByValue<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
