/**
 * <duration-control> - Pick from a duration scale
 * 
 * Shows discrete duration steps: 0, 100, 150, 200, 300, 500, 750, 1000ms
 * Similar to spacing-step-control but for time values.
 * 
 * Attributes:
 * - variable: CSS variable name (e.g., '--transition-duration')
 * - property: CSS property (e.g., 'transition-duration')
 * - current-value: Current value (e.g., '200ms')
 * 
 * Events:
 * - control-change: { variable, property, value }
 */

import { THEME, baseStyles } from '../utils/theme.js';
import { DESIGN_SCALES } from '../utils/property-categories.js';

class DurationControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._abortController = null;
  }

  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this.setAttribute('data-ektachrome', '');

    const property = this.getAttribute('property') || 'transition-duration';
    const variable = this.getAttribute('variable');
    const currentValue = this.getAttribute('current-value') || '200ms';
    
    // Parse current value to milliseconds
    const currentMs = this._parseMs(currentValue);
    
    // Use scale from property-categories or default
    const scale = DESIGN_SCALES.duration || [
      { name: 'instant', value: '0ms', label: '0' },
      { name: 'fast', value: '100ms', label: '100' },
      { name: 'normal', value: '150ms', label: '150' },
      { name: 'medium', value: '200ms', label: '200' },
      { name: 'slow', value: '300ms', label: '300' },
      { name: 'slower', value: '500ms', label: '500' },
      { name: 'slowest', value: '750ms', label: '750' },
      { name: 'glacial', value: '1000ms', label: '1s' },
    ];
    
    // Find closest step
    const currentStep = this._findClosestStep(currentMs, scale);

    this.shadowRoot.innerHTML = `
      <style>${DurationControl._styles()}</style>
      <div class="label">${this._esc(property)} ${variable ? `\u00B7 ${this._esc(variable)}` : ''}</div>
      <div class="steps">
        ${scale.map(step => {
          const stepMs = this._parseMs(step.value);
          const active = stepMs === currentStep ? 'active' : '';
          return `
            <div class="step ${active}" data-value="${step.value}" data-ms="${stepMs}" title="${step.name}">
              ${step.label}
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.shadowRoot.querySelectorAll('.step').forEach(step => {
      step.addEventListener('click', () => {
        const value = step.dataset.value;
        
        if (variable) {
          document.documentElement.style.setProperty(variable, value);
        }
        
        this.dispatchEvent(new CustomEvent('control-change', {
          bubbles: true,
          composed: true,
          detail: { variable, property, value }
        }));
        
        // Update active state
        this.shadowRoot.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        step.classList.add('active');
      }, { signal });
    });
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._abortController = null;
  }

  /**
   * Parse a duration string to milliseconds
   */
  _parseMs(value) {
    if (!value) return 0;
    const str = String(value).trim().toLowerCase();
    
    if (str.endsWith('ms')) {
      return parseFloat(str);
    }
    if (str.endsWith('s')) {
      return parseFloat(str) * 1000;
    }
    // Assume milliseconds if no unit
    return parseFloat(str) || 0;
  }

  /**
   * Find the closest scale step to the current value
   */
  _findClosestStep(ms, scale) {
    let closest = 0;
    let minDiff = Infinity;
    
    for (const step of scale) {
      const stepMs = this._parseMs(step.value);
      const diff = Math.abs(stepMs - ms);
      if (diff < minDiff) {
        minDiff = diff;
        closest = stepMs;
      }
    }
    
    return closest;
  }

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  static _styles() {
    return `
      ${baseStyles}
      
      :host {
        display: block;
      }
      
      .label {
        font-size: ${THEME.fontSizeMd};
        font-family: ${THEME.fontMono};
        color: ${THEME.colorTextMuted};
        margin-bottom: 6px;
      }
      
      .steps {
        display: flex;
        gap: 2px;
        align-items: center;
      }
      
      .step {
        flex: 1;
        height: 26px;
        background: ${THEME.colorBgSubtle};
        border-radius: ${THEME.radiusSm};
        cursor: pointer;
        transition: background 0.1s, color 0.1s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${THEME.fontSizeSm};
        font-family: ${THEME.fontMono};
        color: ${THEME.colorTextFaint};
      }
      
      .step:hover {
        background: ${THEME.colorBgHover};
        color: ${THEME.colorTextMuted};
      }
      
      .step.active {
        background: rgba(120, 180, 220, 0.3);
        color: ${THEME.colorText};
      }
    `;
  }
}

customElements.define('duration-control', DurationControl);
export { DurationControl };
