---
name: theme-intelligence-extractor
description: This skill should be used when the user wants to extract design tokens, tech stack signals, and component patterns from any website URL. It produces a comprehensive markdown documentation of the extracted design system. Use this skill when users ask to analyze a theme, extract design tokens from a URL, document a website design system, or reverse-engineer a sites styling.
---

# Theme Intelligence Extractor

Extract design tokens, tech stack signals, and component patterns from any website URL and generate comprehensive design system documentation.

## Purpose

This skill analyzes publicly accessible websites to extract:
- **Tech stack signals** — Next.js, React, Vue, Tailwind, shadcn/ui, Bootstrap, etc.
- **Design tokens** — Colors, typography, spacing, radii, shadows (as CSS variables)
- **Component patterns** — Buttons, cards, navigation, forms with state detection
- **Accessibility signals** — Skip links, focus styling, ARIA usage, semantic HTML
- **Layout information** — Grid systems, breakpoints, container widths

It produces two outputs:
1. **`theme_report.json`** — Structured extraction data with confidence scores
2. **`design_system.md`** — Comprehensive design system documentation

**Important**: This skill does NOT download paid themes or bypass paywalls. It only analyzes publicly accessible HTML/CSS/JS.

## When to Use

- User provides a URL and wants to understand its design system
- User wants to extract design tokens from a live website
- User needs to document a website's design system
- User asks to "analyze", "extract", or "reverse-engineer" a theme

## Usage

### Running the Extractor

To extract design tokens from a URL, run the TypeScript CLI:

```bash
cd ~/.claude/skills/theme-intelligence-extractor/scripts

# Install dependencies (first time only)
npm install typescript @types/node

# Compile TypeScript
npx tsc

# Run extraction
node cli.js --url https://example.com
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url, -u` | Target URL to analyze (required) | — |
| `--maxPages, -p` | Maximum pages to crawl | 6 |
| `--sameOriginOnly` | Only crawl same-origin links | true |
| `--includeAssets` | Fetch external CSS files | false |
| `--mode, -m` | Output: `extract`, `prompt`, or `both` | both |
| `--notes, -n` | Additional context about target codebase | — |

### Examples

```bash
# Basic extraction
node cli.js --url https://ui.shadcn.com

# Full extraction with CSS files (more complete token detection)
node cli.js -u https://example.com --includeAssets true -p 10

# Generate only the design system doc
node cli.js https://example.com --mode prompt

# With codebase context
node cli.js -u https://example.com -n "Next.js 14 with Tailwind and shadcn/ui"
```

### Output Location

Outputs are written to:
```
./out/theme_intel_prompt/<timestamp>/
├── theme_report.json      # Structured extraction data
└── design_system.md       # Design system documentation
```

## Output: Design System Documentation

The generated `design_system.md` includes:

1. **Tech Stack** — Detected frameworks with confidence scores
2. **Color Palette** — All CSS color tokens with usage categories
3. **Typography** — Font families, type scale, body text settings
4. **Spacing & Layout** — Grid system, breakpoints, container widths
5. **Border Radius** — All radius tokens
6. **Shadows** — All shadow definitions
7. **CSS Custom Properties** — Complete list of extracted variables
8. **Component Patterns** — Detected components with class names and states
9. **Accessibility** — Skip links, focus styles, ARIA usage, semantic HTML
10. **Risks & Notes** — Potential issues and observations
11. **Implementation Checklist** — Step-by-step integration guide
12. **Quick Start Code** — Ready-to-use CSS and Tailwind config

## Extraction Capabilities

### Tech Stack Detection
- **Frameworks**: Next.js, React, Vue, Nuxt, Svelte
- **CSS Frameworks**: Tailwind CSS, Bootstrap
- **UI Libraries**: shadcn/ui, Material UI, Chakra UI
- **Build Tools**: Vite, Webpack

### Token Extraction
- CSS custom properties (`:root { --color-*, --radius-*, etc. }`)
- Color values (hex, rgb, rgba, hsl)
- Font families and type scale
- Border-radius values
- Box-shadow definitions
- Spacing patterns (from media queries and layouts)

### Confidence Scoring
Every extracted value includes:
- `sourceType`: Where it was found (html, css, headers)
- `sourceUrl`: Which page/file contained it
- `sampleSnippet`: Code excerpt for verification
- `confidence`: 0–1 score based on pattern strength

## Limitations

- Cannot execute JavaScript (static HTML analysis only)
- Minified CSS may reduce extraction accuracy
- Dynamic/client-rendered content requires `includeAssets: true`
- Rate-limited to avoid server overload (500ms between requests)
- Respects robots.txt best-effort (warns if blocked but continues)

## Troubleshooting

**No tokens extracted:**
- Try `--includeAssets true` to fetch external CSS files
- Increase `--maxPages` to crawl more pages
- Check if site uses CSS-in-JS (harder to extract statically)

**Low confidence scores:**
- Site may use non-standard class naming
- CSS may be heavily minified
- Consider manually inspecting browser DevTools

**robots.txt warning:**
- Tool continues but may have incomplete data
- Results are best-effort from accessible content

## Files

```
theme-intelligence-extractor/
├── SKILL.md                           # This file
├── scripts/
│   ├── types.ts                       # TypeScript type definitions
│   ├── crawler.ts                     # URL crawler with rate limiting
│   ├── extract.ts                     # Token/stack extraction heuristics
│   ├── format.ts                      # Output generators (JSON + Markdown)
│   ├── index.ts                       # Main orchestrator
│   ├── cli.ts                         # Command-line interface
│   ├── package.json                   # Node.js package config
│   └── tsconfig.json                  # TypeScript config
└── references/                        # (empty - no target design system)
```
