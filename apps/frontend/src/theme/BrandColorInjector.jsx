import React, { useEffect } from 'react';
import { applyBrandColor } from './brandColor';

export function BrandColorInjector({ brandColor }) {
  useEffect(() => {
    if (brandColor) {
      applyBrandColor(brandColor);
    }
  }, [brandColor]);

  return null;
}

export default BrandColorInjector;
