/**
 * Design System Audit Scanner
 *
 * Scans all stylesheets in the current document to collect CSS custom
 * properties, raw color values, spacing values, font sizes, and border
 * radii. Uses Claude API to analyze inconsistencies and generate 
 * recommendations for design system improvements.
 */

import { callClaudeJSON, isClaudeAvailable } from '../utils/claude-client.js';
import { iterateStyleRules, iterateRootCustomProperties, extractVarReferences } from '../utils/stylesheet-scanner.js';

const CLAUDE_SYSTEM_PROMPT = `You are a design system expert analyzing CSS for inconsistencies and improvements. 

Analyze the provided CSS variables and raw values to identify:
1. Inconsistent naming patterns
2. Duplicate or near-duplicate values
3. Missing design tokens (hardcoded values that should be variables)  
4. Spacing scale consistency
5. Color palette coherence
6. Typography scale organization

Return a JSON object with your analysis and specific recommendations.`;

export async function auditDesignSystem(options = {}) {
  const { useClaudeAnalysis = true, apiKey } = options;
  
  console.log('[audit] Starting design system audit...');
  
  // Phase 1: Collect all CSS data
  const scanResults = scanStylesheets();
  
  // Phase 2: Analyze with Claude (if enabled and available)
  let claudeAnalysis = null;
  if (useClaudeAnalysis && (apiKey || isClaudeAvailable())) {
    claudeAnalysis = await analyzeWithClaude(scanResults, apiKey);
  }
  
  // Phase 3: Generate comprehensive report
  const report = generateAuditReport(scanResults, claudeAnalysis);
  
  console.log('[audit] Audit complete. Found', scanResults.definedCount, 'CSS variables');
  return report;
}

function scanStylesheets() {
  const allVariables = [];
  const allValues = { colors: [], spacing: [], typography: [], radii: [] };
  const usedVariables = new Set();
  
  // Get all defined CSS variables from :root
  const definedVariables = [];
  for (const { name, value } of iterateRootCustomProperties()) {
    definedVariables.push(name);
  }
  
  // Scan all stylesheets
  for (const { rule, sheet } of iterateStyleRules()) {
    for (const prop of rule.style) {
      const value = rule.style.getPropertyValue(prop).trim();
      if (!value) continue;
      
      // Collect CSS custom property definitions
      if (prop.startsWith('--')) {
        allVariables.push({ 
          name: prop, 
          value, 
          selector: rule.selectorText,
          sheet: sheet.href || 'inline'
        });
      }
      
      // Track var() references
      const refs = extractVarReferences(value);
      refs.forEach(varName => usedVariables.add(varName));
      
      // Collect raw values by category
      if (prop === 'color' || prop === 'background-color' || prop === 'border-color') {
        allValues.colors.push({ property: prop, value, selector: rule.selectorText });
      }
      if (prop === 'padding' || prop === 'margin' || prop === 'gap') {
        allValues.spacing.push({ property: prop, value, selector: rule.selectorText });
      }
      if (prop === 'font-size' || prop === 'line-height') {
        allValues.typography.push({ property: prop, value, selector: rule.selectorText });
      }
      if (prop === 'border-radius') {
        allValues.radii.push({ property: prop, value, selector: rule.selectorText });
      }
    }
  }
  
  // Find defined but unused variables
  const unusedVariables = definedVariables.filter(v => !usedVariables.has(v));
  
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
    
    const prompt = `Analyze this design system:

CSS Variables (${scanResults.variables.length} total):
${JSON.stringify(scanResults.variables.slice(0, 50), null, 2)}${scanResults.variables.length > 50 ? '\n... (truncated)' : ''}

Raw Color Values:
${JSON.stringify(scanResults.rawValues.colors.slice(0, 30), null, 2)}${scanResults.rawValues.colors.length > 30 ? '\n... (truncated)' : ''}

Raw Spacing Values:
${JSON.stringify(scanResults.rawValues.spacing.slice(0, 30), null, 2)}${scanResults.rawValues.spacing.length > 30 ? '\n... (truncated)' : ''}

Raw Typography Values:
${JSON.stringify(scanResults.rawValues.typography.slice(0, 20), null, 2)}${scanResults.rawValues.typography.length > 20 ? '\n... (truncated)' : ''}

Unused Variables: ${scanResults.unusedVariables.slice(0, 20).join(', ')}${scanResults.unusedVariables.length > 20 ? '... (truncated)' : ''}

Please analyze and return JSON with:
{
  "summary": "Overall assessment",
  "inconsistencies": [{ "type": "naming|value|missing", "description": "...", "examples": [...] }],
  "recommendations": [{ "priority": "high|medium|low", "action": "...", "benefit": "..." }],
  "scores": { "naming": 0-10, "consistency": 0-10, "coverage": 0-10, "organization": 0-10 }
}`;

    return await callClaudeJSON({
      system: CLAUDE_SYSTEM_PROMPT,
      prompt,
      apiKey,
      maxTokens: 2048,
      jsonType: 'object',
    });
    
  } catch (error) {
    console.warn('[audit] Claude analysis failed:', error.message);
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
      variableUsageRate: scanResults.definedCount > 0 
        ? scanResults.usedCount / scanResults.definedCount 
        : 0,
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
  
  const total = colorVariables.length + rawColors.length;
  return {
    tokenizedColors: colorVariables.length,
    hardcodedColors: rawColors.length,
    coverage: total > 0 ? colorVariables.length / total : 1
  };
}

function calculateSpacingConsistency(scanResults) {
  const spacingValues = scanResults.rawValues.spacing
    .map(s => parseFloat(s.value))
    .filter(v => !isNaN(v));
  const uniqueValues = [...new Set(spacingValues)];
  
  if (uniqueValues.length === 0) {
    return { baseUnit: 4, consistency: 1, uniqueValues: 0 };
  }
  
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
  if (colorCoverage.hardcodedColors > 0 && colorCoverage.coverage < 0.8) {
    recommendations.push({
      priority: 'high',
      action: `Convert ${colorCoverage.hardcodedColors} hardcoded colors to design tokens`,
      benefit: 'Improves consistency and makes global color changes easier'
    });
  }
  
  const spacingConsistency = calculateSpacingConsistency(scanResults);
  if (spacingConsistency.uniqueValues > 0 && spacingConsistency.consistency < 0.7) {
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
