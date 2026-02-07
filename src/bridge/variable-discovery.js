async function discoverVariables(elementInfo, adjustmentType, apiKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You analyze CSS to find which custom properties (CSS variables) control a given element's appearance. Return JSON only.`,
        messages: [{
          role: 'user', 
          content: `Element: ${elementInfo.path}
Computed styles: ${JSON.stringify(elementInfo.computedStyles)}
Adjustment type: ${adjustmentType}

Look at the computed styles. What CSS custom properties (--var-name) likely control this element's ${adjustmentType}? 

Return JSON array: [{ "variable": "--var-name", "currentValue": "...", "property": "background-color", "type": "color|length|number" }]

If no custom properties are evident, suggest which inline style properties to override directly.`
        }]
      })
    });
    
    const data = await response.json();
    return JSON.parse(data.content[0].text);
  } catch (error) {
    console.warn('[variable-discovery] Failed to discover variables:', error);
    return [];
  }
}

export { discoverVariables };
