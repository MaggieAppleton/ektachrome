function findCSSVariablesForElement(element) {
  const computed = window.getComputedStyle(element);
  const variables = [];
  
  // Get all stylesheets and find rules that match this element
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && element.matches(rule.selectorText)) {
          // Check if any property values reference CSS variables
          for (const prop of rule.style) {
            const value = rule.style.getPropertyValue(prop);
            const varMatches = value.match(/var\(--[^)]+\)/g);
            if (varMatches) {
              varMatches.forEach(v => {
                const varName = v.match(/var\((--[^,)]+)/)?.[1];
                if (varName) {
                  const currentValue = computed.getPropertyValue(varName).trim();
                  variables.push({
                    variable: varName,
                    property: prop,
                    currentValue,
                    rawValue: value
                  });
                }
              });
            }
          }
        }
      }
    } catch (e) {
      // CORS-blocked stylesheets
    }
  }
  
  return variables;
}