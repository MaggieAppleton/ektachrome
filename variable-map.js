/**
 * Built during audit phase, cached for instant lookups during refinement.
 * Maps every element's visual properties back to the token that controls them.
 */
const variableMap = {
  // "If you see this computed value on this property, it came from this token"
  'color': {
    'rgb(59, 130, 246)': { variable: '--color-primary', oklch: 'oklch(0.62 0.21 255)' },
    'rgb(255, 255, 255)': { variable: '--color-surface', oklch: 'oklch(1 0 0)' },
    // ...
  },
  'font-size': {
    '14px': { variable: '--text-sm', scale: 'sm' },
    '16px': { variable: '--text-base', scale: 'base' },
    // ...
  },
  'padding': {
    '8px': { variable: '--space-2', step: 2 },
    '16px': { variable: '--space-4', step: 4 },
    // ...
  },
  'border-radius': {
    '4px': { variable: '--radius-md', scale: 'md' },
    // ...
  }
};

// Instant lookup when user clicks an element:
function resolveTokensForElement(element) {
  const computed = window.getComputedStyle(element);
  const tokens = {};
  
  for (const [property, valueMap] of Object.entries(variableMap)) {
    const currentValue = computed.getPropertyValue(property);
    if (valueMap[currentValue]) {
      tokens[property] = valueMap[currentValue];
    }
  }
  
  return tokens;
  // Returns: { color: { variable: '--color-primary', ... }, padding: { variable: '--space-4', ... } }
}