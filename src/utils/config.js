/**
 * Configuration loader for Ektachrome
 * 
 * Loads configuration from multiple sources:
 * 1. Window global (window.EKTACHROME_CONFIG)
 * 2. Fetched .env file (for local development)
 * 3. Defaults
 * 
 * Usage:
 *   import { getConfig, loadConfig } from './utils/config.js';
 *   await loadConfig(); // Call once at startup
 *   const apiKey = getConfig('ANTHROPIC_API_KEY');
 */

let config = {
  ANTHROPIC_API_KEY: null,
};

let isLoaded = false;

/**
 * Load configuration from .env file (local development)
 * Falls back gracefully if .env doesn't exist
 */
export async function loadConfig() {
  if (isLoaded) return config;

  // 1. Check for window global first (allows runtime override)
  if (typeof window !== 'undefined' && window.EKTACHROME_CONFIG) {
    Object.assign(config, window.EKTACHROME_CONFIG);
  }

  // 2. Try to load .env file for local development
  try {
    const response = await fetch('/.env');
    if (response.ok) {
      const text = await response.text();
      const envVars = parseEnvFile(text);
      Object.assign(config, envVars);
      console.log('[config] Loaded .env file');
    }
  } catch (e) {
    // .env file not found or not served - that's fine
  }

  // 3. Try relative path (for when served from /test/)
  if (!config.ANTHROPIC_API_KEY) {
    try {
      const response = await fetch('../.env');
      if (response.ok) {
        const text = await response.text();
        const envVars = parseEnvFile(text);
        Object.assign(config, envVars);
        console.log('[config] Loaded .env file (relative path)');
      }
    } catch (e) {
      // .env file not found - that's fine
    }
  }

  isLoaded = true;
  return config;
}

/**
 * Parse a .env file into key-value pairs
 */
function parseEnvFile(text) {
  const result = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Parse KEY=value (handle quoted values)
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
    if (match) {
      const [, key, rawValue] = match;
      // Remove surrounding quotes if present
      let value = rawValue.trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Get a configuration value
 */
export function getConfig(key) {
  return config[key] ?? null;
}

/**
 * Set a configuration value at runtime
 */
export function setConfig(key, value) {
  config[key] = value;
}

/**
 * Check if config has been loaded
 */
export function isConfigLoaded() {
  return isLoaded;
}
