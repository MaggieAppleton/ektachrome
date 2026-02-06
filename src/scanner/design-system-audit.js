/**
 * Design System Audit Scanner
 *
 * Scans all stylesheets in the current document to collect CSS custom
 * properties, raw color values, spacing values, font sizes, and border
 * radii. Used in the audit phase to understand the current state of an
 * app's design system before enabling live refinement.
 */

export async function auditDesignSystem() {
  const allVariables = [];
  const allValues = { colors: [], spacing: [], typography: [], radii: [] };
  
  // 1. Collect all CSS custom properties defined in the app
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.style) {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) {
              const value = rule.style.getPropertyValue(prop).trim();
              allVariables.push({ name: prop, value, selector: rule.selectorText });
            }
            
            // Also collect raw values to find inconsistencies
            const val = rule.style.getPropertyValue(prop);
            if (prop === 'color' || prop === 'background-color' || prop === 'border-color') {
              allValues.colors.push({ property: prop, value: val, selector: rule.selectorText });
            }
            if (prop === 'padding' || prop === 'margin' || prop === 'gap') {
              allValues.spacing.push({ property: prop, value: val, selector: rule.selectorText });
            }
            if (prop === 'font-size' || prop === 'line-height') {
              allValues.typography.push({ property: prop, value: val, selector: rule.selectorText });
            }
            if (prop === 'border-radius') {
              allValues.radii.push({ property: prop, value: val, selector: rule.selectorText });
            }
          }
        }
      }
    } catch (e) { /* CORS */ }
  }
  
  return { variables: allVariables, rawValues: allValues };
}