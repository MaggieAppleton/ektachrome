// Import config utilities
import { loadConfig, getConfig, setConfig } from './utils/config.js';

// Import controls (registers custom elements as side effect)
import { OklchPicker } from './controls/oklch-picker.js';
import { ColorTokenControl } from './controls/color-token-control.js';
import { SpacingStepControl } from './controls/spacing-step-control.js';
import { ScalePicker } from './controls/scale-picker.js';
import { ToolbarPopup } from './controls/toolbar-popup.js';
import { TokenCreator } from './controls/token-creator.js';
import { DurationControl } from './controls/duration-control.js';
import { EasingPicker } from './controls/easing-picker.js';
import { SpringControl } from './controls/spring-control.js';

// Import picker
import { ElementPicker } from './picker/element-picker.js';

// Import scanner utilities
import { findCSSVariablesForElement } from './scanner/detect-css-vars.js';
import { resolveTokensForElement, variableMap, buildVariableMap } from './scanner/variable-map.js';
import { auditDesignSystem } from './scanner/design-system-audit.js';
import { discoverVariables } from './bridge/variable-discovery.js';

class Ektachrome {
  constructor() {
    // Load config asynchronously (non-blocking)
    loadConfig().catch(e => console.warn('[ektachrome] Config load failed:', e));
    
    // Track if we're in active session
    this._active = false;
    
    // Create toolbar popup and append to body
    this._popup = document.createElement('toolbar-popup');
    document.body.appendChild(this._popup);
    
    // When popup closes, reactivate picker (if we're still in an active session)
    this._popup.addEventListener('popup-close', () => {
      if (this._active) {
        this._picker.activate();
      }
    });

    // Create element picker with onSelect callback
    this._picker = new ElementPicker({
      onSelect: (elementInfo) => {
        this._popup.show(elementInfo);
      }
    });
  }

  /** Activate element selection mode */
  activate() {
    this._active = true;
    this._picker.activate();
  }

  /** Deactivate and hide everything */
  deactivate() {
    this._active = false;
    this._picker.deactivate();
    this._popup.hide();
  }

  /** Run the design system audit */
  async audit() {
    return auditDesignSystem();
  }

  /** Clean up — remove popup, deactivate picker */
  destroy() {
    this.deactivate();
    this._popup.remove();
  }
}

export { Ektachrome, ElementPicker, ToolbarPopup };
export { OklchPicker, ColorTokenControl, SpacingStepControl, ScalePicker };
export { TokenCreator, DurationControl, EasingPicker, SpringControl };
export { findCSSVariablesForElement, resolveTokensForElement, variableMap, buildVariableMap };
export { auditDesignSystem, discoverVariables };
export { loadConfig, getConfig, setConfig };
