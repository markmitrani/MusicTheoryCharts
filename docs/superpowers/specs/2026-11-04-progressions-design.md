# Progressions: Design

**Date:** 2026-11-04 · **Status:** v1 built (branch `progressions`), later phases planned
**Source:** conversation with Mark, 2026-11-04. Decisions marked *Mark* were his picks; *call* marks the builder's own choices, open to review.

## What it is

A section about chord progressions: the classic harmonic flow chart (vii° → iii → vi → [ii ⇄ IV] → [V / vii°] → I, which can go anywhere), generated for any tonal centre and mode, the way the Harmony element generates `{root}{scale}`. Comprehensive: major, minor, borrowed chords and the modes. Aesthetic and clear, and editable by writing progressions on it.

Deliverables, in phases:

1. **Progressions card** (built): a canvas element.
2. **Explainer**: a Ways Home-style slideshow that builds the map step by step.
3. **3D pop-out**: an immersive, photoreal version of the same map.
4. **Poster export**: a printable metro-map visual of progressions.

**Copy rule:** no em dashes. UI copy uses the spaced en dash ("Progressions – C Major").

## Decisions

| Decision | Choice | By |
|---|---|---|
| Placement | Card spawned like Harmony (root + map picker), plus an explainer later | Mark |
| Editable | Write progressions by clicking a path; the map itself stays fixed | Mark |
| 3D | Pop-out world like the Tonnetz 3D, loaded only when opened | Mark |
| Borrowed chords | "Borrowed" toggle adds them in a dashed lane | Mark |
| Look | Major: cyan → yellow, deep-blue ink. Minor: black → indigo, white ink (Mark's reference images) | Mark |
| 3D quality | Quality over performance, then optimise; any technique is fair game | Mark |
| Minor numerals | ♭III, ♭VI, ♭VII (as Harmony and Ways Home), not the reference's III, VI, VII | call |
| Minor tonic | i (the reference image shows I) | call |
| Modal maps | Built in the same grammar around each mode's own cadences (below) | call |
| Spawn | In the stub's three-dot menu, after Tonnetz | Mark |
| Colour chords | Same node recipe at twice the strength, outlined in the up tone (replaced underlines) | Mark |

## Theory model (`src/lib/theory/progressions.ts`)

A map is a **spine** of slots left to right, the last one home. A slot is a chord or a **bracket** (two chords that share a job, optionally swapping both ways). Flow arrows join neighbouring slots; **arcs** are shortcuts over or under the line; home fans out ("goes anywhere").

| Map | Spine | Arcs | Colour chords (fuller colour) |
|---|---|---|---|
| Major | vii° → iii → vi → [ii ⇄ IV] → [V / vii°] → I | V-group → vi over (deceptive); iii → [ii IV] and [ii IV] → I under | – |
| Minor | ♭VII → ♭III → ♭VI → [ii° ⇄ iv] → [V / vii°] → i | V-group → ♭VI over; [ii° iv] → i under | – |
| Lydian | V → [iii ⇄ vi] → [II ⇄ vii] → I | – | II, vii (♯4) |
| Mixolydian | vi → [ii ⇄ v] → [♭VII ⇄ IV] → I | [ii v] → I under | v, ♭VII (♭7) |
| Dorian | ♭III → [v ⇄ ii] → [♭VII ⇄ IV] → i | ♭III → [♭VII IV] under; [v ii] → i over | ii, IV (♮6) |
| Phrygian | ♭VI → [♭III ⇄ iv] → [♭II ⇄ ♭vii] → i | [♭III iv] → i under | ♭II, ♭vii (♭2) |
| Locrian | ♭V → [♭iii ⇄ iv] → [♭II ⇄ ♭vii] → i° | [♭iii iv] → i° under | ♭V, ♭iii (♭5) |

- Minor's V and vii° come from harmonic minor; the rest from natural minor.
- Each mode's diminished chord is left off the map, and the caption says why (its tritone pulls toward another key).
- The modal spines lean on the roads from Ways Home: Dorian and Mixolydian run the plagal chain (♭III → ♭VII → IV → I), Mixolydian and Dorian own the backdoor (♭VII → I), Phrygian the half-step ♭II → i. **Mark to review these five maps.**
- Harmonic and melodic minor have no map of their own; the minor map covers them. Locrian was added to `HARMONY_MODES`, so the Harmony element offers it too.

**Borrowed chords** each stand in for a slot and go where that slot goes (and trade places with its chords, e.g. IV → iv):

| Map | Borrowed (slot) | Extra lane moves |
|---|---|---|
| Major | ♭III (iii), ♭VI (vi), ii°, iv, ♭II Neapolitan ([ii IV]), ♭VII ([V vii°]) | ♭VI → ♭VII |
| Minor | ♭II, IV of melodic minor ([ii° iv]), I Picardy (i) | – |
| Dorian | V of harmonic minor ([v ii]), iv ([♭VII IV]) | – |
| Phrygian | ♭VII ([♭II ♭vii]), I of phrygian dominant (i) | – |
| Mixolydian | ♭VI (vi), V of Ionian ([ii v]), iv ([♭VII IV]) | – |
| Lydian, Locrian | none (the toggle is hidden) | – |

**Moves.** `mapMoves` lists every drawn move as chord pairs; with Borrowed on, borrowed chords inherit their slot's moves, so iv → ♭VII (the backdoor ii–V) follows the flow. A written step **follows the flow** if an arrow carries it, it leaves home, or it repeats; anything else is marked **against the flow** (↺).

**Spelling.** The tonic is spelled from its parent major on the circle (G♯ minor from B, E♭ Dorian from D♭); each chord root takes the letter of its degree, with double accidentals and E♯/B♯/C♭/F♭ collapsed as on the other charts. Sevenths are the diatonic ones (V7, iiø7, vii°7 on harmonic minor).

**Registry.** Chord ids and their order (spine, then borrowed) are stored in links: append-only per map.

## Progressions card (built)

- **Element** `{ kind: 'progressions', root, octave, scaleId, showSevenths?, showBorrowed?, showNames?, trail: string[] }`.
- **Shell:** folder tab "Progressions – C Major" (opens the root + map picker; changing map clears the trail), play button, 720px card.
- **Top bar:** the written progression (`ProgressionTrail.tsx`) as a wrapping row of numeral crumbs (I › vi › ii › V ↺ IV) with a clear button; toggles Names, 7ths, Borrowed.
  - **Pencil** at the start of the row, on by default: while on, clicking a chord on the map plays it and adds it to the end; off, clicks only play.
  - **Crumbs:** a click selects (no sound) and rings that chord on the map in the accent; drag to reorder (an accent caret marks the drop); Delete/Backspace or the selected crumb's × removes it; ←/→ move the selection, ⌥←/⌥→ move the chord; Esc or a click outside deselects. These keys never reach the canvas shortcuts.
- **Stage:** the map on its mode's gradient (`src/components/progressions/MapScene.tsx`, geometry in `layout.ts`, shared later by the explainer and poster), in the house language (Mark, 2026-11-04): chords are glass nodes built exactly like Ways Home's corner nodes from a per-mode colour pair (`--prog-<mode>-node`, `-node-up`, one shade deeper in the light theme): the base is the stroke and tints the fill 24% into `--element-fill`; the glass runs from the up tone 42% into the fill, to 22% of the base, to a 34% rim into `--canvas-bg`; text in the theme's own colours; the tonic keeps its mode colour (Mark). Colour chords (holding the mode's colour note) take the same recipe at twice the strength (fill 48%, glass 84/44/68) with an outline in the up tone, so they read as fuller colour without an extra mark (Mark, replacing underlines). Palette (Mark's vote, 2026-11-05): major light teal and Mixolydian teal, Dorian sky and minor deeper sky, Lydian cyan, Phrygian rose, Locrian brick; major and Mixolydian arrows and brackets take their nodes' teal, deepened. Nodes are circles, or capsules when the label runs wide, numeral and name inside, arrows are Ways Home roads (round stroke into a filled tip, stopping short of the node), square brackets, and the fan out of home. The arrow paths and positions follow the reference charts. Wide maps widen the viewBox so nothing clips; 820px card.
- **Glass and print:** the gradient sits a little see-through over the card (`--prog-stage-alpha-*`) under the house sheen at half strength. A grunge texture lies over the background only, in soft-light, beneath the nodes and roads (`texture.ts`: lit paper tooth, faintly coloured mottling for a minimal hue drift, vein crackle and dust pits whose warm and cool copies sit a hair apart for a chromatic-aberration grain). It's rendered once, when the browser is idle, into a shared 2400×1200 bitmap: crisp at 2× and zoomed, one image so it never repeats, nothing recomputed while the canvas pans or zooms. A sounding chord glows in its tint mixed with light, and a pulse runs along the road to the next chord.
- **Interactions:** hover a chord → it and everywhere it can go stay lit, the rest dims (the only highlight on the map). Click → plays it (voice-led from the previous written chord) and, with the pencil on, writes it (max 16). Play → the written progression, or the map's example when empty (major I–vi–ii–V–I, minor i–♭VI–iv–V–i, Dorian i–♭III–ii–IV–i, Mixolydian I–♭VII–IV–I…). The sounding chord breathes a halo in the ink.
- **Caption:** one or two sentences per map (and per borrowed view); the colour chords named in it are bold (`**…**` in the caption strings).
- **Labels:** an orderable segmented control, Functions | Notes (`LabelControl.tsx`). Click a segment to show or hide it (one stays on); drag it past the other, or ⌥←/⌥→, to swap. With both on, the left one is the big serif label and the right one the subtitle; with one, just that one. Chord names in the big face set the root full size and the quality smaller. Crumbs in the progression row follow the big label. Element fields `labelOrder`, `labelsHidden`; the URL keeps the four shown states (flags 4 = one label, 16 = notes first; old links that hid names read as Functions only).
- **Tokens** (`globals.scss`, same in every theme): `--prog-<mode>-from/-to/-ink` for lydian, major, mixolydian, dorian, minor, phrygian, locrian (the brightness ladder, Lydian brightest), `--prog-trace-on-light/-dark`.
- **Transpose:** ↑/↓ shifts the root; the trail is functional and stays.
- **URL codec:** `g + pc1 + scale1 + flags1 + x2 + y2 + steps` (8 + n chars; flags = 7ths + borrowed·2 + namesHidden·4; each step one base36 index into the map's chords).

## Mandala view (built, Mark 2026-11-05)

A "Mandala" toggle on the card (`mandala` flag, codec bit 8) shows every mode at once around one tonic (`MandalaScene.tsx`, geometry in `mandala.ts`):

- **Twin hub:** I on the left, i on the right, the same tonic.
- **Arms:** each mode's own map placed by one rigid transform so it flows into its hub; nodes stay upright. Major side counterclockwise from Lydian (top) to major to Mixolydian (lowest); minor side clockwise from minor (top) to Dorian, Phrygian, Locrian. Right arms are mirrored so arcs keep their sides; minor and Dorian are also flipped across their own axis to send their long arcs home into open space. The gap into home opens (250) so arms clear the hub; arcs bow at 0.42; no fan.
- **Angular wash:** conic gradients at each arm's angle, the mode's far colour (`from`) at the rim and its home colour (`to`) toward the centre (radially faded), blending from arm to arm; sheen and grunge over it, under the arms.
- **Outline:** the card's stroke turns into an angular gradient of the modes' node colours, centred on the mandala's middle with each stop at its arm's own angle (`conicStops`, shared with the wash).
- **Hub rims:** I and i each get an angular rim of only their own side's node colours, each stop at the angle its arm leaves the hub; across the side where the hubs nearly touch, the rim blends from the topmost mode round to the bottom one (`AngularRim`, drawn as fine segments since SVG has no conic gradient; follows circles and capsules).
- **Writing:** only the card's own mode's arm writes (with the pencil on); other arms sound. Clicking a mode's name makes it the card's mode (clearing the trail). Hover lights one arm's moves; hovering a hub lights its whole side.
- **Gradients revised (Mark):** Dorian, minor and Phrygian shifted toward their node hues with more saturation.

## Tempo (app-wide, Mark 2026-11-05)

Settings' tempo is a musical tempo, ♩ = 40–208 (default 120), in the canvas store. `playback.ts` defines note values (`noteMs`: whole … sixteenth, dotted half and quarter) against it, and every element plays in note values: scale notes are eighths, progression chords halves, a single chord rings a dotted half, Tonnetz move pairs quarters. Ways Home's pulse and halo animations still run at a fixed 0.95 s (a half note at ♩ ≈ 126).

## Phase 2: explainer

Generic lesson shell from Ways Home (`src/components/lesson/`). Slides build the major map: V → I; the predominants ii and IV; the fifths chain vi, iii, vii°; the shortcuts (deceptive, plagal, iii → IV); "I goes anywhere"; minor; borrowed chords (IV → iv → I, the backdoor ii–V); one slide per mode family. Each slide playable, with one "At the piano" drill. Copy to be drafted with Mark.

## Phase 3: 3D pop-out

Opened from a "3D" button on the card; full-window overlay, dynamic import, same audio and theme plumbing as the Tonnetz world. Reuses the map layout in 3D: numerals as glossy extruded or SDF forms, arrows as tubes, brackets as bars, on the mode's gradient as an environment.

Look (Mark's "post processing" reference): photoreal and shiny, dark glossy surfaces with soft rim highlights, stylish colour grading. **Quality first** (`docs/reference/threejs-optimization-manual.md` for how): `MeshPhysicalMaterial` with clearcoat lit by a small HDR environment (PMREM) rather than many lights; no transmission; one merged post pass (pmndrs `postprocessing`: bloom, LUT or hue/saturation grade, vignette, grain) with SMAA in the composer and `antialias: false` on the renderer; contact or blob shadows; DPR capped at 2; render on demand when idle and accumulate extra frames when the camera stops; shaders compiled before reveal; measure calls, triangles and frame time before and after each change. Interactions mirror the card (hover, click to write, play) plus camera drift. Needs Mark's input on camera and motion before building.

## Phase 4: poster export (ask Mark first)

Mark's direction, to be confirmed in detail before designing: export SVG, PDF or PNG as a landscape print in a metro-map style. Each progression is a line in its own retro vintage rainbow colour on light cream. You get on and off only at a progression's start and end; looping progressions run both ways; midway stations are passed under. Ties to the print-on-demand idea.

## Verified

- Unit tests: maps, numerals, spelling (G♯ minor, E♭ Dorian, D♭ Lydian), sevenths, colour chords, moves and borrowed inheritance, codec round trips. Full suite passes.
- Rendered in headless Chrome: all seven maps, 7ths, Borrowed, a written trail with an against-the-flow step, hover, playback, the spawn stub, light theme.
- Not verified: sound (headless has no audio), phone layout.
