'use client';

import { useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Note } from '@/lib/theory/note';
import { buildChord, invert, inversionCount, withSeventh, chordDisplayName } from '@/lib/theory/chords';
import type { ChordElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { playChord } from '@/lib/playback/playback';
import { ElementShell } from '../ElementShell';
import { PianoKeys } from '../PianoKeys';
import { PlayButton } from './PlayButton';
import { InversionChevrons } from './InversionChevrons';
import { TypePicker } from './TypePicker';
import styles from './ChordCard.module.scss';

interface ChordCardProps {
  el: ChordElement;
  selected: boolean;
  soloSelected: boolean;
}

export function ChordCard({ el, selected, soloSelected }: ChordCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState<ReadonlySet<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);

  const effectiveQuality = el.seventh ? withSeventh(el.quality) : el.quality;
  const { pitches, baseC, octaves, name } = useMemo(() => {
    const root = new Note(el.root, el.octave);
    const notes = invert(buildChord(root, effectiveQuality), el.inversion);
    const pitches = notes.map((n) => n.totalSemitones);
    const min = Math.min(...pitches);
    const max = Math.max(...pitches);
    const baseC = min - (min % 12);
    const octaves = Math.max(2, Math.ceil((max - baseC + 1) / 12));
    return { pitches, baseC, octaves, name: chordDisplayName(el.root, effectiveQuality, el.inversion) };
  }, [el.root, el.octave, effectiveQuality, el.inversion]);

  const cycleInversion = (dir: 1 | -1) => {
    const count = inversionCount(effectiveQuality);
    const next = (el.inversion + dir + count) % count;
    canvasStore.getState().updateElement(el.id, { inversion: next }, { commit: true });
    gsap.fromTo(
      cardRef.current,
      { x: dir * 7 },
      { x: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' },
    );
  };

  const play = () => {
    setPlaying(true);
    playChord(pitches, {
      onLit: setLit,
      onDone: () => setPlaying(false),
    });
  };

  return (
    <ElementShell
      id={el.id}
      x={el.x}
      y={el.y}
      z={el.z}
      selected={selected}
      soloSelected={soloSelected}
      adornments={
        <InversionChevrons onPrev={() => cycleInversion(-1)} onNext={() => cycleInversion(1)} />
      }
    >
      <div ref={cardRef} className={styles.wrap} data-selected={selected || undefined} data-playing={playing || undefined}>
        <div className={styles.header}>
          <button
            className={styles.nameTab}
            title="Change root or chord type"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setEditing((v) => !v);
            }}
          >
            <span className={styles.nameTabInner}>{name}</span>
          </button>
          <PlayButton playing={playing} onClick={play} />
        </div>
        <div className={styles.card}>
          <div className={styles.keys}>
            <PianoKeys baseC={baseC} octaves={octaves} highlighted={new Set(pitches)} lit={lit} />
          </div>
        </div>
        {editing && (
          <TypePicker
            kinds={['chord']}
            root={el.root}
            typeId={`chord:${el.quality}`}
            onChange={(root, typeId) => {
              const quality = typeId?.split(':')[1] ?? el.quality;
              const effective = el.seventh ? withSeventh(quality) : quality;
              canvasStore.getState().updateElement(
                el.id,
                {
                  root: root ?? el.root,
                  quality,
                  inversion: Math.min(el.inversion, inversionCount(effective) - 1),
                },
                { commit: true },
              );
            }}
            onClose={() => setEditing(false)}
          />
        )}
      </div>
    </ElementShell>
  );
}
