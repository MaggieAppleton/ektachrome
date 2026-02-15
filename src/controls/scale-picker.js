/**
 * <scale-picker> - Pick from a named scale
 * 
 * Works for type sizes, border radii, shadows — anything with named steps.
 * Renders a horizontal segmented control with one button per scale step.
 *
 * Usage:
 * <scale-picker
 *   scale="typography"
 *   variable="--text-base"
 *   current-value="1rem">
 * </scale-picker>
 */
import { THEME } from '../utils/theme.js';

class ScalePicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._abortController = null;
  }

  connectedCallback() {
    // Clean up any previous listeners
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const scaleName = this.getAttribute('scale') || 'typography';
    const variable = this.getAttribute('variable');
    const currentValue = this.getAttribute('current-value') || '';

    const scales = {
      typography: [
        { name: 'xs',   value: '0.75rem',  label: 'XS' },
        { name: 'sm',   value: '0.875rem', label: 'SM' },
        { name: 'base', value: '1rem',     label: 'Base' },
        { name: 'lg',   value: '1.125rem', label: 'LG' },
        { name: 'xl',   value: '1.25rem',  label: 'XL' },
        { name: '2xl',  value: '1.5rem',   label: '2XL' },
        { name: '3xl',  value: '1.875rem', label: '3XL' },
      ],
      radius: [
        { name: 'none', value: '0px',    label: '0' },
        { name: 'sm',   value: '2px',    label: '2' },
        { name: 'md',   value: '4px',    label: '4' },
        { name: 'lg',   value: '8px',    label: '8' },
        { name: 'xl',   value: '12px',   label: '12' },
        { name: '2xl',  value: '16px',   label: '16' },
        { name: 'full', value: '9999px', label: '\u221E' },
      ],
      shadow: [
        { name: 'none', value: 'none',                          label: '0' },
        { name: 'sm',   value: '0 1px 2px rgba(0,0,0,0.05)',   label: 'SM' },
        { name: 'md',   value: '0 4px 6px rgba(0,0,0,0.1)',    label: 'MD' },
        { name: 'lg',   value: '0 10px 15px rgba(0,0,0,0.1)',  label: 'LG' },
        { name: 'xl',   value: '0 20px 25px rgba(0,0,0,0.1)',  label: 'XL' },
        { name: '2xl',  value: '0 25px 50px rgba(0,0,0,0.25)', label: '2XL' },
      ],
    };

    const scale = scales[scaleName] || scales.typography;

    // Find closest matching step to current value
    const trimmed = currentValue.trim();
    let activeIndex = -1;
    if (trimmed) {
      // Try exact match first
      activeIndex = scale.findIndex(s => s.value === trimmed);
      // For numeric scales (radius, typography), try numeric proximity
      if (activeIndex === -1) {
        const numericCurrent = parseFloat(trimmed);
        if (!isNaN(numericCurrent)) {
          let closestDist = Infinity;
          scale.forEach((s, i) => {
            const numericStep = parseFloat(s.value);
            if (!isNaN(numericStep)) {
              const dist = Math.abs(numericStep - numericCurrent);
              if (dist < closestDist) {
                closestDist = dist;
                activeIndex = i;
              }
            }
          });
        }
      }
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .segments {
          display: flex;
          gap: 1px;
          border-radius: ${THEME.radiusMd};
          overflow: hidden;
        }
        .segment {
          flex: 1;
          padding: 6px 6px;
          background: ${THEME.colorBgSubtle};
          border: none;
          cursor: pointer;
          font-family: ${THEME.fontMono};
          font-size: ${THEME.fontSizeXs};
          color: ${THEME.colorTextFaint};
          text-align: center;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .segment:hover {
          background: ${THEME.colorBgHoverStrong};
          color: ${THEME.colorTextMuted};
        }
        .segment.active {
          background: ${THEME.colorBgActive};
          color: ${THEME.colorText};
        }
      </style>
      <div class="segments">
        ${scale.map((step, i) => `
          <button class="segment ${i === activeIndex ? 'active' : ''}"
                  data-value="${step.value}"
                  data-name="${step.name}"
                  title="${step.name}: ${step.value}">
            ${step.label}
          </button>
        `).join('')}
      </div>
    `;

    this.shadowRoot.querySelectorAll('.segment').forEach(segment => {
      segment.addEventListener('click', () => {
        const value = segment.dataset.value;
        if (variable) {
          document.documentElement.style.setProperty(variable, value);
        }
        this.dispatchEvent(new CustomEvent('control-change', {
          bubbles: true,
          composed: true,
          detail: { variable, value, scaleName },
        }));
        // Update active state
        this.shadowRoot.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
        segment.classList.add('active');
      }, { signal });
    });
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._abortController = null;
  }
}

customElements.define('scale-picker', ScalePicker);
export { ScalePicker };
