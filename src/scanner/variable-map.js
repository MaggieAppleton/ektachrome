/**
 * Built during audit phase, cached for instant lookups during refinement.
 * Maps every element's visual properties back to the token that controls them.
 */

// Dynamic cache - gets populated by buildVariableMap()
let variableMap = {};
let isBuilt = false;

/**
 * Build the variable map by scanning all CSS custom properties in the document
 */
function buildVariableMap() {
  const map = {
    color: {},
    'background-color': {},
    'border-color': {},
    'font-size': {},
    'line-height': {},
    'padding': {},
    'margin': {},
    'gap': {},
    'border-radius': {},
    'box-shadow': {}
  };

  // Get computed style of root to capture all CSS variables
  const rootStyles = window.getComputedStyle(document.documentElement);
  const allProperties = Array.from(rootStyles);
  
  // Find all CSS custom properties (variables)
  const customProperties = allProperties.filter(prop => prop.startsWith('--'));
  
  for (const customProp of customProperties) {
    const value = rootStyles.getPropertyValue(customProp).trim();
    
    // Categorize by property type based on variable name and value
    if (customProp.includes('color') || isColorValue(value)) {
      map.color[value] = { 
        variable: customProp, 
        oklch: convertToOklch(value) 
      };
      map['background-color'][value] = { 
        variable: customProp, 
        oklch: convertToOklch(value) 
      };
      map['border-color'][value] = { 
        variable: customProp, 
        oklch: convertToOklch(value) 
      };
    }
    
    if (customProp.includes('text') || customProp.includes('font') || isFontSizeValue(value)) {
      map['font-size'][value] = { 
        variable: customProp, 
        scale: inferTextScale(customProp, value) 
      };
    }
    
    if (customProp.includes('space') || customProp.includes('padding') || customProp.includes('margin') || customProp.includes('gap') || isSpacingValue(value)) {
      map['padding'][value] = { 
        variable: customProp, 
        step: inferSpacingStep(value) 
      };
      map['margin'][value] = { 
        variable: customProp, 
        step: inferSpacingStep(value) 
      };
      map['gap'][value] = { 
        variable: customProp, 
        step: inferSpacingStep(value) 
      };
    }
    
    if (customProp.includes('radius') || isBorderRadiusValue(value)) {
      map['border-radius'][value] = { 
        variable: customProp, 
        scale: inferRadiusScale(customProp, value) 
      };
    }
    
    if (customProp.includes('shadow') || isShadowValue(value)) {
      map['box-shadow'][value] = { 
        variable: customProp, 
        scale: inferShadowScale(customProp, value) 
      };
    }
  }
  
  variableMap = map;
  isBuilt = true;
  console.log('[variable-map] Built dynamic map with', Object.keys(customProperties).length, 'variables');
  return map;
}

// Instant lookup when user clicks an element:
function resolveTokensForElement(element) {
  if (!isBuilt) {
    buildVariableMap();
  }
  
  const computed = window.getComputedStyle(element);
  const tokens = {};
  
  for (const [property, valueMap] of Object.entries(variableMap)) {
    const currentValue = computed.getPropertyValue(property).trim();
    if (valueMap[currentValue]) {
      tokens[property] = valueMap[currentValue];
    }
  }
  
  return tokens;
}

// Helper functions to identify value types
function isColorValue(value) {
  return /^(#|rgb|hsl|oklch|color\()/i.test(value) || 
         /^(red|blue|green|white|black|transparent|inherit|initial)$/i.test(value);
}

function isFontSizeValue(value) {
  return /^[\d.]+r?em$|^[\d.]+px$/.test(value);
}

function isSpacingValue(value) {
  return /^[\d.]+px$|^[\d.]+r?em$/.test(value) && parseFloat(value) < 200; // Reasonable spacing range
}

function isBorderRadiusValue(value) {
  return /^[\d.]+px$|^[\d.]+%$/.test(value) && parseFloat(value) < 100;
}

function isShadowValue(value) {
  return /shadow/.test(value) || /(\d+px\s+){2,}/.test(value);
}

// Infer scale names based on variable names and values
function inferTextScale(varName, value) {
  if (varName.includes('sm')) return 'sm';
  if (varName.includes('lg')) return 'lg';
  if (varName.includes('xl')) return 'xl';
  if (varName.includes('2xl')) return '2xl';
  if (varName.includes('3xl')) return '3xl';
  if (varName.includes('base')) return 'base';
  
  // Infer from pixel value
  const px = parseFloat(value);
  if (px <= 12) return 'xs';
  if (px <= 14) return 'sm';
  if (px <= 16) return 'base';
  if (px <= 18) return 'lg';
  if (px <= 20) return 'xl';
  if (px <= 24) return '2xl';
  return '3xl';
}

function inferSpacingStep(value) {
  const px = parseFloat(value);
  return Math.round(px / 4); // Assume 4px base unit
}

function inferRadiusScale(varName, value) {
  if (varName.includes('none') || value === '0' || value === '0px') return 'none';
  if (varName.includes('sm')) return 'sm';
  if (varName.includes('md')) return 'md';
  if (varName.includes('lg')) return 'lg';
  if (varName.includes('xl')) return 'xl';
  if (varName.includes('full')) return 'full';
  
  const px = parseFloat(value);
  if (px <= 2) return 'sm';
  if (px <= 6) return 'md';
  if (px <= 10) return 'lg';
  if (px > 100) return 'full';
  return 'xl';
}

function inferShadowScale(varName, value) {
  if (varName.includes('sm')) return 'sm';
  if (varName.includes('md')) return 'md';
  if (varName.includes('lg')) return 'lg';
  if (varName.includes('xl')) return 'xl';
  return 'md';
}

// Convert color values to OKLCH format
function convertToOklch(value) {
  // If already OKLCH, return as-is
  if (value.startsWith('oklch(')) return value;
  
  // For other formats, we'd need conversion logic
  // For now, return a sensible default
  return 'oklch(0.5 0.15 0)';
}

export { variableMap, resolveTokensForElement, buildVariableMap };