# Music Theory Playground

An infinite-canvas webapp for arranging music theory tools — scales, chords, and reference images — however you think. Built for jazz learners who are tired of switching contexts between isolated theory tools.

## Features

- **Infinite canvas** with trackpad-native pan (two-finger drag), zoom (pinch or cmd+scroll), and space-hold panning
- **Scales & chords** as draggable cards with piano visualizations — 22 scales (modes, bebop, blues, exotic) and the full jazz chord vocabulary (triads through altered extensions)
- **Chord tools**: universal 7ths toggle, inversion cycling with proper naming ("Gmaj7 — 1st inversion")
- **Playback**: warm pad synthesis via Tone.js — scales play legato note-by-note, chords sustain as a block, piano keys light up in sync
- **Editing in place**: click any element's folder tab to change its root or type
- **Multi-page canvas** with a vertical page rail — rename, reorder, delete
- **Image uploads** via toolbar, drag-and-drop, or paste — aspect-locked resizing
- **Shareable URLs**: the whole canvas state lives in a compact `#v1:` hash

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest unit tests (theory core, store, URL codec)
npm run build    # production build
```

Stack: Next.js (App Router) + TypeScript, SCSS with design tokens in `src/styles/globals.scss`, GSAP for motion, Tone.js for audio, zustand for canvas state.

The previous HTML/CSS/JS implementation lives in [`legacy/`](legacy/) as reference material.

Check out a prefilled example at: http://localhost:3000/#v2:1;~;~f05010r0iC%20Minor%20Section%3A%20Chords-c0700603-c5700j03-c7800j09-c2900609-h01070g1-f060m0r07Key%20centers%20in%20this%20tune%3A%20C%20Minor%20%2B%20Eb%20major-s01060n-s300j0n;~;~

## Acknowledgements

Type set in [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Inter](https://fonts.google.com/specimen/Inter).
