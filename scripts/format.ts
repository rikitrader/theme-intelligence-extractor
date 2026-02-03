/**
 * Theme Intelligence Extractor - Output Formatting Module
 * Generates theme_report.json and design_system.md
 */

import {
  CrawlSession,
  ExtractionResult,
  ThemeReport,
  ExtractorConfig,
} from './types.js';

// ============================================================================
// Theme Report Generation
// ============================================================================

export function generateThemeReport(
  session: CrawlSession,
  extraction: ExtractionResult,
  config: ExtractorConfig
): ThemeReport {
  // Generate recommended approach based on detected stack
  const primaryStack = extraction.stackSignals[0];
  let recommendedApproach = 'Standard CSS integration with design token centralization.';

  if (primaryStack) {
    if (primaryStack.name === 'Tailwind CSS') {
      recommendedApproach =
        'Extend Tailwind configuration with extracted tokens. Create custom utilities for component variants. Use @apply for reusable patterns.';
    } else if (primaryStack.name === 'shadcn/ui') {
      recommendedApproach =
        'Update CSS variables in globals.css. Extend component variants using CVA. Add custom primitives following shadcn/ui patterns.';
    } else if (primaryStack.name === 'Bootstrap') {
      recommendedApproach =
        'Override Bootstrap Sass variables. Create custom utility classes for design system extensions.';
    } else if (primaryStack.name === 'Next.js' || primaryStack.name === 'React') {
      recommendedApproach =
        'Centralize tokens in CSS variables or theme configuration. Create reusable component primitives. Use CSS Modules or styled-components for scoped styling.';
    }
  }

  return {
    meta: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      sourceUrl: config.themeUrl,
      pagesCrawled: session.pages.length,
      crawlDuration: session.crawlDuration,
      robotsTxtStatus: session.robotsTxtStatus,
    },
    stackSignals: extraction.stackSignals,
    tokens: {
      colors: extraction.tokens.colors,
      typography: extraction.tokens.typography,
      spacing: extraction.tokens.spacing,
      radii: extraction.tokens.radii,
      shadows: extraction.tokens.shadows,
      customProperties: extraction.tokens.customProperties,
    },
    typographySummary: {
      primaryFonts: extraction.typographyScale.fontFamilies
        .slice(0, 5)
        .map((f) => f.value),
      headingScale: extraction.typographyScale.headings.map((h) => ({
        tag: h.tag,
        size: h.fontSize,
      })),
      bodySize: extraction.typographyScale.bodyText?.fontSize,
    },
    componentPatterns: extraction.componentPatterns.map((p) => ({
      name: p.name,
      type: p.type,
      classes: p.classPatterns,
      states: [
        p.hasHoverState && 'hover',
        p.hasFocusState && 'focus',
        p.hasActiveState && 'active',
      ].filter(Boolean) as string[],
    })),
    accessibilitySignals: extraction.accessibilitySignals.map((s) => ({
      feature: s.feature,
      present: s.present,
      details: s.details,
    })),
    layout: {
      containerWidths: extraction.layout.containerWidths.map((c) => c.value),
      breakpoints: extraction.layout.breakpoints.map((b) => b.value),
      gridSystem: extraction.layout.gridSystem,
    },
    risks: extraction.risks,
    notes: extraction.notes,
    recommendedApproach,
  };
}

// ============================================================================
// Design System Documentation Generation
// ============================================================================

export function generateIntegrationPrompt(
  report: ThemeReport,
  config: ExtractorConfig
): string {
  // Stack summary
  const stackSummary = report.stackSignals.length > 0
    ? report.stackSignals
        .map((s) => `| ${s.name} | ${s.category} | ${(s.confidence * 100).toFixed(0)}% | ${s.evidence.slice(0, 2).join(', ')} |`)
        .join('\n')
    : '| No frameworks detected | - | - | - |';

  // All color tokens
  const allColorTokens = report.tokens.colors.length > 0
    ? report.tokens.colors
        .map((c) => `  ${c.name}: ${c.value};${c.usage !== 'unknown' ? ` /* ${c.usage} */` : ''}`)
        .join('\n')
    : '  /* No color tokens detected */';

  // All custom properties
  const allCustomProps = report.tokens.customProperties.length > 0
    ? report.tokens.customProperties
        .slice(0, 50)
        .map((p) => `  ${p.value}`)
        .join('\n')
    : '  /* No custom properties detected */';

  // Font families detailed
  const fontFamiliesDetailed = report.typographySummary.primaryFonts.length > 0
    ? report.typographySummary.primaryFonts
        .map((f, i) => `${i + 1}. \`${f}\``)
        .join('\n')
    : '- No font families detected';

  // Typography scale
  const typographyScale = report.typographySummary.headingScale.length > 0
    ? report.typographySummary.headingScale
        .map((h) => `| ${h.tag} | ${h.size || 'Not specified'} |`)
        .join('\n')
    : '| - | No heading styles detected |';

  // Border radii
  const borderRadii = report.tokens.radii.length > 0
    ? report.tokens.radii
        .map((r) => `| \`${r.name}\` | \`${r.value}\` |`)
        .join('\n')
    : '| - | No border-radius tokens detected |';

  // Shadows
  const shadows = report.tokens.shadows.length > 0
    ? report.tokens.shadows
        .map((s) => `| \`${s.name}\` | \`${s.value.length > 60 ? s.value.slice(0, 60) + '...' : s.value}\` |`)
        .join('\n')
    : '| - | No shadow tokens detected |';

  // Component patterns detailed
  const componentPatterns = report.componentPatterns.length > 0
    ? report.componentPatterns
        .map((p) => `### ${p.name.charAt(0).toUpperCase() + p.name.slice(1)}
- **Type**: ${p.type}
- **Classes**: \`${p.classes.join('`, `')}\`
- **States**: ${p.states.length > 0 ? p.states.join(', ') : 'No state variants detected'}`)
        .join('\n\n')
    : 'No component patterns detected.';

  // Accessibility signals
  const a11ySignals = report.accessibilitySignals
    .map((s) => `| ${s.feature} | ${s.present ? '✅ Yes' : '❌ No'} | ${s.details || '-'} |`)
    .join('\n');

  // Layout info
  const breakpointsList = report.layout.breakpoints.length > 0
    ? report.layout.breakpoints.map((b) => `- \`${b}\``).join('\n')
    : '- No breakpoints detected';

  const containerWidthsList = report.layout.containerWidths.length > 0
    ? report.layout.containerWidths.map((c) => `- \`${c}\``).join('\n')
    : '- No container widths detected';

  // Risks and notes
  const risksSection = report.risks.length > 0
    ? report.risks.map((r) => `- ⚠️ ${r}`).join('\n')
    : '- No significant risks identified';

  const notesSection = report.notes.length > 0
    ? report.notes.map((n) => `- ${n}`).join('\n')
    : '- No additional notes';

  const userNotes = config.notes ? `\n### User Context\n${config.notes}\n` : '';

  return `# Design System Documentation

> **Source**: ${report.meta.sourceUrl}
> **Extracted**: ${report.meta.generatedAt}
> **Pages Analyzed**: ${report.meta.pagesCrawled}
> **Crawl Duration**: ${(report.meta.crawlDuration / 1000).toFixed(1)}s

---

## 1. Tech Stack

| Technology | Category | Confidence | Evidence |
|------------|----------|------------|----------|
${stackSummary}

**Recommended Integration Approach**: ${report.recommendedApproach}

---

## 2. Color Palette

### CSS Custom Properties (${report.tokens.colors.length} colors detected)

\`\`\`css
:root {
${allColorTokens}
}
\`\`\`

### Color Usage Summary

| Usage | Count |
|-------|-------|
| Background | ${report.tokens.colors.filter(c => c.usage === 'background').length} |
| Foreground/Text | ${report.tokens.colors.filter(c => c.usage === 'foreground').length} |
| Primary | ${report.tokens.colors.filter(c => c.usage === 'primary').length} |
| Secondary | ${report.tokens.colors.filter(c => c.usage === 'secondary').length} |
| Accent | ${report.tokens.colors.filter(c => c.usage === 'accent').length} |
| Border | ${report.tokens.colors.filter(c => c.usage === 'border').length} |
| Other | ${report.tokens.colors.filter(c => c.usage === 'unknown').length} |

---

## 3. Typography

### Font Families

${fontFamiliesDetailed}

### Type Scale

| Element | Size |
|---------|------|
${typographyScale}

### Body Text
- **Font Size**: ${report.typographySummary.bodySize || 'Not detected'}

---

## 4. Spacing & Layout

### Grid System
- **Type**: ${report.layout.gridSystem || 'Unknown'}

### Breakpoints
${breakpointsList}

### Container Widths
${containerWidthsList}

---

## 5. Border Radius

| Token | Value |
|-------|-------|
${borderRadii}

---

## 6. Shadows

| Token | Value |
|-------|-------|
${shadows}

---

## 7. All CSS Custom Properties

\`\`\`css
:root {
${allCustomProps}
}
\`\`\`

${report.tokens.customProperties.length > 50 ? `\n*Showing first 50 of ${report.tokens.customProperties.length} properties. See theme_report.json for complete list.*\n` : ''}

---

## 8. Component Patterns

${componentPatterns}

---

## 9. Accessibility

| Feature | Present | Details |
|---------|---------|---------|
${a11ySignals}

---

## 10. Risks & Considerations

${risksSection}

### Notes
${notesSection}
${userNotes}

---

## 11. Implementation Checklist

Use this checklist when integrating this design system:

### Token Setup
- [ ] Import color tokens into your styling system
- [ ] Configure typography (font families, scale)
- [ ] Set up spacing/layout tokens
- [ ] Configure border-radius values
- [ ] Add shadow definitions

### Component Migration
- [ ] Identify components to update
- [ ] Apply color tokens to backgrounds, text, borders
- [ ] Update typography styles
- [ ] Apply spacing tokens
- [ ] Update border-radius values
- [ ] Add shadow effects where appropriate

### Quality Checks
- [ ] Verify color contrast meets accessibility standards
- [ ] Test responsive breakpoints
- [ ] Validate component states (hover, focus, active)
- [ ] Check keyboard navigation
- [ ] Test across browsers

---

## 12. Quick Start Code

### CSS Variables Setup

\`\`\`css
/* tokens.css */
:root {
${allColorTokens}

  /* Typography */
${report.typographySummary.primaryFonts.length > 0 ? `  --font-primary: ${report.typographySummary.primaryFonts[0]};` : '  /* Add font families */'}
${report.typographySummary.bodySize ? `  --font-size-body: ${report.typographySummary.bodySize};` : ''}

  /* Border Radius */
${report.tokens.radii.slice(0, 5).map(r => `  ${r.name}: ${r.value};`).join('\n') || '  /* Add border-radius tokens */'}

  /* Shadows */
${report.tokens.shadows.slice(0, 3).map(s => `  ${s.name}: ${s.value};`).join('\n') || '  /* Add shadow tokens */'}
}
\`\`\`

### Tailwind Config (if using Tailwind)

\`\`\`javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
${report.tokens.colors.slice(0, 10).map(c => `        '${c.name.replace(/^--/, '').replace(/[^a-zA-Z0-9]/g, '-')}': '${c.value}',`).join('\n') || '        // Add extracted colors'}
      },
      fontFamily: {
${report.typographySummary.primaryFonts.length > 0 ? `        'primary': [${report.typographySummary.primaryFonts.map(f => `'${f.split(',')[0].trim()}'`).join(', ')}],` : '        // Add font families'}
      },
      borderRadius: {
${report.tokens.radii.slice(0, 5).map(r => `        '${r.name.replace(/^--/, '').replace(/[^a-zA-Z0-9]/g, '-')}': '${r.value}',`).join('\n') || '        // Add border-radius values'}
      },
    },
  },
}
\`\`\`

---

## Appendix: Source Information

- **URL Analyzed**: ${report.meta.sourceUrl}
- **Pages Crawled**: ${report.meta.pagesCrawled}
- **robots.txt Status**: ${report.meta.robotsTxtStatus}
- **Extractor Version**: ${report.meta.version}

For complete data with confidence scores and source references, see \`theme_report.json\`.

---

*Generated by Theme Intelligence Extractor — Analyzes publicly accessible HTML/CSS only.*
`;
}

// ============================================================================
// JSON Formatting
// ============================================================================

export function formatReportJSON(report: ThemeReport): string {
  return JSON.stringify(report, null, 2);
}
