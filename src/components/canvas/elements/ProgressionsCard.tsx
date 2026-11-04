'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getScaleDef } from '@/lib/theory/scales';
import { voiceProgression } from '@/lib/theory/cadence';
import {
  type LabelKind,
  getProgressionMap,
  mapChords,
  mapMoves,
  progressionSpecs,
  resolveChord,
  tonicName,
} from '@/lib/theory/progressions';
import type { ProgressionsElement } from '@/lib/canvas-store/types';
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

/**
 * Progressions: the harmonic flow map of a key. Clicking a chord plays it and
 * writes it into the progression along the top; the play button plays what's
 * written (or walks the map's own example when nothing is).
 */
export function ProgressionsCard({ el, selected, soloSelected }: ProgressionsCardProps) {
  const [editing, setEditing] = useState(false);
  const [sounding, setSounding] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [playingAll, setPlayingAll] = useState(false);
  const [travel, setTravel] = useState<{ from: string; to: string; n: number } | null>(null);
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

  const resolved = useMemo(
    () => new Map(mapChords(map).map((ch) => [ch.id, resolveChord(map, ch, el.root, sevenths)])),
    [map, el.root, sevenths],
  );
  const moves = useMemo(() => mapMoves(map, borrowed), [map, borrowed]);
  const trail = el.trail.filter((id) => resolved.has(id));

  const update = (patch: Partial<ProgressionsElement>) =>
    canvasStore.getState().updateElement(el.id, patch, { commit: true });

  const voiced = (ids: string[]) => voiceProgression(progressionSpecs(map, ids, el.root, sevenths), el.root);

  const write = (id: string) => {
    // Voice-led from the chord before it, so the step sounds as it will in the progression.
    const prev = writing ? trail[trail.length - 1] : undefined;
    const chords = voiced(prev ? [prev, id] : [id]);
    playChord(chords[chords.length - 1], {
      onLit: () => {},
      onDone: () => {
        setSounding(null);
        setTravel(null);
      },
    });
    setSounding(id);
    setStep(-1);
    if (!writing) return;
    setTravel(prev ? { from: prev, to: id, n: Date.now() } : null);
    update({ trail: [...trail, id].slice(-MAX_TRAIL) });
  };

  const playAll = () => {
    const ids = trail.length > 0 ? trail : map.demo;
    setPlayingAll(true);
    playProgression(
      voiced(ids),
      {
        onStep: (j) => {
          setSounding(j < 0 ? null : ids[j]);
          setStep(trail.length > 0 ? j : -1);
          // While a chord sounds, a pulse runs along the road to the next one.
          setTravel(j >= 0 && j < ids.length - 1 ? { from: ids[j], to: ids[j + 1], n: j } : null);
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

  // Angular outline: in the mandala, the modes' colours round its centre (each
  // at the angle its arm sits); selected, in either view, the focus version.
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

  // In the mandala only the card's own mode writes; the other arms just sound.
  const playFrom = (mode: string, id: string) => {
    if (mode === el.scaleId) return write(id);
    const other = getProgressionMap(mode);
    const [chord] = voiceProgression(progressionSpecs(other, [id], el.root, sevenths), el.root);
    playChord(chord, { onLit: () => {}, onDone: () => {} });
  };

  const caption = mandalaView
    ? 'Every mode around one tonic: the major side comes home to I, the minor side to i. Click a mode’s name to write in it.'
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
          data-ring={selected ? 'focus' : mandalaView ? 'plain' : undefined}
          style={
            selected || mandalaView
              ? { ['--angular-ring' as string]: modeRing(ringAt, selected ? 'focus' : 'plain') }
              : undefined
          }
        >
          <div className={styles.topBar}>
            <ProgressionTrail
              map={map}
              moves={moves}
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
                picked={picked === null ? null : (trail[picked] ?? null)}
                travel={travel}
                onChordClick={playFrom}
                onPickMode={(mode) => {
                  if (mode === el.scaleId) return;
                  uiTick(1);
                  setPicked(null);
                  update({ scaleId: mode, trail: [] });
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
                playing={sounding}
                picked={picked === null ? null : (trail[picked] ?? null)}
                travel={travel}
                onChordClick={write}
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
              update({ root: root ?? el.root, scaleId, trail: scaleId === el.scaleId ? el.trail : [] });
            }}
            onClose={() => setEditing(false)}
          />
        )}
      </div>
    </ElementShell>
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
