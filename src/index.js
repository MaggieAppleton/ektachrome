// Import controls (registers custom elements as side effect)
import { ColorTokenControl } from './controls/color-token-control.js';
import { SpacingStepControl } from './controls/spacing-step-control.js';
import { ScalePicker } from './controls/scale-picker.js';
import { ToolbarPopup } from './controls/toolbar-popup.js';

// Import picker
import { ElementPicker } from './picker/element-picker.js';

// Import scanner utilities
import { findCSSVariablesForElement } from './scanner/detect-css-vars.js';
import { resolveTokensForElement, variableMap } from './scanner/variable-map.js';
import { auditDesignSystem } from './scanner/design-system-audit.js';
import { discoverVariables } from './bridge/variable-discovery.js';

class Ektachrome {
  constructor() {
    // Create toolbar popup and append to body
    this._popup = document.createElement('toolbar-popup');
    document.body.appendChild(this._popup);

    // Create element picker with onSelect callback
    this._picker = new ElementPicker({
      onSelect: (elementInfo) => {
        this._popup.show(elementInfo);
      }
    });
  }

  /** Activate element selection mode */
  activate() {
    this._picker.activate();
  }

  /** Deactivate and hide everything */
  deactivate() {
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
export { ColorTokenControl, SpacingStepControl, ScalePicker };
export { findCSSVariablesForElement, resolveTokensForElement, variableMap };
export { auditDesignSystem, discoverVariables };
