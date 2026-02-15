/**
 * Shared stylesheet scanning utility
 * 
 * Provides a common interface for iterating over CSS rules,
 * handling CORS-blocked stylesheets gracefully.
 */

/**
 * Iterate over all CSS rules in the document's stylesheets
 * Yields { rule, sheet } objects for each style rule
 * Handles CORS-blocked stylesheets silently
 * 
 * @yields {{ rule: CSSStyleRule, sheet: CSSStyleSheet }}
 */
export function* iterateStyleRules() {
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.style) {
          yield { rule, sheet };
        }
      }
    } catch (e) {
      // CORS-blocked stylesheet - skip silently
    }
  }
}

/**
 * Iterate over all CSS custom properties defined in :root
 * 
 * @yields {{ name: string, value: string }}
 */
export function* iterateRootCustomProperties() {
  const rootStyles = window.getComputedStyle(document.documentElement);
  const allProperties = Array.from(rootStyles);
  
  for (const prop of allProperties) {
    if (prop.startsWith('--')) {
      yield {
        name: prop,
        value: rootStyles.getPropertyValue(prop).trim()
      };
    }
  }
}

/**
 * Get all CSS custom properties defined on :root as an object
 * 
 * @returns {Record<string, string>}
 */
export function getRootCustomProperties() {
  const properties = {};
  for (const { name, value } of iterateRootCustomProperties()) {
    properties[name] = value;
  }
  return properties;
}

/**
 * Find all var() references in a CSS value
 * 
 * @param {string} value - CSS property value
 * @returns {string[]} Array of variable names (with -- prefix)
 */
export function extractVarReferences(value) {
  const matches = value.match(/var\(--[^)]+\)/g);
  if (!matches) return [];
  
  return matches
    .map(v => v.match(/var\((--[^,)]+)/)?.[1])
    .filter(Boolean);
}

/**
 * Check if an element matches a CSS selector safely
 * Returns false for invalid selectors instead of throwing
 * 
 * @param {Element} element 
 * @param {string} selector 
 * @returns {boolean}
 */
export function safeMatches(element, selector) {
  try {
    return element.matches(selector);
  } catch (e) {
    return false;
  }
}
