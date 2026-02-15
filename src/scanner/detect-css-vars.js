/**
 * CSS Variable Detection for Elements
 * 
 * Finds all CSS custom properties used by a specific element
 * by scanning stylesheets for matching rules.
 */

import { iterateStyleRules, safeMatches, extractVarReferences } from '../utils/stylesheet-scanner.js';

/**
 * Find all CSS variables used by an element
 * 
 * @param {Element} element - DOM element to inspect
 * @returns {Array<{variable: string, property: string, currentValue: string, rawValue: string}>}
 */
function findCSSVariablesForElement(element) {
  const computed = window.getComputedStyle(element);
  const variables = [];
  
  for (const { rule } of iterateStyleRules()) {
    // Check if this rule applies to the element
    if (!rule.selectorText || !safeMatches(element, rule.selectorText)) {
      continue;
    }
    
    // Check each property for var() references
    for (const prop of rule.style) {
      const value = rule.style.getPropertyValue(prop);
      const varNames = extractVarReferences(value);
      
      for (const varName of varNames) {
        const currentValue = computed.getPropertyValue(varName).trim();
        variables.push({
          variable: varName,
          property: prop,
          currentValue,
          rawValue: value
        });
      }
    }
  }
  
  return variables;
}

export { findCSSVariablesForElement };
