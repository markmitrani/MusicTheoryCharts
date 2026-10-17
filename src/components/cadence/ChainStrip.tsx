'use client';

import { CADENCES, JAZZ_CHAINS, MAP_CHAINS, chordLabel, chordName, type CadenceType, type ChordSpec } from '@/lib/theory/cadence';
import { PlayIcon } from '@/components/chrome/icons';
import { Acc } from './Acc';
import styles from './ChainStrip.module.scss';

interface ChainStripProps {
  type: CadenceType;
  /** Id of the row currently sounding and the chord index within it. */
  active: { id: string; index: number } | null;
  onPlay: (id: string, chords: ChordSpec[]) => void;
}

/** A cadence's two chains: the same move three times, and the jazz version. */
export function ChainStrip({ type, active, onPlay }: ChainStripProps) {
  const rows = [
    { id: `${type}-map`, label: 'Map chain', chords: MAP_CHAINS[type] },
    { id: `${type}-jazz`, label: 'Jazz version', chords: JAZZ_CHAINS[type] },
  ];
  return (
    <div className={styles.strip} style={{ ['--tone' as string]: CADENCES[type].colorVar }}>
      <span className={styles.type}>{CADENCES[type].label}</span>
      {rows.map((row) => (
        <div key={row.id} className={styles.row}>
          <button className={styles.play} aria-label={`Play the ${row.label.toLowerCase()}`} onClick={() => onPlay(row.id, row.chords)}>
            <PlayIcon width={11} height={11} />
          </button>
          <span className={styles.label}>{row.label}</span>
          <span className={styles.chords}>
            {row.chords.map((c, i) => (
              <span key={i} className={styles.chord} data-active={(active?.id === row.id && active.index === i) || undefined}>
                <span className={styles.numeral}>
                  <Acc text={chordLabel(c)} />
                </span>
                <span className={styles.name}>
                  <Acc text={chordName(c, 'C')} />
                </span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
