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
    this._abortController = null;
  }

  connectedCallback() {
    // Guard against multiple connectedCallback calls
    this.shadowRoot.innerHTML = '';
    this._abortController?.abort();
    this._abortController = new AbortController();

    const variable = this.getAttribute('variable');
    const usageCount = this.getAttribute('usage-count') || '?';
    const { l, c, h } = this._parseOklch();
    
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
      <!-- oklch-picker is an external dependency from Kodachrome and must be loaded separately -->
      <oklch-picker 
        key="${variable}" 
        label="Adjust token"
        lightness="${l}"
        chroma="${c}"
        hue="${h}">
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
      // Re-dispatch with token metadata so parent components can react
      this.dispatchEvent(new CustomEvent('control-change', {
        bubbles: true, composed: true,
        detail: { variable, value: `oklch(${l} ${c} ${h})` }
      }));
    }, { signal: this._abortController.signal });
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._abortController = null;
  }
  
  /**
   * Parse the current-value attribute as an oklch() string.
   * Returns { l, c, h } with sensible defaults if parsing fails.
   */
  _parseOklch() {
    const value = this.getAttribute('current-value') || '';
    const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    return {
      l: match ? parseFloat(match[1]) : 0.5,
      c: match ? parseFloat(match[2]) : 0.15,
      h: match ? parseFloat(match[3]) : 0,
    };
  }
}

customElements.define('color-token-control', ColorTokenControl);
export { ColorTokenControl };
