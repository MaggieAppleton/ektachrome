/**
 * <toolbar-popup> - Appears when an element is selected via ElementPicker.
 *
 * Shows which design tokens control the element and lets users
 * adjust them through constrained controls (color-token-control,
 * spacing-step-control, scale-picker).
 */
import { findCSSVariablesForElement } from '../scanner/detect-css-vars.js';
import { resolveTokensForElement, buildVariableMap } from '../scanner/variable-map.js';
import { discoverVariables } from '../bridge/variable-discovery.js';
import { CATEGORY_MATCHERS, CATEGORY_LABELS, PROPERTY_CATEGORIES } from '../utils/property-categories.js';
import { THEME } from '../utils/theme.js';
import { createPersistence } from '../utils/state-persistence.js';
import '../controls/commit-panel.js';
import '../controls/token-creator.js';
import '../controls/duration-control.js';
import '../controls/easing-picker.js';
import '../controls/spring-control.js';

// Create persistence instance for this session
const persistence = createPersistence('ektachrome');

class ToolbarPopup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._activeTab = null;
    this._grouped = {};  // { color: [...], spacing: [...], ... }
    this._elementInfo = null;
    this._hardcodedValues = []; // Hardcoded values that could be tokenized
    this._rafId = null;
    this._requestId = 0; // For cancelling stale async requests
    this._serverConnected = false;
  }

  connectedCallback() {
    this.setAttribute('data-ektachrome', '');
    this.style.display = 'none';
    
    // Check if dev server is available
    this._checkServerConnection();
    
    // Restore any previously saved CSS variable adjustments
    this._restoreSavedState();
    
    // Listen for control changes to persist them
    this.shadowRoot.addEventListener('control-change', (e) => {
      this._persistVariableChange(e.detail);
    });
    
    // Listen for clicks outside the popup to close it
    this._onDocumentClick = this._onDocumentClick.bind(this);
    document.addEventListener('mousedown', this._onDocumentClick, true);
    
    this._render();
  }

  /**
   * Show the popup for a selected element.
   * @param {{ element: Element, name: string, path: string, rect: DOMRect, computedStyles: CSSStyleDeclaration }} elementInfo
   */
  async show(elementInfo) {
    // Increment request ID to invalidate any in-flight async operations
    const currentRequestId = ++this._requestId;
    this._elementInfo = elementInfo;

    // Multi-step variable resolution:
    // 1. Try direct CSS variable detection
    let vars = findCSSVariablesForElement(elementInfo.element);
    
    // 2. Try dynamic variable map resolution
    const resolvedTokens = resolveTokensForElement(elementInfo.element);
    const mappedVars = this._convertTokensToVars(resolvedTokens);
    
    // 3. Merge results, preferring direct detection
    vars = this._mergeVariables(vars, mappedVars);
    
    // 4. If still no variables found, try Claude discovery (fallback)
    if (vars.length === 0) {
      console.log('[toolbar-popup] No variables found via automatic detection, trying Claude fallback...');
      const claudeVars = await this._tryClaudeDiscovery(elementInfo);
      
      // Check if this request is still current (user may have clicked another element)
      if (currentRequestId !== this._requestId) {
        console.log('[toolbar-popup] Discarding stale Claude response');
        return;
      }
      
      vars = claudeVars;
    }

    // Final check that this request is still current
    if (currentRequestId !== this._requestId) {
      return;
    }

    this._grouped = this._groupByCategory(vars);
    console.log('[toolbar-popup] Resolved variables by category:', this._grouped);

    // Also detect hardcoded values that could be tokenized
    this._hardcodedValues = this._findHardcodedValues(elementInfo);

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
    if (this.style.display === 'none') return; // Already hidden
    
    this.style.display = 'none';
    this._elementInfo = null;
    this._grouped = {};
    this._activeTab = null;
    this._requestId++; // Invalidate any pending async operations
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    
    // Emit event so Ektachrome can reactivate picker
    this.dispatchEvent(new CustomEvent('popup-close', { bubbles: true }));
  }

  disconnectedCallback() {
    document.removeEventListener('mousedown', this._onDocumentClick, true);
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._elementInfo = null;
    this._grouped = {};
    this._activeTab = null;
  }
  
  /** Handle clicks outside the popup */
  _onDocumentClick(e) {
    if (this.style.display === 'none') return;
    
    // Check if click is inside the popup
    const path = e.composedPath();
    if (path.includes(this)) return;
    
    // Click was outside — close the popup
    this.hide();
  }

  // ---------------------------------------------------------------------------
  // State persistence
  // ---------------------------------------------------------------------------

  /**
   * Check if dev server is available
   */
  async _checkServerConnection() {
    try {
      const response = await fetch('/__ektachrome/status');
      if (response.ok) {
        this._serverConnected = true;
        console.log('[toolbar-popup] Dev server connected');
      }
    } catch {
      this._serverConnected = false;
      console.log('[toolbar-popup] Dev server not available, using copy fallback');
    }
  }

  /**
   * Restore previously saved CSS variable adjustments from localStorage
   */
  _restoreSavedState() {
    const changes = persistence.getPendingChanges();
    if (changes.length === 0) return;
    
    // Apply each saved variable to the document
    for (const change of changes) {
      document.documentElement.style.setProperty(change.variable, change.current);
    }
  }

  /**
   * Persist a variable change to localStorage
   */
  _persistVariableChange(detail) {
    const { variable, value } = detail;
    if (!variable || !value) return;
    
    // Get original value from computed styles (only if not already changed)
    const original = getComputedStyle(document.documentElement)
      .getPropertyValue(variable).trim();
    
    persistence.trackChange(variable, value, original);
    
    // Re-render to update commit badge
    this._updateCommitBadge();
  }

  /**
   * Clear all saved adjustments and reset CSS variables
   * Can be called externally: document.querySelector('toolbar-popup').resetAll()
   */
  resetAll() {
    const changes = persistence.getPendingChanges();
    // Remove all adjusted variables from the document
    for (const change of changes) {
      document.documentElement.style.removeProperty(change.variable);
    }
    persistence.clear();
    this._updateCommitBadge();
  }

  /**
   * Show the commit panel
   */
  _showCommitPanel() {
    const panel = document.createElement('commit-panel');
    
    panel.addEventListener('commit-success', () => {
      // Refresh UI, remove badge
      this._render();
    });
    
    panel.addEventListener('changes-discarded', () => {
      // Revert all CSS changes, refresh UI
      this._render();
    });
    
    panel.addEventListener('panel-close', () => {
      panel.remove();
    });
    
    document.body.appendChild(panel);
    panel.show();
  }

  /**
   * Update just the commit badge without full re-render
   */
  _updateCommitBadge() {
    const badge = this.shadowRoot.querySelector('.commit-badge');
    const count = persistence.getPendingCount();
    
    if (badge) {
      if (count > 0) {
        badge.textContent = `${count} change${count > 1 ? 's' : ''}`;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _groupByCategory(vars) {
    const groups = { color: [], spacing: [], type: [], radius: [], animation: [] };
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

  /**
   * Find hardcoded values that could be tokenized
   */
  _findHardcodedValues(elementInfo) {
    const computed = window.getComputedStyle(elementInfo.element);
    const hardcoded = [];
    
    // Properties that are commonly tokenized
    const tokenizableProperties = [
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'gap',
      'border-radius',
      'font-size',
      'color', 'background-color',
      'transition-duration', 'animation-duration',
    ];
    
    // Get the element's inline styles and stylesheet rules to check for var() usage
    const inlineStyle = elementInfo.element.style;
    
    for (const prop of tokenizableProperties) {
      const value = computed.getPropertyValue(prop).trim();
      
      // Skip empty, auto, or inherited-like values
      if (!value || value === 'auto' || value === 'inherit' || value === 'initial' || value === 'none' || value === '0px') {
        continue;
      }
      
      // Check if this is already using a CSS variable
      const inlineValue = inlineStyle.getPropertyValue(prop);
      if (inlineValue && inlineValue.includes('var(--')) {
        continue;
      }
      
      // Check if this element already has tokens for this property
      const existingTokens = this._grouped;
      let hasToken = false;
      for (const category of Object.values(existingTokens)) {
        if (category.some(v => v.property === prop)) {
          hasToken = true;
          break;
        }
      }
      
      if (!hasToken) {
        hardcoded.push({
          property: prop,
          value: value,
          selector: elementInfo.path
        });
      }
    }
    
    return hardcoded;
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
    const hasHardcoded = this._hardcodedValues.length > 0;
    const pendingCount = persistence.getPendingCount();

    this.shadowRoot.innerHTML = `
      <style>${ToolbarPopup._styles()}</style>
      <div class="popup" data-ektachrome>
        ${info ? this._renderHeader(info) : ''}
        ${info && hasTokens ? this._renderTabs() : ''}
        ${info && hasTokens ? `<div class="content">${this._renderControls()}</div>` : ''}
        ${info && !hasTokens && !hasHardcoded ? `<div class="empty">No CSS variables found for this element. It may use hardcoded values.</div>` : ''}
        ${info && hasHardcoded ? this._renderHardcodedSection() : ''}
        ${pendingCount > 0 ? `<button class="commit-badge" aria-label="Review pending changes">${pendingCount} change${pendingCount > 1 ? 's' : ''}</button>` : ''}
        <button class="close" aria-label="Close">\u00D7</button>
      </div>
    `;

    this._wireEventListeners();
  }

  /**
   * Partial re-render: only update tabs and content area
   * Used when switching tabs to avoid full DOM recreation
   */
  _updateTabsAndContent() {
    const tabsContainer = this.shadowRoot.querySelector('.tabs');
    const contentContainer = this.shadowRoot.querySelector('.content');
    
    if (tabsContainer) {
      // Update tab active states without recreating
      tabsContainer.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === this._activeTab);
      });
    }
    
    if (contentContainer) {
      // Only update the content area
      contentContainer.innerHTML = this._renderControls();
    }
  }

  _wireEventListeners() {
    // Wire close button
    this.shadowRoot.querySelector('.close')?.addEventListener('click', () => this.hide());

    // Wire reset button
    this.shadowRoot.querySelector('.reset-btn')?.addEventListener('click', () => {
      this.resetAll();
      this._render(); // Re-render to remove the reset button
    });

    // Wire commit badge
    this.shadowRoot.querySelector('.commit-badge')?.addEventListener('click', () => {
      this._showCommitPanel();
    });

    // Wire tab buttons with partial update
    this.shadowRoot.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._activeTab === btn.dataset.cat) return; // Already active
        
        this._activeTab = btn.dataset.cat;
        this._updateTabsAndContent();
      });
    });

    // Wire create token buttons
    this.shadowRoot.querySelectorAll('.create-token-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._showTokenCreator(
          btn.dataset.property,
          btn.dataset.value,
          btn.dataset.selector
        );
      });
    });
  }

  /**
   * Show the token creator dialog
   */
  _showTokenCreator(property, value, selector) {
    const creator = document.createElement('token-creator');
    creator.setAttribute('property', property);
    creator.setAttribute('value', value);
    creator.setAttribute('element-selector', selector);
    
    creator.addEventListener('token-created', (e) => {
      console.log('[toolbar-popup] Token created:', e.detail);
      // Refresh the popup to show the new token
      this._render();
    });
    
    document.body.appendChild(creator);
    creator.show();
  }

  _renderHeader(info) {
    const hasSavedState = persistence.getPendingCount() > 0;
    return `
      <div class="header">
        <div class="el-name">${this._esc(info.name)}</div>
        <div class="el-path">${this._esc(info.path)}</div>
        ${hasSavedState ? '<button class="reset-btn" title="Clear all saved adjustments">Reset All</button>' : ''}
      </div>
    `;
  }

  _renderTabs() {
    const tabs = Object.entries(CATEGORY_LABELS)
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

      case 'animation':
        return items.map(v => {
          // Detect which type of animation control to use
          if (v.property.includes('duration')) {
            return `<duration-control variable="${this._esc(v.variable)}" property="${this._esc(v.property)}" current-value="${this._esc(v.currentValue)}"></duration-control>`;
          }
          if (v.property.includes('timing-function') || v.property.includes('easing')) {
            return `<easing-picker variable="${this._esc(v.variable)}" property="${this._esc(v.property)}" current-value="${this._esc(v.currentValue)}"></easing-picker>`;
          }
          // Default: show duration control for transition/animation shorthand
          return `<duration-control variable="${this._esc(v.variable)}" property="${this._esc(v.property)}" current-value="${this._esc(v.currentValue)}"></duration-control>`;
        }).join('');

      default:
        return '';
    }
  }

  _renderHardcodedSection() {
    if (this._hardcodedValues.length === 0) return '';
    
    return `
      <div class="hardcoded-section">
        <div class="section-title">Hardcoded Values</div>
        ${this._hardcodedValues.map(v => `
          <div class="hardcoded-item">
            <span class="hardcoded-prop">${this._esc(v.property)}</span>
            <span class="hardcoded-value">${this._esc(v.value)}</span>
            <button class="create-token-btn" 
                    data-property="${this._esc(v.property)}"
                    data-value="${this._esc(v.value)}"
                    data-selector="${this._esc(v.selector)}">
              Create Token
            </button>
          </div>
        `).join('')}
      </div>
    `;
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
      .reset-btn {
        font-size: 9px;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        border: none;
        background: rgba(255, 120, 100, 0.15);
        color: rgba(255, 180, 150, 0.8);
        font-family: inherit;
        transition: background 0.1s;
      }
      .reset-btn:hover {
        background: rgba(255, 120, 100, 0.25);
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

      /* Commit badge */
      .commit-badge {
        position: absolute;
        bottom: 8px;
        right: 8px;
        font-size: 9px;
        padding: 3px 8px;
        border-radius: 10px;
        cursor: pointer;
        border: none;
        background: rgba(120, 200, 150, 0.2);
        color: rgba(120, 200, 150, 0.9);
        font-family: inherit;
        font-weight: 500;
        transition: background 0.1s;
      }
      .commit-badge:hover {
        background: rgba(120, 200, 150, 0.35);
      }

      /* Hardcoded values section */
      .hardcoded-section {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      .section-title {
        font-size: 10px;
        color: rgba(232, 228, 222, 0.5);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .hardcoded-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }
      .hardcoded-prop {
        font-family: 'SF Mono', monospace;
        font-size: 10px;
        color: rgba(232, 228, 222, 0.7);
        min-width: 80px;
      }
      .hardcoded-value {
        font-family: 'SF Mono', monospace;
        font-size: 10px;
        color: rgba(232, 228, 222, 0.4);
        flex: 1;
      }
      .create-token-btn {
        font-size: 9px;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        border: none;
        background: rgba(120, 180, 220, 0.15);
        color: rgba(120, 180, 220, 0.9);
        font-family: inherit;
        transition: background 0.1s;
        white-space: nowrap;
      }
      .create-token-btn:hover {
        background: rgba(120, 180, 220, 0.25);
      }
    `;
  }

  // Convert resolved tokens to variable format for consistency
  _convertTokensToVars(tokens) {
    const vars = [];
    for (const [property, tokenInfo] of Object.entries(tokens)) {
      vars.push({
        variable: tokenInfo.variable,
        property: property,
        currentValue: tokenInfo.oklch || tokenInfo.scale || tokenInfo.step || 'unknown',
        rawValue: `var(${tokenInfo.variable})`,
        confidence: 0.8 // High confidence from dynamic resolution
      });
    }
    return vars;
  }

  // Merge variables from different sources, preferring higher confidence
  _mergeVariables(directVars, mappedVars) {
    const merged = [...directVars];
    const existingVars = new Set(directVars.map(v => v.variable));
    
    for (const mappedVar of mappedVars) {
      if (!existingVars.has(mappedVar.variable)) {
        merged.push(mappedVar);
      }
    }
    
    return merged;
  }

  // Fallback to Claude discovery when automatic detection fails
  async _tryClaudeDiscovery(elementInfo) {
    try {
      // Try color discovery first (most common)
      const colorVars = await discoverVariables(elementInfo, 'color');
      if (colorVars.length > 0) return colorVars;
      
      // Try spacing discovery
      const spacingVars = await discoverVariables(elementInfo, 'spacing');
      if (spacingVars.length > 0) return spacingVars;
      
      // Try typography discovery
      const typeVars = await discoverVariables(elementInfo, 'typography');
      return typeVars;
      
    } catch (error) {
      console.warn('[toolbar-popup] Claude discovery failed:', error);
      return [];
    }
  }
}

customElements.define('toolbar-popup', ToolbarPopup);
export { ToolbarPopup };
