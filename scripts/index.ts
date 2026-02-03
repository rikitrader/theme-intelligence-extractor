/**
 * Theme Intelligence Extractor - Main Orchestrator
 * Coordinates crawling, extraction, and output generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { crawl } from './crawler.js';
import { extract } from './extract.js';
import {
  generateThemeReport,
  generateIntegrationPrompt,
  formatReportJSON,
} from './format.js';
import {
  ExtractorInput,
  ExtractorConfig,
  ExtractorOutput,
  ThemeReport,
} from './types.js';

// ============================================================================
// Input Validation
// ============================================================================

export function validateInput(input: ExtractorInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: themeUrl
  if (!input.themeUrl) {
    errors.push('themeUrl is required');
  } else {
    try {
      const url = new URL(input.themeUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('themeUrl must use http or https protocol');
      }
    } catch {
      errors.push('themeUrl must be a valid URL');
    }
  }

  // Optional: maxPages
  if (input.maxPages !== undefined) {
    if (typeof input.maxPages !== 'number' || input.maxPages < 1 || input.maxPages > 20) {
      errors.push('maxPages must be a number between 1 and 20');
    }
  }

  // Optional: mode
  if (input.mode !== undefined) {
    if (!['extract', 'prompt', 'both'].includes(input.mode)) {
      errors.push('mode must be "extract", "prompt", or "both"');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeConfig(input: ExtractorInput): ExtractorConfig {
  return {
    themeUrl: input.themeUrl,
    maxPages: input.maxPages ?? 6,
    sameOriginOnly: input.sameOriginOnly ?? true,
    includeAssets: input.includeAssets ?? false,
    mode: input.mode ?? 'both',
    notes: input.notes ?? '',
  };
}

// ============================================================================
// Output Directory Management
// ============================================================================

function createOutputDir(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(process.cwd(), 'out', 'theme_intel_prompt', timestamp);

  fs.mkdirSync(outputDir, { recursive: true });

  return outputDir;
}

function writeOutputs(
  outputDir: string,
  report: ThemeReport,
  prompt: string,
  mode: ExtractorConfig['mode']
): void {
  if (mode === 'extract' || mode === 'both') {
    const reportPath = path.join(outputDir, 'theme_report.json');
    fs.writeFileSync(reportPath, formatReportJSON(report), 'utf-8');
    console.log(`[Output] Written: ${reportPath}`);
  }

  if (mode === 'prompt' || mode === 'both') {
    const promptPath = path.join(outputDir, 'design_system.md');
    fs.writeFileSync(promptPath, prompt, 'utf-8');
    console.log(`[Output] Written: ${promptPath}`);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function runExtractor(input: ExtractorInput): Promise<ExtractorOutput> {
  // Validate input
  const validation = validateInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
  }

  // Normalize configuration
  const config = normalizeConfig(input);

  console.log('\n========================================');
  console.log(' Theme Intelligence Extractor v1.0.0');
  console.log('========================================\n');
  console.log(`[Config] URL: ${config.themeUrl}`);
  console.log(`[Config] Max Pages: ${config.maxPages}`);
  console.log(`[Config] Same Origin Only: ${config.sameOriginOnly}`);
  console.log(`[Config] Include Assets: ${config.includeAssets}`);
  console.log(`[Config] Mode: ${config.mode}`);
  console.log('');

  // Phase 1: Crawl
  console.log('[Phase 1/3] Crawling pages...');
  const session = await crawl(config);
  console.log(`[Phase 1/3] Complete: ${session.pages.length} pages, ${session.cssContents.size} CSS files\n`);

  // Phase 2: Extract
  console.log('[Phase 2/3] Extracting design tokens and patterns...');
  const extraction = extract(session);
  console.log(`[Phase 2/3] Complete:`);
  console.log(`  - Stack signals: ${extraction.stackSignals.length}`);
  console.log(`  - Color tokens: ${extraction.tokens.colors.length}`);
  console.log(`  - Typography tokens: ${extraction.tokens.typography.length}`);
  console.log(`  - Radius tokens: ${extraction.tokens.radii.length}`);
  console.log(`  - Shadow tokens: ${extraction.tokens.shadows.length}`);
  console.log(`  - Component patterns: ${extraction.componentPatterns.length}`);
  console.log(`  - A11y signals: ${extraction.accessibilitySignals.length}`);
  console.log('');

  // Phase 3: Format outputs
  console.log('[Phase 3/3] Generating outputs...');
  const report = generateThemeReport(session, extraction, config);
  const prompt = generateIntegrationPrompt(report, config);

  // Write outputs
  const outputDir = createOutputDir();
  writeOutputs(outputDir, report, prompt, config.mode);

  console.log('\n========================================');
  console.log(' Extraction Complete');
  console.log('========================================');
  console.log(`Output directory: ${outputDir}`);
  console.log('');

  // Summary
  console.log('Summary:');
  if (extraction.stackSignals.length > 0) {
    console.log(`  Primary stack: ${extraction.stackSignals[0].name} (${(extraction.stackSignals[0].confidence * 100).toFixed(0)}% confidence)`);
  }
  console.log(`  Total tokens: ${extraction.tokens.colors.length + extraction.tokens.typography.length + extraction.tokens.radii.length + extraction.tokens.shadows.length}`);
  console.log(`  Risks: ${extraction.risks.length}`);
  console.log('');

  return {
    report,
    prompt,
    outputDir,
  };
}

// ============================================================================
// CLI Support
// ============================================================================

export { ExtractorInput, ExtractorConfig, ExtractorOutput, ThemeReport };
