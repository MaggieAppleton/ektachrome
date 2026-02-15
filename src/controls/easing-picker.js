/**
 * <easing-picker> - Visual easing curve selector
 * 
 * Shows preset curves with small canvas previews.
 * Optionally allows custom cubic-bezier input.
 * 
 * Attributes:
 * - variable: CSS variable name (e.g., '--transition-ease')
 * - property: CSS property (e.g., 'transition-timing-function')
 * - current-value: Current value (e.g., 'ease-out')
 * 
 * Events:
 * - control-change: { variable, property, value }
 */

import { THEME, baseStyles } from '../utils/theme.js';
import { DESIGN_SCALES } from '../utils/property-categories.js';

class EasingPicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._abortController = null;
  }

  static get PRESETS() {
    return DESIGN_SCALES.easing || [
      { name: 'linear', value: 'linear', label: 'Linear', points: [0, 0, 1, 1] },
      { name: 'ease', value: 'ease', label: 'Ease', points: [0.25, 0.1, 0.25, 1] },
      { name: 'ease-in', value: 'ease-in', label: 'In', points: [0.42, 0, 1, 1] },
      { name: 'ease-out', value: 'ease-out', label: 'Out', points: [0, 0, 0.58, 1] },
      { name: 'ease-in-out', value: 'ease-in-out', label: 'InOut', points: [0.42, 0, 0.58, 1] },
      { name: 'snappy', value: 'cubic-bezier(0.2, 0, 0, 1)', label: 'Snappy', points: [0.2, 0, 0, 1] },
      { name: 'bounce', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', label: 'Bounce', points: [0.34, 1.56, 0.64, 1] },
    ];
  }

  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this.setAttribute('data-ektachrome', '');

    const property = this.getAttribute('property') || 'transition-timing-function';
    const variable = this.getAttribute('variable');
    const currentValue = this.getAttribute('current-value') || 'ease';

    this.shadowRoot.innerHTML = `
      <style>${EasingPicker._styles()}</style>
      <div class="label">${this._esc(property)} ${variable ? `\u00B7 ${this._esc(variable)}` : ''}</div>
      <div class="curves">
        ${EasingPicker.PRESETS.map(preset => `
          <div class="curve ${this._isCurrentPreset(currentValue, preset) ? 'active' : ''}" 
               data-value="${this._escAttr(preset.value)}"
               data-name="${preset.name}">
            <canvas data-points="${preset.points.join(',')}"></canvas>
            <div class="curve-name">${preset.label}</div>
          </div>
        `).join('')}
      </div>
    `;

    // Draw curves after DOM is ready
    requestAnimationFrame(() => {
      this.shadowRoot.querySelectorAll('canvas').forEach(canvas => {
        const points = canvas.dataset.points.split(',').map(Number);
        this._drawCurve(canvas, points);
      });
    });

    // Wire click handlers
    this.shadowRoot.querySelectorAll('.curve').forEach(curve => {
      curve.addEventListener('click', () => {
        const value = curve.dataset.value;
        
        if (variable) {
          document.documentElement.style.setProperty(variable, value);
        }
        
        this.dispatchEvent(new CustomEvent('control-change', {
          bubbles: true,
          composed: true,
          detail: { variable, property, value }
        }));
        
        // Update active state
        this.shadowRoot.querySelectorAll('.curve').forEach(c => c.classList.remove('active'));
        curve.classList.add('active');
      }, { signal });
    });
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._abortController = null;
  }

  _isCurrentPreset(currentValue, preset) {
    if (!currentValue) return false;
    const normalized = currentValue.toLowerCase().replace(/\s+/g, '');
    const presetNormalized = preset.value.toLowerCase().replace(/\s+/g, '');
    
    return normalized === presetNormalized ||
           normalized === preset.name ||
           normalized.includes(preset.points.join(','));
  }

  _drawCurve(canvas, [x1, y1, x2, y2]) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = 3;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw curve
    ctx.strokeStyle = 'rgba(232, 228, 222, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);

    // Draw bezier curve
    for (let t = 0; t <= 1; t += 0.02) {
      const x = this._bezierX(t, x1, x2);
      const y = this._bezierY(t, y1, y2);
      
      // Clamp y to prevent overflow for bounce curves
      const clampedY = Math.max(0, Math.min(1.2, y));
      
      ctx.lineTo(
        pad + x * (w - pad * 2),
        (h - pad) - clampedY * (h - pad * 2) * 0.8
      );
    }

    ctx.stroke();
  }

  _bezierX(t, x1, x2) {
    return 3 * (1 - t) * (1 - t) * t * x1 +
           3 * (1 - t) * t * t * x2 +
           t * t * t;
  }

  _bezierY(t, y1, y2) {
    return 3 * (1 - t) * (1 - t) * t * y1 +
           3 * (1 - t) * t * t * y2 +
           t * t * t;
  }

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _escAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
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
      
      .curves {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
      }
      
      .curve {
        background: ${THEME.colorBgSubtle};
        border-radius: ${THEME.radiusMd};
        padding: 6px 4px 4px;
        cursor: pointer;
        transition: background 0.1s;
        text-align: center;
      }
      
      .curve:hover {
        background: ${THEME.colorBgHover};
      }
      
      .curve.active {
        background: rgba(120, 180, 220, 0.3);
      }
      
      .curve canvas {
        width: 100%;
        height: 28px;
        display: block;
      }
      
      .curve-name {
        font-size: ${THEME.fontSizeXs};
        font-family: ${THEME.fontMono};
        color: ${THEME.colorTextFaint};
        margin-top: 3px;
      }
      
      .curve.active .curve-name {
        color: ${THEME.colorText};
      }
    `;
  }
}

customElements.define('easing-picker', EasingPicker);
export { EasingPicker };
