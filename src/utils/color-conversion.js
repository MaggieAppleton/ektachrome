/**
 * Color conversion utilities for Ektachrome
 * 
 * Converts various CSS color formats to OKLCH for the color picker.
 * Uses browser's built-in color parsing where possible.
 */

/**
 * Convert any CSS color value to OKLCH format
 * @param {string} value - CSS color value (hex, rgb, hsl, named color, etc.)
 * @returns {string} OKLCH color string, e.g., "oklch(0.62 0.21 255)"
 */
export function cssToOklch(value) {
  if (!value || value === 'transparent' || value === 'inherit' || value === 'initial') {
    return 'oklch(0.5 0 0)';
  }
  
  // Already OKLCH
  if (value.startsWith('oklch(')) {
    return value;
  }
  
  // Parse the color to RGB first using canvas
  const rgb = parseColorToRgb(value);
  if (!rgb) {
    return 'oklch(0.5 0 0)';
  }
  
  // Convert RGB to OKLCH
  return rgbToOklch(rgb.r, rgb.g, rgb.b);
}

/**
 * Parse any CSS color to RGB using the browser's color parser
 * @param {string} value - CSS color value
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseColorToRgb(value) {
  // Use a canvas to parse colors (handles all CSS color formats)
  const ctx = getCanvasContext();
  if (!ctx) return null;
  
  try {
    ctx.fillStyle = '#000'; // Reset
    ctx.fillStyle = value;
    
    // If the color wasn't valid, fillStyle stays at the reset value
    const parsed = ctx.fillStyle;
    if (parsed === '#000000' && value.toLowerCase() !== '#000' && value.toLowerCase() !== '#000000' && value.toLowerCase() !== 'black') {
      // Might be invalid, but also might be actual black - do a second check
      ctx.fillStyle = '#fff';
      ctx.fillStyle = value;
      if (ctx.fillStyle === '#ffffff') {
        return null; // Invalid color
      }
    }
    
    // Parse the hex result
    const hex = ctx.fillStyle;
    if (hex.startsWith('#')) {
      return hexToRgb(hex);
    }
    
    // Could be rgb() format
    const rgbMatch = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// Cached canvas context for color parsing
let _canvasCtx = null;
function getCanvasContext() {
  if (_canvasCtx) return _canvasCtx;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    _canvasCtx = canvas.getContext('2d');
    return _canvasCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    // Try 3-digit hex
    const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (short) {
      return {
        r: parseInt(short[1] + short[1], 16),
        g: parseInt(short[2] + short[2], 16),
        b: parseInt(short[3] + short[3], 16)
      };
    }
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

/**
 * Convert RGB (0-255) to OKLCH string
 * Based on the official OKLab specification by Bjorn Ottosson
 */
export function rgbToOklch(r, g, b) {
  // Normalize to 0-1
  r = r / 255;
  g = g / 255;
  b = b / 255;
  
  // sRGB to linear RGB
  const srgbToLinear = (x) => {
    if (x <= 0.04045) return x / 12.92;
    return Math.pow((x + 0.055) / 1.055, 2.4);
  };
  
  const rLinear = srgbToLinear(r);
  const gLinear = srgbToLinear(g);
  const bLinear = srgbToLinear(b);
  
  // Linear RGB to LMS
  const l = 0.4122214708 * rLinear + 0.5363325363 * gLinear + 0.0514459929 * bLinear;
  const m = 0.2119034982 * rLinear + 0.6806995451 * gLinear + 0.1073969566 * bLinear;
  const s = 0.0883024619 * rLinear + 0.2817188376 * gLinear + 0.6299787005 * bLinear;
  
  // LMS to OKLab (cube root)
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  
  // OKLab to OKLCH
  const C = Math.sqrt(A * A + B * B);
  let H = Math.atan2(B, A) * (180 / Math.PI);
  if (H < 0) H += 360;
  
  // Round to reasonable precision
  const lightness = Math.round(L * 100) / 100;
  const chroma = Math.round(C * 100) / 100;
  const hue = Math.round(H);
  
  return `oklch(${lightness} ${chroma} ${hue})`;
}

/**
 * Parse an OKLCH string into components
 * @param {string} oklch - e.g., "oklch(0.62 0.21 255)"
 * @returns {{ l: number, c: number, h: number } | null}
 */
export function parseOklch(oklch) {
  const match = oklch.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!match) return null;
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3])
  };
}
