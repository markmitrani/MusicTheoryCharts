'use client';

import { useState } from 'react';
import type { NoteName } from '@/lib/theory/note';
import { scaleDisplayName } from '@/lib/theory/scales';
import { chordDisplayName } from '@/lib/theory/chords';
import type { StubElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { ElementShell } from '../ElementShell';
import { TypePicker } from './TypePicker';
import { CheckIcon } from '@/components/chrome/icons';
import chordStyles from './ChordCard.module.scss';
import styles from './StubCard.module.scss';

/**
 * Element kinds offered by the spawn stub. Future canvas tools (circle of
 * fifths, Bartók pitch axis, …) slot in here as new entries.
 */
const STUB_KINDS = [
  { id: 'scale', label: 'Scale' },
  { id: 'chord', label: 'Chord' },
  { id: 'harmony', label: 'Harmony' },
] as const;

type StubKind = (typeof STUB_KINDS)[number]['id'];

/**
 * Unconfirmed spawn stub: pick a kind, then root + type; the confirm icon
 * turns it into a real element. Clicking away removes it (handled by the
 * canvas background handler via removeUnconfirmedStubs).
 */
export function StubCard({ el }: { el: StubElement }) {
  const [kind, setKind] = useState<StubKind>(
    (el.typeId?.split(':')[0] as StubKind) ?? 'scale',
  );
  const filled = el.root !== null && el.typeId !== null;

  const previewName = (() => {
    if (!filled) return 'New element…';
    const [k, typeId] = el.typeId!.split(':');
    if (k === 'chord') return chordDisplayName(el.root!, typeId, 0);
    if (k === 'harmony') return `${scaleDisplayName(el.root!, typeId)} Harmony`;
    return scaleDisplayName(el.root!, typeId);
  })();

  const switchKind = (next: StubKind) => {
    setKind(next);
    if (el.typeId && !el.typeId.startsWith(`${next}:`)) {
      canvasStore.getState().updateElement(el.id, { typeId: null });
    }
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={false} soloSelected={false}>
      <div className={chordStyles.wrap}>
        <div className={chordStyles.header}>
          <span className={chordStyles.nameTab}>
            <span className={chordStyles.nameTabInner} data-empty={!filled || undefined}>
              {previewName}
            </span>
          </span>
          {filled && (
            <button
              className={styles.confirm}
              aria-label="Place on canvas"
              title="Place on canvas"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                canvasStore.getState().confirmStub(el.id);
              }}
            >
              <CheckIcon width={16} height={16} />
            </button>
          )}
        </div>
        <div className={styles.body} onPointerDown={(e) => e.stopPropagation()}>
          <div className={styles.kinds} role="tablist" aria-label="Element kind">
            {STUB_KINDS.map((k) => (
              <button
                key={k.id}
                role="tab"
                aria-selected={kind === k.id}
                className={styles.kind}
                data-active={kind === k.id || undefined}
                onClick={() => switchKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <TypePicker
            inline
            kinds={[kind]}
            root={el.root as NoteName | null}
            typeId={el.typeId}
            onChange={(root, typeId) =>
              canvasStore.getState().updateElement(el.id, { root, typeId })
            }
          />
        </div>
      </div>
    </ElementShell>
  );
}
