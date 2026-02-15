/**
 * ElementPicker — hover-highlight and click-to-select any element on the page.
 *
 * Plain JS class (not a Web Component). Used by the toolbar-popup to let users
 * pick a DOM element and get back structured info about it (name, CSS path,
 * bounding rect, computed visual styles).
 *
 * Handles shadow DOM traversal so it works with Web Component-heavy pages.
 */

const IGNORED_SELECTOR_DEFAULT = '[data-ektachrome]';

const VISUAL_PROPERTIES = [
  'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight',
  'lineHeight', 'padding', 'margin', 'gap', 'borderRadius', 'borderColor',
  'borderWidth', 'boxShadow', 'width', 'height',
];

export class ElementPicker {
  /**
   * @param {object} options
   * @param {(info: object) => void} options.onSelect  Called when user clicks an element.
   * @param {string} options.ignoreSelector  CSS selector for elements to skip (own UI).
   */
  constructor(options = {}) {
    this.onSelect = options.onSelect || (() => {});
    this.ignoreSelector = options.ignoreSelector || IGNORED_SELECTOR_DEFAULT;

    this._overlay = null;
    this._tooltip = null;
    this._active = false;
    this._currentTarget = null;
    this._cachedName = null;

    // Bound handlers for clean add/remove
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  // ---- Public API ---------------------------------------------------------

  activate() {
    if (this._active) return;
    this._active = true;
    this._createOverlay();
    this._createTooltip();
    document.addEventListener('mousemove', this._onMouseMove, true);
    document.addEventListener('mousedown', this._onMouseDown, true);
    document.addEventListener('click', this._onClick, true);
    document.addEventListener('keydown', this._onKeyDown, true);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    this._currentTarget = null;
    this._cachedName = null;
    document.removeEventListener('mousemove', this._onMouseMove, true);
    document.removeEventListener('mousedown', this._onMouseDown, true);
    document.removeEventListener('click', this._onClick, true);
    document.removeEventListener('keydown', this._onKeyDown, true);
    this._removeOverlay();
    this._removeTooltip();
  }

  // ---- Event handlers -----------------------------------------------------

  _onMouseMove(e) {
    const el = this._deepElementFromPoint(e.clientX, e.clientY);
    if (!el || this._shouldIgnore(el)) {
      this._currentTarget = null;
      this._cachedName = null;
      this._hideOverlay();
      this._hideTooltip();
      return;
    }

    if (el !== this._currentTarget) {
      this._currentTarget = el;
      const rect = el.getBoundingClientRect();
      this._positionOverlay(rect);
      const { name } = this._identifyElement(el);
      this._cachedName = name;
    }

    this._positionTooltip(e.clientX, e.clientY, this._cachedName);
  }

  _onMouseDown(e) {
    const el = this._deepElementFromPoint(e.clientX, e.clientY);
    if (!el || this._shouldIgnore(el)) return; // let click pass through

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const info = this._buildElementInfo(el);
    this.deactivate();
    this.onSelect(info);
  }

  /** Prevent click events from triggering actions on links/buttons */
  _onClick(e) {
    const el = this._deepElementFromPoint(e.clientX, e.clientY);
    if (!el || this._shouldIgnore(el)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.deactivate();
    }
  }

  // ---- Overlay ------------------------------------------------------------

  _createOverlay() {
    if (this._overlay) return;
    const el = document.createElement('div');
    el.setAttribute('data-ektachrome', '');
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '999999',
      border: '1px solid rgba(232, 228, 222, 0.5)',
      background: 'rgba(232, 228, 222, 0.03)',
      borderRadius: '3px',
      transition: 'all 0.1s ease',
      display: 'none',
    });
    document.documentElement.appendChild(el);
    this._overlay = el;
  }

  _removeOverlay() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }

  _positionOverlay(rect) {
    if (!this._overlay) return;
    Object.assign(this._overlay.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      display: 'block',
    });
  }

  _hideOverlay() {
    if (this._overlay) this._overlay.style.display = 'none';
  }

  // ---- Tooltip ------------------------------------------------------------

  _createTooltip() {
    if (this._tooltip) return;
    const el = document.createElement('div');
    el.setAttribute('data-ektachrome', '');
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '999999',
      pointerEvents: 'none',
      background: 'rgba(14, 12, 16, 0.88)',
      backdropFilter: 'blur(20px)',
      color: 'rgba(232, 228, 222, 0.9)',
      font: "10px 'SF Mono', 'Monaco', 'Inconsolata', monospace",
      padding: '4px 8px',
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      maxWidth: '300px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'none',
    });
    document.documentElement.appendChild(el);
    this._tooltip = el;
  }

  _removeTooltip() {
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
    }
  }

  _positionTooltip(x, y, text) {
    if (!this._tooltip) return;
    this._tooltip.textContent = text;

    // Offset 15px right and below the cursor
    let left = x + 15;
    let top = y + 15;

    // Keep within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Measure after setting text so we get correct width
    this._tooltip.style.display = 'block';
    this._tooltip.style.left = `${left}px`;
    this._tooltip.style.top = `${top}px`;

    const tipRect = this._tooltip.getBoundingClientRect();
    if (tipRect.right > vw) left = x - tipRect.width - 10;
    if (tipRect.bottom > vh) top = y - tipRect.height - 10;
    this._tooltip.style.left = `${left}px`;
    this._tooltip.style.top = `${top}px`;
  }

  _hideTooltip() {
    if (this._tooltip) this._tooltip.style.display = 'none';
  }

  // ---- Shadow DOM traversal -----------------------------------------------

  _deepElementFromPoint(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const deeper = el.shadowRoot.elementFromPoint(x, y);
      if (!deeper || deeper === el) break;
      el = deeper;
    }
    return el;
  }

  // ---- Element identification ---------------------------------------------

  _identifyElement(el) {
    const name = this._getElementName(el);
    const path = this._getElementPath(el, 4);
    return { name, path };
  }

  _getElementName(el) {
    const tag = el.tagName.toLowerCase();

    // data-element attribute overrides everything
    const dataName = el.getAttribute('data-element');
    if (dataName) return dataName;

    // Truncate helper for plain strings (aria-label, alt, etc.)
    const trunc = (s, max = 30) => {
      const clean = (s || '').trim().replace(/\s+/g, ' ');
      return clean.length > max ? clean.slice(0, max) + '...' : clean;
    };

    const ariaLabel = el.getAttribute('aria-label');

    // SVG elements
    if (tag === 'svg' || el instanceof SVGElement) {
      const parent = el.closest('[class], [id]');
      if (parent && parent !== el) return `icon in ${parent.tagName.toLowerCase()}`;
      return 'icon';
    }

    // Buttons
    if (tag === 'button' || el.getAttribute('role') === 'button') {
      const label = ariaLabel || this._getTextPreview(el, 30);
      return label ? `button "${trunc(label, 30)}"` : 'button';
    }

    // Links
    if (tag === 'a') {
      const label = this._getTextPreview(el, 30) || el.getAttribute('href');
      return label ? `link "${trunc(label, 30)}"` : 'link';
    }

    // Inputs
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      const label = el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('aria-label');
      return label ? `${tag} "${trunc(label)}"` : tag;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const text = this._getTextPreview(el, 30);
      return text ? `${tag} "${text}"` : tag;
    }

    // Images
    if (tag === 'img') {
      const alt = el.getAttribute('alt');
      return alt ? `image "${trunc(alt)}"` : 'image';
    }

    // Paragraphs
    if (tag === 'p') {
      const text = this._getTextPreview(el, 30);
      return text ? `paragraph: "${text}"` : 'paragraph';
    }

    // Containers — try cleaned class names, fall back to tag
    const cleaned = this._cleanClassNames(el);
    if (cleaned) return cleaned;

    return tag;
  }

  _getElementPath(el, maxDepth = 4) {
    const parts = [];
    let current = el;
    let depth = 0;

    while (current && depth < maxDepth) {
      const tag = current.tagName?.toLowerCase();
      if (!tag || tag === 'html' || tag === 'body') break;

      // Check if we crossed a shadow boundary
      if (current.getRootNode() instanceof ShadowRoot && depth > 0) {
        parts.push('::shadow');
      }

      if (current.id) {
        parts.push(`#${current.id}`);
        break; // IDs are unique enough to stop
      }

      const cleaned = this._cleanClassNames(current);
      parts.push(cleaned ? `${tag}.${cleaned.replace(/\s+/g, '.')}` : tag);

      // Walk up — if parent is a shadow root, jump to the host element
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        current = root.host;
      } else {
        current = current.parentElement;
      }
      depth++;
    }

    return parts.reverse().join(' > ');
  }

  // ---- Helpers ------------------------------------------------------------

  _getTextPreview(el, maxLen = 30) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let result = '';
    while (walker.nextNode() && result.length < maxLen + 10) {
      const text = walker.currentNode.textContent.trim();
      if (text) result += (result ? ' ' : '') + text;
    }
    result = result.trim();
    return result.length > maxLen ? result.slice(0, maxLen) + '...' : result;
  }

  _shouldIgnore(el) {
    try {
      return el.closest(this.ignoreSelector) !== null;
    } catch {
      return false;
    }
  }

  /** Strip CSS-module hashes and short/meaningless class names. */
  _cleanClassNames(el) {
    if (!el.className || typeof el.className !== 'string') return '';
    return el.className
      .split(/\s+/)
      .filter(c => {
        if (!c || c.length < 3) return false;
        // Skip names that look like CSS module hashes (contain multiple digits or underscores with hex)
        if (/^[a-zA-Z][\w-]*_[a-zA-Z0-9]{5,}$/.test(c)) return false;
        // Skip pure hash-like strings
        if (/^[a-f0-9]{6,}$/i.test(c)) return false;
        return true;
      })
      .join(' ')
      .trim();
  }

  _buildElementInfo(el) {
    const { name, path } = this._identifyElement(el);
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);

    const computedStyles = {};
    for (const prop of VISUAL_PROPERTIES) {
      computedStyles[prop] = computed.getPropertyValue(
        prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
      );
    }

    return { element: el, name, path, rect, computedStyles };
  }
}
