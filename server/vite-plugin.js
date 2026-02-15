/**
 * Vite plugin for Ektachrome write-back functionality.
 * Adds HTTP middleware endpoints for browser communication.
 */

import { readFile, writeFile } from 'fs/promises';
import { relative } from 'path';
import { findCSSFiles, extractVariables, updateVariable, findVariableFile, insertVariable, findBestFileForScope, updatePropertyToUseToken } from './css-parser.js';

/**
 * Ektachrome Vite plugin
 * @param {Object} options
 * @param {string[]} [options.include] - Glob patterns for CSS files to scan
 * @param {string[]} [options.exclude] - Patterns to exclude
 * @returns {import('vite').Plugin}
 */
export function ektachromePlugin(options = {}) {
  const {
    include = ['src/**/*.css', 'styles/**/*.css', '*.css'],
    exclude = ['node_modules/**', 'dist/**']
  } = options;

  /** @type {string[]} */
  let cachedFiles = [];
  let cacheTime = 0;
  const CACHE_TTL = 5000; // 5 seconds

  return {
    name: 'ektachrome',

    configureServer(server) {
      const root = server.config.root;

      /**
       * Get CSS files with caching
       */
      async function getCSSFiles() {
        const now = Date.now();
        if (cachedFiles.length === 0 || now - cacheTime > CACHE_TTL) {
          cachedFiles = await findCSSFiles(root, include, exclude);
          cacheTime = now;
        }
        return cachedFiles;
      }

      /**
       * Parse JSON body from request
       */
      async function parseBody(req) {
        return new Promise((resolve, reject) => {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch (e) {
              reject(new Error('Invalid JSON'));
            }
          });
          req.on('error', reject);
        });
      }

      /**
       * Send JSON response
       */
      function sendJSON(res, data, status = 200) {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      }

      // GET /__ektachrome/status
      server.middlewares.use('/__ektachrome/status', (req, res, next) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        sendJSON(res, { connected: true, version: '1.0.0' });
      });

      // GET /__ektachrome/tokens
      server.middlewares.use('/__ektachrome/tokens', async (req, res, next) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const cssFiles = await getCSSFiles();
          const tokens = [];

          for (const file of cssFiles) {
            const content = await readFile(file, 'utf-8');
            const variables = extractVariables(content);
            const relativePath = relative(root, file);

            for (const v of variables) {
              tokens.push({
                name: v.name,
                value: v.value,
                file: relativePath,
                line: v.line,
                selector: v.selector
              });
            }
          }

          sendJSON(res, {
            tokens,
            files: cssFiles.map(f => relative(root, f))
          });
        } catch (e) {
          console.error('[ektachrome] Error scanning tokens:', e);
          sendJSON(res, { error: e.message }, 500);
        }
      });

      // POST /__ektachrome/commit
      server.middlewares.use('/__ektachrome/commit', async (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const body = await parseBody(req);
          const { changes = [], options: commitOptions = {} } = body;

          if (!Array.isArray(changes) || changes.length === 0) {
            sendJSON(res, { error: 'No changes provided' }, 400);
            return;
          }

          const cssFiles = await getCSSFiles();
          const committed = [];
          const errors = [];

          for (const change of changes) {
            const { variable, value } = change;

            if (!variable || !value) {
              errors.push({ variable, error: 'Missing variable or value' });
              continue;
            }

            // Find which file contains this variable
            const location = await findVariableFile(variable, cssFiles);

            if (!location) {
              errors.push({ variable, error: 'Variable not found in any CSS file' });
              continue;
            }

            try {
              // Read current file content
              const content = await readFile(location.file, 'utf-8');

              // Update the variable
              const selector = commitOptions.selector || null;
              const result = updateVariable(content, variable, value, selector);

              if (!result.changed) {
                errors.push({ variable, error: 'Variable value unchanged' });
                continue;
              }

              // Write back to file
              await writeFile(location.file, result.content, 'utf-8');

              // Invalidate cache since file changed
              cacheTime = 0;

              committed.push({
                variable,
                file: relative(root, location.file),
                line: location.line
              });
            } catch (e) {
              errors.push({ variable, error: e.message });
            }
          }

          const success = errors.length === 0;
          sendJSON(res, { success, committed, errors: errors.length > 0 ? errors : undefined });

        } catch (e) {
          console.error('[ektachrome] Error committing changes:', e);
          sendJSON(res, { error: e.message }, 500);
        }
      });

      // POST /__ektachrome/create-token
      server.middlewares.use('/__ektachrome/create-token', async (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const body = await parseBody(req);
          const { name, value, scope, property } = body;

          if (!name || !value || !scope) {
            sendJSON(res, { error: 'Missing required fields: name, value, scope' }, 400);
            return;
          }

          const cssFiles = await getCSSFiles();
          
          if (cssFiles.length === 0) {
            sendJSON(res, { error: 'No CSS files found' }, 400);
            return;
          }

          // Find the best file for this scope
          const targetFile = await findBestFileForScope(scope, cssFiles);

          // Insert the variable declaration
          const result = await insertVariable(targetFile, name, value, scope);

          // Optionally update the property to use the new token
          if (property && scope !== ':root') {
            await updatePropertyToUseToken(targetFile, scope, property, name);
          }

          // Invalidate cache
          cacheTime = 0;

          sendJSON(res, {
            success: true,
            file: relative(root, targetFile),
            line: result.line
          });

        } catch (e) {
          console.error('[ektachrome] Error creating token:', e);
          sendJSON(res, { error: e.message }, 500);
        }
      });
    }
  };
}

export default ektachromePlugin;
