/**
 * Claude API client for Ektachrome
 * 
 * Shared client for all Claude API interactions with consistent
 * error handling and JSON parsing.
 */

import { getConfig } from './config.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Call Claude API with a system prompt and user message
 * 
 * @param {object} options
 * @param {string} options.system - System prompt
 * @param {string} options.prompt - User message
 * @param {string} [options.apiKey] - API key (falls back to config)
 * @param {number} [options.maxTokens=1024] - Max tokens to generate
 * @returns {Promise<string>} Raw response text
 * @throws {Error} If API key is missing or API call fails
 */
export async function callClaude({ system, prompt, apiKey, maxTokens = 1024 }) {
  apiKey = apiKey || getConfig('ANTHROPIC_API_KEY');
  
  if (!apiKey) {
    throw new Error('No Claude API key configured. Set ANTHROPIC_API_KEY in .env file.');
  }
  
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  return data.content[0].text;
}

/**
 * Call Claude API and parse JSON from response
 * 
 * @param {object} options - Same as callClaude
 * @param {string} [options.jsonType='object'] - Expected type: 'object' or 'array'
 * @returns {Promise<object|array>} Parsed JSON
 * @throws {Error} If parsing fails or JSON not found
 */
export async function callClaudeJSON({ system, prompt, apiKey, maxTokens = 1024, jsonType = 'object' }) {
  const responseText = await callClaude({ system, prompt, apiKey, maxTokens });
  
  // Try to extract JSON from the response
  const pattern = jsonType === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = responseText.match(pattern);
  
  if (!match) {
    console.warn('[claude-client] No JSON found in response:', responseText);
    throw new Error('No JSON found in Claude response');
  }
  
  try {
    return JSON.parse(match[0]);
  } catch (parseError) {
    console.warn('[claude-client] Failed to parse JSON:', parseError);
    throw new Error(`Failed to parse Claude response as JSON: ${parseError.message}`);
  }
}

/**
 * Check if Claude API is available (API key is configured)
 * @returns {boolean}
 */
export function isClaudeAvailable() {
  return Boolean(getConfig('ANTHROPIC_API_KEY'));
}
