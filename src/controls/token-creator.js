/**
 * <token-creator> - Dialog for creating new CSS custom property tokens
 * 
 * Shows when a user wants to tokenize a hardcoded value.
 * Offers name suggestions, scope selection, and preview.
 * 
 * Attributes:
 * - property: CSS property being tokenized (e.g., "padding")
 * - value: Current hardcoded value (e.g., "24px")
 * - element-selector: Suggested scope based on selected element
 * 
 * Events:
 * - token-created: After successful creation, detail: { name, value, scope, file }
 * - token-cancelled: User cancelled
 */

import { THEME, baseStyles } from '../utils/theme.js';

class TokenCreator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._abortController = null;
    this._serverConnected = false;
  }

  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this.setAttribute('data-ektachrome', '');
    
    // Check server connection then render
    this._checkServerConnection().then(() => {
      this._render();
      this._wireEvents(signal);
    });
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._abortController = null;
  }

  /**
   * Show the dialog (can be called after appending to DOM)
   */
  show() {
    this.style.display = 'block';
    // Focus the name input
    const input = this.shadowRoot.querySelector('.name-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  /**
   * Hide the dialog
   */
  hide() {
    this.style.display = 'none';
  }

  async _checkServerConnection() {
    try {
      const response = await fetch('/__ektachrome/status');
      if (response.ok) {
        this._serverConnected = true;
      }
    } catch {
      this._serverConnected = false;
    }
  }

  _render() {
    const property = this.getAttribute('property') || '';
    const value = this.getAttribute('value') || '';
    const elementSelector = this.getAttribute('element-selector') || '.component';
    
    const suggestedName = this._suggestTokenName(property, elementSelector);
    
    this.shadowRoot.innerHTML = `
      <style>${TokenCreator._styles()}</style>
      <div class="overlay" data-ektachrome>
        <div class="dialog" data-ektachrome>
          <div class="header">
            <span class="title">Create Token</span>
            <button class="close" aria-label="Close">\u00D7</button>
          </div>
          
          <div class="body">
            <div class="info-row">
              <span class="info-label">Property:</span>
              <span class="info-value">${this._esc(property)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Value:</span>
              <span class="info-value">${this._esc(value)}</span>
            </div>
            
            <div class="field">
              <label class="field-label">Token name</label>
              <input type="text" class="name-input" value="${this._esc(suggestedName)}" spellcheck="false">
            </div>
            
            <div class="field">
              <label class="field-label">Scope</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" name="scope" value=":root" class="scope-radio">
                  <span class="radio-text">:root <span class="radio-hint">(global token)</span></span>
                </label>
                <label class="radio-label">
                  <input type="radio" name="scope" value="${this._esc(elementSelector)}" class="scope-radio" checked>
                  <span class="radio-text">${this._esc(elementSelector)} <span class="radio-hint">(component token)</span></span>
                </label>
              </div>
            </div>
            
            <div class="field">
              <label class="field-label">Preview</label>
              <pre class="preview">${this._generatePreview(suggestedName, value, elementSelector)}</pre>
            </div>
          </div>
          
          <div class="footer">
            <button class="btn cancel-btn">Cancel</button>
            <button class="btn create-btn" ${!this._serverConnected ? 'disabled title="Dev server not connected"' : ''}>Create</button>
          </div>
        </div>
      </div>
    `;
  }

  _wireEvents(signal) {
    const closeBtn = this.shadowRoot.querySelector('.close');
    const cancelBtn = this.shadowRoot.querySelector('.cancel-btn');
    const createBtn = this.shadowRoot.querySelector('.create-btn');
    const nameInput = this.shadowRoot.querySelector('.name-input');
    const scopeRadios = this.shadowRoot.querySelectorAll('.scope-radio');
    const overlay = this.shadowRoot.querySelector('.overlay');

    // Close actions
    closeBtn?.addEventListener('click', () => this._cancel(), { signal });
    cancelBtn?.addEventListener('click', () => this._cancel(), { signal });
    
    // Click outside to close
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) this._cancel();
    }, { signal });

    // Create action
    createBtn?.addEventListener('click', () => this._create(), { signal });

    // Update preview on name change
    nameInput?.addEventListener('input', () => this._updatePreview(), { signal });

    // Update preview on scope change
    scopeRadios.forEach(radio => {
      radio.addEventListener('change', () => this._updatePreview(), { signal });
    });

    // Enter to create
    nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this._serverConnected) {
        this._create();
      }
    }, { signal });
  }

  _suggestTokenName(property, elementSelector) {
    // Extract component name from selector
    const component = elementSelector
      .replace(/^\./, '')           // Remove leading dot
      .replace(/[^a-zA-Z0-9-]/g, '-') // Replace special chars with hyphens
      .replace(/-+/g, '-')          // Collapse multiple hyphens
      .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
      .toLowerCase();
    
    // Map property to semantic suffix
    const suffixes = {
      'padding': 'padding',
      'padding-top': 'padding-top',
      'padding-right': 'padding-right',
      'padding-bottom': 'padding-bottom',
      'padding-left': 'padding-left',
      'padding-inline': 'padding-x',
      'padding-block': 'padding-y',
      'margin': 'margin',
      'margin-top': 'margin-top',
      'margin-right': 'margin-right',
      'margin-bottom': 'margin-bottom',
      'margin-left': 'margin-left',
      'margin-inline': 'margin-x',
      'margin-block': 'margin-y',
      'gap': 'gap',
      'border-radius': 'radius',
      'font-size': 'text-size',
      'font-weight': 'font-weight',
      'line-height': 'line-height',
      'background-color': 'bg',
      'background': 'bg',
      'color': 'text',
      'border-color': 'border',
      'transition-duration': 'duration',
      'animation-duration': 'duration',
      'transition-timing-function': 'easing',
      'animation-timing-function': 'easing',
    };
    
    const suffix = suffixes[property] || property.replace(/[^a-zA-Z0-9-]/g, '-');
    return `--${component}-${suffix}`;
  }

  _generatePreview(name, value, scope) {
    const property = this.getAttribute('property') || '';
    
    return `${scope} {
  ${name}: ${value};
  ${property}: var(${name});
}`;
  }

  _updatePreview() {
    const nameInput = this.shadowRoot.querySelector('.name-input');
    const scopeRadio = this.shadowRoot.querySelector('.scope-radio:checked');
    const preview = this.shadowRoot.querySelector('.preview');
    
    if (nameInput && scopeRadio && preview) {
      const name = nameInput.value.trim();
      const scope = scopeRadio.value;
      const value = this.getAttribute('value') || '';
      
      preview.textContent = this._generatePreview(name, value, scope);
    }
  }

  _cancel() {
    this.dispatchEvent(new CustomEvent('token-cancelled', {
      bubbles: true,
      composed: true
    }));
    this.remove();
  }

  async _create() {
    const nameInput = this.shadowRoot.querySelector('.name-input');
    const scopeRadio = this.shadowRoot.querySelector('.scope-radio:checked');
    const createBtn = this.shadowRoot.querySelector('.create-btn');
    
    if (!nameInput || !scopeRadio) return;
    
    const name = nameInput.value.trim();
    const scope = scopeRadio.value;
    const value = this.getAttribute('value') || '';
    const property = this.getAttribute('property') || '';
    
    // Validate name
    if (!name.startsWith('--')) {
      nameInput.classList.add('error');
      return;
    }
    
    // Disable button during request
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
    }
    
    try {
      const response = await fetch('/__ektachrome/create-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value, scope, property })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Apply the new variable immediately for live preview
        document.documentElement.style.setProperty(name, value);
        
        this.dispatchEvent(new CustomEvent('token-created', {
          bubbles: true,
          composed: true,
          detail: { name, value, scope, file: result.file, line: result.line }
        }));
        this.remove();
      } else {
        console.error('[token-creator] Failed to create token:', result.error);
        if (createBtn) {
          createBtn.disabled = false;
          createBtn.textContent = 'Create';
        }
      }
    } catch (error) {
      console.error('[token-creator] Error creating token:', error);
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = 'Create';
      }
    }
  }

  _esc(str) {
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
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        display: block;
      }
      
      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }
      
      .dialog {
        background: ${THEME.colorBgPopup};
        border: 1px solid ${THEME.colorBorder};
        border-radius: ${THEME.radiusLg};
        width: 340px;
        max-width: 90vw;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
        font-family: ${THEME.fontSystem};
        color: ${THEME.colorText};
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid ${THEME.colorBorderSubtle};
      }
      
      .title {
        font-size: ${THEME.fontSizeXl};
        font-weight: 500;
      }
      
      .close {
        background: none;
        border: none;
        color: ${THEME.colorTextFaint};
        font-size: 18px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      }
      .close:hover {
        color: ${THEME.colorText};
      }
      
      .body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .info-row {
        display: flex;
        gap: 8px;
        font-size: ${THEME.fontSizeLg};
      }
      
      .info-label {
        color: ${THEME.colorTextFaint};
        min-width: 60px;
      }
      
      .info-value {
        font-family: ${THEME.fontMono};
        color: ${THEME.colorText};
      }
      
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .field-label {
        font-size: ${THEME.fontSizeMd};
        color: ${THEME.colorTextMuted};
      }
      
      .name-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid ${THEME.colorBorderSubtle};
        border-radius: ${THEME.radiusMd};
        padding: 8px 10px;
        font-family: ${THEME.fontMono};
        font-size: ${THEME.fontSizeLg};
        color: ${THEME.colorText};
        outline: none;
        transition: border-color 0.15s;
      }
      .name-input:focus {
        border-color: ${THEME.colorActive};
      }
      .name-input.error {
        border-color: rgba(255, 100, 100, 0.5);
      }
      
      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .radio-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: ${THEME.fontSizeLg};
      }
      
      .radio-text {
        color: ${THEME.colorText};
      }
      
      .radio-hint {
        color: ${THEME.colorTextFaint};
        font-size: ${THEME.fontSizeSm};
      }
      
      .scope-radio {
        accent-color: rgb(120, 200, 150);
      }
      
      .preview {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid ${THEME.colorBorderSubtle};
        border-radius: ${THEME.radiusMd};
        padding: 10px;
        font-family: ${THEME.fontMono};
        font-size: ${THEME.fontSizeSm};
        color: ${THEME.colorTextMuted};
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.5;
      }
      
      .footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid ${THEME.colorBorderSubtle};
      }
      
      .btn {
        padding: 6px 14px;
        border-radius: ${THEME.radiusMd};
        font-size: ${THEME.fontSizeLg};
        font-family: ${THEME.fontSystem};
        cursor: pointer;
        border: none;
        transition: background 0.15s, opacity 0.15s;
      }
      
      .cancel-btn {
        background: ${THEME.colorBgSubtle};
        color: ${THEME.colorTextMuted};
      }
      .cancel-btn:hover {
        background: ${THEME.colorBgHover};
      }
      
      .create-btn {
        background: ${THEME.colorActive};
        color: ${THEME.colorText};
      }
      .create-btn:hover:not(:disabled) {
        background: rgba(120, 200, 150, 0.4);
      }
      .create-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

customElements.define('token-creator', TokenCreator);
export { TokenCreator };
