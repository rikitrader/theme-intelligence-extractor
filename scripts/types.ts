/**
 * Theme Intelligence Extractor - Type Definitions
 * Version: 1.0.0
 */

// ============================================================================
// Input Types
// ============================================================================

export interface ExtractorInput {
  themeUrl: string;
  maxPages?: number;
  sameOriginOnly?: boolean;
  includeAssets?: boolean;
  mode?: 'extract' | 'prompt' | 'both';
  notes?: string;
}

export interface ExtractorConfig {
  themeUrl: string;
  maxPages: number;
  sameOriginOnly: boolean;
  includeAssets: boolean;
  mode: 'extract' | 'prompt' | 'both';
  notes: string;
}

// ============================================================================
// Crawler Types
// ============================================================================

export interface CrawlResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  html: string;
  cssLinks: string[];
  jsLinks: string[];
  internalLinks: string[];
  error?: string;
}

export interface CrawledPage {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  htmlSnippet: string;
  fullHtml: string;
  cssLinks: string[];
  jsLinks: string[];
  internalLinks: string[];
  crawledAt: string;
  error?: string;
}

export interface CrawlSession {
  startUrl: string;
  pages: CrawledPage[];
  cssContents: Map<string, string>;
  robotsTxtStatus: 'allowed' | 'blocked' | 'unknown' | 'error';
  robotsTxtWarning?: string;
  totalRequests: number;
  failedRequests: number;
  crawlDuration: number;
}

// ============================================================================
// Extraction Types
// ============================================================================

export interface SourceInfo {
  sourceType: 'html' | 'css' | 'headers' | 'js-hint';
  sourceUrl: string;
  sampleSnippet: string;
  confidence: number;
}

export interface ExtractedValue<T = string> extends SourceInfo {
  value: T;
}

export interface StackSignal {
  name: string;
  category: 'framework' | 'css-framework' | 'ui-library' | 'build-tool' | 'other';
  confidence: number;
  evidence: string[];
  sourceUrls: string[];
}

export interface ColorToken {
  name: string;
  value: string;
  format: 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'named';
  usage?: 'background' | 'foreground' | 'primary' | 'secondary' | 'accent' | 'border' | 'unknown';
  source: SourceInfo;
}

export interface TypographyToken {
  name: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  source: SourceInfo;
}

export interface SpacingToken {
  name: string;
  value: string;
  unit: 'px' | 'rem' | 'em' | '%' | 'other';
  source: SourceInfo;
}

export interface RadiusToken {
  name: string;
  value: string;
  source: SourceInfo;
}

export interface ShadowToken {
  name: string;
  value: string;
  source: SourceInfo;
}

export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  radii: RadiusToken[];
  shadows: ShadowToken[];
  customProperties: ExtractedValue[];
}

export interface TypographyScale {
  headings: {
    tag: string;
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    fontFamily?: string;
    source: SourceInfo;
  }[];
  bodyText: {
    fontSize?: string;
    lineHeight?: string;
    fontFamily?: string;
    source: SourceInfo;
  } | null;
  fontFamilies: ExtractedValue[];
}

export interface ComponentPattern {
  name: string;
  type: 'button' | 'card' | 'nav' | 'hero' | 'form' | 'input' | 'modal' | 'other';
  classPatterns: string[];
  hasHoverState: boolean;
  hasFocusState: boolean;
  hasActiveState: boolean;
  sampleMarkup?: string;
  source: SourceInfo;
}

export interface AccessibilitySignal {
  feature: string;
  present: boolean;
  details?: string;
  source: SourceInfo;
}

export interface LayoutInfo {
  containerWidths: ExtractedValue[];
  breakpoints: ExtractedValue[];
  gridSystem?: 'css-grid' | 'flexbox' | 'bootstrap-grid' | 'custom' | 'unknown';
  gridEvidence: string[];
}

export interface ExtractionResult {
  stackSignals: StackSignal[];
  tokens: DesignTokens;
  typographyScale: TypographyScale;
  componentPatterns: ComponentPattern[];
  accessibilitySignals: AccessibilitySignal[];
  layout: LayoutInfo;
  risks: string[];
  notes: string[];
}

// ============================================================================
// Output Types
// ============================================================================

export interface ThemeReport {
  meta: {
    version: string;
    generatedAt: string;
    sourceUrl: string;
    pagesCrawled: number;
    crawlDuration: number;
    robotsTxtStatus: string;
  };
  stackSignals: StackSignal[];
  tokens: {
    colors: ColorToken[];
    typography: TypographyToken[];
    spacing: SpacingToken[];
    radii: RadiusToken[];
    shadows: ShadowToken[];
    customProperties: ExtractedValue[];
  };
  typographySummary: {
    primaryFonts: string[];
    headingScale: { tag: string; size?: string }[];
    bodySize?: string;
  };
  componentPatterns: {
    name: string;
    type: string;
    classes: string[];
    states: string[];
  }[];
  accessibilitySignals: {
    feature: string;
    present: boolean;
    details?: string;
  }[];
  layout: {
    containerWidths: string[];
    breakpoints: string[];
    gridSystem?: string;
  };
  risks: string[];
  notes: string[];
  recommendedApproach: string;
}

export interface ExtractorOutput {
  report: ThemeReport;
  prompt: string;
  outputDir: string;
}
