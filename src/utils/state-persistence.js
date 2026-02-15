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
        console.warn('[state-persistence] Failed to load state:', e);
        return null;
      }
    },

    save(state) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        console.warn('[state-persistence] Failed to save state:', e);
      }
    },

    clear() {
      localStorage.removeItem(key);
    },

    /**
     * Track a variable change, preserving original value
     * @param {string} variable - CSS variable name (e.g., '--color-primary')
     * @param {string} newValue - New value being set
     * @param {string} originalValue - Original computed value before any changes
     */
    trackChange(variable, newValue, originalValue) {
      const state = this.load() || { variables: {} };
      
      if (!state.variables[variable]) {
        // First change - store original
        state.variables[variable] = {
          original: originalValue,
          current: newValue
        };
      } else {
        // Subsequent change - keep original, update current
        state.variables[variable].current = newValue;
      }
      
      this.save(state);
    },

    /**
     * Revert a single variable (remove from pending changes)
     * @param {string} variable - CSS variable name
     */
    revertVariable(variable) {
      const state = this.load();
      if (state?.variables?.[variable]) {
        delete state.variables[variable];
        this.save(state);
      }
    },

    /**
     * Get all pending changes in commit format
     * @returns {Array<{variable: string, original: string, current: string}>}
     */
    getPendingChanges() {
      const state = this.load();
      if (!state?.variables) return [];
      
      return Object.entries(state.variables).map(([variable, data]) => {
        // Handle both old format (string) and new format (object with original/current)
        if (typeof data === 'string') {
          return {
            variable,
            original: data, // In old format, we don't have original
            current: data
          };
        }
        return {
          variable,
          original: data.original,
          current: data.current
        };
      });
    },

    /**
     * Get count of pending changes
     * @returns {number}
     */
    getPendingCount() {
      const state = this.load();
      return Object.keys(state?.variables || {}).length;
    }
  };
}