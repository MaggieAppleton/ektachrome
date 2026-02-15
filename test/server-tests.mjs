/**
 * Unit tests for css-parser.js
 * Run with: node test/server-tests.mjs
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { extractVariables, updateVariable, findCSSFiles } from '../server/css-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`\x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`\x1b[31m✗\x1b[0m ${name}`);
    console.log(`  ${e.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`\x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`\x1b[31m✗\x1b[0m ${name}`);
    console.log(`  ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) {
    throw new Error(msg || `Expected truthy value, got: ${value}`);
  }
}

// ============================================================================
// extractVariables tests
// ============================================================================

console.log('\n--- extractVariables ---\n');

const fixtureCSS = await readFile(join(FIXTURES_DIR, 'tokens.css'), 'utf-8');

test('extractVariables: finds all variables', () => {
  const vars = extractVariables(fixtureCSS);
  assertTrue(vars.length >= 11, `Should find at least 11 variables, found ${vars.length}`);
});

test('extractVariables: returns correct metadata for :root variables', () => {
  const vars = extractVariables(fixtureCSS);
  const primary = vars.find(v => v.name === '--color-primary' && v.selector === ':root');
  
  assertTrue(primary, 'Should find --color-primary in :root');
  assertEqual(primary.value, 'oklch(0.6 0.2 250)', 'Value should match');
  assertTrue(primary.line > 0, 'Line number should be positive');
});

test('extractVariables: finds variables in .dark selector', () => {
  const vars = extractVariables(fixtureCSS);
  const darkPrimary = vars.find(v => v.name === '--color-primary' && v.selector === '.dark');
  
  assertTrue(darkPrimary, 'Should find --color-primary in .dark');
  assertEqual(darkPrimary.value, 'oklch(0.4 0.15 250)', 'Dark value should match');
});

test('extractVariables: finds variables in component selectors', () => {
  const vars = extractVariables(fixtureCSS);
  const cardBg = vars.find(v => v.name === '--card-bg');
  
  assertTrue(cardBg, 'Should find --card-bg');
  assertEqual(cardBg.selector, '.card', 'Selector should be .card');
});

// ============================================================================
// updateVariable tests
// ============================================================================

console.log('\n--- updateVariable ---\n');

test('updateVariable: replaces value preserving formatting', () => {
  const css = `:root {
  --color-primary: oklch(0.6 0.2 250);
}`;
  
  const result = updateVariable(css, '--color-primary', 'oklch(0.7 0.3 260)');
  
  assertTrue(result.changed, 'Should report changed');
  assertEqual(result.occurrences, 1, 'Should find 1 occurrence');
  assertTrue(result.content.includes('--color-primary: oklch(0.7 0.3 260);'), 'Should have new value');
  assertTrue(result.content.includes('  --color-primary'), 'Should preserve indentation');
});

test('updateVariable: handles variable not found', () => {
  const css = `:root {
  --color-primary: oklch(0.6 0.2 250);
}`;
  
  const result = updateVariable(css, '--color-nonexistent', 'red');
  
  assertTrue(!result.changed, 'Should report not changed');
  assertEqual(result.occurrences, 0, 'Should find 0 occurrences');
  assertEqual(result.content, css, 'Content should be unchanged');
});

test('updateVariable: handles multiple occurrences (default: first only)', () => {
  const css = `:root {
  --color-primary: oklch(0.6 0.2 250);
}
.dark {
  --color-primary: oklch(0.4 0.15 250);
}`;
  
  const result = updateVariable(css, '--color-primary', 'red');
  
  assertTrue(result.changed, 'Should report changed');
  assertEqual(result.occurrences, 1, 'Should only count first occurrence when stopping early');
  
  // Check only first occurrence was changed
  const lines = result.content.split('\n');
  const rootLine = lines.find(l => l.includes('--color-primary') && l.includes('red'));
  const darkLine = lines.find(l => l.includes('--color-primary') && l.includes('oklch(0.4'));
  
  assertTrue(rootLine, 'First occurrence should be changed');
  assertTrue(darkLine, 'Second occurrence should be unchanged');
});

test('updateVariable: updates all occurrences with selector: "*"', () => {
  const css = `:root {
  --color-primary: oklch(0.6 0.2 250);
}
.dark {
  --color-primary: oklch(0.4 0.15 250);
}`;
  
  const result = updateVariable(css, '--color-primary', 'red', '*');
  
  assertTrue(result.changed, 'Should report changed');
  assertEqual(result.occurrences, 2, 'Should find 2 occurrences');
  
  // Both should be changed
  const matches = result.content.match(/--color-primary: red;/g);
  assertEqual(matches?.length, 2, 'Both occurrences should be changed');
});

test('updateVariable: updates specific selector only', () => {
  const css = `:root {
  --color-primary: oklch(0.6 0.2 250);
}
.dark {
  --color-primary: oklch(0.4 0.15 250);
}`;
  
  const result = updateVariable(css, '--color-primary', 'red', '.dark');
  
  assertTrue(result.changed, 'Should report changed');
  
  // Only .dark should be changed
  assertTrue(result.content.includes('oklch(0.6 0.2 250)'), ':root should be unchanged');
  assertTrue(!result.content.includes('oklch(0.4 0.15 250)'), '.dark should be changed');
});

// ============================================================================
// findCSSFiles tests
// ============================================================================

console.log('\n--- findCSSFiles ---\n');

await asyncTest('findCSSFiles: finds CSS files in fixtures', async () => {
  const files = await findCSSFiles(FIXTURES_DIR);
  assertTrue(files.length >= 1, `Should find at least 1 CSS file, found ${files.length}`);
  assertTrue(files.some(f => f.endsWith('tokens.css')), 'Should find tokens.css');
});

await asyncTest('findCSSFiles: respects exclude patterns', async () => {
  const projectRoot = join(__dirname, '..');
  const files = await findCSSFiles(projectRoot, ['**/*.css'], ['node_modules/**', 'dist/**', 'test/**']);
  
  // Should not include files from test directory
  assertTrue(!files.some(f => f.includes('/test/')), 'Should exclude test directory');
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n--- Summary ---\n`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
