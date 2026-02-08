async function discoverVariables(elementInfo, adjustmentType, apiKey = process.env.ANTHROPIC_API_KEY) {
  if (!apiKey) {
    console.warn('[variable-discovery] No API key provided. Set ANTHROPIC_API_KEY environment variable.');
    return [];
  }

  try {
    console.log('[variable-discovery] Discovering variables for', adjustmentType, 'on', elementInfo.path);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: `You analyze CSS to find which custom properties (CSS variables) control a given element's appearance. 
        
Focus on identifying:
1. CSS custom properties that directly affect the requested property type
2. The current computed values and their likely sources
3. Whether values should be tokenized (converted to variables)

Always return valid JSON array format.`,
        messages: [{
          role: 'user', 
          content: `Element: ${elementInfo.path}
Element classes: ${elementInfo.element?.className || 'none'}
Element ID: ${elementInfo.element?.id || 'none'}

Computed styles for ${adjustmentType}:
${JSON.stringify(extractRelevantStyles(elementInfo.computedStyles, adjustmentType), null, 2)}

Full computed styles:
${JSON.stringify(elementInfo.computedStyles, null, 2)}

What CSS custom properties (--var-name) likely control this element's ${adjustmentType} properties? 

Consider:
- Look for var() references in the computed styles
- Identify which properties affect ${adjustmentType} (e.g., for "color": color, background-color, border-color)
- Check if hardcoded values should be replaced with design tokens

Return JSON array: [{ "variable": "--var-name", "currentValue": "computed value", "property": "css-property", "type": "color|length|number", "confidence": 0.0-1.0 }]

If no custom properties found, suggest which properties could be tokenized.`
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const responseText = data.content[0].text;
    
    // Try to extract JSON from the response
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const variables = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      console.log('[variable-discovery] Found', variables.length, 'variable suggestions');
      return variables;
      
    } catch (parseError) {
      console.warn('[variable-discovery] Could not parse Claude response as JSON:', parseError);
      console.log('[variable-discovery] Raw response:', responseText);
      return [];
    }
    
  } catch (error) {
    console.warn('[variable-discovery] Failed to discover variables:', error);
    return [];
  }
}

// Extract only styles relevant to the adjustment type
function extractRelevantStyles(computedStyles, adjustmentType) {
  const relevantProperties = {
    'color': ['color', 'background-color', 'border-color', 'fill', 'stroke'],
    'spacing': ['padding', 'margin', 'gap', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    'typography': ['font-size', 'line-height', 'font-weight', 'font-family', 'letter-spacing'],
    'radius': ['border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
    'shadow': ['box-shadow', 'text-shadow', 'filter']
  };
  
  const properties = relevantProperties[adjustmentType] || Object.keys(computedStyles);
  const relevant = {};
  
  for (const prop of properties) {
    if (computedStyles[prop]) {
      relevant[prop] = computedStyles[prop];
    }
  }
  
  return relevant;
}

export { discoverVariables };
