/**
 * Dynamic Brand Color Manager
 * Automatically synchronizes custom studio brand colors with CSS variables
 * for unified input, dropdown, button, and accent styling everywhere.
 */

export function applyBrandColor(color) {
  if (!color || typeof color !== 'string') return;
  const root = document.documentElement;

  const cleanHex = color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`;
  root.style.setProperty('--brand-primary', cleanHex);

  const hex = cleanHex.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      // YIQ equation for high-contrast accessible text
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      const foreground = yiq >= 128 ? '#0F172A' : '#FFFFFF';

      root.style.setProperty('--brand-primary-foreground', foreground);
      root.style.setProperty('--brand-primary-rgb', `${r}, ${g}, ${b}`);
      root.style.setProperty('--brand-primary-focus', `rgba(${r}, ${g}, ${b}, 0.22)`);
      root.style.setProperty('--brand-primary-border', `rgba(${r}, ${g}, ${b}, 0.45)`);
      root.style.setProperty('--brand-primary-hover', `rgba(${r}, ${g}, ${b}, 0.08)`);
      root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);

      // Dynamic branded dropdown chevron SVG
      const strokeHex = `%23${hex}`;
      const svgChevron = `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='${strokeHex}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
      root.style.setProperty('--brand-select-arrow', svgChevron);

      try {
        localStorage.setItem('studioflow-brand-color', cleanHex);
      } catch (_) {}
    }
  }
}

export function getStoredBrandColor() {
  try {
    return localStorage.getItem('studioflow-brand-color') || '#3B82F6';
  } catch (_) {
    return '#3B82F6';
  }
}

export function initBrandColor() {
  const color = getStoredBrandColor();
  applyBrandColor(color);
}
