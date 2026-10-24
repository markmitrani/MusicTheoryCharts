# Tonnetz: Design

**Date:** 2026-10-25 · **Status:** draft, not built
**Source:** backlog conversation with Mark, 2026-10-19 to 2026-10-25. Open decisions are listed at the end and need a check-in before building.

## What we're building

A Tonnetz (the lattice of notes linked by fifths and thirds, where every triangle is a major or minor triad) in two views:

1. **Tonnetz card**: a flat canvas element. Double-clicking any note recentres the lattice on it.
2. **3D pop-out**: an immersive view of the same lattice, opened from the card. Drag to spin it, with smooth momentum. Step from triad to triad with the neo-Riemannian moves (P, L, R, S, N, H).

Both views share a "Chord names" checkbox: each triangle shows its chord name and is coloured by quality (major vs minor).

**Feel reference:** https://www.phantom.land/ : an endless dark grid you drag in any direction, with eased momentum. The edges bend away as if you're inside a curved surface, and it wraps seamlessly. The 3D view should feel this immersive and smooth.

**Copy rule:** no em dashes anywhere. UI copy uses the British spaced en dash ("Tonnetz – C").

## Theory model

**Lattice.** Notes sit on a triangular grid with three axes:

| Axis | Interval | Semitones | Direction on screen |
|---|---|---|---|
| fifths | perfect 5th | +7 | → right |
| major thirds | major 3rd | +4 | ↗ up-right |
| minor thirds | minor 3rd | +3 | ↖ up-left |

A note at grid coordinate `(i, j)` (i fifths, j major thirds) has pitch class `(c + 7i + 4j) mod 12`. Up-pointing triangles are major triads (C–E–G); down-pointing ones are minor (C–E♭–G).

**Torus.** With enharmonic notes treated as the same, the lattice repeats: 3 major thirds return to the start (C–E–G♯–C), as do 4 minor thirds (C–E♭–G♭–A–C). Folding out the repeats leaves a torus with 12 notes, 36 edges and 24 triangles (each major and minor triad exactly once).

**Moves.** Each move maps a triad to another triad of the opposite quality. Examples from C major:

| Move | Name | Built from | C major → | Common tones |
|---|---|---|---|---|
| P | Parallel | – | C minor | 2 |
| R | Relative | – | A minor | 2 |
| L | Leading-tone exchange | – | E minor | 2 |
| N | Nebenverwandt | R·L·P | F minor | 1 |
| S | Slide | L·P·R | C♯ minor | 1 (the third) |
| H | Hexatonic pole | L·P·L | A♭ minor | 0 |

P, L and R flip to the triangle across one shared edge. N, S and H jump several triangles; the 3D view animates them as their P/L/R steps. Every move is an involution (doing it twice returns home). These are tested invariants.

**Labels.** Default spelling is `NOTE_NAMES` (sharps), the same as the rest of the app. User-chosen spelling is tabled app-wide (see Pitch Axis); this element plugs into that decision when it lands.

**Sound.** Clicking a note plays it; clicking a triangle plays its triad. Moves play the old triad then the new one, voice-led to the nearest inversion so common tones hold. Built with `buildChord` and played through `playProgression`.

## Unit: theory core (`src/lib/theory/tonnetz.ts`)

Pure, no React. Exports:

- `Triad = { root: number; minor: boolean }`, `TRIADS` (all 24, codec order: `root * 2 + minor`; append-only).
- `pcAt(centre, i, j)` → pitch class at a grid coordinate.
- `trianglesIn(centre, radius)` → triads with their three corner coordinates, for rendering a window of the lattice.
- `Move = 'P' | 'L' | 'R' | 'N' | 'S' | 'H'`, `MOVES` registry (order fixed, append-only), `MOVE_STEPS: Record<Move, ('P'|'L'|'R')[]>`.
- `applyMove(triad, move)` → triad; `movePath(triad, move)` → the triads passed through, for animation.
- `triadName(triad)` → "C", "Am".

Tests: involutions for all six moves; common-tone counts from the table; `pcAt` wraps after 3 major thirds and 4 minor thirds; all 24 triads appear exactly once on the torus.

## Unit: Tonnetz card (`src/components/canvas/elements/TonnetzCard.tsx`)

**Element type** (added to `src/lib/canvas-store/types.ts`):

```ts
interface TonnetzElement extends ElementBase {
  kind: 'tonnetz';
  centre: number;        // pitch class of the centre note
  triad: Triad | null;   // selected triad; the 3D view opens here
  showChords: boolean;   // "Chord names" checkbox
}
```

**Spawning.** New instant kind in the stub's "more" menu ("Tonnetz"), next to Pitch Axis and Ways Home. `confirmStub` creates `{ kind: 'tonnetz', centre: 0, triad: null, showChords: false }`.

**Shell.** House pattern: folder tab "Tonnetz – <centre>", fixed-size card, play button floating top-right (plays the selected triad). A top bar holds the "Chord names" checkbox and a "3D" button that opens the pop-out.

**Stage** (SVG):

- A window of the lattice around the centre note, faded at the edges to suggest it continues.
- Notes as small glass nodes (radial wash, tinted rim, as on Ways Home); the centre note emphasised in the display serif.
- With "Chord names" on, every triangle is filled with the major or minor colour and shows its chord name. New tokens `--tonnetz-major` and `--tonnetz-minor` in `globals.scss`, defined for every theme; no hardcoded colours.
- The selected triad is outlined and lit like a playing harmony chip.

**Interactions.**

- Hover a note → its three axes light up through it.
- Click a note → play it. Click a triangle → select and play its triad.
- Double-click a note → the lattice slides so that note is the centre (animated), then the tab label updates. Same gesture as the Pitch Axis rotate-to-top.
- No drag-panning inside the card; pinch, scroll and drag stay with the canvas camera, as on Ways Home.

**Integration.** `CanvasApp` renders `case 'tonnetz'`. Transpose (↑/↓) shifts `centre` and `triad` by a semitone.

**URL codec** (append-only; existing registries untouched). New element code `t` (unused):

```
tonnetz = t + flags1 + centre1 + triad1 + x2 + y2   (7 chars)
flags1  = (showChords ? 1 : 0)
centre1 = pitch class 0–b
triad1  = base36(root * 2 + minor), or 'z' = none
```

## Unit: 3D pop-out (`src/components/tonnetz/TonnetzWorld.tsx`)

A full-window overlay above the canvas, opened from the card's "3D" button. Closes with Esc or a close button, writing the current triad back to the card.

**Stack.** Match phantom.land. Detected from its live bundles on 2026-10-25: Next.js (App Router) + React, three.js r175, React Three Fiber, `postprocessing` (EffectComposer), GSAP, Motion, custom `ShaderMaterial`s and `InstancedMesh`. This app already runs Next.js and React 19, so it adds:

- `three`, `@react-three/fiber` (v9, React 19), `@react-three/drei` (SDF text via troika)
- `postprocessing` / `@react-three/postprocessing` for bloom on the playback glow
- `gsap` for discrete transitions (step snapping, move travel, open/close)

Lenis (phantom.land's smooth scroll) isn't needed: the pop-out is a fixed full-window canvas with no page scroll. The whole 3D bundle loads with a dynamic import only when the pop-out opens, so the canvas page doesn't pay for it.

**Scene.** Dark backdrop, unlit flat colours for triangles so major/minor colours stay true. Chord-name text uses the same "Chord names" setting as the card.

**Shape.** A literal torus: the 24 triangles wrapped once around it, the small loop holding 3 major-third steps and the large loop 4 minor-third steps. Camera placement is open decision D1. The phantom.land feel sets the bar for motion and polish.

**Interactions.**

- **A / D** → travel around the torus's large loop (around the hole), left / right.
- **W / S** → rotate the surface around the small loop (the tube's cross-section, like a ring of constant size orbiting the torus's body), clockwise / counterclockwise.
- The small loop carries the 3-step major-third cycle and the large loop the 4-step minor-third cycle, so each loop wraps after a whole number of lattice steps.
- A tap moves one lattice step and settles on it; holding keeps moving with eased momentum and settles on the nearest step when released.
- Click + drag does the same as the keys: horizontal drag = A / D, vertical drag = W / S. Release throws with the drag's velocity, glides with momentum and settles on the nearest step, exactly like releasing a held key.
- Move bar: six buttons P L R N S H, each with a tooltip naming the move and its result ("R – A minor"). Keyboard: Shift + the letter (plain S is taken by WASD).
- A move animates the camera along `movePath`, lighting each triangle passed, then plays old → new triad. The current triad stays centred and lit with the playback glow.
- Click a triangle → travel to it and play it.
- History strip along the bottom (C › Am › F › …); clicking an entry travels back.
- Reduced motion: no momentum, moves cross-fade instead of travelling.

**Smoothness (acceptance bar: on par with phantom.land side by side).**

- Every frame runs in R3F's `useFrame`, mutating refs and uniforms; no React state updates or re-renders while moving.
- Motion is frame-rate independent: damping uses `1 - exp(-k · dt)`, so 60 Hz and 120 Hz displays move identically and a dropped frame doesn't jolt.
- Torus rotation is two continuous angles (large loop, small loop) with velocity; keys, drag and snapping all feed the same angles, so switching input mid-motion never jumps.
- Drag uses pointer capture and samples velocity over the last ~100 ms for the throw.
- Snap to the nearest step with a critically damped spring (no overshoot wobble); move travel (P/L/R…) uses GSAP timelines on the same angles.
- Instanced triangles, one draw call per layer; SDF labels; device pixel ratio capped at 2; geometry and materials built once.
- Targets: 60 fps on a recent phone, 120 fps on ProMotion, no long frames (>16 ms) in a Chrome performance trace while dragging, input reflected on the next frame.
- Reduced motion: no momentum or travel; steps cross-fade.

## Phasing

- **v1:** theory core + Tonnetz card (flat view, recentre, chord names, playback, codec).
- **v2:** 3D pop-out with drag, momentum and the six moves.
- **v3:** polish to the phantom.land bar (motion tuning, glow) and history.

## Challenges

1. **The real torus is tiny.** 12 notes and 24 triangles form a 3×4 grid. A literal donut is lumpy and low-poly, inner-side triangles get squashed, and labels crowd or hide.
2. **Faithful vs immersive.** An "every chord once" torus is too small to feel endless; from inside the tube it is a 3-triangle-wide tunnel. Lushness needs repeated copies of the lattice, which hides the "each chord once" idea.
3. **Spin vs pan.** Spinning a donut from outside and panning a curved plane are different gestures. On the torus, drag directions map to major and minor thirds; fifths run diagonally and are hard to follow by dragging.
4. **Compound moves skip triangles.** S, N and H must choose a route and travel it readably. Major and minor triangles point opposite ways, so keeping the current one centred and upright rotates the camera on every move, which can disorient.
5. **Spelling.** G♯m and A♭m are one triangle; each label has to pick a spelling until the app-wide decision lands.
6. **Colour under lighting.** Shading pulls major and minor colours together; triangles need unlit colour.
7. **Cost and smoothness.** The 3D stack (three.js, R3F, postprocessing, GSAP) is large; dynamic import only. Crisp 3D text needs SDF tooling. The phantom.land feel comes from heavy motion tuning, and phones need care. Reduced motion needs its own path. Porting the playback glow into 3D is extra work.

## Open decisions (check-in before building)

- **D1 – 3D shape.** WASD navigation (decided 2026-10-25) assumes a literal torus with a large and a small loop, which rules out a flat curved plane alone. Still open: camera outside the torus, or inside the tube. Either way, the phantom.land feel applies to motion and polish.
- **D2 – Drag axes.** Decided 2026-10-25: drag and WASD both follow the torus's two loops (minor thirds around the large loop, major thirds around the small loop).
- **D3 – Upright vs fixed camera.** Rotate the camera so the current triangle stays upright, or keep the world fixed and let triangles flip.
- **D4 – Moves on the flat card.** Keep P/L/R/N/S/H in the 3D view only, or add the move bar to the card too.
