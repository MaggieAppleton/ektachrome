/**
 * Shared theme constants and base styles for Ektachrome components
 * 
 * Provides consistent colors, fonts, and reusable CSS for all
 * Web Components in the design system inspector.
 */

export const THEME = {
  // Font stacks (matching kodachrome)
  fontMono: "'SF Mono', 'Monaco', 'Inconsolata', monospace",
  fontSystem: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
  
  // Text colors (light text on dark background)
  colorText: '#e8e4de',
  colorTextMuted: 'rgba(232, 228, 222, 0.7)',
  colorTextFaint: 'rgba(232, 228, 222, 0.5)',
  colorTextDim: 'rgba(232, 228, 222, 0.4)',
  
  // Interactive colors
  colorActive: 'rgba(232, 228, 222, 0.9)',
  colorActiveText: 'rgba(232, 228, 222, 0.9)',
  colorWarning: 'rgba(255, 180, 80, 0.8)',
  colorDanger: '#ff6b6b',
  
  // Background colors (darker, matching kodachrome)
  colorBgPopup: 'rgba(14, 12, 16, 0.88)',
  colorBgHover: 'rgba(255, 255, 255, 0.03)',
  colorBgHoverStrong: 'rgba(255, 255, 255, 0.05)',
  colorBgSubtle: 'rgba(255, 255, 255, 0.08)',
  colorBgActive: 'rgba(255, 255, 255, 0.05)',
  colorBgInput: 'rgba(255, 255, 255, 0.08)',
  
  // Border colors
  colorBorder: 'rgba(255, 255, 255, 0.08)',
  colorBorderHover: 'rgba(255, 255, 255, 0.15)',
  colorBorderSubtle: 'rgba(255, 255, 255, 0.05)',
  
  // Sizes (larger radii like kodachrome)
  radiusSm: '3px',
  radiusMd: '6px',
  radiusLg: '10px',
  
  // Font sizes
  fontSizeXs: '9px',
  fontSizeSm: '10px',
  fontSizeMd: '11px',
  fontSizeLg: '12px',
  fontSizeXl: '13px',
  
  // Blur
  backdropBlur: 'blur(20px)',
  
  // Panel
  panelWidth: '220px',
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
    font-family: ${THEME.fontSystem};
    font-size: ${THEME.fontSizeMd};
    color: ${THEME.colorTextMuted};
  }
  
  .ek-label-sm {
    font-family: ${THEME.fontMono};
    font-size: ${THEME.fontSizeXs};
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${THEME.colorTextDim};
  }
  
  /* Common value display */
  .ek-value {
    font-family: ${THEME.fontMono};
    font-size: ${THEME.fontSizeSm};
    color: ${THEME.colorTextFaint};
    text-align: right;
  }
  
  /* Interactive element base */
  .ek-interactive {
    background: ${THEME.colorBgSubtle};
    border: 1px solid ${THEME.colorBorder};
    border-radius: ${THEME.radiusMd};
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  
  .ek-interactive:hover {
    background: ${THEME.colorBgSubtle};
    border-color: ${THEME.colorBorderHover};
    color: ${THEME.colorText};
  }
  
  .ek-interactive.active {
    background: ${THEME.colorBgActive};
    color: ${THEME.colorText};
  }
  
  /* Badge/pill style */
  .ek-badge {
    font-size: ${THEME.fontSizeXs};
    color: ${THEME.colorTextFaint};
    background: ${THEME.colorBgActive};
    padding: 2px 8px;
    border-radius: ${THEME.radiusMd};
  }
  
  /* Warning text */
  .ek-warning {
    font-size: ${THEME.fontSizeXs};
    color: ${THEME.colorWarning};
  }
  
  /* Slider track base (matching kodachrome) */
  .ek-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  
  .ek-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    background: ${THEME.colorText};
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.1s ease;
  }
  
  .ek-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
  
  .ek-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: ${THEME.colorText};
    border: none;
    border-radius: 50%;
    cursor: pointer;
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
