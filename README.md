# Ektachrome

A design system refinement tool with live visual feedback. Select any element in a running app, see which design tokens control it, and adjust them with constrained controls that enforce design system consistency — all with instant, live updates across the entire app.

## Vision

Most design tools let you change any CSS property to any value. Ektachrome is different: it helps you **build, audit, and refine a design system** through direct manipulation. Every adjustment happens within structured constraints — spacing on a grid, colors mapped to tokens, typography on a scale — so the result is always a coherent system, not a collection of one-off overrides.

## How It Works

### Two Phases

#### Phase 1: Audit & Setup (Claude-assisted, run once per app)

Before live editing, Ektachrome scans the app's stylesheets and uses Claude to understand the current state of the design system:

1. **Scan**: Collect all CSS custom properties, raw color values, spacing values, font sizes, and border radii from all stylesheets
2. **Analyze**: Claude identifies which values map to tokens, which are hardcoded, and where inconsistencies exist
3. **Report**: Generate a design system audit showing:
   - How many color tokens exist vs. hardcoded colors
   - Whether spacing follows a consistent grid (4px, 8px, etc.)
   - How many typography scale stops are defined
   - Border radius consistency
4. **Propose**: Claude suggests a variable mapping to clean up inconsistencies (e.g., "Map `#3b82f6` to `--color-primary`")
5. **Apply**: User approves, Claude Code applies the refactor to source files
6. **Cache**: Build a `variableMap` that maps every computed style value back to its source token for instant lookups during refinement

#### Phase 2: Live Refinement (zero latency, no model needed)

Once the design system is clean:

1. **Select**: Click any element in the running app. An element picker highlights it and identifies it (tag, classes, React components, CSS path)
2. **Inspect**: A toolbar popup shows which design tokens control the selected element's visual properties
3. **Adjust**: Constrained controls let you tune each property — colors via OKLCH pickers (mapped to tokens), spacing via stepped grid controls, typography and radii via named scale pickers
4. **Live update**: Every adjustment immediately calls `document.documentElement.style.setProperty()` on the CSS variable, so changes ripple across the entire app instantly
5. **Commit**: When satisfied, serialize the adjusted token values and write them back to source files via Claude Code

### Where Claude Sits

Claude is needed at three specific moments, not continuously:

| Moment | What Claude does | Latency |
|--------|-----------------|---------|
| **Audit** | Scan stylesheets, identify tokens, find inconsistencies | 10-30s (run once) |
| **Variable resolution** | When the pure JS scanner can't resolve which token controls an element | 2-3s (rare, per element) |
| **Commit** | Generate code changes to persist slider adjustments back to source | 5-10s (when done) |

The live slider interaction is **zero latency, zero model involvement**. It's pure CSS custom property manipulation.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Running App (any framework using CSS variables)         │
│                                                          │
│  1. User clicks element                                  │
│     → Element picker identifies it                       │
│     → Captures computed styles + CSS selectors            │
│                                                          │
│  2. Mini-toolbar appears: Color | Spacing | Type | ...   │
│     → User picks "Color"                                 │
│                                                          │
│  3. Variable map lookup (instant, cached from audit)     │
│     → Finds: --color-primary controls this element's bg  │
│     → Knows it's used in 47 other places                 │
│                                                          │
│  4. Dynamically generate constrained controls            │
│     → OKLCH picker bound to --color-primary              │
│     → Shows usage count and token name                   │
│                                                          │
│  5. User adjusts sliders → LIVE updates via              │
│     document.documentElement.style.setProperty(          │
│       '--color-primary', 'oklch(0.6 0.2 250)'          │
│     → Every element using this token updates instantly   │
│                                                          │
│  6. "Commit" → Claude writes new values to source        │
└──────────────────────────────────────────────────────────┘
```

### File Structure

```
ektachrome/
├── README.md                          # This file
├── src/
│   ├── controls/                      # Web Components (framework-agnostic)
│   │   ├── color-token-control.js     # OKLCH picker bound to design tokens
│   │   ├── spacing-step-control.js    # Stepped spacing grid control
│   │   ├── scale-picker.js            # Named scale picker (type, radii)
│   │   └── toolbar-popup.js           # The popup that appears on element select
│   ├── scanner/
│   │   ├── design-system-audit.js     # Stylesheet scanner for audit phase
│   │   ├── variable-map.js            # Cached token → computed value mapping
│   │   └── detect-css-vars.js         # Pure JS CSS variable detection
│   ├── picker/
│   │   └── element-picker.js          # Element selection and identification
│   └── bridge/
│       └── variable-discovery.js      # Claude API bridge for variable resolution
```

## Constrained Control Types

### Colors: Token Picker, Not Freeform

When you select an element and pick "Color", you see **which color token** this element uses and how many other elements share it. You adjust the token's OKLCH value, and it ripples everywhere.

- Shows token name (e.g., `--color-primary`)
- Shows usage count (e.g., "used 47×")
- Warns when changing high-usage tokens
- Uses OKLCH color space for perceptually uniform adjustments

### Spacing: Stepped Grid, Not Arbitrary

Instead of a continuous slider, spacing shows discrete steps on your grid:

- Base unit configurable (default: 4px)
- Scale: `0, 4, 8, 12, 16, 24, 32, 48, 64`
- Visual bar chart showing the scale with active step highlighted
- Maps to spacing tokens (e.g., `--space-4`, `--space-8`)

### Typography: Named Scale Picker

Pick from named stops, not arbitrary pixel values:

- `XS` (0.75rem) → `SM` (0.875rem) → `Base` (1rem) → `LG` (1.125rem) → `XL` (1.25rem) → `2XL` (1.5rem) → `3XL` (1.875rem)
- Rendered as a horizontal segmented control
- Maps to type tokens (e.g., `--text-sm`, `--text-lg`)

### Border Radius: Named Scale Picker

Same pattern as typography:

- `none` (0) → `sm` (2px) → `md` (4px) → `lg` (8px) → `xl` (12px) → `2xl` (16px) → `full` (9999px)
- Maps to radius tokens (e.g., `--radius-md`)

## Key Design Decisions

### Framework-Agnostic

All controls are Web Components using Shadow DOM. They work in any app — React, Svelte, plain HTML. The element picker is pure DOM manipulation. No framework dependency.

### Design System First

You can't change "this one button's color". You change `--color-primary`, which changes every element that uses it. This is a feature, not a limitation. It forces coherent design.

### No MCP Server Required

The Claude integration is a simple `fetch` to the Anthropic API. No server infrastructure, no MCP protocol. Just a single API call for audit and a single call for variable resolution when needed.

### Builds on Kodachrome

The OKLCH picker and slider Web Components from [Kodachrome](https://github.com/MaggieAppleton/kodachrome) are the foundation. Ektachrome extends them with token awareness and constrained scales.

### Borrows from Agentation

The element selection pattern (click-to-select, hover highlights, element identification via class names/IDs/text content, CSS path generation) is adapted from [Agentation](https://github.com/benjitaylor/agentation), ported to be framework-agnostic.

## Build Plan

### Milestone 1: Element Picker + Variable Scanner
- [ ] Port Agentation's element selection to vanilla JS
- [ ] Build the CSS variable scanner (pure JS, no Claude)
- [ ] Element highlight overlay on hover
- [ ] Click to select → show element info

### Milestone 2: Constrained Controls
- [ ] `<color-token-control>` — OKLCH picker with token name + usage count
- [ ] `<spacing-step-control>` — stepped grid with visual bar chart
- [ ] `<scale-picker>` — horizontal segmented control for type sizes and radii
- [ ] `<toolbar-popup>` — container that appears on element select

### Milestone 3: Live Binding
- [ ] Wire controls to `document.documentElement.style.setProperty()`
- [ ] Build the variable map (computed value → token resolution)
- [ ] Dynamic control generation based on element's resolved tokens
- [ ] Test with a real app using CSS custom properties

### Milestone 4: Audit Phase
- [ ] Stylesheet scanner collects all values
- [ ] Claude API integration for design system analysis
- [ ] Audit report UI showing system health
- [ ] Variable map generation and caching

### Milestone 5: Commit Phase
- [ ] Serialize adjusted values
- [ ] Claude Code integration to write values back to source
- [ ] Before/after diff preview

## Prior Art

- **[Kodachrome](https://github.com/MaggieAppleton/kodachrome)** — Live control panel with OKLCH pickers and sliders. Ektachrome inherits the Web Component architecture and control-change event pattern.
- **[Agentation](https://github.com/benjitaylor/agentation)** — Visual feedback tool for AI agents. Ektachrome borrows the element picker, identification, and CSS path generation patterns.