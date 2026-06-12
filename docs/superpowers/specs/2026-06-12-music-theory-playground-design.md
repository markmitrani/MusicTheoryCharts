# Music Theory Playground — Design

**Date:** 2026-06-12 · **Branch:** `interactive-canvas-expansion`
**Source spec:** user-provided (conversation). This doc records the decisions layered on top of it; where the two conflict, the user spec wins unless a resolution is noted here.

## What we're building

A premium React/Next.js infinite-canvas app for arranging music theory objects (scales, chords, images) freely across multiple pages, with Tone.js playback, GSAP-grade motion, and full canvas state encoded in the URL. The existing HTML/CSS/TS app is reference material only (scale definitions, audio recipes); the UI is rebuilt from scratch.

## Approved shell layout (check-in 1: Direction A — reference-faithful)

- **Bottom-center floating toolbar**: select, move, frame/section, upload, layers, add-new — per `toolbar.png`. Active tool = orange `#F49119` fill.
- **Vertical page rail, left edge**: stacked bars per `page-navigation.png`; current page brighter/wider; "+" above; hover reveals page name; double-click renames; right-click deletes (disabled at one page); drag reorders. *(Resolves spec-text "horizontal tab strip" in favor of the Figma reference — user picked A knowing this.)*
- **Top-right**: settings gear + share affordance; collapsible title/intro panel below them.

## Architecture

- **Stack**: Next.js (App Router) + TypeScript, SCSS modules + `globals.scss` tokens, GSAP for motion, Tone.js for audio, zustand for canvas/app state. No Tailwind.
- **Canvas**: DOM-based (single transformed viewport div holding absolutely-positioned elements), tldraw-style. Pan/zoom = one `translate(x,y) scale(k)` transform; trackpad two-finger pan, pinch / cmd+scroll zoom, space-hold pan. DOM (not `<canvas>`) keeps piano SVGs, text, and per-element interaction cheap and accessible.
- **Repo layout**: Next app lives at repo root; old HTML/CSS/dist/src moved to `legacy/` (kept in git as reference). `.claude/reference/` untouched.
- **Modules** (one clear purpose each):
  - `lib/theory/` — ported `Note`, scale interval tables, new chord-quality tables (jazz set), inversion + 7ths logic, naming ("Gmaj7 — 1st inversion").
  - `lib/audio/` — Tone.js engine: warm pad voice (FatOscillator saw → wandering lowpass → chorus → 9s reverb, per reference `audio.js`), UI interaction sounds, GSAP-driven param ramps, global mute.
  - `lib/canvas-store/` — zustand: pages, elements (scale/chord/image), selection, z-order, undo/redo history, tool mode.
  - `lib/url-state/` — versioned (`v1:`) compact encode/decode of full state, 400ms debounced; exact format agreed at check-in 4.
  - `components/canvas/` — viewport, dot grid, marquee, element shells (states: default/hover/selected), chord/scale cards with piano SVG, image element with AR-locked corner handles, settings bars, inversion chevrons, play buttons.
  - `components/chrome/` — toolbar, page rail, settings panel, title panel, share toast.

## Element behaviour (key decisions)

- Spawn flow: add-new → empty stub with (root, type) dropdowns → vanishes if clicked away unfilled → confirm icon spawns the element.
- Chords: 7ths toggle on floating settings bar; inversion chevrons flank the element; labels never use slash notation. Quality groups: triads / sevenths / extensions / altered, full jazz list per spec.
- Scales: keep all 21 existing scales, grouped (Major & Minor, Pentatonic & Blues, Modes, Jazz & Exotic, Bebop, Chromatic).
- Playback: scales ~180ms/note legato + octave root at end; chords block, ~1.5s sustain; piano keys light in sync; cross-fade between elements; mute kills audio but not animation.
- Music elements fixed size; only images scale.

## Check-in protocol (remaining)

2. One fully-realized element (styling + states + settings bar + chevrons + play button) before building the rest.
3. Audio design (pad timbre, one scale + one chord playback) before wiring everywhere.
4. URL encoding scheme before serialization becomes load-bearing.

## Testing

- Unit tests for `lib/theory` (inversions, 7ths mapping, naming) and `lib/url-state` (round-trip encode/decode, version handling) — these are the pure, regression-prone cores.
- Interaction/visual quality verified manually at each check-in.

## Out of scope (for now)

Light theme (tokens prepared, single dark theme active), themes picker behaviour, popup scales/chords from harmony chart (`FOR LATER STAGES` reference), mobile/touch-first support.
