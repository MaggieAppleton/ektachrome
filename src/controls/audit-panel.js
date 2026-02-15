/**
 * <audit-panel> - Slide-in panel displaying design system audit results
 *
 * Shows health score, coverage stats, and actionable issues list.
 * Non-modal panel that slides in from the right edge of the viewport.
 */
import { THEME, baseStyles } from '../utils/theme.js';

class AuditPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._report = null;
    this._expandedIssues = new Set();
    this._healthScore = null;
  }

  /** Set the audit report data */
  set report(value) {
    this._report = value;
    if (value) {
      this._healthScore = this._calculateHealthScore(value);
    }
    this._render();
  }

  get report() {
    return this._report;
  }

  connectedCallback() {
    this.setAttribute('data-ektachrome', '');
    this._render();

    // Handle clicks within shadow DOM
    this.shadowRoot.addEventListener('click', (e) => {
      const target = e.target;

      // Close button
      if (target.closest('.close-btn')) {
        this.close();
        return;
      }

      // Copy report button
      if (target.closest('.copy-btn')) {
        this._copyReport();
        return;
      }

      // Issue toggle
      const issueHeader = target.closest('.issue-header');
      if (issueHeader) {
        const issueId = issueHeader.dataset.issueId;
        if (this._expandedIssues.has(issueId)) {
          this._expandedIssues.delete(issueId);
        } else {
          this._expandedIssues.add(issueId);
        }
        this._render();
        return;
      }
    });
  }

  disconnectedCallback() {
    this._report = null;
    this._expandedIssues.clear();
  }

  /** Close the panel with animation */
  close() {
    const panel = this.shadowRoot.querySelector('.panel');
    if (panel) {
      panel.classList.add('closing');
      panel.addEventListener('animationend', () => {
        this.remove();
      }, { once: true });
    } else {
      this.remove();
    }
  }

  /** Calculate overall health score (0-100) */
  _calculateHealthScore(report) {
    const { basicAnalysis, summary } = report;
    
    // Color token coverage (30% weight)
    const colorScore = (basicAnalysis.colorTokenCoverage?.coverage || 0) * 100;
    
    // Spacing consistency (25% weight)
    const spacingScore = (basicAnalysis.spacingConsistency?.consistency || 0) * 100;
    
    // Token hygiene - penalize unused variables (25% weight)
    const totalVars = summary.totalVariables || 1;
    const unusedRatio = (summary.unusedVariables || 0) / totalVars;
    const hygieneScore = Math.max(0, 100 - (unusedRatio * 200)); // Heavy penalty for unused
    
    // Naming consistency (20% weight) - reward if dominated by one pattern
    const patterns = basicAnalysis.namingPatterns || {};
    const patternValues = Object.values(patterns);
    const maxPattern = Math.max(...patternValues, 0);
    const totalPatterns = patternValues.reduce((a, b) => a + b, 0) || 1;
    const namingScore = (maxPattern / totalPatterns) * 100;
    
    // Weighted average
    const score = Math.round(
      (colorScore * 0.30) +
      (spacingScore * 0.25) +
      (hygieneScore * 0.25) +
      (namingScore * 0.20)
    );
    
    return {
      total: Math.min(100, Math.max(0, score)),
      breakdown: {
        color: Math.round(colorScore),
        spacing: Math.round(spacingScore),
        hygiene: Math.round(hygieneScore),
        naming: Math.round(namingScore)
      }
    };
  }

  /** Get label for health score */
  _getScoreLabel(score) {
    if (score >= 90) return { label: 'Excellent', class: 'excellent' };
    if (score >= 70) return { label: 'Good', class: 'good' };
    if (score >= 50) return { label: 'Needs Work', class: 'needs-work' };
    return { label: 'Poor', class: 'poor' };
  }

  /** Build issues list from report */
  _buildIssues(report) {
    const issues = [];
    const { summary, basicAnalysis, recommendations } = report;

    // High priority: Hardcoded colors
    if (basicAnalysis.colorTokenCoverage?.hardcodedColors > 0) {
      const count = basicAnalysis.colorTokenCoverage.hardcodedColors;
      issues.push({
        id: 'hardcoded-colors',
        priority: 'high',
        title: `${count} hardcoded color${count > 1 ? 's' : ''}`,
        description: 'These color values should be design tokens for consistency.',
        details: this._getHardcodedColorDetails(report)
      });
    }

    // Low priority: Unused variables
    if (summary.unusedVariables > 0) {
      const vars = report.data?.unusedVariables || [];
      issues.push({
        id: 'unused-vars',
        priority: 'low',
        title: `${summary.unusedVariables} unused variable${summary.unusedVariables > 1 ? 's' : ''}`,
        description: 'These variables are defined but never referenced.',
        details: vars.slice(0, 20).map(v => ({ name: v }))
      });
    }

    // Medium priority: Spacing inconsistency
    if (basicAnalysis.spacingConsistency?.consistency < 0.8) {
      const { baseUnit, uniqueValues } = basicAnalysis.spacingConsistency;
      issues.push({
        id: 'spacing-grid',
        priority: 'medium',
        title: `Spacing off ${baseUnit}px grid`,
        description: `Found ${uniqueValues} unique spacing values. Consider standardizing to ${baseUnit}px multiples.`,
        details: null
      });
    }

    // Add recommendations from report
    for (const rec of recommendations || []) {
      // Avoid duplicates
      if (rec.action.includes('hardcoded') || rec.action.includes('unused')) continue;
      issues.push({
        id: `rec-${issues.length}`,
        priority: rec.priority || 'low',
        title: rec.action,
        description: rec.benefit || '',
        details: null
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return issues;
  }

  /** Extract hardcoded color details from raw data */
  _getHardcodedColorDetails(report) {
    const rawColors = report.data?.rawValues?.colors || [];
    const hardcoded = rawColors.filter(c => !c.value.includes('var('));
    
    // Group by value
    const grouped = {};
    for (const item of hardcoded) {
      const key = item.value;
      if (!grouped[key]) {
        grouped[key] = { value: key, selectors: [] };
      }
      if (!grouped[key].selectors.includes(item.selector)) {
        grouped[key].selectors.push(item.selector);
      }
    }
    
    return Object.values(grouped).slice(0, 10);
  }

  /** Generate Markdown report */
  _generateMarkdown() {
    if (!this._report) return '';

    const { summary, basicAnalysis } = this._report;
    const score = this._healthScore?.total || 0;
    const scoreInfo = this._getScoreLabel(score);
    const issues = this._buildIssues(this._report);

    const colorCoverage = Math.round((basicAnalysis.colorTokenCoverage?.coverage || 0) * 100);
    const spacingConsistency = Math.round((basicAnalysis.spacingConsistency?.consistency || 0) * 100);
    
    let md = `# Design System Audit

**Score: ${score}/100** (${scoreInfo.label})

## Coverage

| Category   | Coverage | Notes |
|------------|----------|-------|
| Color      | ${colorCoverage}%      | ${basicAnalysis.colorTokenCoverage?.hardcodedColors || 0} hardcoded values |
| Spacing    | ${spacingConsistency}%     | ${basicAnalysis.spacingConsistency?.baseUnit || 4}px grid |

## Tokens

- ${summary.totalVariables} defined
- ${summary.usedVariables} in use (${Math.round((summary.usedVariables / summary.totalVariables) * 100) || 0}%)
- ${summary.unusedVariables} orphaned

## Issues

`;

    const highIssues = issues.filter(i => i.priority === 'high');
    const mediumIssues = issues.filter(i => i.priority === 'medium');
    const lowIssues = issues.filter(i => i.priority === 'low');

    if (highIssues.length > 0) {
      md += `### High Priority\n`;
      for (const issue of highIssues) {
        md += `- **${issue.title}**: ${issue.description}\n`;
      }
      md += '\n';
    }

    if (mediumIssues.length > 0) {
      md += `### Medium Priority\n`;
      for (const issue of mediumIssues) {
        md += `- **${issue.title}**: ${issue.description}\n`;
      }
      md += '\n';
    }

    if (lowIssues.length > 0) {
      md += `### Low Priority\n`;
      for (const issue of lowIssues) {
        md += `- **${issue.title}**: ${issue.description}\n`;
      }
      md += '\n';
    }

    md += `---\n*Generated by Ektachrome • ${new Date().toISOString().split('T')[0]}*\n`;

    return md;
  }

  /** Copy report to clipboard */
  async _copyReport() {
    const markdown = this._generateMarkdown();
    try {
      await navigator.clipboard.writeText(markdown);
      
      // Show feedback
      const btn = this.shadowRoot.querySelector('.copy-btn');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 2000);
      }
    } catch (err) {
      console.warn('[audit-panel] Failed to copy:', err);
    }
  }

  /** Render a progress bar */
  _renderProgressBar(percent, label, sublabel = '') {
    const clampedPercent = Math.min(100, Math.max(0, percent));
    return `
      <div class="progress-row">
        <span class="progress-label">${label}</span>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${clampedPercent}%"></div>
        </div>
        <span class="progress-value">${clampedPercent}%</span>
        ${sublabel ? `<span class="progress-sublabel">${sublabel}</span>` : ''}
      </div>
    `;
  }

  _render() {
    if (!this._report) {
      this.shadowRoot.innerHTML = `
        <style>${this._styles()}</style>
        <div class="panel">
          <div class="panel-header">
            <h2>Design System Audit</h2>
            <button class="close-btn" aria-label="Close">×</button>
          </div>
          <div class="panel-body">
            <p class="empty-state">No audit data. Run an audit first.</p>
          </div>
        </div>
      `;
      return;
    }

    const { summary, basicAnalysis } = this._report;
    const score = this._healthScore?.total || 0;
    const scoreInfo = this._getScoreLabel(score);
    const issues = this._buildIssues(this._report);

    const colorCoverage = Math.round((basicAnalysis.colorTokenCoverage?.coverage || 0) * 100);
    const spacingConsistency = Math.round((basicAnalysis.spacingConsistency?.consistency || 0) * 100);
    const hardcodedCount = basicAnalysis.colorTokenCoverage?.hardcodedColors || 0;
    const baseUnit = basicAnalysis.spacingConsistency?.baseUnit || 4;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="panel">
        <div class="panel-header">
          <h2>Design System Audit</h2>
          <button class="close-btn" aria-label="Close">×</button>
        </div>
        
        <div class="panel-body">
          <!-- Health Score -->
          <section class="score-section">
            <div class="score-ring ${scoreInfo.class}">
              <span class="score-value">${score}</span>
            </div>
            <div class="score-meta">
              <span class="score-label">${scoreInfo.label}</span>
              <span class="score-sublabel">Health Score</span>
            </div>
          </section>

          <!-- Token Stats -->
          <section class="stats-section">
            <h3>Tokens</h3>
            <div class="token-stats">
              <div class="stat">
                <span class="stat-value">${summary.totalVariables}</span>
                <span class="stat-label">defined</span>
              </div>
              <div class="stat-divider">·</div>
              <div class="stat">
                <span class="stat-value">${summary.usedVariables}</span>
                <span class="stat-label">in use</span>
              </div>
              <div class="stat-divider">·</div>
              <div class="stat ${summary.unusedVariables > 0 ? 'warning' : ''}">
                <span class="stat-value">${summary.unusedVariables}</span>
                <span class="stat-label">orphaned</span>
              </div>
            </div>
          </section>

          <!-- Coverage Stats -->
          <section class="coverage-section">
            <h3>Coverage</h3>
            ${this._renderProgressBar(colorCoverage, 'Color', hardcodedCount > 0 ? `${hardcodedCount} hardcoded` : '')}
            ${this._renderProgressBar(spacingConsistency, 'Spacing', `${baseUnit}px grid`)}
          </section>

          <!-- Issues -->
          <section class="issues-section">
            <h3>Issues <span class="issue-count">${issues.length}</span></h3>
            ${issues.length === 0 ? 
              '<p class="no-issues">No issues found</p>' : 
              issues.map(issue => this._renderIssue(issue)).join('')
            }
          </section>
        </div>

        <div class="panel-footer">
          <button class="copy-btn">Copy Report</button>
          <button class="close-btn-footer" onclick="this.getRootNode().host.close()">Close</button>
        </div>
      </div>
    `;
  }

  _renderIssue(issue) {
    const isExpanded = this._expandedIssues.has(issue.id);
    const priorityIcon = {
      high: '⚠',
      medium: '○',
      low: '○'
    }[issue.priority];

    let detailsHtml = '';
    if (isExpanded && issue.details && issue.details.length > 0) {
      detailsHtml = `
        <div class="issue-details">
          <p class="issue-description">${issue.description}</p>
          <ul class="issue-items">
            ${issue.details.map(d => {
              if (d.selectors) {
                return `<li>
                  <code>${d.value}</code>
                  <span class="item-selectors">${d.selectors.slice(0, 3).join(', ')}${d.selectors.length > 3 ? '...' : ''}</span>
                </li>`;
              }
              return `<li><code>${d.name}</code></li>`;
            }).join('')}
          </ul>
        </div>
      `;
    } else if (isExpanded) {
      detailsHtml = `
        <div class="issue-details">
          <p class="issue-description">${issue.description}</p>
        </div>
      `;
    }

    return `
      <div class="issue ${issue.priority} ${isExpanded ? 'expanded' : ''}">
        <div class="issue-header" data-issue-id="${issue.id}">
          <span class="issue-chevron">${isExpanded ? '▾' : '▸'}</span>
          <span class="issue-icon">${priorityIcon}</span>
          <span class="issue-title">${issue.title}</span>
          <span class="issue-priority ${issue.priority}">${issue.priority}</span>
        </div>
        ${detailsHtml}
      </div>
    `;
  }

  _styles() {
    return `
      ${baseStyles}

      :host {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483646;
        pointer-events: none;
      }

      .panel {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 380px;
        max-width: 100vw;
        background: ${THEME.colorBgPopup};
        backdrop-filter: ${THEME.backdropBlur};
        -webkit-backdrop-filter: ${THEME.backdropBlur};
        border-left: 1px solid ${THEME.colorBorder};
        display: flex;
        flex-direction: column;
        font-family: ${THEME.fontSystem};
        color: ${THEME.colorText};
        pointer-events: auto;
        animation: slideIn 0.25s ease-out;
      }

      .panel.closing {
        animation: slideOut 0.2s ease-in forwards;
      }

      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }

      /* Header */
      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid ${THEME.colorBorder};
        flex-shrink: 0;
      }

      .panel-header h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: ${THEME.colorText};
      }

      .close-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: ${THEME.colorTextMuted};
        font-size: 20px;
        cursor: pointer;
        border-radius: ${THEME.radiusSm};
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
      }

      .close-btn:hover {
        background: ${THEME.colorBgHoverStrong};
        color: ${THEME.colorText};
      }

      /* Body */
      .panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      .panel-body section {
        margin-bottom: 24px;
      }

      .panel-body section:last-child {
        margin-bottom: 0;
      }

      .panel-body h3 {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: ${THEME.colorTextMuted};
        margin: 0 0 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* Health Score */
      .score-section {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: ${THEME.colorBgSubtle};
        border-radius: ${THEME.radiusLg};
      }

      .score-ring {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: conic-gradient(
          var(--score-color, ${THEME.colorTextMuted}) calc(var(--score-percent, 0) * 1%),
          ${THEME.colorBgHover} 0
        );
        position: relative;
      }

      .score-ring::before {
        content: '';
        position: absolute;
        inset: 6px;
        border-radius: 50%;
        background: ${THEME.colorBgPopup};
      }

      .score-ring .score-value {
        position: relative;
        font-size: 20px;
        font-weight: 700;
        font-family: ${THEME.fontMono};
      }

      .score-ring.excellent { --score-color: #4ade80; --score-percent: ${this._healthScore?.total || 0}; }
      .score-ring.good { --score-color: #60a5fa; --score-percent: ${this._healthScore?.total || 0}; }
      .score-ring.needs-work { --score-color: #fbbf24; --score-percent: ${this._healthScore?.total || 0}; }
      .score-ring.poor { --score-color: #f87171; --score-percent: ${this._healthScore?.total || 0}; }

      .score-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .score-label {
        font-size: 16px;
        font-weight: 600;
      }

      .score-sublabel {
        font-size: 12px;
        color: ${THEME.colorTextMuted};
      }

      /* Token Stats */
      .token-stats {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .stat {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }

      .stat-value {
        font-size: 18px;
        font-weight: 600;
        font-family: ${THEME.fontMono};
      }

      .stat-label {
        font-size: 12px;
        color: ${THEME.colorTextMuted};
      }

      .stat-divider {
        color: ${THEME.colorTextDim};
      }

      .stat.warning .stat-value {
        color: ${THEME.colorWarning};
      }

      /* Progress Bars */
      .progress-row {
        display: grid;
        grid-template-columns: 60px 1fr 40px;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .progress-row:last-child {
        margin-bottom: 0;
      }

      .progress-label {
        font-size: 12px;
        color: ${THEME.colorTextMuted};
      }

      .progress-bar {
        height: 6px;
        background: ${THEME.colorBgSubtle};
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #60a5fa, #4ade80);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .progress-value {
        font-size: 12px;
        font-family: ${THEME.fontMono};
        text-align: right;
        color: ${THEME.colorText};
      }

      .progress-sublabel {
        grid-column: 2 / -1;
        font-size: 10px;
        color: ${THEME.colorTextDim};
        margin-top: -8px;
      }

      /* Issues */
      .issue-count {
        font-size: 10px;
        background: ${THEME.colorBgSubtle};
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: 500;
      }

      .no-issues {
        font-size: 12px;
        color: ${THEME.colorTextMuted};
        text-align: center;
        padding: 20px;
      }

      .issue {
        background: ${THEME.colorBgSubtle};
        border-radius: ${THEME.radiusMd};
        margin-bottom: 8px;
        overflow: hidden;
      }

      .issue:last-child {
        margin-bottom: 0;
      }

      .issue-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .issue-header:hover {
        background: ${THEME.colorBgHoverStrong};
      }

      .issue-chevron {
        font-size: 10px;
        color: ${THEME.colorTextDim};
        width: 12px;
      }

      .issue-icon {
        font-size: 12px;
      }

      .issue.high .issue-icon {
        color: #f87171;
      }

      .issue.medium .issue-icon {
        color: #fbbf24;
      }

      .issue.low .issue-icon {
        color: ${THEME.colorTextMuted};
      }

      .issue-title {
        flex: 1;
        font-size: 12px;
        font-weight: 500;
      }

      .issue-priority {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
      }

      .issue-priority.high {
        background: rgba(248, 113, 113, 0.2);
        color: #f87171;
      }

      .issue-priority.medium {
        background: rgba(251, 191, 36, 0.2);
        color: #fbbf24;
      }

      .issue-priority.low {
        background: ${THEME.colorBgHover};
        color: ${THEME.colorTextMuted};
      }

      .issue-details {
        padding: 0 12px 12px 32px;
        border-top: 1px solid ${THEME.colorBorder};
      }

      .issue-description {
        font-size: 11px;
        color: ${THEME.colorTextMuted};
        margin: 12px 0;
        line-height: 1.5;
      }

      .issue-items {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .issue-items li {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 0;
        border-bottom: 1px solid ${THEME.colorBorderSubtle};
      }

      .issue-items li:last-child {
        border-bottom: none;
      }

      .issue-items code {
        font-family: ${THEME.fontMono};
        font-size: 11px;
        color: ${THEME.colorText};
      }

      .item-selectors {
        font-size: 10px;
        color: ${THEME.colorTextDim};
      }

      /* Footer */
      .panel-footer {
        display: flex;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid ${THEME.colorBorder};
        flex-shrink: 0;
      }

      .panel-footer button {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: ${THEME.radiusMd};
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
      }

      .copy-btn {
        background: ${THEME.colorText};
        color: ${THEME.colorBgPopup};
      }

      .copy-btn:hover {
        transform: translateY(-1px);
      }

      .copy-btn.copied {
        background: #4ade80;
      }

      .close-btn-footer {
        background: ${THEME.colorBgSubtle};
        color: ${THEME.colorTextMuted};
      }

      .close-btn-footer:hover {
        background: ${THEME.colorBgHoverStrong};
        color: ${THEME.colorText};
      }

      /* Empty state */
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: ${THEME.colorTextMuted};
        font-size: 13px;
      }

      /* Scrollbar */
      .panel-body::-webkit-scrollbar {
        width: 6px;
      }

      .panel-body::-webkit-scrollbar-track {
        background: transparent;
      }

      .panel-body::-webkit-scrollbar-thumb {
        background: ${THEME.colorBgSubtle};
        border-radius: 3px;
      }

      .panel-body::-webkit-scrollbar-thumb:hover {
        background: ${THEME.colorBorderHover};
      }
    `;
  }
}

customElements.define('audit-panel', AuditPanel);

export { AuditPanel };
