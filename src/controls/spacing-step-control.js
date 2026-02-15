/**
 * <spacing-step-control> - Pick from a spacing scale
 * 
 * Instead of a continuous slider, shows discrete steps
 * on your spacing grid (e.g., 4px base = 0, 4, 8, 12, 16, 24, 32, 48, 64)
 */
class SpacingStepControl extends HTMLElement {
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

    const property = this.getAttribute('property'); // 'padding', 'margin', 'gap'
    const variable = this.getAttribute('variable');  // '--space-4'
    const baseUnit = parseInt(this.getAttribute('base-unit') || '4');
    const currentPx = parseInt(this.getAttribute('current-value') || '16');
    
    // Generate the scale: 0, 4, 8, 12, 16, 24, 32, 48, 64
    const scale = [0, 1, 2, 3, 4, 6, 8, 12, 16].map(n => n * baseUnit);
    
    // Find closest step to current value
    const currentStep = scale.reduce((prev, curr) => 
      Math.abs(curr - currentPx) < Math.abs(prev - currentPx) ? curr : prev
    );
    
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .label {
          font-size: 10px;
          font-family: 'SF Mono', monospace;
          color: rgba(232, 228, 222, 0.7);
          margin-bottom: 4px;
        }
        .steps {
          display: flex;
          gap: 2px;
          align-items: flex-end;
        }
        .step {
          width: 20px;
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.1s;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 2px;
        }
        .step:hover { background: rgba(255,255,255,0.15); }
        .step.active { background: rgba(120, 200, 150, 0.3); }
        .step-label {
          font-size: 8px;
          color: rgba(232,228,222,0.4);
        }
      </style>
      <div class="label">${property} · ${variable || 'inline'}</div>
      <div class="steps">
        ${scale.map(px => `
          <div class="step ${px === currentStep ? 'active' : ''}" 
               data-value="${px}"
               style="height: ${8 + (px / baseUnit) * 3}px">
            <span class="step-label">${px}</span>
          </div>
        `).join('')}
      </div>
    `;
    
    this.shadowRoot.querySelectorAll('.step').forEach(step => {
      step.addEventListener('click', () => {
        const value = step.dataset.value + 'px';
        if (variable) {
          document.documentElement.style.setProperty(variable, value);
        }
        this.dispatchEvent(new CustomEvent('control-change', {
          bubbles: true, composed: true,
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
}

customElements.define('spacing-step-control', SpacingStepControl);
export { SpacingStepControl };