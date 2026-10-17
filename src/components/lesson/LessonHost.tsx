'use client';

import { useLesson } from '@/lib/lesson/store';
import { WaysHomeLesson } from '@/components/cadence/WaysHomeLesson';

/** Renders whichever lesson is open (outside the canvas transform). */
export function LessonHost() {
  const open = useLesson((s) => s.open);
  if (open === 'ways-home') return <WaysHomeLesson />;
  return null;
}
