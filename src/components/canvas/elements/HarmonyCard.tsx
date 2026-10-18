'use client';

import { useMemo, useState } from 'react';
import { Note } from '@/lib/theory/note';
import { scaleDisplayName } from '@/lib/theory/scales';
import { harmonyChords } from '@/lib/theory/harmony';
import type { HarmonyElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { playChord, playProgression } from '@/lib/playback/playback';
import { ChevronDownIcon } from '@/components/chrome/icons';
import { ElementShell } from '../ElementShell';
import { PianoKeys } from '../PianoKeys';
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
  const [expanded, setExpanded] = useState(false);
  const [lit, setLit] = useState<ReadonlySet<number>>(new Set());

  const { chords, name } = useMemo(() => {
    const root = new Note(el.root, el.octave);
    return {
      chords: harmonyChords(root, el.scaleId, el.showSevenths ?? false),
      name: `${scaleDisplayName(el.root, el.scaleId)} Harmony`,
    };
  }, [el.root, el.octave, el.scaleId, el.showSevenths]);

  const playChip = (i: number) => {
    // Start first: it cancels any chord still sounding, whose onDone resets the chip.
    playChord(chords[i].pitches, {
      onLit: setLit,
      onDone: () => setActiveChip(-1),
    });
    setActiveChip(i);
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
    <ElementShell
      id={el.id}
      x={el.x}
      y={el.y}
      z={el.z}
      selected={selected}
      soloSelected={soloSelected}
      lifted={editing}
      adornments={
        <button
          className={styles.expandToggle}
          data-open={expanded || undefined}
          aria-label={expanded ? 'Hide chords' : 'Show chords'}
          aria-expanded={expanded}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <ChevronDownIcon width={12} height={12} />
        </button>
      }
    >
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
          {selected && soloSelected && (
            <button
              className={styles.seventhToggle}
              role="switch"
              aria-checked={el.showSevenths ?? false}
              data-on={el.showSevenths || undefined}
              title="Show diatonic 7th chords"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                canvasStore
                  .getState()
                  .updateElement(el.id, { showSevenths: !el.showSevenths }, { commit: true });
              }}
            >
              <span className={styles.seventhBox} />
              7ths
            </button>
          )}
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
        {expanded && (
          <div className={styles.chordPanel}>
            {[chords.slice(0, 3), chords.slice(3, 6), chords.slice(6)].map((row, r) => (
              <div key={r} className={styles.chordRow}>
                {row.map((chord, j) => {
                  const i = r * 3 + j;
                  return (
                    <MiniChord
                      key={`${chord.name}-${i}`}
                      numeral={chord.numeral}
                      name={chord.name}
                      quality={chord.quality}
                      pitches={chord.pitches}
                      lit={activeChip === i ? lit : undefined}
                      active={activeChip === i}
                      colorIndex={el.highlightColor ?? 0}
                      onPlay={() => playChip(i)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
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

interface MiniChordProps {
  numeral: string;
  name: string;
  quality: string;
  pitches: number[];
  lit?: ReadonlySet<number>;
  active: boolean;
  colorIndex: number;
  onPlay: () => void;
}

/** One degree chord on a small keyboard, shown in the expanded chord panel. */
function MiniChord({ numeral, name, quality, pitches, lit, active, colorIndex, onPlay }: MiniChordProps) {
  const { baseC, octaves, highlighted } = useMemo(() => {
    const min = Math.min(...pitches);
    const max = Math.max(...pitches);
    const baseC = min - (min % 12);
    return {
      baseC,
      octaves: Math.max(2, Math.ceil((max - baseC + 1) / 12)),
      highlighted: new Set(pitches),
    };
  }, [pitches]);

  return (
    <button
      className={styles.miniChord}
      data-quality={quality}
      data-active={active || undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
    >
      <span className={styles.miniLabel}>
        <span className={styles.numeral}>{numeral}</span>
        <span className={styles.chordName}>{name}</span>
      </span>
      <span className={styles.miniKeys}>
        <PianoKeys baseC={baseC} octaves={octaves} highlighted={highlighted} lit={lit} colorIndex={colorIndex} />
      </span>
    </button>
  );
}
