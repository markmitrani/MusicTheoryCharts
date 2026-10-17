'use client';

import { useState } from 'react';
import {
  CADENCES,
  CADENCE_TYPES,
  approachOf,
  homeOf,
  keyLabel,
  voiceProgression,
} from '@/lib/theory/cadence';
import type { RoadsElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { playProgression, uiTick } from '@/lib/playback/playback';
import { RoadsRing, type Road } from '@/components/cadence/RoadsRing';
import { Acc } from '@/components/cadence/Acc';
import { InfoIcon } from '@/components/chrome/icons';
import { ElementShell } from '../ElementShell';
import { CHORD_MS } from './WaysHomeCard';
import chordStyles from './ChordCard.module.scss';
import styles from './RoadsCard.module.scss';

interface RoadsCardProps {
  el: RoadsElement;
  selected: boolean;
  soloSelected: boolean;
}

const SHOW: Array<{ id: RoadsElement['show']; label: string }> = [
  { id: 'in', label: 'Ways in' },
  { id: 'out', label: 'Homes' },
  { id: 'both', label: 'Both' },
];

const MOVE = { dominant: 'V→I', plagal: 'IV→I', backdoor: '♭VII→I', tritone: '♭II→I' } as const;

/**
 * Roads: the circle of fifths as a road map around a centre key. Its four
 * ways in and four homes are drawn as roads; neighbours share one road driven
 * both ways (dominant in, plagal out). Double-click a key to make it the centre.
 */
export function RoadsCard({ el, selected, soloSelected }: RoadsCardProps) {
  const [info, setInfo] = useState(false);

  const roads: Road[] = [
    ...(el.show !== 'out'
      ? CADENCE_TYPES.map((type, i) => ({ from: approachOf(0, type), to: 0, type, delay: i * 0.08 }))
      : []),
    ...(el.show !== 'in'
      ? CADENCE_TYPES.map((type, i) => ({ from: 0, to: homeOf(0, type), type, delay: 0.45 + i * 0.08 }))
      : []),
  ];

  const update = (patch: Partial<RoadsElement>) =>
    canvasStore.getState().updateElement(el.id, patch, { commit: true });

  const playRoad = (road: Road) => {
    const chords = voiceProgression(
      [
        { pc: road.from, quality: CADENCES[road.type].approachQuality },
        { pc: road.to, quality: 'maj7' },
      ],
      el.centerKey,
    );
    playProgression(chords, { onStep: () => {}, onDone: () => {} }, CHORD_MS);
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected} lifted={info}>
      <div className={`${chordStyles.wrap} ${styles.wrap}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <span className={chordStyles.nameTab}>
            <span className={chordStyles.nameTabInner}>
              Roads – <Acc text={keyLabel(el.centerKey)} />
            </span>
          </span>
        </div>
        <div className={chordStyles.card}>
          <div className={styles.topBar} onPointerDown={(e) => e.stopPropagation()}>
            <div className={styles.chips} role="radiogroup" aria-label="Roads shown">
              {SHOW.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={el.show === s.id}
                  className={styles.chip}
                  data-active={el.show === s.id || undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (el.show !== s.id) update({ show: s.id });
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              className={styles.infoBtn}
              aria-label="About roads"
              aria-expanded={info}
              data-active={info || undefined}
              onClick={(e) => {
                e.stopPropagation();
                setInfo((v) => !v);
              }}
            >
              <InfoIcon width={16} height={16} />
            </button>
          </div>
          <RoadsRing
            centre={el.centerKey}
            roads={roads}
            onRoadClick={playRoad}
            onKeyDoubleClick={(key) => {
              uiTick(1);
              update({ centerKey: key });
            }}
            ariaLabel={`Roads into and out of ${keyLabel(el.centerKey)}`}
          />
          <div className={styles.legend}>
            {CADENCE_TYPES.map((t) => (
              <span key={t} className={styles.legendItem} style={{ color: CADENCES[t].colorVar }}>
                <span className={styles.swatch} />
                <span className={styles.legendName}>{CADENCES[t].label}</span>
                <span className={styles.legendMove}>
                  <Acc text={MOVE[t]} />
                </span>
              </span>
            ))}
          </div>
        </div>

        {info && (
          <div className={styles.info} onPointerDown={(e) => e.stopPropagation()}>
            <h4>Roads</h4>
            <p>
              Each key is a stop on the circle of fifths; each cadence is a road. Neighbours are joined by one road
              driven both ways: into the centre it&rsquo;s dominant (V→I), out of it it&rsquo;s plagal (IV→I) into the
              next key.
            </p>
            <p>
              The backdoor skips two stops; the tritone sub crosses the circle. Click a road to hear it; double-click a
              key to make it the centre.
            </p>
          </div>
        )}
      </div>
    </ElementShell>
  );
}
