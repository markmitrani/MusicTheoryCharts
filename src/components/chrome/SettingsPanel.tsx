'use client';

import { useEffect, useState } from 'react';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import {
  getTheme,
  setTheme,
  getSurfaces,
  setSurfaces,
  type Theme,
  type Surfaces,
} from '@/lib/theme';
import { GearIcon, ShareIcon } from './icons';
import styles from './SettingsPanel.module.scss';

/**
 * Top-right corner actions: share (copies canvas URL once URL-state lands)
 * and the settings popover (mute, tempo, theme placeholder, clear page).
 */
export function CornerActions() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [theme, setThemeState] = useState<Theme>('dark');
  const [surfaces, setSurfacesState] = useState<Surfaces>('flat');
  const muted = useCanvas((s) => s.muted);
  const tempoMs = useCanvas((s) => s.tempoMs);
  const sound = useCanvas((s) => s.sound);
  const gradientMode = useCanvas((s) => s.gradientMode);
  const harmonicsViz = useCanvas((s) => s.harmonicsViz);

  // Sync from the DOM (set pre-paint by the no-flash script) on mount.
  useEffect(() => {
    setThemeState(getTheme());
    setSurfacesState(getSurfaces());
  }, []);

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    setThemeState(next);
  };

  const chooseSurfaces = (next: Surfaces) => {
    setSurfaces(next);
    setSurfacesState(next);
  };

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setToast(true);
    window.setTimeout(() => setToast(false), 1800);
  };

  return (
    <div className={styles.corner}>
      <button className={styles.iconBtn} aria-label="Copy share link" title="Share" onClick={share}>
        <ShareIcon width={19} height={19} />
      </button>
      <button
        className={styles.iconBtn}
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
        data-active={open || undefined}
        onClick={() => setOpen(!open)}
      >
        <GearIcon width={19} height={19} />
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Settings">
          <h3>Settings</h3>

          <label className={styles.row}>
            <span>Audio</span>
            <button
              className={styles.switch}
              role="switch"
              aria-checked={!muted}
              data-on={!muted || undefined}
              onClick={() => canvasStore.getState().setMuted(!muted)}
            >
              <span className={styles.knob} />
            </button>
          </label>

          <label className={styles.row}>
            <span>Sound</span>
            <select
              className={styles.select}
              value={sound}
              aria-label="Playback sound"
              onChange={(e) => canvasStore.getState().setSound(e.target.value as 'pad' | 'piano')}
            >
              <option value="pad">Pad</option>
              <option value="piano">Piano</option>
            </select>
          </label>

          <label className={styles.row}>
            <span>Tempo</span>
            <span className={styles.tempoValue}>{tempoMs}ms / note</span>
          </label>
          <input
            className={styles.slider}
            type="range"
            min={100}
            max={400}
            step={10}
            value={tempoMs}
            aria-label="Playback tempo in milliseconds per note"
            onChange={(e) => canvasStore.getState().setTempoMs(Number(e.target.value))}
          />

          <label className={styles.row}>
            <span>Theme</span>
            <div className={styles.segmented} role="radiogroup" aria-label="Theme">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={theme === t}
                  className={styles.segment}
                  data-active={theme === t || undefined}
                  onClick={() => chooseTheme(t)}
                >
                  {t === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
          </label>

          <label className={styles.row}>
            <span>Surfaces</span>
            <div className={styles.segmented} role="radiogroup" aria-label="Surfaces">
              {(['flat', 'glass'] as const).map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={surfaces === s}
                  className={styles.segment}
                  data-active={surfaces === s || undefined}
                  onClick={() => chooseSurfaces(s)}
                >
                  {s === 'flat' ? 'Flat' : 'Glass'}
                </button>
              ))}
            </div>
          </label>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Experimental</span>

            <label className={styles.row}>
              <span>Background gradient</span>
              <select
                className={styles.select}
                value={gradientMode}
                aria-label="Gradient backdrop style"
                onChange={(e) =>
                  canvasStore.getState().setGradientMode(e.target.value as 'off' | 'perlin' | 'mesh')
                }
              >
                <option value="off">Off</option>
                <option value="perlin">Perlin</option>
                <option value="mesh">Mesh</option>
              </select>
            </label>

            <label className={styles.row}>
              <span>Harmonics wave</span>
              <button
                className={styles.switch}
                role="switch"
                aria-checked={harmonicsViz}
                data-on={harmonicsViz || undefined}
                onClick={() => canvasStore.getState().setHarmonicsViz(!harmonicsViz)}
              >
                <span className={styles.knob} />
              </button>
            </label>
            <p className={styles.hint}>Harmonics wave reacts while audio plays.</p>
          </div>

          <button
            className={styles.danger}
            onClick={() => {
              canvasStore.getState().clearActivePage();
              setOpen(false);
            }}
          >
            Clear this page
          </button>
        </div>
      )}

      <div className={styles.toast} data-visible={toast || undefined} role="status">
        Link copied
      </div>
    </div>
  );
}
