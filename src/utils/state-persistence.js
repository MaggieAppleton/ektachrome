/**
 * State persistence utility for design system adjustments.
 * Auto-saves variable adjustments to localStorage for the current session.
 * 
 * Usage:
 *   import { createPersistence } from './state-persistence.js';
 *   const persistence = createPersistence('ektachrome-session');
 *   const savedState = persistence.load();
 *   // merge with defaults: Object.assign(state, savedState);
 *   // on change: persistence.save(state);
 */

export function createPersistence(sessionId) {
  const key = `${sessionId}-state`;

  return {
    load() {
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        console.warn(`Failed to load state for ${sessionId}:`, e);
        return null;
      }
    },

    save(state) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        console.warn(`Failed to save state for ${sessionId}:`, e);
      }
    },

    clear() {
      localStorage.removeItem(key);
    }
  };
}