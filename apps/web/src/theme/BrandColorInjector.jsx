import React, { useEffect } from 'react';

export function BrandColorInjector({ brandColor }) {
  useEffect(() => {
    if (!brandColor) return;

    const root = document.documentElement;
    root.style.setProperty('--brand-primary', brandColor);

    // Calculate perceived brightness for accessible contrast text color
    const hex = brandColor.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      const foreground = yiq >= 128 ? '#0F172A' : '#FFFFFF';
      root.style.setProperty('--brand-primary-foreground', foreground);
    }
  }, [brandColor]);

  return null;
}
