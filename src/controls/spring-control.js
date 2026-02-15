/**
 * <spring-control> - Spring physics animation editor
 * 
 * Provides two control modes:
 * 1. Simple: visualDuration + bounce (Motion-compatible)
 * 2. Physics: stiffness + damping + mass
 * 
 * Outputs Motion-compatible spring config.
 * 
 * Attributes:
 * - variable: CSS variable name (optional)
 * - current-value: Current spring config as JSON
 * 
 * Events:
 * - control-change: { variable, value, springConfig }
 */

import { THEME, baseStyles } from '../utils/theme.js';

class SpringControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._abortController = null;

    // Default to Motion's natural spring
    this._visualDuration = 0.3;
    this._bounce = 0.2;
  }

  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this.setAttribute('data-ektachrome', '');

    // Parse initial value if provided
    const initialValue = this.getAttribute('current-value');
    if (initialValue) {
      this._parseInitialValue(initialValue);
    }

    this._render();
    this._wireEvents(signal);
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._abortController = null;
  }

  _render() {
    const variable = this.getAttribute('variable');

    this.shadowRoot.innerHTML = `
      <style>${SpringControl._styles()}</style>
      
      <div class="label">Spring ${variable ? `\u00B7 ${this._esc(variable)}` : ''}</div>
      
      <div class="preview">
        <canvas id="spring-preview"></canvas>
        <div class="preview-ball" id="preview-ball"></div>
      </div>
      
      <div class="sliders">
        <div class="slider-row">
          <span class="slider-label">Duration</span>
          <input type="range" class="slider" id="duration-slider"
                 min="0.1" max="1" step="0.05" value="${this._visualDuration}">
          <span class="slider-value" id="duration-value">${this._visualDuration}s</span>
        </div>
        <div class="slider-row">
          <span class="slider-label">Bounce</span>
          <input type="range" class="slider" id="bounce-slider"
                 min="0" max="0.5" step="0.05" value="${this._bounce}">
          <span class="slider-value" id="bounce-value">${this._bounce}</span>
        </div>
      </div>
      
      <div class="output" id="output">
        ${this._formatOutput()}
      </div>
      
      <button class="play-btn" id="play-btn" title="Play animation">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 1.5v9l8-4.5-8-4.5z"/>
        </svg>
        Preview
      </button>
    `;

    // Draw initial curve
    requestAnimationFrame(() => {
      this._drawSpringCurve();
    });
  }

  _wireEvents(signal) {
    const durationSlider = this.shadowRoot.getElementById('duration-slider');
    const bounceSlider = this.shadowRoot.getElementById('bounce-slider');
    const playBtn = this.shadowRoot.getElementById('play-btn');

    durationSlider?.addEventListener('input', (e) => {
      this._visualDuration = parseFloat(e.target.value);
      this._updateDisplay();
      this._emitChange();
    }, { signal });

    bounceSlider?.addEventListener('input', (e) => {
      this._bounce = parseFloat(e.target.value);
      this._updateDisplay();
      this._emitChange();
    }, { signal });

    playBtn?.addEventListener('click', () => {
      this._playPreview();
    }, { signal });
  }

  _updateDisplay() {
    const durationValue = this.shadowRoot.getElementById('duration-value');
    const bounceValue = this.shadowRoot.getElementById('bounce-value');
    const output = this.shadowRoot.getElementById('output');

    if (durationValue) durationValue.textContent = `${this._visualDuration}s`;
    if (bounceValue) bounceValue.textContent = this._bounce.toFixed(2);
    if (output) output.textContent = this._formatOutput();

    this._drawSpringCurve();
  }

  _formatOutput() {
    // Motion-compatible format
    return `{ type: "spring", visualDuration: ${this._visualDuration}, bounce: ${this._bounce} }`;
  }

  _emitChange() {
    const variable = this.getAttribute('variable');
    const value = {
      type: 'spring',
      visualDuration: this._visualDuration,
      bounce: this._bounce
    };

    this.dispatchEvent(new CustomEvent('control-change', {
      bubbles: true,
      composed: true,
      detail: {
        variable,
        value: JSON.stringify(value),
        springConfig: value
      }
    }));
  }

  _playPreview() {
    const ball = this.shadowRoot.getElementById('preview-ball');
    if (!ball) return;

    // Reset position
    ball.style.transition = 'none';
    ball.style.transform = 'translateX(0)';

    // Force reflow
    ball.offsetHeight;

    // Apply spring animation (approximated with CSS)
    const duration = this._visualDuration * 1000;
    const bounceEasing = this._bounce > 0.1 
      ? `cubic-bezier(0.34, ${1 + this._bounce * 2}, 0.64, 1)`
      : 'cubic-bezier(0.2, 0, 0, 1)';

    ball.style.transition = `transform ${duration}ms ${bounceEasing}`;
    ball.style.transform = 'translateX(calc(100% - 16px))';

    // Reset after animation
    setTimeout(() => {
      ball.style.transition = 'none';
      ball.style.transform = 'translateX(0)';
    }, duration + 100);
  }

  _drawSpringCurve() {
    const canvas = this.shadowRoot.getElementById('spring-preview');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = 4;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw target line (y = 1)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(pad, pad + (h - pad * 2) * 0.2);
    ctx.lineTo(w - pad, pad + (h - pad * 2) * 0.2);
    ctx.stroke();

    // Draw spring curve
    ctx.strokeStyle = 'rgba(120, 180, 220, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const duration = this._visualDuration;
    const bounce = this._bounce;

    // Simulate spring motion
    for (let t = 0; t <= 1; t += 0.01) {
      const y = this._springValue(t, duration, bounce);
      const x = pad + t * (w - pad * 2);
      
      // Map y (0 to ~1.2) to canvas coordinates
      // y=0 at bottom, y=1 near top, allow overshoot
      const yPos = (h - pad) - y * (h - pad * 2) * 0.8;

      if (t === 0) {
        ctx.moveTo(x, yPos);
      } else {
        ctx.lineTo(x, yPos);
      }
    }

    ctx.stroke();
  }

  _springValue(t, duration, bounce) {
    // Simplified spring approximation
    // Real spring would use stiffness/damping/mass
    const omega = (2 * Math.PI) / duration;
    const decay = (1 - bounce) * 5;

    if (bounce === 0) {
      // No bounce - ease out
      return 1 - Math.pow(1 - t, 3);
    }

    // Damped oscillation
    const dampedT = t * duration;
    const envelope = 1 - Math.exp(-decay * dampedT);
    const oscillation = Math.cos(omega * dampedT * (1 + bounce * 2));

    return envelope * (1 - oscillation * bounce * Math.exp(-dampedT * 3));
  }

  _parseInitialValue(value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.visualDuration !== undefined) {
        this._visualDuration = parsed.visualDuration;
      }
      if (parsed.bounce !== undefined) {
        this._bounce = parsed.bounce;
      }
    } catch {
      // Not JSON, might be a preset name - use defaults
    }
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
      
      .preview {
        height: 48px;
        margin-bottom: 8px;
        position: relative;
        background: rgba(255, 255, 255, 0.04);
        border-radius: ${THEME.radiusMd};
        overflow: hidden;
      }
      
      .preview canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      
      .preview-ball {
        position: absolute;
        bottom: 8px;
        left: 8px;
        width: 8px;
        height: 8px;
        background: rgba(120, 200, 150, 0.8);
        border-radius: 50%;
        pointer-events: none;
      }
      
      .sliders {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .slider-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .slider-label {
        font-size: ${THEME.fontSizeSm};
        font-family: ${THEME.fontMono};
        color: ${THEME.colorTextFaint};
        width: 56px;
        flex-shrink: 0;
      }
      
      .slider {
        flex: 1;
        -webkit-appearance: none;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        outline: none;
      }
      
      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        background: rgba(120, 180, 220, 0.8);
        border-radius: 50%;
        cursor: pointer;
        border: none;
      }
      
      .slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: rgba(120, 180, 220, 0.8);
        border-radius: 50%;
        cursor: pointer;
        border: none;
      }
      
      .slider-value {
        font-size: ${THEME.fontSizeMd};
        font-family: ${THEME.fontMono};
        color: ${THEME.colorTextMuted};
        width: 36px;
        text-align: right;
      }
      
      .output {
        margin-top: 8px;
        padding: 6px 8px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: ${THEME.radiusMd};
        font-size: ${THEME.fontSizeXs};
        font-family: ${THEME.fontMono};
        color: ${THEME.colorTextFaint};
        word-break: break-all;
        line-height: 1.4;
      }
      
      .play-btn {
        margin-top: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        padding: 6px;
        background: ${THEME.colorBgSubtle};
        border: none;
        border-radius: ${THEME.radiusMd};
        color: ${THEME.colorTextMuted};
        font-size: ${THEME.fontSizeSm};
        font-family: ${THEME.fontSystem};
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      
      .play-btn:hover {
        background: ${THEME.colorBgHover};
        color: ${THEME.colorText};
      }
      
      .play-btn svg {
        flex-shrink: 0;
      }
    `;
  }
}

customElements.define('spring-control', SpringControl);
export { SpringControl };
