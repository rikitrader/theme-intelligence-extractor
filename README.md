# Theme Intelligence Extractor

<p align="center">
  <img src="assets/logo.svg" alt="Theme Intelligence Extractor Logo" width="200">
</p>

<p align="center">
  <strong>Extract design systems from any website with AI-powered analysis</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#output">Output</a> •
  <a href="#api">API</a>
</p>

---

## Overview

**Theme Intelligence Extractor** is a Claude Code skill that analyzes any publicly accessible website and extracts its complete design system. It crawls pages, parses HTML/CSS, detects tech stacks, and generates comprehensive documentation of colors, typography, spacing, components, and more.

Perfect for:
- 🎨 **Designers** — Document existing design systems
- 💻 **Developers** — Understand a codebase's styling before contributing
- 🔄 **Migrations** — Extract tokens before refactoring to a new framework
- 📚 **Documentation** — Auto-generate design system docs from live sites
- 🔍 **Research** — Analyze competitors' design patterns

---

## Features

### 🔍 Tech Stack Detection

Automatically identifies frameworks and libraries with confidence scores:

| Category | Detected Technologies |
|----------|----------------------|
| **Frameworks** | Next.js, React, Vue, Nuxt, Svelte |
| **CSS Frameworks** | Tailwind CSS, Bootstrap |
| **UI Libraries** | shadcn/ui, Material UI, Chakra UI |
| **Build Tools** | Vite, Webpack |

### 🎨 Design Token Extraction

Extracts all CSS custom properties and design tokens:

- **Colors** — Full palette with usage categories (background, foreground, primary, accent, border)
- **Typography** — Font families, type scale (h1-h6), body text settings
- **Spacing** — Margin/padding patterns, spacing scale
- **Border Radius** — All radius tokens
- **Shadows** — Box-shadow definitions
- **Custom Properties** — Complete `:root` variable extraction

### 🧩 Component Pattern Detection

Identifies UI component patterns with state analysis:

- Buttons, Cards, Navigation, Heroes, Forms, Inputs, Modals
- Hover, Focus, and Active state detection
- Class naming pattern extraction

### ♿ Accessibility Analysis

Evaluates accessibility implementation:

- Skip link presence
- Focus-visible styling
- ARIA attribute usage
- Semantic HTML (nav, main, header, footer)
- Image alt text coverage

### 📐 Layout Information

Documents layout architecture:

- Grid system type (CSS Grid, Flexbox, Bootstrap)
- Responsive breakpoints
- Container max-widths

### 📊 Confidence Scoring

Every extracted value includes:

```json
{
  "value": "#000000",
  "sourceType": "css",
  "sourceUrl": "https://example.com/styles.css",
  "sampleSnippet": "--color-black: #000000;",
  "confidence": 0.95
}
```

---

## Installation

### As a Claude Code Skill

```bash
# Clone or unzip to your skills directory
unzip theme-intelligence-extractor.zip -d ~/.claude/skills/

# Or clone from repository
git clone https://github.com/YOUR_USERNAME/theme-intelligence-extractor.git ~/.claude/skills/theme-intelligence-extractor
```

Skills are automatically loaded when Claude Code starts.

### Standalone CLI

```bash
cd ~/.claude/skills/theme-intelligence-extractor/scripts

# Install dependencies
npm install typescript @types/node

# Compile TypeScript
npx tsc

# Run
node cli.js --url https://example.com
```

---

## Usage

### Within Claude Code

Simply ask Claude to analyze a URL:

```
Analyze the design system at https://ui.shadcn.com
```

```
Extract design tokens from https://tailwindui.com
```

```
Document the styling of https://stripe.com
```

### CLI Options

```bash
node cli.js --url <URL> [OPTIONS]
```

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--url` | `-u` | Target URL to analyze (required) | — |
| `--maxPages` | `-p` | Maximum pages to crawl | `6` |
| `--sameOriginOnly` | — | Only crawl same-origin links | `true` |
| `--includeAssets` | — | Fetch external CSS files | `false` |
| `--mode` | `-m` | Output: `extract`, `prompt`, or `both` | `both` |
| `--notes` | `-n` | Context about target codebase | — |
| `--help` | `-h` | Show help | — |

### Examples

```bash
# Basic extraction
node cli.js --url https://ui.shadcn.com

# Full extraction with external CSS files
node cli.js -u https://vercel.com --includeAssets true -p 10

# Only generate design system documentation
node cli.js https://linear.app --mode prompt

# With codebase context for better recommendations
node cli.js -u https://example.com -n "Next.js 14 app with Tailwind"
```

---

## Output

Outputs are saved to `./out/theme_intel_prompt/<timestamp>/`

### 1. `theme_report.json`

Structured JSON with all extracted data and confidence scores:

```json
{
  "meta": {
    "version": "1.0.0",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "sourceUrl": "https://example.com",
    "pagesCrawled": 6,
    "crawlDuration": 12500,
    "robotsTxtStatus": "allowed"
  },
  "stackSignals": [
    {
      "name": "Next.js",
      "category": "framework",
      "confidence": 0.95,
      "evidence": ["__NEXT_DATA__ script", "/_next/ assets"]
    }
  ],
  "tokens": {
    "colors": [...],
    "typography": [...],
    "radii": [...],
    "shadows": [...]
  },
  "componentPatterns": [...],
  "accessibilitySignals": [...],
  "layout": {...}
}
```

### 2. `design_system.md`

Comprehensive markdown documentation:

```markdown
# Design System Documentation

> **Source**: https://example.com
> **Extracted**: 2024-01-15T10:30:00.000Z
> **Pages Analyzed**: 6

## 1. Tech Stack
| Technology | Category | Confidence | Evidence |
|------------|----------|------------|----------|
| Next.js | framework | 95% | __NEXT_DATA__, /_next/ |

## 2. Color Palette
:root {
  --background: #ffffff;
  --foreground: #000000;
  --primary: #0070f3;
}

## 3. Typography
1. `Inter, -apple-system, sans-serif`
2. `Georgia, serif`

... (12 sections total)
```

---

## API

### TypeScript Interface

```typescript
interface ExtractorInput {
  themeUrl: string;           // Required: URL to analyze
  maxPages?: number;          // Default: 6 (max: 20)
  sameOriginOnly?: boolean;   // Default: true
  includeAssets?: boolean;    // Default: false
  mode?: 'extract' | 'prompt' | 'both';  // Default: 'both'
  notes?: string;             // Optional context
}

interface ExtractorOutput {
  report: ThemeReport;        // Structured data
  prompt: string;             // Markdown documentation
  outputDir: string;          // Path to output files
}
```

### Programmatic Usage

```typescript
import { runExtractor } from './index.js';

const output = await runExtractor({
  themeUrl: 'https://example.com',
  maxPages: 10,
  includeAssets: true,
  mode: 'both'
});

console.log(output.report.stackSignals);
console.log(output.outputDir);
```

---

## Architecture

```
theme-intelligence-extractor/
├── SKILL.md                 # Claude Code skill definition
├── README.md                # This file
├── scripts/
│   ├── types.ts             # TypeScript type definitions
│   ├── crawler.ts           # URL crawler with rate limiting
│   │   ├── fetchWithRetry() # Exponential backoff
│   │   ├── extractLinks()   # HTML link parsing
│   │   └── checkRobotsTxt() # robots.txt compliance
│   ├── extract.ts           # Design token extraction
│   │   ├── detectStack()    # Framework detection
│   │   ├── extractColors()  # Color token extraction
│   │   ├── extractTypography()
│   │   └── detectComponentPatterns()
│   ├── format.ts            # Output formatters
│   │   ├── generateThemeReport()  # JSON output
│   │   └── generateIntegrationPrompt()  # Markdown output
│   ├── index.ts             # Main orchestrator
│   ├── cli.ts               # Command-line interface
│   ├── package.json
│   └── tsconfig.json
└── assets/
    └── logo.svg             # Project logo
```

---

## How It Works

### 1. Crawling Phase

```
┌─────────────────────────────────────────────────────────┐
│  1. Check robots.txt (best-effort compliance)           │
│  2. Fetch initial URL                                   │
│  3. Extract internal links (<a href>)                   │
│  4. BFS crawl up to maxPages                           │
│  5. Collect CSS links (<link rel="stylesheet">)        │
│  6. Optionally fetch external CSS files                 │
│  7. Rate limit: 500ms between requests                  │
│  8. Retry with exponential backoff on 429/5xx          │
└─────────────────────────────────────────────────────────┘
```

### 2. Extraction Phase

```
┌─────────────────────────────────────────────────────────┐
│  For each page/CSS file:                                │
│  ├── Detect tech stack (17 pattern matchers)           │
│  ├── Extract CSS variables (:root { --* })             │
│  ├── Parse color values (hex, rgb, hsl)                │
│  ├── Extract font-family declarations                   │
│  ├── Find border-radius tokens                          │
│  ├── Find box-shadow tokens                             │
│  ├── Detect component class patterns                    │
│  ├── Analyze accessibility features                     │
│  └── Extract layout/breakpoint info                     │
└─────────────────────────────────────────────────────────┘
```

### 3. Output Phase

```
┌─────────────────────────────────────────────────────────┐
│  1. Deduplicate tokens                                  │
│  2. Calculate confidence scores                         │
│  3. Generate theme_report.json                          │
│  4. Generate design_system.md                           │
│  5. Write to ./out/theme_intel_prompt/<timestamp>/     │
└─────────────────────────────────────────────────────────┘
```

---

## Limitations

| Limitation | Workaround |
|------------|------------|
| Cannot execute JavaScript | Use `--includeAssets true` to fetch CSS files |
| Minified CSS reduces accuracy | Check `theme_report.json` confidence scores |
| CSS-in-JS not fully supported | Works best with CSS files/variables |
| Rate limited (500ms/request) | Increase `--maxPages` for more coverage |
| Same-origin default | Set `--sameOriginOnly false` for CDN assets |

---

## Troubleshooting

### No tokens extracted

```bash
# 1. Enable external CSS fetching
node cli.js -u https://example.com --includeAssets true

# 2. Increase page coverage
node cli.js -u https://example.com -p 15

# 3. Check if site uses CSS-in-JS (harder to extract)
```

### Low confidence scores

- Site may use non-standard naming conventions
- CSS may be heavily minified
- Manually inspect via browser DevTools

### robots.txt warning

The tool respects robots.txt best-effort but continues crawling. Results may be incomplete for blocked sites.

---

## Security & Ethics

- ✅ **Public content only** — Only analyzes publicly accessible HTML/CSS/JS
- ✅ **No paywall bypass** — Does not download paid themes or protected content
- ✅ **Rate limited** — 500ms delays prevent server overload
- ✅ **robots.txt respect** — Warns when crawling is disallowed
- ✅ **No code execution** — Static analysis only, no JS execution

---

## License

MIT License — See [LICENSE](LICENSE) for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## Changelog

### v1.0.0 (2024)
- Initial release
- Tech stack detection (17 frameworks/libraries)
- Design token extraction (colors, typography, radii, shadows)
- Component pattern detection
- Accessibility analysis
- Markdown documentation generation
- CLI interface

---

<p align="center">
  Built with ❤️ for the design systems community
</p>
