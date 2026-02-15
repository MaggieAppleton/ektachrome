/**
 * Claude-powered variable discovery for complex cases
 * 
 * Used as a fallback when automatic detection fails to find
 * CSS custom properties for an element.
 */

import { callClaudeJSON, isClaudeAvailable } from '../utils/claude-client.js';
import { PROPERTY_CATEGORIES } from '../utils/property-categories.js';

const SYSTEM_PROMPT = `You analyze CSS to find which custom properties (CSS variables) control a given element's appearance. 

Focus on identifying:
1. CSS custom properties that directly affect the requested property type
2. The current computed values and their likely sources
3. Whether values should be tokenized (converted to variables)

Always return valid JSON array format.`;

/**
 * Discover CSS variables for an element using Claude
 * 
 * @param {object} elementInfo - Element info from ElementPicker
 * @param {string} adjustmentType - Category: 'color', 'spacing', 'typography', 'radius', 'shadow'
 * @param {string} [apiKey] - Optional API key override
 * @returns {Promise<Array>} Array of variable suggestions
 */
async function discoverVariables(elementInfo, adjustmentType, apiKey = null) {
  if (!isClaudeAvailable() && !apiKey) {
    console.warn('[variable-discovery] No API key configured. Set ANTHROPIC_API_KEY in .env file.');
    return [];
  }

  try {
    console.log('[variable-discovery] Discovering variables for', adjustmentType, 'on', elementInfo.path);
    
    const prompt = buildPrompt(elementInfo, adjustmentType);
    
    const variables = await callClaudeJSON({
      system: SYSTEM_PROMPT,
      prompt,
      apiKey,
      maxTokens: 1024,
      jsonType: 'array',
    });
    
    console.log('[variable-discovery] Found', variables.length, 'variable suggestions');
    return variables;
    
  } catch (error) {
    console.warn('[variable-discovery] Failed to discover variables:', error.message);
    return [];
  }
}

/**
 * Build the prompt for Claude
 */
function buildPrompt(elementInfo, adjustmentType) {
  const relevantStyles = extractRelevantStyles(elementInfo.computedStyles, adjustmentType);
  
  return `Element: ${elementInfo.path}
Element classes: ${elementInfo.element?.className || 'none'}
Element ID: ${elementInfo.element?.id || 'none'}

Computed styles for ${adjustmentType}:
${JSON.stringify(relevantStyles, null, 2)}

Full computed styles:
${JSON.stringify(elementInfo.computedStyles, null, 2)}

What CSS custom properties (--var-name) likely control this element's ${adjustmentType} properties? 

Consider:
- Look for var() references in the computed styles
- Identify which properties affect ${adjustmentType} (e.g., for "color": color, background-color, border-color)
- Check if hardcoded values should be replaced with design tokens

Return JSON array: [{ "variable": "--var-name", "currentValue": "computed value", "property": "css-property", "type": "color|length|number", "confidence": 0.0-1.0 }]

If no custom properties found, suggest which properties could be tokenized.`;
}

/**
 * Extract only styles relevant to the adjustment type
 */
function extractRelevantStyles(computedStyles, adjustmentType) {
  // Map adjustment type to property category
  const categoryMap = {
    'color': PROPERTY_CATEGORIES.color,
    'spacing': PROPERTY_CATEGORIES.spacing,
    'typography': PROPERTY_CATEGORIES.typography,
    'radius': PROPERTY_CATEGORIES.radius,
    'shadow': PROPERTY_CATEGORIES.shadow,
  };
  
  const properties = categoryMap[adjustmentType] || Object.keys(computedStyles);
  const relevant = {};
  
  for (const prop of properties) {
    if (computedStyles[prop]) {
      relevant[prop] = computedStyles[prop];
    }
  }
  
  return relevant;
}

export { discoverVariables };
