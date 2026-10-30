'use client';

import { useEffect, useState } from 'react';
import { useCanvas, canvasStore, type SoundId } from '@/lib/canvas-store/store';
import {
  getTheme,
  setTheme,
  getSurfaces,
  setSurfaces,
  type Theme,
  type Surfaces,
} from '@/lib/theme';
import {
  COLOR_SLOTS,
  readColor,
  setColor,
  resetColors,
  hasColors,
  colorsEnabled,
  setColorsEnabled,
  type ColorSlot,
} from '@/lib/custom-colors';
import { useIsMobile } from '@/lib/use-mobile';
import { ColorPicker } from './ColorPicker';
import { GearIcon, ShareIcon, TrashIcon } from './icons';
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
  const deleteMode = useCanvas((s) => s.deleteMode);
  const mobile = useIsMobile();
  const [colors, setColors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<ColorSlot | null>(null);
  const [customised, setCustomised] = useState(false);
  const [colorsOn, setColorsOn] = useState(false);

  const readColors = (t: Theme) => {
    setColors(Object.fromEntries(COLOR_SLOTS.map(({ slot, token }) => [slot, readColor(token)])));
    setCustomised(hasColors(t));
  };

  useEffect(() => {
    if (open) readColors(theme);
  }, [open, theme]);

  // Sync from the DOM (set pre-paint by the no-flash script) on mount.
  useEffect(() => {
    setThemeState(getTheme());
    setSurfacesState(getSurfaces());
    setColorsOn(colorsEnabled());
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
      {mobile && (
        <button
          className={styles.iconBtn}
          aria-label="Delete mode: tap elements to delete them"
          aria-pressed={deleteMode}
          title="Delete mode"
          data-danger={deleteMode || undefined}
          onClick={() => canvasStore.getState().setDeleteMode(!deleteMode)}
        >
          <TrashIcon width={19} height={19} />
        </button>
      )}
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
              onChange={(e) => canvasStore.getState().setSound(e.target.value as SoundId)}
            >
              <option value="pad">Pad</option>
              <option value="piano">Piano</option>
              <option value="epiano">Electric Piano</option>
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

            <label className={styles.row}>
              <span>Custom colours</span>
              <button
                className={styles.switch}
                role="switch"
                aria-checked={colorsOn}
                data-on={colorsOn || undefined}
                onClick={() => {
                  setColorsEnabled(!colorsOn, theme);
                  setColorsOn(!colorsOn);
                  setEditing(null);
                  readColors(theme);
                }}
              >
                <span className={styles.knob} />
              </button>
            </label>
            {colorsOn && (
              <>
                <div className={styles.swatches}>
                  {COLOR_SLOTS.map(({ slot, label }) => (
                    <button
                      key={slot}
                      className={styles.swatchBtn}
                      aria-expanded={editing === slot}
                      data-active={editing === slot || undefined}
                      onClick={() => setEditing(editing === slot ? null : slot)}
                    >
                      <span className={styles.swatch} style={{ background: colors[slot] }} />
                      {label}
                    </button>
                  ))}
                </div>
                {editing && colors[editing] && (
                  <ColorPicker
                    value={colors[editing]}
                    onChange={(hex) => {
                      setColor(theme, editing, hex);
                      setColors((c) => ({ ...c, [editing]: hex }));
                      setCustomised(true);
                    }}
                  />
                )}
                <div className={styles.sectionHead}>
                  <p className={styles.hint}>Accent also colours highlighted notes. Saved separately for dark and light.</p>
                  {customised && (
                    <button
                      className={styles.reset}
                      onClick={() => {
                        resetColors(theme);
                        readColors(theme);
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </>
            )}
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
