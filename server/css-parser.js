/**
 * CSS Parser for Ektachrome write-back functionality.
 * Parses and modifies CSS files to update variable declarations.
 */

import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { join, relative } from 'path';

// Match variable declaration: --name: value;
// Captures: (indentation)(varName)(colon+whitespace)(value)(semicolon)
const VAR_DECLARATION = /^(\s*)(--[\w-]+)(\s*:\s*)([^;]+)(;)/gm;

// Match selector blocks containing variables
const SELECTOR_WITH_VARS = /([^{}]+)\{([^}]*--[\w-]+[^}]*)\}/g;

/**
 * Find all CSS files in a directory (recursive)
 * @param {string} root - Project root path
 * @param {string[]} include - Glob patterns to include (default: ['**\/*.css'])
 * @param {string[]} exclude - Patterns to exclude (default: ['node_modules/**'])
 * @returns {Promise<string[]>} Array of absolute file paths
 */
export async function findCSSFiles(root, include = ['**/*.css'], exclude = ['node_modules/**', 'dist/**']) {
  const files = [];
  
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(root, fullPath);
      
      // Check excludes
      const isExcluded = exclude.some(pattern => {
        if (pattern.endsWith('/**')) {
          const prefix = pattern.slice(0, -3);
          return relativePath.startsWith(prefix) || relativePath === prefix;
        }
        return relativePath === pattern;
      });
      
      if (isExcluded) continue;
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.css')) {
        // Check includes
        const isIncluded = include.some(pattern => {
          if (pattern === '**/*.css') return true;
          if (pattern.endsWith('/**/*.css')) {
            const prefix = pattern.slice(0, -8);
            return relativePath.startsWith(prefix);
          }
          if (pattern === '*.css') {
            return !relativePath.includes('/');
          }
          return relativePath === pattern;
        });
        
        if (isIncluded) {
          files.push(fullPath);
        }
      }
    }
  }
  
  try {
    await walk(root);
  } catch (e) {
    console.warn('[css-parser] Error walking directory:', e.message);
  }
  
  return files;
}

/**
 * Extract all CSS custom property declarations from a file
 * @param {string} cssContent - File contents
 * @returns {Array<{name: string, value: string, line: number, selector: string}>}
 */
export function extractVariables(cssContent) {
  const variables = [];
  
  // Remove CSS comments first to avoid parsing issues
  const contentNoComments = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = contentNoComments.split('\n');
  
  // Track selector context
  let currentSelector = '';
  let braceDepth = 0;
  let selectorBuffer = '';
  
  // Also track line numbers in original content
  const originalLines = cssContent.split('\n');
  let originalLineIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Try to find corresponding line in original (approximate)
    // This is imperfect but good enough for line numbers
    while (originalLineIndex < originalLines.length && 
           !originalLines[originalLineIndex].includes(line.trim().slice(0, 20))) {
      originalLineIndex++;
    }
    const lineNumber = originalLineIndex + 1;
    
    // Track selector context
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '{') {
        if (braceDepth === 0) {
          // Extract selector from what came before
          const beforeBrace = line.slice(0, j);
          selectorBuffer += beforeBrace;
          // Clean up the selector: trim whitespace and normalize
          currentSelector = selectorBuffer.trim().replace(/\s+/g, ' ');
          selectorBuffer = '';
        }
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          currentSelector = '';
          selectorBuffer = '';
        }
      }
    }
    
    // If we're outside a block and line doesn't have braces, accumulate for selector
    if (!line.includes('{') && !line.includes('}') && braceDepth === 0) {
      const trimmed = line.trim();
      if (trimmed) {
        selectorBuffer += (selectorBuffer ? ' ' : '') + trimmed;
      }
    }
    
    // Check for variable declarations
    const varMatch = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (varMatch && braceDepth > 0) {
      variables.push({
        name: varMatch[1],
        value: varMatch[2].trim(),
        line: lineNumber,
        selector: currentSelector || ':root'
      });
    }
  }
  
  return variables;
}

/**
 * Update a variable's value in CSS content
 * @param {string} cssContent - Original file contents
 * @param {string} varName - Variable name (e.g., '--color-primary')
 * @param {string} newValue - New value to set
 * @param {string} [selector] - Optional: only update in this selector (default: update first occurrence)
 * @returns {{content: string, changed: boolean, occurrences: number}}
 */
export function updateVariable(cssContent, varName, newValue, selector = null) {
  const lines = cssContent.split('\n');
  let occurrences = 0;
  let changed = false;
  
  // Track current selector context
  let currentSelector = '';
  let braceDepth = 0;
  let selectorStart = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track selector context
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '{') {
        if (braceDepth === 0) {
          const beforeBrace = line.slice(0, j).trim();
          selectorStart = selectorStart + beforeBrace;
          currentSelector = selectorStart.trim();
          selectorStart = '';
        }
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          currentSelector = '';
        }
      }
    }
    
    if (!line.includes('{') && !line.includes('}') && braceDepth === 0) {
      selectorStart += line;
    }
    
    // Check for variable declaration on this line
    const pattern = new RegExp(`^(\\s*)(${escapeRegex(varName)})(\\s*:\\s*)([^;]+)(;)`);
    const match = line.match(pattern);
    
    if (match && braceDepth > 0) {
      occurrences++;
      
      // Check if we should update this occurrence
      const shouldUpdate = selector === null 
        ? !changed  // Update first occurrence only
        : selector === '*'  // Update all
        || currentSelector === selector;  // Update specific selector
      
      if (shouldUpdate) {
        // Preserve formatting: keep indentation and whitespace
        lines[i] = `${match[1]}${match[2]}${match[3]}${newValue}${match[5]}`;
        changed = true;
        
        // If no selector specified, only update first occurrence
        if (selector === null) break;
      }
    }
  }
  
  return {
    content: lines.join('\n'),
    changed,
    occurrences
  };
}

/**
 * Find which file contains a variable declaration
 * @param {string} varName - Variable name
 * @param {string[]} cssFiles - Array of file paths
 * @returns {Promise<{file: string, line: number, selector: string} | null>}
 */
export async function findVariableFile(varName, cssFiles) {
  for (const file of cssFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      const variables = extractVariables(content);
      
      const found = variables.find(v => v.name === varName);
      if (found) {
        return {
          file,
          line: found.line,
          selector: found.selector
        };
      }
    } catch (e) {
      console.warn('[css-parser] Error reading file:', file, e.message);
    }
  }
  
  return null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Insert a new CSS variable declaration
 * @param {string} filePath - CSS file to modify
 * @param {string} varName - Variable name (e.g., '--card-padding')
 * @param {string} value - Variable value
 * @param {string} selector - Selector to insert into (e.g., ':root', '.card')
 * @returns {Promise<{line: number}>}
 */
export async function insertVariable(filePath, varName, value, selector) {
  let content = await readFile(filePath, 'utf-8');
  
  // Find the selector block
  const selectorRegex = new RegExp(
    `(${escapeRegex(selector)}\\s*\\{)([^}]*)(\\})`,
    's'
  );
  
  const match = content.match(selectorRegex);
  
  if (match) {
    // Insert at end of existing block
    const [fullMatch, open, body, close] = match;
    const indent = detectIndent(body);
    const newDeclaration = `${indent}${varName}: ${value};\n`;
    const newBody = body.trimEnd() + '\n' + newDeclaration;
    content = content.replace(fullMatch, open + newBody + close);
  } else {
    // Create new selector block
    const newBlock = `\n${selector} {\n  ${varName}: ${value};\n}\n`;
    content += newBlock;
  }
  
  await writeFile(filePath, content, 'utf-8');
  
  // Calculate line number for response
  const line = content.substring(0, content.indexOf(varName)).split('\n').length;
  return { line };
}

/**
 * Update a property to use a CSS variable
 * @param {string} filePath - CSS file to modify  
 * @param {string} selector - Selector containing the property
 * @param {string} property - CSS property name
 * @param {string} varName - Variable name to reference
 * @returns {Promise<{changed: boolean}>}
 */
export async function updatePropertyToUseToken(filePath, selector, property, varName) {
  let content = await readFile(filePath, 'utf-8');
  
  // Find the selector block
  const selectorRegex = new RegExp(
    `(${escapeRegex(selector)}\\s*\\{)([^}]*)(\\})`,
    's'
  );
  
  const match = content.match(selectorRegex);
  
  if (!match) {
    return { changed: false };
  }
  
  const [fullMatch, open, body, close] = match;
  
  // Find and replace the property value (not CSS variables which start with --)
  // Use word boundary or start of whitespace to ensure we match the property, not part of a variable name
  const propertyRegex = new RegExp(
    `((?:^|[;\\s])\\s*)(${escapeRegex(property)})(\\s*:\\s*)([^;]+)(;)`,
    'gm'
  );
  
  let changed = false;
  const newBody = body.replace(propertyRegex, (m, prefix, prop, colon, oldValue, suffix) => {
    // Skip if this looks like a CSS variable (has -- anywhere before it in the prefix area)
    if (prefix.includes('--') || prop.startsWith('-')) {
      return m;
    }
    changed = true;
    return `${prefix}${prop}${colon}var(${varName})${suffix}`;
  });
  
  if (changed) {
    content = content.replace(fullMatch, open + newBody + close);
    await writeFile(filePath, content, 'utf-8');
  }
  
  return { changed };
}

/**
 * Detect indentation used in a CSS block body
 * @param {string} body - CSS block body content
 * @returns {string} Detected indent (defaults to 2 spaces)
 */
function detectIndent(body) {
  // Look for existing indentation pattern
  const indentMatch = body.match(/\n(\s+)/);
  if (indentMatch) {
    return indentMatch[1];
  }
  // Default to 2 spaces
  return '  ';
}

/**
 * Find the best file to add a scoped token to
 * @param {string} scope - Selector scope (e.g., ':root', '.card')
 * @param {string[]} cssFiles - Array of CSS file paths
 * @returns {Promise<string>} Best file path
 */
export async function findBestFileForScope(scope, cssFiles) {
  // If :root scope, look for tokens.css or variables.css
  if (scope === ':root') {
    const tokenFile = cssFiles.find(f => 
      f.includes('token') || f.includes('variable')
    );
    if (tokenFile) return tokenFile;
  }
  
  // For component scope, look for file containing that selector
  for (const file of cssFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      if (content.includes(scope)) {
        return file;
      }
    } catch {
      // Ignore read errors
    }
  }
  
  // Default to first CSS file
  return cssFiles[0];
}
