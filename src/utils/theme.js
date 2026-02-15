/**
 * Shared theme constants and base styles for Ektachrome components
 * 
 * Provides consistent colors, fonts, and reusable CSS for all
 * Web Components in the design system inspector.
 */

export const THEME = {
  // Font stacks
  fontMono: "'SF Mono', 'Monaco', 'Consolas', monospace",
  fontSystem: "-apple-system, 'SF Pro', system-ui, sans-serif",
  
  // Text colors (light text on dark background)
  colorText: 'rgba(232, 228, 222, 0.9)',
  colorTextMuted: 'rgba(232, 228, 222, 0.7)',
  colorTextFaint: 'rgba(232, 228, 222, 0.4)',
  
  // Interactive colors
  colorActive: 'rgba(120, 200, 150, 0.3)',
  colorActiveText: 'rgba(120, 200, 150, 0.9)',
  colorWarning: 'rgba(255, 180, 80, 0.8)',
  
  // Background colors
  colorBgPopup: 'rgba(28, 28, 30, 0.95)',
  colorBgHover: 'rgba(255, 255, 255, 0.15)',
  colorBgSubtle: 'rgba(255, 255, 255, 0.08)',
  colorBgActive: 'rgba(255, 255, 255, 0.06)',
  
  // Border colors
  colorBorder: 'rgba(255, 255, 255, 0.1)',
  colorBorderSubtle: 'rgba(255, 255, 255, 0.06)',
  
  // Sizes
  radiusSm: '2px',
  radiusMd: '4px',
  radiusLg: '8px',
  
  // Font sizes
  fontSizeXs: '8px',
  fontSizeSm: '9px',
  fontSizeMd: '10px',
  fontSizeLg: '11px',
  fontSizeXl: '12px',
};

/**
 * Base styles that can be included in any component
 */
export const baseStyles = `
  /* Reset & Box sizing */
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  /* Common label style */
  .ek-label {
    font-family: ${THEME.fontMono};
    font-size: ${THEME.fontSizeLg};
    color: ${THEME.colorTextMuted};
  }
  
  .ek-label-sm {
    font-family: ${THEME.fontMono};
    font-size: ${THEME.fontSizeSm};
    color: ${THEME.colorTextFaint};
  }
  
  /* Common value display */
  .ek-value {
    font-family: ${THEME.fontMono};
    font-size: ${THEME.fontSizeSm};
    color: ${THEME.colorTextFaint};
  }
  
  /* Interactive element base */
  .ek-interactive {
    background: ${THEME.colorBgSubtle};
    border: none;
    border-radius: ${THEME.radiusSm};
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  
  .ek-interactive:hover {
    background: ${THEME.colorBgHover};
  }
  
  .ek-interactive.active {
    background: ${THEME.colorActive};
    color: ${THEME.colorText};
  }
  
  /* Badge/pill style */
  .ek-badge {
    font-size: ${THEME.fontSizeSm};
    color: ${THEME.colorTextFaint};
    background: ${THEME.colorBgActive};
    padding: 1px 6px;
    border-radius: 8px;
  }
  
  /* Warning text */
  .ek-warning {
    font-size: ${THEME.fontSizeSm};
    color: ${THEME.colorWarning};
  }
`;

/**
 * Generate CSS custom properties from theme for use in components
 */
export function themeToCustomProperties() {
  return Object.entries(THEME)
    .map(([key, value]) => `--ek-${kebabCase(key)}: ${value};`)
    .join('\n');
}

/**
 * Convert camelCase to kebab-case
 */
function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
