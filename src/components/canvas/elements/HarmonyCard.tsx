'use client';

import { useMemo, useState } from 'react';
import { Note } from '@/lib/theory/note';
import { scaleDisplayName } from '@/lib/theory/scales';
import { harmonyChords } from '@/lib/theory/harmony';
import type { HarmonyElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { playChord, playProgression } from '@/lib/playback/playback';
import { ElementShell } from '../ElementShell';
import { PlayButton } from './PlayButton';
import { TypePicker } from './TypePicker';
import chordStyles from './ChordCard.module.scss';
import styles from './HarmonyCard.module.scss';

interface HarmonyCardProps {
  el: HarmonyElement;
  selected: boolean;
  soloSelected: boolean;
}

/**
 * Harmony element: the seven diatonic degree chords of a scale as playable
 * chips (numeral above chord name, colored by quality, per the legacy
 * harmony chart). Chips play individually; the card play button walks the
 * whole progression I → vii.
 */
export function HarmonyCard({ el, selected, soloSelected }: HarmonyCardProps) {
  const [editing, setEditing] = useState(false);
  const [activeChip, setActiveChip] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const { chords, name } = useMemo(() => {
    const root = new Note(el.root, el.octave);
    return {
      chords: harmonyChords(root, el.scaleId),
      name: `${scaleDisplayName(el.root, el.scaleId)} Harmony`,
    };
  }, [el.root, el.octave, el.scaleId]);

  const playChip = (i: number) => {
    setActiveChip(i);
    playChord(chords[i].pitches, {
      onLit: () => {},
      onDone: () => setActiveChip(-1),
    });
  };

  const playAll = () => {
    setPlaying(true);
    playProgression(
      chords.map((c) => c.pitches),
      {
        onStep: setActiveChip,
        onDone: () => {
          setPlaying(false);
          setActiveChip(-1);
        },
      },
    );
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div className={`${chordStyles.wrap} ${styles.wide}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <button
            className={chordStyles.nameTab}
            title="Change root or scale"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setEditing((v) => !v);
            }}
          >
            <span className={chordStyles.nameTabInner}>{name}</span>
          </button>
          <PlayButton playing={playing} onClick={playAll} />
        </div>
        <div className={chordStyles.card}>
          <div className={styles.grid}>
            {chords.map((chord, i) => (
              <button
                key={`${chord.name}-${i}`}
                className={styles.chip}
                data-quality={chord.quality}
                data-active={activeChip === i || undefined}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  playChip(i);
                }}
              >
                <span className={styles.numeral}>{chord.numeral}</span>
                <span className={styles.chordName}>{chord.name}</span>
              </button>
            ))}
          </div>
        </div>
        {editing && (
          <TypePicker
            kinds={['harmony']}
            root={el.root}
            typeId={`harmony:${el.scaleId}`}
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
