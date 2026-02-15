/**
 * Shared property category definitions for Ektachrome
 * 
 * Centralizes the mapping between CSS properties and design token categories.
 * Used by toolbar-popup, variable-discovery, and variable-map.
 */

/**
 * CSS properties grouped by design token category
 */
export const PROPERTY_CATEGORIES = {
  color: [
    'color', 
    'background-color', 
    'background', 
    'border-color',
    'fill',
    'stroke',
    'outline-color',
    'text-decoration-color',
  ],
  
  spacing: [
    'padding',
    'padding-top', 
    'padding-right', 
    'padding-bottom', 
    'padding-left',
    'padding-inline',
    'padding-block',
    'margin',
    'margin-top', 
    'margin-right', 
    'margin-bottom', 
    'margin-left',
    'margin-inline',
    'margin-block',
    'gap',
    'row-gap',
    'column-gap',
  ],
  
  typography: [
    'font-size',
    'font-weight',
    'font-family',
    'line-height',
    'letter-spacing',
  ],
  
  radius: [
    'border-radius',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-left-radius',
    'border-bottom-right-radius',
  ],
  
  shadow: [
    'box-shadow',
    'text-shadow',
    'filter',
  ],
  
  animation: [
    'transition',
    'transition-duration',
    'transition-timing-function',
    'transition-delay',
    'animation',
    'animation-duration',
    'animation-timing-function',
    'animation-delay',
  ],
};

/**
 * Regex matchers for each category (for toolbar-popup)
 */
export const CATEGORY_MATCHERS = {
  color: new RegExp(`^(${PROPERTY_CATEGORIES.color.join('|')})$`),
  spacing: new RegExp(`^(${PROPERTY_CATEGORIES.spacing.join('|')})$`),
  type: new RegExp(`^(${PROPERTY_CATEGORIES.typography.join('|')})$`),
  radius: new RegExp(`^(${PROPERTY_CATEGORIES.radius.join('|')})$`),
  animation: new RegExp(`^(${PROPERTY_CATEGORIES.animation.join('|')})$`),
};

/**
 * Human-readable labels for each category
 */
export const CATEGORY_LABELS = {
  color: 'Color',
  spacing: 'Spacing',
  type: 'Type',
  radius: 'Radius',
  animation: 'Motion',
};

/**
 * Get the category for a CSS property
 * @param {string} property - CSS property name
 * @returns {string | null} Category name or null if not categorized
 */
export function getCategoryForProperty(property) {
  for (const [category, properties] of Object.entries(PROPERTY_CATEGORIES)) {
    if (properties.includes(property)) {
      // Map typography to 'type' for UI consistency
      if (category === 'typography') return 'type';
      return category;
    }
  }
  return null;
}

/**
 * Check if a variable name suggests a particular category
 * @param {string} varName - CSS variable name (e.g., '--color-primary')
 * @returns {string | null} Suggested category or null
 */
export function inferCategoryFromVarName(varName) {
  const lower = varName.toLowerCase();
  
  if (lower.includes('color') || lower.includes('bg') || lower.includes('text')) {
    return 'color';
  }
  if (lower.includes('space') || lower.includes('gap') || lower.includes('margin') || lower.includes('padding')) {
    return 'spacing';
  }
  if (lower.includes('font') || lower.includes('text-') || lower.includes('line-height')) {
    return 'type';
  }
  if (lower.includes('radius') || lower.includes('rounded')) {
    return 'radius';
  }
  if (lower.includes('shadow')) {
    return 'shadow';
  }
  if (lower.includes('transition') || lower.includes('animation') || lower.includes('duration') || lower.includes('ease') || lower.includes('spring')) {
    return 'animation';
  }
  
  return null;
}

/**
 * Design scales for each category
 */
export const DESIGN_SCALES = {
  typography: [
    { name: 'xs',   value: '0.75rem',  label: 'XS' },
    { name: 'sm',   value: '0.875rem', label: 'SM' },
    { name: 'base', value: '1rem',     label: 'Base' },
    { name: 'lg',   value: '1.125rem', label: 'LG' },
    { name: 'xl',   value: '1.25rem',  label: 'XL' },
    { name: '2xl',  value: '1.5rem',   label: '2XL' },
    { name: '3xl',  value: '1.875rem', label: '3XL' },
  ],
  
  radius: [
    { name: 'none', value: '0px',    label: '0' },
    { name: 'sm',   value: '2px',    label: '2' },
    { name: 'md',   value: '4px',    label: '4' },
    { name: 'lg',   value: '8px',    label: '8' },
    { name: 'xl',   value: '12px',   label: '12' },
    { name: '2xl',  value: '16px',   label: '16' },
    { name: 'full', value: '9999px', label: '\u221E' },
  ],
  
  shadow: [
    { name: 'none', value: 'none',                          label: '0' },
    { name: 'sm',   value: '0 1px 2px rgba(0,0,0,0.05)',   label: 'SM' },
    { name: 'md',   value: '0 4px 6px rgba(0,0,0,0.1)',    label: 'MD' },
    { name: 'lg',   value: '0 10px 15px rgba(0,0,0,0.1)',  label: 'LG' },
    { name: 'xl',   value: '0 20px 25px rgba(0,0,0,0.1)',  label: 'XL' },
    { name: '2xl',  value: '0 25px 50px rgba(0,0,0,0.25)', label: '2XL' },
  ],
  
  duration: [
    { name: 'instant', value: '0ms',    label: '0' },
    { name: 'fast',    value: '100ms',  label: '100' },
    { name: 'normal',  value: '150ms',  label: '150' },
    { name: 'medium',  value: '200ms',  label: '200' },
    { name: 'slow',    value: '300ms',  label: '300' },
    { name: 'slower',  value: '500ms',  label: '500' },
    { name: 'slowest', value: '750ms',  label: '750' },
    { name: 'glacial', value: '1000ms', label: '1s' },
  ],
  
  easing: [
    { name: 'linear',     value: 'linear',                           label: 'Linear', points: [0, 0, 1, 1] },
    { name: 'ease',       value: 'ease',                             label: 'Ease',   points: [0.25, 0.1, 0.25, 1] },
    { name: 'ease-in',    value: 'ease-in',                          label: 'In',     points: [0.42, 0, 1, 1] },
    { name: 'ease-out',   value: 'ease-out',                         label: 'Out',    points: [0, 0, 0.58, 1] },
    { name: 'ease-in-out', value: 'ease-in-out',                     label: 'InOut',  points: [0.42, 0, 0.58, 1] },
    { name: 'snappy',     value: 'cubic-bezier(0.2, 0, 0, 1)',       label: 'Snappy', points: [0.2, 0, 0, 1] },
    { name: 'bounce',     value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', label: 'Bounce', points: [0.34, 1.56, 0.64, 1] },
  ],
  
  // Spacing uses multipliers of base unit, generated dynamically
  spacingMultipliers: [0, 1, 2, 3, 4, 6, 8, 12, 16],
};

/**
 * Generate spacing scale from a base unit
 * @param {number} baseUnit - Base spacing unit in pixels (default 4)
 * @returns {number[]} Array of spacing values in pixels
 */
export function generateSpacingScale(baseUnit = 4) {
  return DESIGN_SCALES.spacingMultipliers.map(n => n * baseUnit);
}
