# Many Ways Home: Design

**Date:** 2026-10-03, revised 2026-10-17 · **Status:** approved
**Source:** brainstorming session with Mark (conversation). Decisions below were picked at explicit check-ins.

## What we're building

A cadence explorer that shows, interactively and in one place, every common way to arrive at a chord, and every home a chord can travel to. Deliverables:

1. **Ways Home card**: a canvas element (the "central artifact"). A zoomable fractal of cadences: I sits in the centre, its four approach chords sit on the corners, and every corner is the centre of its own four corners, without end.
2. **Explainer**: a paged slideshow launched from the card. Seven slides build the idea step by step and end on the live explorer.
3. **Roads card**: the "same road, both directions" ring as its own canvas element.
4. **Key picker**: choose a real I, so labels map from Roman numerals to chord names and back.

Audience: jazz learners coming from classical training. Theory and practice together: every slide is playable and carries one "At the piano" drill.

**Copy rule:** no em dashes anywhere. UI copy uses the British spaced en dash ("Ways Home – V").

## Theory model

Four cadence types, each defined by the root motion from the approach chord into home:

| Type | Approach → I | Root motion into home | Semitones | Corner | Colour |
|---|---|---|---|---|---|
| dominant | V → I | falls a 5th | +5 | ↗ top-right | red |
| plagal | IV → I | falls a 4th | +7 | ↖ top-left | green |
| backdoor | ♭VII → I | rises a whole step | +2 | ↙ bottom-left | blue-violet |
| tritone | ♭II → I | falls a half step | −1 | ↘ bottom-right | yellow-orange |

Two directions from any node X:

- **Ways in** (`approachesOf`): the four chords that resolve to X. `approach = X − interval`.
- **Homes** (`homesOf`): the four chords X resolves to if it plays each role. `home = X + interval`.

Facts the views make visible (all are tested invariants):

- `homesOf(approachesOf(x, t), t) === x` for every type.
- Dominant and plagal are one road driven in opposite directions: `approachesOf(x, 'dominant') === homesOf(x, 'plagal')` (G→C is V→I in C; C→G is IV→I in G).
- Straight diagonals in the fractal are single-move chains; zig-zags mix moves.

**Labels.** Roman numerals relative to the walk's I, one fixed spelling per semitone: I ♭II II ♭III III IV ♭V V ♭VI VI ♭VII VII. Fractal nodes are uppercase (they are roots/centres). The label function takes an optional key from the start, so the key picker plugs in without rework.

**Chains** (per type, shown in the explainer):

| Type | Map chain (same move ×3) | Jazz version |
|---|---|---|
| dominant | vi–ii–V–I | ii7–V7–Imaj7 |
| plagal | ♭III–♭VII–IV–I | IVmaj7–iv6–Imaj7 |
| backdoor | ♭V–♭VI–♭VII–I | iv7–♭VII7–Imaj7 |
| tritone | ♭III–II–♭II–I | ii7–♭II7–Imaj7 |

**Sound.** Chord quality follows the move it makes: dominant, backdoor and tritone approaches play as dominant 7ths; plagal approaches as maj7; home as maj7. Map chains therefore sound as secondary-dominant chains (VI7–II7–V7–Imaj7); jazz versions use their own qualities. Voicing: left-hand root plus a four-note right-hand close voicing, each chord voice-led to the nearest inversion of the next so guide tones move by step. Playback reuses `playProgression` and the existing audio engine.

## Unit: theory core (`src/lib/theory/cadence.ts`)

Pure, no React. Exports:

- `CadenceType`, `CADENCE_TYPES` (registry order: dominant, plagal, backdoor, tritone; append-only, used by the URL codec).
- `CADENCES: Record<CadenceType, { numeral, interval, corner, colorVar, approachQuality }>`.
- `approachesOf(pc)`, `homesOf(pc)` → `Record<CadenceType, number>` (pitch classes 0–11 relative to I).
- `fractal(focusPc, dir, depth)` → flat node list `{ pc, path: CadenceType[], level }` for rendering (depth 4 = 85 nodes).
- `numeral(pc)` and `chordName(pc, key)` → label strings.
- `MAP_CHAINS`, `JAZZ_CHAINS` → chord specs `{ pc, quality }`.
- `walkToProgression(walk)` → ordered chord specs for playback (see card behaviour).
- `voiceProgression(specs, key?)` → `number[][]` absolute pitches, root in bass, nearest-inversion voice leading. Builds chords with `buildChord` from `chords.ts`.

## Unit: Ways Home card (`src/components/canvas/elements/WaysHomeCard.tsx`)

**Element type** (added to `types.ts`):

```ts
interface WalkStep { dir: 'in' | 'out'; type: CadenceType }
interface WaysHomeElement extends ElementBase {
  kind: 'wayshome';
  walk: WalkStep[];      // path from I to the current centre, max 12 steps
  dir: 'in' | 'out';     // current view: ways in, or homes
  key: NoteName | null;  // null = functional; set by the key picker (last build step)
}
```

**Spawning.** New instant kind in the stub's "more" menu ("Ways Home"), next to Circle of Fifths and Pitch Axis. `confirmStub` creates `{ kind: 'wayshome', walk: [], dir: 'in', key: null }`.

**Shell.** House pattern: folder tab "Ways Home – <centre numeral>", fixed-size square card, play button floating top-right, an ⓘ "Explainer" button that opens the slideshow.

**Stage** (SVG, `src/components/cadence/FractalScene.tsx`, shared with the explainer):

- Centre node + four corners + their four corners, labelled; the fourth level renders as faint dots that grow into labelled nodes during a zoom.
- Level-1 arrows connect fully into the centre as gentle pinwheel arcs that pass beside each corner's inward-facing child; deeper arrows are straight full lines.
- Breadcrumb top-left, Explorer-style: `I › V › II`. A flip in the walk shows as a turn marker between crumbs. Clicking a crumb zooms back out to that level.
- Bottom: a two-way switch, "Ways in ⇄ Homes".

**Interactions.**

- Hover a node → its full path to the centre lights up; everything else dims.
- Click a node → play the move(s) between it and the centre (e.g. V7→Imaj7, or centre→home when viewing homes), zoom into the node, then re-root seamlessly; the walk grows by that node's path (one step for a corner, two for a corner's corner). Fourth-level dots are not clickable.
- Flip → every arrow reverses (animated draw-on in the new direction) and corner labels cross-fade to their new values; the walk records the turn.
- Play button → plays the walk as a progression. A ways-in run plays from its furthest chord back to where the run started (walk I › V › II plays II–V–I); a homes run plays forward from where it started (walk I › IV › ♭VII plays C–F–B♭). After a flip, playback covers the steps since the last turn.
- Zoom is click-driven only. Pinch and scroll stay with the canvas camera.

**Infinite zoom.** Child offset ratio r ≈ 0.45. Zooming into a child tweens the scene transform by 1/r about that child while node radii and label sizes interpolate to their next-level values; on complete, the scene re-roots at the child and resets the transform. The structure is self-similar, so the handoff is invisible. Breadcrumb zoom-out runs the same tween in reverse (multi-level jumps compose into one 1/rᵏ tween).

**Integration.** `CanvasApp` renders `case 'wayshome'`. Not pitched: transpose (↑/↓), R-highlight and inversion keys ignore it.

**URL codec** (append-only; existing registries untouched). New element code:

```
wayshome = w + dir1 + key1 + x2 + y2 + steps   (7 + n chars, n ≤ 12)
dir1  = '0' ways in | '1' homes
key1  = pitch class 0–b, or 'c' = functional
step  = base36( dirBit * 4 + typeIndex ), one char, 0–7
```

## Unit: explainer window (`src/components/lesson/`)

Generic slideshow shell, reusable for future lessons.

- `lessonStore` (zustand vanilla): `{ open: LessonId | null, slide: number, sourceId: string | null }`. `LessonHost` in `CanvasApp` renders the window via a portal outside the transformed viewport.
- **Window:** glass panel over a dimmed canvas, up to ~1120×720 (`min(1120px, 92vw)` × `min(720px, 88vh)`). Close with ✕ or Esc.
- **Layout:** text column left (title in Fraunces, short body, chain strip with play buttons, one "At the piano" drill); stage right; a two-octave piano strip (`PianoKeys`) under the stage lights the voicing currently sounding.
- **Navigation:** → on the right edge; ← on the left edge only when a previous slide exists; keyboard ←/→. Bottom-centre dots: active in `--accent`, others in `--rail-bar`; clicking a dot jumps and the stage animates directly to that state.
- **Keyboard isolation:** while a lesson is open, `CanvasApp`'s global key handler bails (its arrows otherwise switch pages, transpose, or cycle inversions).
- **Sound:** no autoplay. Clicking any arrow, node or chain plays it.
- Closing returns to the card. The finale walk is not written back to the card.

## Unit: the Ways Home lesson (`src/lessons/ways-home.ts` + `src/components/cadence/`)

Slides are data: `{ id, title, body, drill, chains?, stage: StageState }`. `CadenceStage` renders a `StageState` by choosing a scene (`FractalScene` or `RoadsRing`) and GSAP-tweening between states (arrows draw on, nodes pop in, zooms, flips, scene cross-morph). The narrative is written in C; slides 1–6 show numerals with C names as subtitles. The finale uses the card's key.

Draft copy (edit freely):

**1. The well-travelled way home**: *stage: I, V on ↗, arrow draws in.*
Most tonal music comes home the same way: V to I. The root falls a fifth, G to C. Inside G7 sits a tritone, B and F. B rises a half step to C; F falls a half step to E. That squeeze is the pull you feel.
Chains: vi–ii–V–I · ii7–V7–Imaj7.
*At the piano:* Play G7→Cmaj7, root in the left hand. Watch B and F close in on C and E. Then go around the circle: C, F, B♭, E♭…

**2. Another way home**: *stage: IV joins on ↖.*
IV to I: F to C. The root falls a fourth. No tritone, no squeeze – a softer arrival, the "amen" at the end of a hymn. Borrow the minor iv and it turns to gospel.
Chains: ♭III–♭VII–IV–I · IVmaj7–iv6–Imaj7.
*At the piano:* Play F→C, then F→Fm→C. Only A moves from F to Fm, down to A♭. Then A♭ slides down to G as you land.

**3. Same road, both directions**: *stage: morph to the circle-of-fifths ring (`RoadsRing`).*
On the circle of fifths, G and C are neighbours. Drive from G to C and it's V→I. Drive back from C to G and it's IV→I – in the key of G. Dominant and plagal aren't two roads; they're one road driven in opposite directions. Every pair of neighbours works the same way.
*At the piano:* Play G→C, then C→G. Same two chords; where you stop decides which one is home.

**4. Many ways home**: *stage: back to the fractal frame; ♭VII joins on ↙, ♭II on ↘.*
Two more roads lead home. The backdoor, B♭7→C, is borrowed from C minor; the root climbs a whole step. The tritone sub, D♭7→C, holds the same tritone as G7 – F and C♭ – so it pulls the same way while the root slides down a half step. These are the four most common ways home. There are many more.
Chains: ♭V–♭VI–♭VII–I · iv7–♭VII7–Imaj7 and ♭III–II–♭II–I · ii7–♭II7–Imaj7.
*At the piano:* Play all four into Cmaj7 (G7, F, B♭7, D♭7) and listen to how each one arrives.

**5. Many homes to travel to**: *stage: zoom into V; arrows turn outward (homes view).*
So far G has been the V of C. But a chord doesn't know its job – the next chord tells it. Treat G as a IV and it goes home to D. As a ♭VII, to A. As a tritone sub, down to F♯. One chord, four homes.
*At the piano:* Play G7→C, Gmaj7→D, G7→A, G7→F♯.

**6. Corners have corners**: *stage: the fractal grows level by level from I (ways in).*
Every corner has four corners of its own: V has its own V, IV, ♭VII and ♭II, and so on all the way down. Any path from the outside in is a progression that lands home. Straight lines repeat one move: ↗↗ is ii–V–I. Zig-zags mix moves: ↙ then ↗ is the backdoor ii–V, iv–♭VII–I.
*At the piano:* Pick any path three steps deep and play it into C. Then play the four straight ones.

**7. Your turn**: *stage: the live explorer (same component as the card).*
Click any chord to travel there. Flip the arrows to see where a chord can go instead of how to reach it. The trail top-left is your progression: play it, or click back to any step.
*At the piano:* Walk five steps, play the trail, then play it from memory.

## Unit: Roads card (`src/components/canvas/elements/RoadsCard.tsx`)

The interlude's ring as a canvas element, reusing `RoadsRing`.

- **Element:** `{ kind: 'roads', centerKey: NoteName }`. Instant kind in the "more" menu ("Roads"). Folder tab "Roads – C".
- **Body:** the 12 keys in fifths order, the centre key rotated to the top (rotate-then-relabel, as in `CircleCard`). The centre's four ways in and four ways out are drawn as coloured roads; neighbour roads appear as paired two-way arcs, so the dominant/plagal duality is always visible. Nodes show the real key name with the numeral relative to the centre as a subtitle.
- **Interactions:** click a key to rotate it to the top; hover a road to highlight it and show its label ("G→C · V→I"); click a road to play that cadence. Chips switch between ways in, homes, and both (default both). ⓘ panel with a short explanation.
- **URL codec:** `roads = r + center1 + x2 + y2` (6 chars).

## Unit: key picker

Lands last; the data model and codec carry `key` from the start.

- **Where:** the Ways Home card's folder tab opens a key popover (house pattern: the tab edits the element). Options: "Functional" plus the 12 keys in circle-of-fifths order using the circle's labels (C, G, D, A, E, B, F♯, D♭, A♭, E♭, B♭, F). The explainer's final slide shows the same picker.
- **Labels when keyed:** chord name large, numeral small beneath. The breadcrumb switches to names too. Tab: "Ways Home – G (in C)"; functional stays "Ways Home – V".
- **Spelling:** tonic spelled from the circle labels; each degree takes the letter (tonic letter + degree − 1) and the accidental that matches the semitone; double accidentals collapse to the simpler enharmonic (A♭♭ → G).
- **Sound:** keyed playback sounds in that key; functional playback sounds in C.

## Look and motion

- **Tokens** in `globals.scss`, dark + light like `--axis-*`. Tetradic scheme from the CMYK-wheel quartering; warm on the dominant side (right), cool on the subdominant side (left), complements across the diagonals. Starting values, tuned in the browser:

  | Token | Dark | Light |
  |---|---|---|
  | `--cadence-dominant` (red) | `#e5484d` | `#d13438` |
  | `--cadence-tritone` (yellow-orange) | `#f5b82e` | `#d9930f` |
  | `--cadence-plagal` (green) | `#46b97a` | `#1f9d61` |
  | `--cadence-backdoor` (blue-violet) | `#8a7cf5` | `#5b4fd6` |

  The tritone yellow-orange must stay visibly distinct from `--accent` (`#f49119` dark); checked during tuning.
- **Motion** (GSAP): arrows draw on via stroke-dashoffset; nodes pop with `back.out`; zoom-travel 0.8s `power3.inOut`; flip reverses arrow draw direction while labels cross-fade; slide transitions tween the stage between states rather than cutting.
- Cards follow the folder-tab pattern and reference tokens only; no hardcoded colours.

## Testing

- **Unit (vitest):** `cadence.ts`: approach/home for all 4 types × 12 pitch classes; inverse and V/IV-duality invariants; fractal node count and labels match the approved sketch (I's corners V/IV/♭VII/♭II; V's corners II/I/IV/♭VI, etc.); numeral spelling; chord-name spelling per key (no double accidentals); chains; voice leading (root in bass, bounded movement); `walkToProgression` ordering including the flip rule.
- **Codec:** round-trip of `wayshome` (walks of 0, 1 and 12 steps, both directions, functional and keyed) and `roads`; existing v2/v1 fixtures still decode.
- **Store:** `confirmStub` creates `wayshome` and `roads` elements.
- **Lesson shell (testing-library):** ← hidden on slide 1; →/←/dot navigation; Esc closes; slide data references valid stage states.
- **Manual (preview):** zoom handoff is seamless, flip animation, breadcrumb zoom-out, hover path, light/dark, audio.

## Build order

1. Copy sweep: replace em dashes in existing UI copy with spaced en dashes.
2. Theory core + tests.
3. Cadence tokens + `FractalScene` (static render, hover path).
4. Ways Home card: types, stub entry, store, codec, render; zoom-travel, breadcrumb, flip, playback.
5. Lesson shell (generic window, host, keyboard isolation).
6. Ways Home lesson: stage states, `RoadsRing` interlude, slide copy, chain strip, piano strip.
7. Roads card.
8. Key picker.

Verification runs after every step (tests + preview), with a final pass after step 8.

## Out of scope

Deep links to individual slides; writing the finale walk back to the card; touch-first/mobile.
