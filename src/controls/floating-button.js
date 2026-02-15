/**
 * <floating-button> - Circular activation button for Ektachrome
 * 
 * Fixed position button in the bottom-right corner that activates
 * element selection mode. Shows a crosshair/target icon.
 * 
 * Events:
 * - activate: User clicked to activate element picker
 * - deactivate: User clicked to deactivate
 */

import { THEME } from '../utils/theme.js';

class FloatingButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._active = false;
  }

  connectedCallback() {
    this.setAttribute('data-ektachrome', '');
    this._render();
    this._wireEvents();
  }

  disconnectedCallback() {
    // Clean up if needed
  }

  get active() {
    return this._active;
  }

  set active(value) {
    this._active = Boolean(value);
    this._updateState();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${FloatingButton._styles()}</style>
      <button class="fab" aria-label="Activate element picker" title="Select element to inspect">
        <svg class="icon icon-crosshair" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
        <svg class="icon icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
  }

  _wireEvents() {
    const btn = this.shadowRoot.querySelector('.fab');
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._active = !this._active;
      this._updateState();
      
      this.dispatchEvent(new CustomEvent(this._active ? 'activate' : 'deactivate', {
        bubbles: true,
        composed: true
      }));
    });
  }

  _updateState() {
    const btn = this.shadowRoot.querySelector('.fab');
    if (btn) {
      btn.classList.toggle('active', this._active);
      btn.setAttribute('aria-pressed', String(this._active));
      btn.setAttribute('title', this._active ? 'Deactivate picker' : 'Select element to inspect');
    }
  }

  static _styles() {
    return `
      :host {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999998;
        display: block;
      }
      
      .fab {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(14, 12, 16, 0.95);
        border: 1px solid ${THEME.colorBorder};
        color: ${THEME.colorTextMuted};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        backdrop-filter: ${THEME.backdropBlur};
        -webkit-backdrop-filter: ${THEME.backdropBlur};
      }
      
      .fab:hover {
        background: rgba(24, 22, 28, 0.98);
        border-color: ${THEME.colorBorderHover};
        color: ${THEME.colorText};
        transform: scale(1.05);
      }
      
      .fab.active {
        background: ${THEME.colorText};
        border-color: ${THEME.colorText};
        color: rgba(14, 12, 16, 1);
      }
      
      .fab.active:hover {
        background: rgba(232, 228, 222, 0.9);
        transform: scale(1.05);
      }
      
      .icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
      
      .icon-crosshair {
        display: block;
      }
      
      .icon-close {
        display: none;
      }
      
      .fab.active .icon-crosshair {
        display: none;
      }
      
      .fab.active .icon-close {
        display: block;
      }
    `;
  }
}

customElements.define('floating-button', FloatingButton);
export { FloatingButton };
