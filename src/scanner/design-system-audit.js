/**
 * Design System Audit Scanner
 *
 * Scans all stylesheets in the current document to collect CSS custom
 * properties, raw color values, spacing values, font sizes, and border
 * radii. Uses Claude API to analyze inconsistencies and generate 
 * recommendations for design system improvements.
 */

export async function auditDesignSystem(options = {}) {
  const { useClaudeAnalysis = true, apiKey = process.env.ANTHROPIC_API_KEY } = options;
  
  console.log('[audit] Starting design system audit...');
  
  // Phase 1: Collect all CSS data
  const scanResults = await scanStylesheets();
  
  // Phase 2: Analyze with Claude (if enabled and key available)
  let claudeAnalysis = null;
  if (useClaudeAnalysis && apiKey) {
    claudeAnalysis = await analyzeWithClaude(scanResults, apiKey);
  }
  
  // Phase 3: Generate comprehensive report
  const report = generateAuditReport(scanResults, claudeAnalysis);
  
  console.log('[audit] Audit complete. Found', scanResults.variables.length, 'CSS variables');
  return report;
}

async function scanStylesheets() {
  const allVariables = [];
  const allValues = { colors: [], spacing: [], typography: [], radii: [] };
  const unusedVariables = [];
  
  // Get all defined CSS variables from :root
  const rootStyles = window.getComputedStyle(document.documentElement);
  const definedVariables = Array.from(rootStyles).filter(prop => prop.startsWith('--'));
  
  // 1. Collect all CSS custom properties defined in stylesheets
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.style) {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) {
              const value = rule.style.getPropertyValue(prop).trim();
              allVariables.push({ 
                name: prop, 
                value, 
                selector: rule.selectorText,
                sheet: sheet.href || 'inline'
              });
            }
            
            // Collect raw values to find inconsistencies
            const val = rule.style.getPropertyValue(prop).trim();
            if (val) {
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
      }
    } catch (e) { 
      console.warn('[audit] CORS blocked stylesheet:', sheet.href);
    }
  }
  
  // 2. Detect unused variables
  const usedVariables = new Set();
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.style) {
          for (const prop of rule.style) {
            const value = rule.style.getPropertyValue(prop);
            const varMatches = value.match(/var\(--[^)]+\)/g);
            if (varMatches) {
              varMatches.forEach(v => {
                const varName = v.match(/var\((--[^,)]+)/)?.[1];
                if (varName) usedVariables.add(varName);
              });
            }
          }
        }
      }
    } catch (e) { /* CORS */ }
  }
  
  // Find defined but unused variables
  for (const varName of definedVariables) {
    if (!usedVariables.has(varName)) {
      unusedVariables.push(varName);
    }
  }
  
  return { 
    variables: allVariables, 
    rawValues: allValues, 
    unusedVariables,
    definedCount: definedVariables.length,
    usedCount: usedVariables.size
  };
}

async function analyzeWithClaude(scanResults, apiKey) {
  try {
    console.log('[audit] Analyzing with Claude...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: `You are a design system expert analyzing CSS for inconsistencies and improvements. 
        
Analyze the provided CSS variables and raw values to identify:
1. Inconsistent naming patterns
2. Duplicate or near-duplicate values
3. Missing design tokens (hardcoded values that should be variables)  
4. Spacing scale consistency
5. Color palette coherence
6. Typography scale organization

Return a JSON object with your analysis and specific recommendations.`,
        messages: [{
          role: 'user', 
          content: `Analyze this design system:

CSS Variables (${scanResults.variables.length} total):
${JSON.stringify(scanResults.variables, null, 2)}

Raw Color Values:
${JSON.stringify(scanResults.rawValues.colors, null, 2)}

Raw Spacing Values:
${JSON.stringify(scanResults.rawValues.spacing, null, 2)}

Raw Typography Values:
${JSON.stringify(scanResults.rawValues.typography, null, 2)}

Unused Variables: ${scanResults.unusedVariables.join(', ')}

Please analyze and return JSON with:
{
  "summary": "Overall assessment",
  "inconsistencies": [{ "type": "naming|value|missing", "description": "...", "examples": [...] }],
  "recommendations": [{ "priority": "high|medium|low", "action": "...", "benefit": "..." }],
  "scores": { "naming": 0-10, "consistency": 0-10, "coverage": 0-10, "organization": 0-10 }
}`
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }
    
    const data = await response.json();
    const analysisText = data.content[0].text;
    
    // Try to parse JSON from Claude's response
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'No JSON found in response' };
    } catch (parseError) {
      console.warn('[audit] Could not parse Claude response as JSON:', parseError);
      return { error: 'Invalid JSON response', rawResponse: analysisText };
    }
    
  } catch (error) {
    console.warn('[audit] Claude analysis failed:', error);
    return { error: error.message };
  }
}

function generateAuditReport(scanResults, claudeAnalysis) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalVariables: scanResults.definedCount,
      usedVariables: scanResults.usedCount,
      unusedVariables: scanResults.unusedVariables.length,
      rawColorValues: scanResults.rawValues.colors.length,
      rawSpacingValues: scanResults.rawValues.spacing.length,
      rawTypographyValues: scanResults.rawValues.typography.length,
    },
    
    // Basic analysis (always available)
    basicAnalysis: {
      variableUsageRate: scanResults.usedCount / scanResults.definedCount,
      colorTokenCoverage: calculateColorTokenCoverage(scanResults),
      spacingConsistency: calculateSpacingConsistency(scanResults),
      namingPatterns: detectNamingPatterns(scanResults.variables)
    },
    
    // Claude analysis (if available)
    claudeAnalysis: claudeAnalysis || null,
    
    // Recommendations
    recommendations: generateRecommendations(scanResults, claudeAnalysis),
    
    // Raw data for further inspection
    data: scanResults
  };
  
  return report;
}

function calculateColorTokenCoverage(scanResults) {
  const colorVariables = scanResults.variables.filter(v => 
    v.name.includes('color') || /^(#|rgb|hsl|oklch)/.test(v.value)
  );
  const rawColors = scanResults.rawValues.colors.filter(c => 
    !c.value.includes('var(')
  );
  
  return {
    tokenizedColors: colorVariables.length,
    hardcodedColors: rawColors.length,
    coverage: colorVariables.length / (colorVariables.length + rawColors.length)
  };
}

function calculateSpacingConsistency(scanResults) {
  const spacingValues = scanResults.rawValues.spacing.map(s => parseFloat(s.value));
  const uniqueValues = [...new Set(spacingValues)];
  
  // Check if values follow a consistent scale (multiples of base unit)
  const possibleBaseUnits = [2, 4, 8];
  let bestBase = 4;
  let consistency = 0;
  
  for (const base of possibleBaseUnits) {
    const onScaleCount = uniqueValues.filter(v => v % base === 0).length;
    const currentConsistency = onScaleCount / uniqueValues.length;
    if (currentConsistency > consistency) {
      consistency = currentConsistency;
      bestBase = base;
    }
  }
  
  return { baseUnit: bestBase, consistency, uniqueValues: uniqueValues.length };
}

function detectNamingPatterns(variables) {
  const patterns = {
    'BEM-style': variables.filter(v => v.name.includes('--')).length,
    'scale-suffixed': variables.filter(v => /(sm|md|lg|xl)$/.test(v.name)).length,
    'number-suffixed': variables.filter(v => /\d+$/.test(v.name)).length,
    'semantic': variables.filter(v => /(primary|secondary|success|error)/.test(v.name)).length
  };
  
  return patterns;
}

function generateRecommendations(scanResults, claudeAnalysis) {
  const recommendations = [];
  
  // Basic recommendations
  if (scanResults.unusedVariables.length > 0) {
    recommendations.push({
      priority: 'low',
      action: `Remove ${scanResults.unusedVariables.length} unused CSS variables`,
      benefit: 'Reduces bundle size and maintenance overhead',
      variables: scanResults.unusedVariables
    });
  }
  
  const colorCoverage = calculateColorTokenCoverage(scanResults);
  if (colorCoverage.coverage < 0.8) {
    recommendations.push({
      priority: 'high',
      action: `Convert ${colorCoverage.hardcodedColors} hardcoded colors to design tokens`,
      benefit: 'Improves consistency and makes global color changes easier'
    });
  }
  
  const spacingConsistency = calculateSpacingConsistency(scanResults);
  if (spacingConsistency.consistency < 0.7) {
    recommendations.push({
      priority: 'medium',
      action: `Standardize spacing values to ${spacingConsistency.baseUnit}px grid`,
      benefit: 'Creates visual rhythm and simplifies spacing decisions'
    });
  }
  
  // Add Claude recommendations if available
  if (claudeAnalysis && claudeAnalysis.recommendations) {
    recommendations.push(...claudeAnalysis.recommendations);
  }
  
  return recommendations;
}