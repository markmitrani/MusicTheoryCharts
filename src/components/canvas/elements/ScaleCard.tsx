'use client';

import { useMemo, useState } from 'react';
import { Note } from '@/lib/theory/note';
import { buildScale, getScaleDef, scaleDisplayName } from '@/lib/theory/scales';
import type { ScaleElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { playScale } from '@/lib/playback/playback';
import { ElementShell } from '../ElementShell';
import { PianoKeys } from '../PianoKeys';
import { PlayButton } from './PlayButton';
import { TypePicker } from './TypePicker';
import { TransposeControl } from './TransposeControl';
import styles from './ChordCard.module.scss';

interface ScaleCardProps {
  el: ScaleElement;
  selected: boolean;
  soloSelected: boolean;
}

export function ScaleCard({ el, selected, soloSelected }: ScaleCardProps) {
  const [lit, setLit] = useState<ReadonlySet<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);

  const { pitches, highlighted, baseC, octaves, name } = useMemo(() => {
    const root = new Note(el.root, el.octave);
    const notes = buildScale(root, getScaleDef(el.scaleId));
    const pitches = notes.map((n) => n.totalSemitones);
    // playback includes the octave root; the element highlight does not
    const highlighted = new Set(pitches.slice(0, -1));
    const min = Math.min(...pitches);
    const max = Math.max(...pitches);
    const baseC = min - (min % 12);
    const octaves = Math.max(2, Math.ceil((max - baseC + 1) / 12));
    return { pitches, highlighted, baseC, octaves, name: scaleDisplayName(el.root, el.scaleId) };
  }, [el.root, el.octave, el.scaleId]);

  const play = () => {
    setPlaying(true);
    playScale(
      pitches,
      { onLit: setLit, onDone: () => setPlaying(false) },
      canvasStore.getState().tempoMs,
    );
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div className={styles.wrap} data-selected={selected || undefined}>
        <div className={styles.header}>
          <button
            className={styles.nameTab}
            title="Change root or scale type"
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
            <PianoKeys
              baseC={baseC}
              octaves={octaves}
              highlighted={highlighted}
              lit={lit}
              colorIndex={el.highlightColor ?? 0}
            />
            <TransposeControl id={el.id} />
          </div>
        </div>
        {editing && (
          <TypePicker
            kinds={['scale']}
            root={el.root}
            typeId={`scale:${el.scaleId}`}
            onChange={(root, typeId) => {
              canvasStore.getState().updateElement(
                el.id,
                { root: root ?? el.root, scaleId: typeId?.split(':')[1] ?? el.scaleId },
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
