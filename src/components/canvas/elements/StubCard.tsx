'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
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
const MORE_KINDS = [
  { id: 'circle', label: 'Circle of Fifths' },
  { id: 'pitchaxis', label: 'Pitch Axis' },
] as const;

type StubKind =
  | (typeof PRIMARY_KINDS)[number]['id']
  | (typeof MORE_KINDS)[number]['id'];

const isMoreKind = (k: StubKind) => MORE_KINDS.some((m) => m.id === k);

// "Instant" kinds need no root/type choice — confirm spawns them as-is.
const INSTANT_KINDS = ['circle', 'pitchaxis'] as const;
const isInstantKind = (k: StubKind): k is (typeof INSTANT_KINDS)[number] =>
  (INSTANT_KINDS as readonly string[]).includes(k);

const INSTANT_LABEL: Record<string, string> = {
  circle: 'Circle of Fifths',
  pitchaxis: 'Pitch Axis',
};

const INSTANT_NOTE: Record<string, string> = {
  circle:
    'An interactive circle of fifths — click a key on it to re-center, and spawn scales, chords, or harmonies from any key. Confirm above to place it.',
  pitchaxis:
    "Bartók's pitch axis — the 12 notes grouped into tonic, subdominant and dominant functions, independent of mode. Confirm above to place it.",
};

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

  // Ephemeral lifecycle: the stub fades 100→0% over 3s and despawns if
  // ignored; any interaction revives it (opacity climbs back at 75%/s), then
  // the fade restarts. Click-away removal is handled by the canvas background.
  const wrapRef = useRef<HTMLDivElement>(null);
  const startFade = useRef<() => void>(() => {});
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    startFade.current = () => {
      gsap.to(wrap, {
        opacity: 0,
        duration: 3,
        ease: 'power1.inOut',
        overwrite: true,
        onComplete: () => canvasStore.getState().removeUnconfirmedStubs(),
      });
    };
    startFade.current();
    return () => gsap.killTweensOf(wrap);
  }, []);

  const revive = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cur = Number(gsap.getProperty(wrap, 'opacity')) || 1;
    gsap.killTweensOf(wrap);
    gsap.to(wrap, {
      opacity: 1,
      duration: Math.max(0.04, (1 - cur) / 0.75),
      ease: 'power1.out',
      overwrite: true,
      onComplete: () => startFade.current(),
    });
  };
  const filled = isInstantKind(kind)
    ? el.typeId === `${kind}:default`
    : el.root !== null && el.typeId !== null;

  const previewName = (() => {
    if (!filled) return 'New element…';
    if (isInstantKind(kind)) return INSTANT_LABEL[kind];
    const [k, typeId] = el.typeId!.split(':');
    if (k === 'chord') return chordDisplayName(el.root!, typeId, 0);
    if (k === 'harmony') return `${scaleDisplayName(el.root!, typeId)} Harmony`;
    return scaleDisplayName(el.root!, typeId);
  })();

  const switchKind = (next: StubKind) => {
    setKind(next);
    setMoreOpen(false);
    if (isInstantKind(next)) {
      canvasStore.getState().updateElement(el.id, { typeId: `${next}:default` });
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
      <div className={chordStyles.wrap} ref={wrapRef} onPointerDownCapture={revive}>
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
          {isInstantKind(kind) ? (
            <p className={styles.circleNote}>{INSTANT_NOTE[kind]}</p>
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
