'use client';

import { useEffect, useState } from 'react';
import { getSurfaces, type Surfaces } from './theme';

/**
 * Reactively tracks the `data-surfaces` mode (flat / glass) on <html>, which
 * the settings toggle flips outside React. Lets SVG components swap fills
 * (e.g. piano keys → gradient) when the mode changes.
 */
export function useSurfaces(): Surfaces {
  const [surfaces, setSurfaces] = useState<Surfaces>('flat');
  useEffect(() => {
    setSurfaces(getSurfaces());
    const obs = new MutationObserver(() => setSurfaces(getSurfaces()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-surfaces'] });
    return () => obs.disconnect();
  }, []);
  return surfaces;
}
