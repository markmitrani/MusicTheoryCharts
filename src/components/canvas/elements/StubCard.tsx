'use client';

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
 * Unconfirmed spawn stub: root + type must be picked, then the confirm icon
 * turns it into a real element. Clicking away from it removes it (handled by
 * the canvas background handler via removeUnconfirmedStubs).
 */
export function StubCard({ el }: { el: StubElement }) {
  const filled = el.root !== null && el.typeId !== null;

  const previewName = (() => {
    if (!filled) return 'New element…';
    const [kind, typeId] = el.typeId!.split(':');
    return kind === 'chord'
      ? chordDisplayName(el.root!, typeId, 0)
      : scaleDisplayName(el.root!, typeId);
  })();

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
        <div className={styles.body}>
          <TypePicker
            inline
            kinds={['scale', 'chord']}
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
