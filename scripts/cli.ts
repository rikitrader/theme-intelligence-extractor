#!/usr/bin/env node
/**
 * Theme Intelligence Extractor - CLI
 * Command-line interface for the theme extractor
 *
 * ⚠️ PASSWORD PROTECTED - Requires authentication to run
 */

import { runExtractor, ExtractorInput } from './index.js';
import * as crypto from 'crypto';
import * as readline from 'readline';

// ============================================================================
// Authentication
// ============================================================================

// Password hash (SHA-256) - the actual password is not stored in code
const PASSWORD_HASH = 'cb457be0f71c4d409eeec0146f2baacc33da8f941cb9182680b58805c6b61cee';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string): boolean {
  return hashPassword(password) === PASSWORD_HASH;
}

async function promptPassword(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Hide password input
    process.stdout.write('🔐 Enter password to unlock: ');

    let password = '';
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (char: string) => {
      if (char === '\n' || char === '\r') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', onData);
        console.log('');
        rl.close();
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit(1);
      } else if (char === '\u007F' || char === '\b') {
        // Backspace
        password = password.slice(0, -1);
        process.stdout.clearLine?.(0);
        process.stdout.cursorTo?.(0);
        process.stdout.write('🔐 Enter password to unlock: ' + '*'.repeat(password.length));
      } else {
        password += char;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
}

async function authenticate(providedKey?: string): Promise<boolean> {
  // Check if key provided via argument
  if (providedKey) {
    if (verifyPassword(providedKey)) {
      return true;
    }
    console.error('❌ Invalid access key\n');
    return false;
  }

  // Check environment variable
  const envKey = process.env.THEME_EXTRACTOR_KEY;
  if (envKey) {
    if (verifyPassword(envKey)) {
      return true;
    }
    console.error('❌ Invalid THEME_EXTRACTOR_KEY\n');
    return false;
  }

  // Interactive prompt
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   THEME INTELLIGENCE EXTRACTOR v1.0    ║');
  console.log('║        🔒 PASSWORD PROTECTED 🔒         ║');
  console.log('╚════════════════════════════════════════╝\n');

  const password = await promptPassword();

  if (verifyPassword(password)) {
    console.log('✅ Access granted\n');
    return true;
  }

  console.error('❌ Access denied - incorrect password\n');
  return false;
}

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
  key?: string;
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
    } else if (arg === '--key' || arg === '-k') {
      result.key = args[++i];
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
🔒 PASSWORD PROTECTED

Extracts design tokens, tech stack signals, and component patterns from any
website, then generates comprehensive design system documentation.

AUTHENTICATION:
  This tool requires a password to run. Provide it via:
  1. --key argument: node cli.js --key YOUR_PASSWORD --url ...
  2. Environment variable: export THEME_EXTRACTOR_KEY=YOUR_PASSWORD
  3. Interactive prompt: will ask when you run the command

USAGE:
  node cli.js --url <URL> [OPTIONS]
  node cli.js <URL> [OPTIONS]

OPTIONS:
  --url, -u <URL>         Target URL to analyze (required)
  --key, -k <PASSWORD>    Access key/password
  --maxPages, -p <N>      Maximum pages to crawl (default: 6, max: 20)
  --sameOriginOnly <bool> Only crawl same-origin links (default: true)
  --includeAssets <bool>  Fetch external CSS files (default: false)
  --mode, -m <mode>       Output mode: extract | prompt | both (default: both)
  --notes, -n <text>      Additional context about your codebase
  --help, -h              Show this help message

EXAMPLES:
  # With password via argument
  node cli.js --key YOUR_PASSWORD --url https://example.com

  # With password via environment
  export THEME_EXTRACTOR_KEY=YOUR_PASSWORD
  node cli.js --url https://example.com

  # Interactive password prompt
  node cli.js --url https://example.com

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

  // Authenticate before proceeding
  const isAuthenticated = await authenticate(args.key);
  if (!isAuthenticated) {
    process.exit(1);
  }

  if (!args.url) {
    console.error('Error: --url is required\n');
    console.error('Usage: node cli.js --key PASSWORD --url <URL>');
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
