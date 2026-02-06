/**
 * <color-token-control> - Pick from design system color tokens
 * 
 * Shows the current token (e.g., --color-primary) and lets you
 * adjust the token's value, which updates everywhere it's used.
 * 
 * Usage:
 * <color-token-control 
 *   variable="--color-primary"
 *   current-value="oklch(0.62 0.21 255)"
 *   usage-count="47">
 * </color-token-control>
 */
class ColorTokenControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const variable = this.getAttribute('variable');
    const usageCount = this.getAttribute('usage-count') || '?';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .token-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .token-name {
          font-family: 'SF Mono', monospace;
          font-size: 10px;
          color: rgba(232, 228, 222, 0.7);
        }
        .usage-badge {
          font-size: 9px;
          color: rgba(232, 228, 222, 0.4);
          background: rgba(255,255,255,0.06);
          padding: 1px 6px;
          border-radius: 8px;
        }
        .warning {
          font-size: 9px;
          color: rgba(255, 180, 80, 0.8);
          margin-top: 4px;
        }
      </style>
      <div class="token-header">
        <span class="token-name">${variable}</span>
        <span class="usage-badge">used ${usageCount}×</span>
      </div>
      <oklch-picker 
        key="${variable}" 
        label="Adjust token"
        lightness="${this._parseLightness()}"
        chroma="${this._parseChroma()}"
        hue="${this._parseHue()}">
      </oklch-picker>
      ${parseInt(usageCount) > 20 
        ? '<div class="warning">⚠ Changing this affects 20+ elements</div>' 
        : ''}
    `;
    
    // When the picker changes, update the CSS variable globally
    this.shadowRoot.addEventListener('control-change', (e) => {
      const { l, c, h } = e.detail.value;
      document.documentElement.style.setProperty(
        variable, 
        `oklch(${l} ${c} ${h})`
      );
    });
  }
  
  // ... parse current oklch value from the variable
}