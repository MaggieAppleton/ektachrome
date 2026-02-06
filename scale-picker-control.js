/**
 * <scale-picker> - Pick from a named scale
 * 
 * Works for type sizes, border radii, shadows — anything with named steps
 */
class ScalePicker extends HTMLElement {
  connectedCallback() {
    const scaleType = this.getAttribute('scale'); // 'typography' | 'radius' | 'shadow'
    
    const scales = {
      typography: [
        { name: 'xs',  value: '0.75rem',  label: 'XS' },
        { name: 'sm',  value: '0.875rem', label: 'SM' },
        { name: 'base', value: '1rem',    label: 'Base' },
        { name: 'lg',  value: '1.125rem', label: 'LG' },
        { name: 'xl',  value: '1.25rem',  label: 'XL' },
        { name: '2xl', value: '1.5rem',   label: '2XL' },
        { name: '3xl', value: '1.875rem', label: '3XL' },
      ],
      radius: [
        { name: 'none', value: '0px',    label: '0' },
        { name: 'sm',   value: '2px',    label: '2' },
        { name: 'md',   value: '4px',    label: '4' },
        { name: 'lg',   value: '8px',    label: '8' },
        { name: 'xl',   value: '12px',   label: '12' },
        { name: '2xl',  value: '16px',   label: '16' },
        { name: 'full', value: '9999px', label: '∞' },
      ]
    };
    
    // Render as a horizontal segmented control
    // Click a segment → update the CSS variable
  }
}