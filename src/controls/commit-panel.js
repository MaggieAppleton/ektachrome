/**
 * <commit-panel> - Displays pending CSS variable changes and handles commit/discard actions.
 *
 * Shows a diff view of changes and allows committing to source files
 * or copying CSS to clipboard when no dev server is available.
 */

import { createPersistence } from '../utils/state-persistence.js';
import { THEME, baseStyles } from '../utils/theme.js';

const persistence = createPersistence('ektachrome');

class CommitPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._serverConnected = false;
    this._isCommitting = false;
    this._abortController = null;
  }

  connectedCallback() {
    this.setAttribute('data-ektachrome', '');
    this._abortController = new AbortController();
    this._checkServerConnection();
    this._render();
  }

  disconnectedCallback() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Check if dev server is available
   */
  async _checkServerConnection() {
    try {
      const response = await fetch('/__ektachrome/status', {
        signal: this._abortController?.signal
      });
      if (response.ok) {
        const data = await response.json();
        this._serverConnected = data.connected === true;
        this._render();
      }
    } catch {
      this._serverConnected = false;
    }
  }

  /**
   * Show the panel
   */
  show() {
    this.style.display = 'block';
    this._render();
  }

  /**
   * Hide the panel
   */
  hide() {
    this.style.display = 'none';
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true }));
  }

  /**
   * Refresh pending changes from localStorage
   */
  refresh() {
    this._render();
  }

  _render() {
    const changes = persistence.getPendingChanges();
    const count = changes.length;

    this.shadowRoot.innerHTML = `
      <style>${CommitPanel._styles()}</style>
      <div class="panel" data-ektachrome>
        <div class="header">
          <span class="title">Pending Changes (${count})</span>
          <button class="close" aria-label="Close">\u00D7</button>
        </div>
        
        <div class="changes-list">
          ${count === 0 
            ? '<div class="empty">No pending changes</div>'
            : changes.map((c, i) => this._renderChange(c, i)).join('')
          }
        </div>
        
        ${count > 0 ? `
          <div class="footer">
            <button class="btn btn-secondary discard-btn">Discard All</button>
            <button class="btn btn-primary commit-btn" ${this._isCommitting ? 'disabled' : ''}>
              ${this._isCommitting ? 'Committing...' : (this._serverConnected ? 'Commit All' : 'Copy CSS')}
            </button>
          </div>
        ` : ''}
        
        <div class="toast" style="display: none;"></div>
      </div>
    `;

    this._wireEventListeners();
  }

  _renderChange(change, index) {
    const { variable, original, current } = change;
    const truncate = (val, len = 30) => val.length > len ? val.slice(0, len) + '...' : val;
    
    return `
      <div class="change-item" data-index="${index}">
        <div class="change-header">
          <span class="var-name">${this._esc(variable)}</span>
          <button class="revert-btn" data-variable="${this._esc(variable)}" title="Revert this change">\u21A9</button>
        </div>
        <div class="change-diff">
          <span class="old-value" title="${this._esc(original)}">${this._esc(truncate(original))}</span>
          <span class="arrow">\u2192</span>
          <span class="new-value" title="${this._esc(current)}">${this._esc(truncate(current))}</span>
        </div>
      </div>
    `;
  }

  _wireEventListeners() {
    // Close button
    this.shadowRoot.querySelector('.close')?.addEventListener('click', () => this.hide());

    // Discard all
    this.shadowRoot.querySelector('.discard-btn')?.addEventListener('click', () => {
      this._handleDiscardAll();
    });

    // Commit/Copy
    this.shadowRoot.querySelector('.commit-btn')?.addEventListener('click', () => {
      this._handleCommit();
    });

    // Per-variable revert buttons
    this.shadowRoot.querySelectorAll('.revert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const variable = btn.dataset.variable;
        this._handleRevert(variable);
      });
    });
  }

  /**
   * Handle reverting a single variable
   */
  _handleRevert(variable) {
    const changes = persistence.getPendingChanges();
    const change = changes.find(c => c.variable === variable);
    
    if (change) {
      // Restore original value in DOM
      document.documentElement.style.setProperty(variable, change.original);
      // Remove from persistence
      persistence.revertVariable(variable);
      this._render();
    }
  }

  /**
   * Handle discarding all changes
   */
  _handleDiscardAll() {
    const changes = persistence.getPendingChanges();
    
    // Restore all original values in DOM
    for (const change of changes) {
      document.documentElement.style.setProperty(change.variable, change.original);
    }
    
    // Clear persistence
    persistence.clear();
    
    this.dispatchEvent(new CustomEvent('changes-discarded', { bubbles: true }));
    this.hide();
  }

  /**
   * Handle commit action - either commit to server or copy to clipboard
   */
  async _handleCommit() {
    if (this._isCommitting) return;

    if (this._serverConnected) {
      await this._commitToServer();
    } else {
      await this._copyToClipboard();
    }
  }

  /**
   * Commit changes to dev server
   */
  async _commitToServer() {
    this._isCommitting = true;
    this._render();

    const changes = persistence.getPendingChanges();
    const payload = {
      changes: changes.map(c => ({
        variable: c.variable,
        value: c.current
      }))
    };

    try {
      const response = await fetch('/__ektachrome/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: this._abortController?.signal
      });

      const result = await response.json();

      if (result.success) {
        // Clear persistence on success
        persistence.clear();
        
        this._showToast(`Committed ${result.committed.length} change(s)`);
        this.dispatchEvent(new CustomEvent('commit-success', {
          bubbles: true,
          detail: { committed: result.committed }
        }));
        
        setTimeout(() => this.hide(), 1500);
      } else {
        // Partial failure
        const errorMsg = result.errors?.map(e => e.variable).join(', ') || 'Unknown error';
        this._showToast(`Some changes failed: ${errorMsg}`, true);
        this.dispatchEvent(new CustomEvent('commit-error', {
          bubbles: true,
          detail: { errors: result.errors }
        }));
      }
    } catch (e) {
      this._showToast(`Commit failed: ${e.message}`, true);
      this.dispatchEvent(new CustomEvent('commit-error', {
        bubbles: true,
        detail: { errors: [{ error: e.message }] }
      }));
    } finally {
      this._isCommitting = false;
      this._render();
    }
  }

  /**
   * Copy CSS to clipboard (fallback when no dev server)
   */
  async _copyToClipboard() {
    const changes = persistence.getPendingChanges();
    
    // Format as CSS
    const css = `:root {\n${
      changes.map(c => `  ${c.variable}: ${c.current};`).join('\n')
    }\n}`;

    try {
      await navigator.clipboard.writeText(css);
      this._showToast('Copied CSS to clipboard');
      
      // Clear persistence after copy
      persistence.clear();
      
      this.dispatchEvent(new CustomEvent('commit-success', {
        bubbles: true,
        detail: { copied: true }
      }));
      
      setTimeout(() => this.hide(), 1500);
    } catch (e) {
      this._showToast('Failed to copy to clipboard', true);
    }
  }

  /**
   * Show a toast notification
   */
  _showToast(message, isError = false) {
    const toast = this.shadowRoot.querySelector('.toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  /**
   * Minimal HTML-attribute escaping
   */
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
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      
      .panel {
        position: relative;
        background: ${THEME.colorBgPopup};
        border: 1px solid ${THEME.colorBorder};
        border-radius: ${THEME.radiusLg};
        padding: 16px;
        min-width: 320px;
        max-width: 480px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
        font-family: ${THEME.fontSystem};
        color: ${THEME.colorText};
      }
      
      /* Header */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 12px;
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
      
      /* Changes list */
      .changes-list {
        flex: 1;
        overflow-y: auto;
        margin-bottom: 12px;
      }
      
      .empty {
        font-size: ${THEME.fontSizeLg};
        color: ${THEME.colorTextFaint};
        text-align: center;
        padding: 24px;
      }
      
      .change-item {
        padding: 8px;
        margin-bottom: 8px;
        background: ${THEME.colorBgSubtle};
        border-radius: ${THEME.radiusMd};
      }
      
      .change-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      
      .var-name {
        font-family: ${THEME.fontMono};
        font-size: ${THEME.fontSizeLg};
        color: ${THEME.colorActiveText};
      }
      
      .revert-btn {
        background: none;
        border: none;
        color: ${THEME.colorTextFaint};
        font-size: 14px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: ${THEME.radiusSm};
        transition: background 0.1s, color 0.1s;
      }
      
      .revert-btn:hover {
        background: ${THEME.colorBgHover};
        color: ${THEME.colorText};
      }
      
      .change-diff {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: ${THEME.fontMono};
        font-size: ${THEME.fontSizeSm};
      }
      
      .old-value {
        color: rgba(255, 120, 100, 0.8);
        text-decoration: line-through;
      }
      
      .arrow {
        color: ${THEME.colorTextFaint};
      }
      
      .new-value {
        color: rgba(120, 200, 150, 0.9);
      }
      
      /* Footer */
      .footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid ${THEME.colorBorderSubtle};
      }
      
      .btn {
        font-family: ${THEME.fontSystem};
        font-size: ${THEME.fontSizeLg};
        padding: 6px 12px;
        border-radius: ${THEME.radiusMd};
        border: none;
        cursor: pointer;
        transition: background 0.1s, opacity 0.1s;
      }
      
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .btn-secondary {
        background: ${THEME.colorBgSubtle};
        color: ${THEME.colorTextMuted};
      }
      
      .btn-secondary:hover:not(:disabled) {
        background: ${THEME.colorBgHover};
        color: ${THEME.colorText};
      }
      
      .btn-primary {
        background: ${THEME.colorActive};
        color: ${THEME.colorText};
      }
      
      .btn-primary:hover:not(:disabled) {
        background: rgba(120, 200, 150, 0.4);
      }
      
      /* Toast */
      .toast {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        border-radius: ${THEME.radiusMd};
        font-size: ${THEME.fontSizeLg};
        animation: toast-in 0.2s ease-out;
      }
      
      .toast-success {
        background: rgba(120, 200, 150, 0.3);
        color: rgba(120, 200, 150, 0.9);
      }
      
      .toast-error {
        background: rgba(255, 120, 100, 0.3);
        color: rgba(255, 180, 150, 0.9);
      }
      
      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
  }
}

customElements.define('commit-panel', CommitPanel);
export { CommitPanel };
