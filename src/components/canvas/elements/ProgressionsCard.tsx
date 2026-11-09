'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getScaleDef } from '@/lib/theory/scales';
import { voiceProgression } from '@/lib/theory/cadence';
import {
  type LabelKind,
  type ResolvedChord,
  getProgressionMap,
  resolveStep,
  stepRef,
  stepRoad,
  stepSpecs,
  stepTwins,
  tonicName,
} from '@/lib/theory/progressions';
import type { ProgressionsElement } from '@/lib/canvas-store/types';
import type { PortalChord, PortalKind } from '@/lib/theory/portals';
import { canvasStore } from '@/lib/canvas-store/store';
import { playChord, playProgression, uiTick } from '@/lib/playback/playback';
import { MapScene } from '@/components/progressions/MapScene';
import { MandalaScene } from '@/components/progressions/MandalaScene';
import { layoutMandala, modeRing } from '@/components/progressions/mandala';
import { LabelControl } from '@/components/progressions/LabelControl';
import { ProgressionTrail } from '@/components/progressions/ProgressionTrail';
import { useGrunge } from '@/components/progressions/texture';
import { Acc } from '@/components/cadence/Acc';
import { ElementShell } from '../ElementShell';
import { PlayButton } from './PlayButton';
import { TypePicker } from './TypePicker';
import chordStyles from './ChordCard.module.scss';
import styles from './ProgressionsCard.module.scss';

interface ProgressionsCardProps {
  el: ProgressionsElement;
  selected: boolean;
  soloSelected: boolean;
}

const MAX_TRAIL = 16;

type Travel = { mode: string; from: string; to: string; n: number } | null;

/** The pulse for a step: along the road that carries it, on the later chord's map. */
const travelOf = (from: string, to: string, n: number): Travel => {
  const road = stepRoad(from, to);
  return road ? { ...road, n } : null;
};

/**
 * Progressions: the harmonic flow map of a key. Clicking a chord plays it and
 * writes it into the progression along the top (in the mandala, from any
 * mode); the play button plays what's written (or walks the map's own example
 * when nothing is).
 */
export function ProgressionsCard({ el, selected, soloSelected }: ProgressionsCardProps) {
  const [editing, setEditing] = useState(false);
  const [sounding, setSounding] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [playingAll, setPlayingAll] = useState(false);
  const [travel, setTravel] = useState<Travel>(null);
  // Pencil: on by default, clicks on the map write; off, they only play.
  const [writing, setWriting] = useState(true);
  // Crumb selected in the progression row (selecting doesn't sound).
  const [picked, setPicked] = useState<number | null>(null);
  const grunge = useGrunge();
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Centre of the angular outline: the mandala's middle, or the card's.
  const [ringAt, setRingAt] = useState('50% 50%');

  const map = getProgressionMap(el.scaleId);
  const sevenths = !!el.showSevenths;
  const labelOrder: LabelKind[] = el.labelOrder ?? ['functions', 'notes'];
  const labels = labelOrder.filter((k) => k !== el.labelsHidden);
  const mandalaView = !!el.mandala;
  const borrowed = !mandalaView && !!el.showBorrowed && map.borrowed.length > 0;
  const title = `${tonicName(el.root, map)} ${getScaleDef(el.scaleId).label}`;

  // Written steps keep their own mode, so the trail outlives a change of mode.
  const resolved = useMemo(() => {
    const out = new Map<string, ResolvedChord>();
    for (const ref of el.trail) {
      const r = resolveStep(ref, el.root, sevenths);
      if (r) out.set(ref, r);
    }
    return out;
  }, [el.trail, el.root, sevenths]);
  const trail = el.trail.filter((ref) => resolved.has(ref));

  const update = (patch: Partial<ProgressionsElement>) =>
    canvasStore.getState().updateElement(el.id, patch, { commit: true });

  const voiced = (refs: string[]) => voiceProgression(stepSpecs(refs, el.root, sevenths), el.root);

  const write = (mode: string, id: string) => {
    const ref = stepRef(mode, id);
    // Voice-led from the chord before it, so the step sounds as it will in the progression.
    const prev = writing ? trail[trail.length - 1] : undefined;
    const chords = voiced(prev ? [prev, ref] : [ref]);
    playChord(chords[chords.length - 1], {
      onLit: () => {},
      onDone: () => {
        setSounding(null);
        setTravel(null);
      },
    });
    setSounding(ref);
    setStep(-1);
    if (!writing) return;
    setTravel(prev ? travelOf(prev, ref, Date.now()) : null);
    update({ trail: [...trail, ref].slice(-MAX_TRAIL) });
  };

  const playAll = () => {
    const ids = trail.length > 0 ? trail : map.demo.map((id) => stepRef(el.scaleId, id));
    setPlayingAll(true);
    playProgression(
      voiced(ids),
      {
        onStep: (j) => {
          setSounding(j < 0 ? null : ids[j]);
          setStep(trail.length > 0 ? j : -1);
          // While a chord sounds, a pulse runs along the road to the next one.
          setTravel(j >= 0 && j < ids.length - 1 ? travelOf(ids[j], ids[j + 1], j) : null);
        },
        onDone: () => {
          setPlayingAll(false);
          setSounding(null);
          setStep(-1);
          setTravel(null);
        },
      },
    );
  };

  // Focus outline, in either view: the modes' colours round the mandala's
  // centre (each at the angle its arm sits), over the selected stroke.
  const mandalaFrame = useMemo(
    () => (mandalaView ? layoutMandala(el.root, { labels, sevenths }).viewBox : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mandalaView, el.root, labels.join(), sevenths],
  );
  useLayoutEffect(() => {
    const card = cardRef.current;
    const stage = stageRef.current;
    if (!mandalaFrame || !card || !stage) {
      setRingAt('50% 50%');
      return;
    }
    const place = () => {
      const cx = stage.offsetLeft + (-mandalaFrame.x / mandalaFrame.w) * stage.clientWidth;
      const cy = stage.offsetTop + (-mandalaFrame.y / mandalaFrame.h) * stage.clientHeight;
      // The ring sits 1px outside the card's box (over its border).
      setRingAt(`${cx + 1}px ${cy + 1}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(card);
    return () => ro.disconnect();
  }, [mandalaFrame]);

  // Portal chords only sound: they aren't map chords, so they can't be written yet.
  const playPortal = (chord: PortalChord) => {
    const [voiced] = voiceProgression([{ pc: chord.pc, quality: chord.quality }], el.root);
    setSounding(chord.id);
    playChord(voiced, { onLit: () => {}, onDone: () => setSounding(null) });
  };

  // A step lights the chord on this map that sounds like it, whichever mode wrote it.
  const onMap = (ref: string | null | undefined) => (ref ? (stepTwins(ref, el.scaleId)[0] ?? null) : null);
  const pickedRef = picked === null ? null : (trail[picked] ?? null);

  const caption = mandalaView
    ? 'Every mode around one tonic: the major side comes home to I, the minor side to i. Write with chords from any of them; a mode’s name picks the card’s own.'
    : borrowed && map.borrowedCaption
      ? map.borrowedCaption
      : map.caption;

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected} lifted={editing}>
      <div
        className={`${chordStyles.wrap} ${styles.wrap}`}
        data-selected={selected || undefined}
        data-view={mandalaView ? 'mandala' : undefined}
      >
        <div className={chordStyles.header}>
          <button
            className={chordStyles.nameTab}
            title="Change the key or mode"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setEditing((v) => !v);
            }}
          >
            <span className={chordStyles.nameTabInner}>
              Progressions – <Acc text={title} />
            </span>
          </button>
          <PlayButton playing={playingAll} onClick={playAll} />
        </div>
        <div
          ref={cardRef}
          className={`${chordStyles.card} ${styles.angular}`}
          data-ring={selected ? 'focus' : undefined}
          style={selected ? { ['--angular-ring' as string]: modeRing(ringAt, 'focus') } : undefined}
        >
          <div className={styles.topBar}>
            <ProgressionTrail
              trail={trail}
              resolved={resolved}
              playing={step}
              main={labels[0]}
              writing={writing}
              onWritingChange={setWriting}
              selected={picked}
              onSelect={setPicked}
              onMove={(from, to) => {
                const next = [...trail];
                const [id] = next.splice(from, 1);
                next.splice(to > from ? to - 1 : to, 0, id);
                update({ trail: next });
                setPicked(to > from ? to - 1 : to);
              }}
              onRemove={(i) => {
                uiTick(0);
                update({ trail: trail.filter((_, k) => k !== i) });
                setPicked(trail.length > 1 ? Math.min(i, trail.length - 2) : null);
              }}
              onClear={() => {
                update({ trail: [] });
                setPicked(null);
              }}
            />
            <div className={styles.toggles} onPointerDown={(e) => e.stopPropagation()}>
              <LabelControl
                order={labelOrder}
                hidden={el.labelsHidden}
                onChange={(order, hidden) => update({ labelOrder: order, labelsHidden: hidden })}
              />
              <Toggle label="7ths" on={sevenths} onClick={() => update({ showSevenths: !sevenths })} />
              {map.borrowed.length > 0 && !mandalaView && (
                <Toggle label="Borrowed" on={borrowed} onClick={() => update({ showBorrowed: !borrowed })} />
              )}
              <Toggle label="Mandala" on={mandalaView} onClick={() => update({ mandala: !mandalaView })} />
            </div>
          </div>
          <div
            ref={stageRef}
            className={styles.stage}
            data-mode={el.scaleId}
            data-view={mandalaView ? 'mandala' : undefined}
            data-textured={grunge ? '' : undefined}
            style={grunge ? { ['--grunge' as string]: `url("${grunge}")` } : undefined}
          >
            {mandalaView ? (
              <MandalaScene
                root={el.root}
                sevenths={sevenths}
                labels={labels}
                current={el.scaleId}
                playing={sounding}
                picked={pickedRef}
                travel={travel}
                onChordClick={write}
                onPickMode={(mode) => {
                  if (mode === el.scaleId) return;
                  uiTick(1);
                  update({ scaleId: mode });
                }}
                ariaLabel={`${tonicName(el.root, map)} progression mandala`}
              />
            ) : (
              <MapScene
                map={map}
                root={el.root}
                sevenths={sevenths}
                labels={labels}
                borrowed={borrowed}
                playing={onMap(sounding)}
                picked={onMap(pickedRef)}
                travel={travel?.mode === el.scaleId ? travel : null}
                onChordClick={(id) => write(el.scaleId, id)}
                portals={el.portals}
                onPortalClick={playPortal}
                ariaLabel={`${title} progression map`}
              />
            )}
          </div>
          <p className={styles.caption}>
            {caption.split('**').map((part, i) =>
              i % 2 ? (
                <strong key={i} className={styles.colourChord}>
                  <Acc text={part} />
                </strong>
              ) : (
                <Acc key={i} text={part} />
              ),
            )}
          </p>
        </div>
        {editing && (
          <TypePicker
            kinds={['progressions']}
            root={el.root}
            typeId={`progressions:${el.scaleId}`}
            onChange={(root, typeId) => {
              const scaleId = typeId?.split(':')[1] ?? el.scaleId;
              update({ root: root ?? el.root, scaleId });
            }}
            onClose={() => setEditing(false)}
          >
            <PortalToggles value={el.portals ?? []} onChange={(portals) => update({ portals })} />
          </TypePicker>
        )}
      </div>
    </ElementShell>
  );
}

const PORTALS: Array<[PortalKind, string]> = [
  ['secondary', 'Secondary dominants'],
  ['tritone', 'Tritone subs'],
];

/** Which portals open off the map. */
function PortalToggles({ value, onChange }: { value: PortalKind[]; onChange(next: PortalKind[]): void }) {
  return (
    <div className={styles.portals}>
      <div className={styles.portalsLabel}>Portals</div>
      {PORTALS.map(([kind, label]) => {
        const on = value.includes(kind);
        return (
          <button
            key={kind}
            className={styles.portal}
            data-on={on || undefined}
            aria-pressed={on}
            onClick={() => {
              uiTick(on ? 0 : 1);
              onChange(on ? value.filter((k) => k !== kind) : [...value, kind]);
            }}
          >
            <span className={styles.portalBox} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      className={styles.toggle}
      aria-pressed={on}
      data-on={on || undefined}
      onClick={(e) => {
        e.stopPropagation();
        uiTick(on ? 0 : 1);
        onClick();
      }}
    >
      {label}
    </button>
  );
}
