# Music Theory Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild MusicTheoryCharts as a premium Next.js infinite-canvas app (Direction A shell) with scale/chord elements, Tone.js playback, multi-page canvas, image uploads, and URL-encoded state.

**Architecture:** DOM-based infinite canvas (one transformed viewport div), zustand state with undo/redo, pure theory core in `lib/theory`, Tone.js audio engine with GSAP-driven param ramps, versioned URL serialization. Phases are gated by the user's 4-check-in protocol: shell layout (✅ A picked), element styling, audio design, URL scheme.

**Tech Stack:** Next.js (App Router) + TypeScript, SCSS modules + token-based `globals.scss`, GSAP, Tone.js, zustand, Vitest for the pure cores.

**Check-in gates (do not build past a gate before its check-in):**
- Check-in 2 (element styling) gates Phase 5+ visual rollout.
- Check-in 3 (audio design) gates wiring audio through all elements.
- Check-in 4 (URL scheme) gates Phase 8 serialization implementation.

---

## Phase 0 — Repo restructure + scaffold

### Task 0.1: Move legacy app aside

**Files:**
- Move: `index.html`, `harmony-chart.html`, `basic-prototype.html`, `key-view.html`, `scale-view.html`, `chord-view.html`, `*.css`, `dist/`, `src/`, `landing-photo.jpg` → `legacy/`
- Keep: `.claude/`, `docs/`, `readme.md`, `.gitignore`

- [ ] Step 1: `mkdir legacy && git mv index.html harmony-chart.html basic-prototype.html key-view.html scale-view.html chord-view.html harmony-chart-style.css style.css scale-key-view-style.css font_alternatives.css dist src landing-photo.jpg package.json package-lock.json tsconfig.json legacy/`
- [ ] Step 2: Commit: `chore: move legacy HTML app to legacy/ as reference material`

### Task 0.2: Scaffold Next.js app at repo root

- [ ] Step 1: `npx create-next-app@latest . --ts --app --src-dir --no-tailwind --no-eslint --import-alias "@/*" --use-npm` (work around non-empty dir by scaffolding into `.next-scaffold` and moving files if needed)
- [ ] Step 2: `npm i gsap tone zustand sass && npm i -D vitest @vitest/ui jsdom @testing-library/react`
- [ ] Step 3: Add `vitest.config.ts` (environment: jsdom, alias `@` → `src`). Add `"test": "vitest run"` script.
- [ ] Step 4: Verify `npm run dev` serves and `npm test` runs (0 tests OK). Commit: `chore: scaffold Next.js app with gsap/tone/zustand/sass/vitest`

### Task 0.3: Design tokens + typography

**Files:**
- Create: `src/styles/globals.scss`, `src/app/layout.tsx` (fonts via `next/font`)

- [ ] Step 1: Define CSS custom properties on `:root[data-theme="dark"]` (single active theme), values from reference SVG:
  - `--canvas-bg: #0E0E0E; --canvas-dot-grid: rgba(244,240,234,0.06); --element-fill: #2C1C20; --element-stroke: rgba(166,116,74,0.45); --element-stroke-selected: #F49119; --accent: #F49119; --accent-warm: #A6744A; --text-primary: #F4F0EA; --text-secondary: #D9D9D9; --text-muted: #787878;`
  - `--shadow-sm`, `--shadow-md` (soft, warm-tinted), `--radius-sm: 8px; --radius-md: 14px; --radius-lg: 24px;`
- [ ] Step 2: Load Fraunces (display, opsz axis) + Inter (body) with `next/font/google`, expose as `--font-display` / `--font-body`. Define type scale vars (`--text-xs` … `--text-2xl`, weights: Fraunces 560 for headings, Inter 400/500).
- [ ] Step 3: Commit: `feat: design tokens and typography foundation`

## Phase 1 — Theory core (TDD, Vitest)

### Task 1.1: Port Note

**Files:**
- Create: `src/lib/theory/note.ts`, `src/lib/theory/note.test.ts`

- [ ] Step 1: Failing tests — pitch math:
```ts
import { describe, it, expect } from 'vitest';
import { Note } from './note';
describe('Note', () => {
  it('moves by semitones across octaves', () => {
    expect(new Note('B', 3).move(1).toString()).toBe('C4');
    expect(new Note('C', 4).move(12).toString()).toBe('C5');
  });
  it('computes total semitones', () => {
    expect(new Note('C', 1).totalSemitones).toBe(0);
    expect(new Note('A', 4).totalSemitones).toBe(45);
  });
});
```
- [ ] Step 2: Run, verify FAIL. Port `legacy/src/note.ts` (same API: `name`, `octave`, `semitoneIndex`, `totalSemitones`, `move`, `fromTotalSemitones`, `toString`). Run, verify PASS.
- [ ] Step 3: Commit: `feat: port Note pitch model with tests`

### Task 1.2: Scale catalog (all 21 existing scales, grouped)

**Files:**
- Create: `src/lib/theory/scales.ts`, `src/lib/theory/scales.test.ts`

- [ ] Step 1: Failing tests:
```ts
import { SCALE_GROUPS, buildScale, getScaleDef } from './scales';
it('keeps all legacy scales', () => {
  const all = SCALE_GROUPS.flatMap(g => g.scales.map(s => s.id));
  for (const id of ['major','minor','melodicMinor','harmonicMinor','harmonicMajor',
    'pentatonicMajor','pentatonicMinor','bluesMajor','bluesMinor',
    'dorian','phrygian','lydian','mixolydian','locrian',
    'phrygianDominant','halfWholeDiminished','altered','mixolydianFlat6',
    'dominantBebop','majorBebop','minorBebop','chromatic']) {
    expect(all).toContain(id);
  }
});
it('builds C major', () => {
  expect(buildScale(new Note('C', 4), getScaleDef('major')).map(String))
    .toEqual(['C4','D4','E4','F4','G4','A4','B4','C5']);
});
```
- [ ] Step 2: Implement `ScaleDef { id, label, intervals }` + groups: "Major & Minor", "Pentatonic & Blues", "Modes", "Jazz & Exotic", "Bebop", "Chromatic". Intervals copied from `legacy/src/scale.ts`. PASS.
- [ ] Step 3: Commit: `feat: grouped scale catalog with all legacy scales`

### Task 1.3: Chord catalog (jazz qualities) + 7ths mapping + inversions + naming

**Files:**
- Create: `src/lib/theory/chords.ts`, `src/lib/theory/chords.test.ts`

- [ ] Step 1: Failing tests:
```ts
it('builds Cmaj7 in root position', () => {
  expect(buildChord(new Note('C', 4), 'maj7').map(String)).toEqual(['C4','E4','G4','B4']);
});
it('inverts: 1st inversion puts third in bass', () => {
  expect(invert(buildChord(new Note('G', 3), 'maj7'), 1).map(String))
    .toEqual(['B3','D4','G4','A4'].slice(0,0).length ? [] : ['B3','D4','G4','B4']); // see impl task for real expected values
});
it('names with inversion, no slash notation', () => {
  expect(chordDisplayName('G', 'maj7', 1)).toBe('Gmaj7 — 1st inversion');
  expect(chordDisplayName('C', 'maj', 0)).toBe('C');
});
it('7ths toggle mapping is universal', () => {
  expect(withSeventh('maj')).toBe('maj7');
  expect(withSeventh('min')).toBe('m7');
  expect(withSeventh('dom')).toBe('7'); // dominant triad context
  expect(withSeventh('dim')).toBe('dim7');
  expect(withSeventh('m7b5')).toBe('m7b5'); // no-op, inherently has 7th
});
```
(Fix the placeholder expected values when writing the real test: G3 B3 D4 F#4 root → 1st inversion = B3 D4 F#4 G4.)
- [ ] Step 2: Implement `CHORD_GROUPS` (Triads: maj, min, dim, aug, sus2, sus4; Sevenths: maj7, m7, 7, m7b5, dim7, 6, m6; Extensions: 9, m9, 11, 13; Altered: maj7#11, 7b9, 7#9, 7#11, 7b13) with semitone formulas, e.g. `maj7: [0,4,7,11]`, `7b9: [0,4,7,10,13]`, `13: [0,4,7,10,14,21]`. Display labels use proper glyphs (♭, ♯). `invert(notes, n)`: move lowest `n` notes up an octave; inversion count = chord size. Ordinals: root position / 1st / 2nd / 3rd…
- [ ] Step 3: PASS. Commit: `feat: jazz chord catalog with inversions, sevenths mapping, display naming`

## Phase 2 — Canvas shell (Direction A chrome)

### Task 2.1: Canvas store

**Files:**
- Create: `src/lib/canvas-store/store.ts`, `types.ts`, `history.ts`, `store.test.ts`

- [ ] Step 1: Types: `CanvasElement = ScaleElement | ChordElement | ImageElement` (common: `id, x, y, z`; chord: `root, quality, inversion, seventh`; scale: `root, scaleId`; image: `src, width, aspectRatio`). `Page { id, name?, elements }`. App state: `pages, activePageId, selection: Set<id>, tool: 'select'|'move'|'frame'|'upload'|'layers'`, undo/redo stacks (snapshot-based, capped 100).
- [ ] Step 2: Tests for: add/remove element, select/multi-select, undo/redo round-trip, page add/remove (min 1 enforced), z-order forward/backward. Implement. PASS.
- [ ] Step 3: Commit: `feat: canvas store with pages, selection, undo/redo`

### Task 2.2: Viewport — pan/zoom/dot grid

**Files:**
- Create: `src/components/canvas/Viewport.tsx`, `src/lib/canvas-store/camera.ts`

- [ ] Step 1: Camera state `{x, y, k}` outside React render path (ref + direct transform writes for 60fps), dot grid as CSS `radial-gradient` background that tracks camera. Wheel handler: plain wheel/two-finger = pan; `ctrlKey` (pinch) or `metaKey`+scroll = zoom toward cursor (clamp k 0.2–3). Space-hold = pan drag from any tool.
- [ ] Step 2: Manual verify in dev: pan, pinch zoom, cmd+scroll, space-drag. Commit: `feat: infinite canvas viewport with trackpad pan/zoom`

### Task 2.3: Chrome — toolbar, page rail, title panel, settings panel (visual shells)

**Files:**
- Create: `src/components/chrome/Toolbar.tsx`, `PageRail.tsx`, `TitlePanel.tsx`, `SettingsPanel.tsx`, each with `.module.scss`

- [ ] Step 1: Toolbar bottom-center per `toolbar.png`: select, move, frame, upload, layers, add-new (+). Active tool orange `--accent` fill, hover lift, GSAP press scale. Material-symbols-style light icons (inline SVG).
- [ ] Step 2: PageRail left edge per `page-navigation.png`: bars, active = wide/bright, "+" on top; hover reveals name label. (Interactions beyond switch/add land in Phase 7.)
- [ ] Step 3: TitlePanel top-right (Fraunces title, collapsible, content from current screenshot). Settings gear top-right; panel with mute toggle, tempo slider, theme placeholder, clear-page (wired later).
- [ ] Step 4: Commit per component.

## Phase 3 — One fully-realized element → CHECK-IN 2

### Task 3.1: Piano SVG

**Files:**
- Create: `src/components/canvas/PianoKeys.tsx`

- [ ] Step 1: Two-octave keyboard SVG matching reference style (rounded keys `rx≈2.5`, highlighted keys `--accent-warm` fill). Props: `highlighted: Set<number>` (semitone offsets), `litKeys` for playback animation. Pure + memoized.

### Task 3.2: Chord element card, fully realized

**Files:**
- Create: `src/components/canvas/elements/ChordCard.tsx`, `ElementShell.tsx` (shared state/drag wrapper), `SettingsBar.tsx`, `InversionChevrons.tsx`, `PlayButton.tsx`

- [ ] Step 1: Card: `--element-fill`, `--radius-md`, label strip below piano (e.g. "Gmaj7 — 1st inversion"). States: default / hover (lift + stroke brighten) / selected (`--element-stroke-selected` + settings bar floats above with gap). Play button right side. Chevrons flank element when selected; clicking cycles inversion with GSAP micro-motion; 7ths toggle on settings bar updates notes + name.
- [ ] Step 2: Place one hardcoded Gmaj7 on the canvas in dev. Verify all states at 60fps.
- [ ] Step 3: **CHECK-IN 2: show the element, wait for approval.** Commit after approval: `feat: fully realized chord element (check-in 2 approved)`

## Phase 4 — Audio engine → CHECK-IN 3

### Task 4.1: Pad voice + playback engine

**Files:**
- Create: `src/lib/audio/engine.ts`, `src/lib/audio/voices.ts`

- [ ] Step 1: Warm bassy pad: `Tone.PolySynth` with fat saw oscillators → lowpass (~500–900Hz, slight envelope) → chorus → shared reverb (decay ~6–9s) → limiter, modeled on `.claude/reference/audio.js` graph. Scale playback: ~180ms/note legato overlap + octave root at end. Chord: block, ~1.5s sustain, soft release. Crossfade: per-element gain nodes, new trigger ramps old down 150ms.
- [ ] Step 2: Demo page/flag playing one scale + one chord. **CHECK-IN 3: audio design approval.**
- [ ] Step 3: After approval: wire play buttons + key-light sync (GSAP timeline drives both audio triggers and `litKeys`), global mute (animations continue), UI interaction sounds (soft pluck on tool/toggle press per reference `ui.js` feel). Commit.

## Phase 5 — Full element system (post check-in 2 styling)

### Task 5.1: Spawn stub flow (add-new → dropdowns → confirm)
- [ ] Stub card with root dropdown (12 notes) + type dropdown (grouped scales/chords per Tasks 1.2/1.3); click-away removes unfilled stub; confirm icon spawns element with pop-in motion. Commit.

### Task 5.2: Scale element card
- [ ] Reuse ElementShell + PianoKeys; label "F Lydian"; play button sequential lighting. Commit.

### Task 5.3: Selection + manipulation
- [ ] Click select, shift+click multi, marquee on empty canvas (select tool), drag move (grid-snap off), delete/backspace, cmd+d duplicate, cmd+z/cmd+shift+z hooked to store history, multi-select bounding box (no per-element bars). Layers tool: send forward/backward. Commit per behavior cluster.

## Phase 6 — Images
- [ ] Upload via tool button, drag-drop, cmd+v paste; png/jpg/webp/gif; ≤10MB; object URLs in store (URL-state stores nothing image-binary — placeholder w/ note). Selected state: stroke + 4 corner handles, AR-locked resize. Spawn in front of music elements. Commit.

## Phase 7 — Pages (full interactions)
- [ ] Rail: switch (animated cross-page transition), add, double-click rename (inline input, "Untitled" muted when empty), drag reorder, right-click delete (disabled at 1 page), per-page element sets from store. Commit.

## Phase 8 — URL state → CHECK-IN 4
- [ ] Step 1: Draft encoding scheme doc (elements sorted top-left → bottom-right, lossy position bucketing, version prefix `v1:`, base64url-packed). **CHECK-IN 4: present scheme, wait.**
- [ ] Step 2: After approval: `src/lib/url-state/codec.ts` + round-trip tests (encode→decode equality, unknown-version rejection), 400ms debounced `replaceState`, Share button + toast. Commit.

## Phase 9 — Polish
- [ ] Motion audit (every state change eased, GSAP timelines), perf pass (no React re-render on pan/zoom), micro-interactions (rauno.me-grade hover/press), empty states, favicon/meta. Commit.

---

## Self-review notes
- Spec coverage checked against design doc: all sections mapped to phases (images→6, pages→7, URL→8, settings→2.3+4, quality bar→9).
- Check-in gates marked inline; executor must stop at each.
- Known deliberate deferral: exact audio param values and URL byte format are decided *at* their check-ins, not before.
