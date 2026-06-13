'use client';

import { useEffect, useState } from 'react';
import type { NoteName } from '@/lib/theory/note';
import { scaleDisplayName } from '@/lib/theory/scales';
import { chordDisplayName } from '@/lib/theory/chords';
import type { StubElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { ElementShell } from '../ElementShell';
import { TypePicker } from './TypePicker';
import { CheckIcon, EllipsisIcon } from '@/components/chrome/icons';
import chordStyles from './ChordCard.module.scss';
import styles from './StubCard.module.scss';

/**
 * Everyday element kinds, shown directly in the spawn stub.
 */
const PRIMARY_KINDS = [
  { id: 'scale', label: 'Scale' },
  { id: 'chord', label: 'Chord' },
  { id: 'harmony', label: 'Harmony' },
] as const;

/**
 * Advanced/conceptual tools placed on the canvas less often. Tucked behind an
 * ellipsis so the common kinds stay front-and-centre; future tools (Bartók
 * pitch axis, …) join this group.
 */
const MORE_KINDS = [{ id: 'circle', label: 'Circle of Fifths' }] as const;

type StubKind =
  | (typeof PRIMARY_KINDS)[number]['id']
  | (typeof MORE_KINDS)[number]['id'];

const isMoreKind = (k: StubKind) => MORE_KINDS.some((m) => m.id === k);

/**
 * Unconfirmed spawn stub: pick a kind, then root + type; the confirm icon
 * turns it into a real element. Clicking away removes it (handled by the
 * canvas background handler via removeUnconfirmedStubs).
 */
export function StubCard({ el }: { el: StubElement }) {
  const [kind, setKind] = useState<StubKind>(
    (el.typeId?.split(':')[0] as StubKind) ?? (el.kindHint as StubKind) ?? 'scale',
  );
  // Dropdown of advanced kinds, anchored to the ellipsis button.
  const [moreOpen, setMoreOpen] = useState(false);
  const filled =
    kind === 'circle' ? el.typeId === 'circle:default' : el.root !== null && el.typeId !== null;

  const previewName = (() => {
    if (!filled) return 'New element…';
    if (kind === 'circle') return 'Circle of Fifths';
    const [k, typeId] = el.typeId!.split(':');
    if (k === 'chord') return chordDisplayName(el.root!, typeId, 0);
    if (k === 'harmony') return `${scaleDisplayName(el.root!, typeId)} Harmony`;
    return scaleDisplayName(el.root!, typeId);
  })();

  const switchKind = (next: StubKind) => {
    setKind(next);
    setMoreOpen(false);
    if (next === 'circle') {
      canvasStore.getState().updateElement(el.id, { typeId: 'circle:default' });
    } else if (el.typeId && !el.typeId.startsWith(`${next}:`)) {
      canvasStore.getState().updateElement(el.id, { typeId: null });
    }
  };

  // Close the advanced dropdown on any click outside the stub body.
  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [moreOpen]);

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
            {PRIMARY_KINDS.map((k) => (
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
            <div className={styles.moreWrap}>
              <button
                className={styles.more}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label="More element types"
                data-active={moreOpen || isMoreKind(kind) || undefined}
                title="More element types"
                onClick={() => setMoreOpen((v) => !v)}
              >
                <EllipsisIcon width={18} height={18} />
              </button>
              {moreOpen && (
                <div className={styles.moreMenu} role="menu" aria-label="Advanced element kind">
                  {MORE_KINDS.map((k) => (
                    <button
                      key={k.id}
                      role="menuitem"
                      className={styles.moreItem}
                      data-active={kind === k.id || undefined}
                      onClick={() => switchKind(k.id)}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {kind === 'circle' ? (
            <p className={styles.circleNote}>
              An interactive circle of fifths — click a key on it to re-center, and spawn
              scales, chords, or harmonies from any key. Confirm above to place it.
            </p>
          ) : (
            <TypePicker
              inline
              kinds={[kind]}
              root={el.root as NoteName | null}
              typeId={el.typeId}
              onChange={(root, typeId) =>
                canvasStore.getState().updateElement(el.id, { root, typeId })
              }
            />
          )}
        </div>
      </div>
    </ElementShell>
  );
}
