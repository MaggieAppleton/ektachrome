# Ektachrome

Design system refinement tool with live visual feedback. Select elements, see which tokens control them, adjust with constrained controls.

## Usage Modes

### Basic Mode
Works in any project (React, Vue, Svelte, plain HTML). Import as ES module:
- Live editing via CSS custom properties
- Changes persist to localStorage
- "Copy CSS" button for manual export

### Enhanced Mode (Vite)
Add the Vite plugin for automatic write-back to source CSS files:
- Changes written directly to CSS source files
- Diff review before committing
- Full version control integration

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start dev server with write-back enabled
npm run dev

# Open test pages
open http://localhost:5173/test/validation-test.html  # Manual testing
open http://localhost:5173/test/unit-tests.html       # Automated tests
```

## Architecture

```
src/
├── index.js                    # Entry point, exports Ektachrome class
├── controls/                   # Web Components
│   ├── oklch-picker.js         # OKLCH color picker (L/C/H sliders)
│   ├── color-token-control.js  # Token-aware color control
│   ├── spacing-step-control.js # Stepped spacing grid
│   ├── scale-picker.js         # Typography/radius scale picker
│   ├── toolbar-popup.js        # Main popup UI, handles state persistence
│   └── commit-panel.js         # Pending changes UI for write-back
├── picker/
│   └── element-picker.js       # Click-to-select element picker
├── scanner/
│   ├── detect-css-vars.js      # Find CSS vars used by an element
│   ├── variable-map.js         # Build computed→token mapping
│   └── design-system-audit.js  # Full stylesheet audit
├── bridge/
│   └── variable-discovery.js   # Claude API fallback for var resolution
└── utils/
    ├── config.js               # Browser .env loader
    ├── color-conversion.js     # RGB↔OKLCH conversion
    ├── stylesheet-scanner.js   # Shared stylesheet iteration
    ├── property-categories.js  # Category matchers (color/spacing/type/radius)
    ├── theme.js                # Shared UI theme constants
    ├── claude-client.js        # Shared Claude API client
    └── state-persistence.js    # localStorage persistence + change tracking

server/                         # Vite plugin for write-back (Node.js)
├── vite-plugin.js              # HTTP middleware endpoints for commit
└── css-parser.js               # Parse and modify CSS files
```

## Key Patterns

### No Build Step
Pure ES modules. Import directly in browser.

### Web Components + Shadow DOM
All controls use Shadow DOM for style isolation. Framework-agnostic.

### CSS Variable Manipulation
Live updates via `document.documentElement.style.setProperty()`. Changes persist to localStorage and restore on reload.

### Error Handling
All modules use `console.warn('[module-name]', ...)` pattern.

### Async Race Conditions
`toolbar-popup.js` uses `_requestId` counter to invalidate stale Claude responses.

### Memory Management
Controls use `AbortController` in `connectedCallback`, clean up in `disconnectedCallback`.

## Claude Integration

Optional. Only used for:
1. **Audit** - Design system analysis
2. **Variable discovery** - Fallback when JS scanner fails

Set `ANTHROPIC_API_KEY` in `.env` file for Claude features.

## Write-Back (Vite Plugin)

Enable writing CSS variable changes directly to source files.

### Setup

```js
// vite.config.js
import { ektachromePlugin } from 'ektachrome/server/vite-plugin.js';

export default {
  plugins: [
    ektachromePlugin({
      include: ['src/**/*.css'],
      exclude: ['node_modules/**']
    })
  ]
}
```

### Endpoints

- `GET /__ektachrome/status` - Connection check
- `GET /__ektachrome/tokens` - Scan CSS files for variables
- `POST /__ektachrome/commit` - Write changes to CSS files

## Testing

- `test/unit-tests.html` - Automated browser tests for all utilities
- `test/validation-test.html` - Manual integration testing
- `test/manual-test.html` - Simple test page

## State Persistence

CSS variable changes auto-save to localStorage. Call `toolbar-popup.resetAll()` to clear.
