#!/usr/bin/env node
/**
 * Theme Intelligence Extractor - CLI
 * Command-line interface for the theme extractor
 */

import { runExtractor, ExtractorInput } from './index.js';

// ============================================================================
// Argument Parsing
// ============================================================================

interface CLIArgs {
  url?: string;
  maxPages?: number;
  sameOriginOnly?: boolean;
  includeAssets?: boolean;
  mode?: 'extract' | 'prompt' | 'both';
  notes?: string;
  help?: boolean;
}

function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--url' || arg === '-u') {
      result.url = args[++i];
    } else if (arg === '--maxPages' || arg === '-p') {
      result.maxPages = parseInt(args[++i], 10);
    } else if (arg === '--sameOriginOnly') {
      const val = args[++i]?.toLowerCase();
      result.sameOriginOnly = val === 'true' || val === '1';
    } else if (arg === '--includeAssets') {
      const val = args[++i]?.toLowerCase();
      result.includeAssets = val === 'true' || val === '1';
    } else if (arg === '--mode' || arg === '-m') {
      const val = args[++i] as CLIArgs['mode'];
      if (['extract', 'prompt', 'both'].includes(val)) {
        result.mode = val;
      }
    } else if (arg === '--notes' || arg === '-n') {
      result.notes = args[++i];
    } else if (!arg.startsWith('-') && !result.url) {
      // Positional argument - treat as URL
      result.url = arg;
    }
  }

  return result;
}

// ============================================================================
// Help Text
// ============================================================================

function printHelp(): void {
  console.log(`
Theme Intelligence Extractor v1.0.0
===================================

Extracts design tokens, tech stack signals, and component patterns from any
website, then generates comprehensive design system documentation.

USAGE:
  npx ts-node cli.ts --url <URL> [OPTIONS]
  npx ts-node cli.ts <URL> [OPTIONS]

OPTIONS:
  --url, -u <URL>         Target URL to analyze (required)
  --maxPages, -p <N>      Maximum pages to crawl (default: 6, max: 20)
  --sameOriginOnly <bool> Only crawl same-origin links (default: true)
  --includeAssets <bool>  Fetch external CSS files (default: false)
  --mode, -m <mode>       Output mode: extract | prompt | both (default: both)
  --notes, -n <text>      Additional context about your codebase
  --help, -h              Show this help message

EXAMPLES:
  # Basic extraction
  npx ts-node cli.ts --url https://example.com

  # Full extraction with CSS files
  npx ts-node cli.ts -u https://example.com --includeAssets true -p 10

  # Generate only the design system doc
  npx ts-node cli.ts https://example.com --mode prompt

  # With codebase context
  npx ts-node cli.ts -u https://example.com -n "Next.js 14 with shadcn/ui"

OUTPUT:
  Outputs are written to: ./out/theme_intel_prompt/<timestamp>/
    - theme_report.json   Structured extraction data with confidence scores
    - design_system.md    Comprehensive design system documentation

NOTES:
  - This tool only analyzes publicly accessible HTML/CSS/JS
  - It does NOT download paid themes or bypass paywalls
  - robots.txt is checked (best-effort) before crawling
  - Rate limiting is applied to avoid overloading servers
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.url) {
    console.error('Error: --url is required\n');
    console.error('Usage: npx ts-node cli.ts --url <URL>');
    console.error('Run with --help for more information.');
    process.exit(1);
  }

  const input: ExtractorInput = {
    themeUrl: args.url,
    maxPages: args.maxPages,
    sameOriginOnly: args.sameOriginOnly,
    includeAssets: args.includeAssets,
    mode: args.mode,
    notes: args.notes,
  };

  try {
    const output = await runExtractor(input);

    // Print final summary
    console.log('Files generated:');
    if (input.mode === 'extract' || input.mode === 'both' || !input.mode) {
      console.log(`  📄 ${output.outputDir}/theme_report.json`);
    }
    if (input.mode === 'prompt' || input.mode === 'both' || !input.mode) {
      console.log(`  📝 ${output.outputDir}/design_system.md`);
    }

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
