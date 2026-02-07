/**
 * <toolbar-popup> - Appears when an element is selected via ElementPicker.
 *
 * Shows which design tokens control the element and lets users
 * adjust them through constrained controls (color-token-control,
 * spacing-step-control, scale-picker).
 */
import { findCSSVariablesForElement } from '../scanner/detect-css-vars.js';

const CATEGORY_MATCHERS = {
  color: /^(color|background-color|background|border-color)$/,
  spacing: /^(padding|padding-top|padding-right|padding-bottom|padding-left|padding-inline|padding-block|margin|margin-top|margin-right|margin-bottom|margin-left|margin-inline|margin-block|gap|row-gap|column-gap)$/,
  type: /^(font-size|font-weight|font-family|line-height|letter-spacing)$/,
  radius: /^(border-radius|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius)$/,
};

const TAB_LABELS = {
  color: 'Color',
  spacing: 'Spacing',
  type: 'Type',
  radius: 'Radius',
};

class ToolbarPopup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._activeTab = null;
    this._grouped = {};  // { color: [...], spacing: [...], ... }
    this._elementInfo = null;
    this._rafId = null;
  }

  connectedCallback() {
    this.setAttribute('data-ektachrome', '');
    this.style.display = 'none';
    this._render();
  }

  /**
   * Show the popup for a selected element.
   * @param {{ element: Element, name: string, path: string, rect: DOMRect, computedStyles: CSSStyleDeclaration }} elementInfo
   */
  show(elementInfo) {
    this._elementInfo = elementInfo;

    // Resolve tokens
    const vars = findCSSVariablesForElement(elementInfo.element);
    this._grouped = this._groupByCategory(vars);

    // Pick initial tab: first category that has tokens
    const availableTabs = Object.keys(this._grouped).filter(
      k => this._grouped[k].length > 0,
    );
    this._activeTab = availableTabs[0] || null;

    this._render();
    this.style.display = 'block';
    this._position(elementInfo.rect);
  }

  /** Hide the popup and clear state. */
  hide() {
    this.style.display = 'none';
    this._elementInfo = null;
    this._grouped = {};
    this._activeTab = null;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  disconnectedCallback() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._elementInfo = null;
    this._grouped = {};
    this._activeTab = null;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _groupByCategory(vars) {
    const groups = { color: [], spacing: [], type: [], radius: [] };
    for (const v of vars) {
      for (const [cat, re] of Object.entries(CATEGORY_MATCHERS)) {
        if (re.test(v.property)) {
          groups[cat].push(v);
          break;
        }
      }
    }
    return groups;
  }

  _position(rect) {
    const GAP = 8;
    const popup = this;

    if (this._rafId) cancelAnimationFrame(this._rafId);

    // Capture rect as local variable so stale state can't cause issues
    const targetRect = rect;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (!this._elementInfo) return; // guard against hide() during rAF

      const popupRect = popup.getBoundingClientRect();
      let top, left;

      // Default: below the element
      top = targetRect.bottom + GAP;
      if (top + popupRect.height > window.innerHeight) {
        // Not enough room below — try above
        top = targetRect.top - popupRect.height - GAP;
      }
      // Still off-screen? Clamp to viewport
      top = Math.max(GAP, Math.min(top, window.innerHeight - popupRect.height - GAP));

      // Horizontal: align left edge with element, but keep in viewport
      left = targetRect.left;
      left = Math.max(GAP, Math.min(left, window.innerWidth - popupRect.width - GAP));

      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
    });
  }

  _render() {
    const info = this._elementInfo;
    const hasTokens = Object.values(this._grouped).some(a => a.length > 0);

    this.shadowRoot.innerHTML = `
      <style>${ToolbarPopup._styles()}</style>
      <div class="popup" data-ektachrome>
        ${info ? this._renderHeader(info) : ''}
        ${info && hasTokens ? this._renderTabs() : ''}
        ${info && hasTokens ? `<div class="content">${this._renderControls()}</div>` : ''}
        ${info && !hasTokens ? `<div class="empty">No CSS variables found for this element. It may use hardcoded values.</div>` : ''}
        <button class="close" aria-label="Close">\u00D7</button>
      </div>
    `;

    // Wire close button
    this.shadowRoot.querySelector('.close')?.addEventListener('click', () => this.hide());

    // Wire tab buttons
    this.shadowRoot.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeTab = btn.dataset.cat;
        // Re-render just the tabs + content area (full re-render is simpler and cheap)
        this._render();
        this._position(this._elementInfo.rect);
      });
    });
  }

  _renderHeader(info) {
    return `
      <div class="header">
        <div class="el-name">${this._esc(info.name)}</div>
        <div class="el-path">${this._esc(info.path)}</div>
      </div>
    `;
  }

  _renderTabs() {
    const tabs = Object.entries(TAB_LABELS)
      .filter(([cat]) => this._grouped[cat]?.length > 0)
      .map(([cat, label]) => {
        const active = cat === this._activeTab ? 'active' : '';
        return `<button class="tab ${active}" data-cat="${cat}">${label}</button>`;
      })
      .join('');
    return `<div class="tabs">${tabs}</div>`;
  }

  _renderControls() {
    const items = this._grouped[this._activeTab] || [];
    if (items.length === 0) return '';

    switch (this._activeTab) {
      case 'color':
        return items.map(v =>
          `<color-token-control variable="${this._esc(v.variable)}" current-value="${this._esc(v.currentValue)}"></color-token-control>`
        ).join('');

      case 'spacing':
        return items.map(v =>
          `<spacing-step-control variable="${this._esc(v.variable)}" property="${this._esc(v.property)}" current-value="${this._esc(v.currentValue)}"></spacing-step-control>`
        ).join('');

      case 'type':
        return items.map(v =>
          `<scale-picker scale="typography" variable="${this._esc(v.variable)}" current-value="${this._esc(v.currentValue)}"></scale-picker>`
        ).join('');

      case 'radius':
        return items.map(v =>
          `<scale-picker scale="radius" variable="${this._esc(v.variable)}" current-value="${this._esc(v.currentValue)}"></scale-picker>`
        ).join('');

      default:
        return '';
    }
  }

  /** Minimal HTML-attribute escaping. */
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
      :host {
        position: fixed;
        z-index: 999998;
        pointer-events: auto;
      }
      .popup {
        position: relative;
        background: rgba(28, 28, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        min-width: 280px;
        max-width: 360px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, 'SF Pro', sans-serif;
        color: rgba(232, 228, 222, 0.9);
        backdrop-filter: blur(12px);
        box-sizing: border-box;
      }

      /* Header */
      .header { margin-bottom: 8px; }
      .el-name {
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 2px;
      }
      .el-path {
        font-family: 'SF Mono', monospace;
        font-size: 10px;
        color: rgba(232, 228, 222, 0.4);
        margin-bottom: 8px;
        word-break: break-all;
      }

      /* Tabs */
      .tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 0;
      }
      .tab {
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        border: none;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(232, 228, 222, 0.5);
        font-family: inherit;
        transition: background 0.1s, color 0.1s;
      }
      .tab:hover {
        background: rgba(255, 255, 255, 0.12);
        color: rgba(232, 228, 222, 0.7);
      }
      .tab.active {
        background: rgba(120, 200, 150, 0.2);
        color: rgba(232, 228, 222, 0.9);
      }

      /* Content area */
      .content {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* Empty state */
      .empty {
        font-size: 11px;
        color: rgba(232, 228, 222, 0.4);
        line-height: 1.5;
        padding: 8px 0;
      }

      /* Close button */
      .close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: rgba(232, 228, 222, 0.4);
        font-size: 16px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        font-family: inherit;
      }
      .close:hover {
        color: rgba(232, 228, 222, 0.9);
      }
    `;
  }
}

customElements.define('toolbar-popup', ToolbarPopup);
export { ToolbarPopup };
