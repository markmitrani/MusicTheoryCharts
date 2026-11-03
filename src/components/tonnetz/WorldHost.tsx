'use client';

import dynamic from 'next/dynamic';
import { useWorld } from '@/lib/tonnetz/world-store';

// The 3D stack (three.js, React Three Fiber) loads only when a world opens.
const TonnetzWorld = dynamic(() => import('./TonnetzWorld').then((m) => m.TonnetzWorld), { ssr: false });

/** Renders the 3D Tonnetz overlay for whichever card opened it. */
export function WorldHost() {
  const id = useWorld((s) => s.elementId);
  return id ? <TonnetzWorld key={id} elementId={id} /> : null;
}
