import type { CadenceType, Direction, WalkStep } from '@/lib/theory/cadence';

/** What the stage shows on a slide; the stage animates between these. */
export type StageState =
  | {
      scene: 'fractal';
      walk: WalkStep[];
      dir: Direction;
      corners?: CadenceType[] | null;
      maxLevel?: number;
      /** Reveal levels one at a time up to maxLevel. */
      grow?: boolean;
    }
  | { scene: 'roads' }
  | { scene: 'explorer' };

export interface Slide {
  id: string;
  title: string;
  body: string[];
  drill: string;
  chains?: CadenceType[];
  stage: StageState;
}

const V: WalkStep = { dir: 'in', type: 'dominant' };

export const WAYS_HOME_TITLE = 'Many Ways Home';

export const WAYS_HOME_SLIDES: Slide[] = [
  {
    id: 'well-travelled',
    title: 'The well-travelled way home',
    body: [
      'Most tonal music comes home the same way: V to I. The root falls a fifth, G to C.',
      'Inside G7 sits a tritone, B and F. B rises a half step to C; F falls a half step to E. That squeeze is the pull you feel.',
    ],
    drill:
      'Play G7→Cmaj7, root in the left hand. Watch B and F close in on C and E. Then go around the circle: C, F, B♭, E♭…',
    chains: ['dominant'],
    stage: { scene: 'fractal', walk: [], dir: 'in', corners: ['dominant'], maxLevel: 1 },
  },
  {
    id: 'another-way',
    title: 'Another way home',
    body: [
      'IV to I: F to C. The root falls a fourth.',
      'No tritone, no squeeze – a softer arrival, the "amen" at the end of a hymn. Borrow the minor iv and it turns to gospel.',
    ],
    drill: 'Play F→C, then F→Fm→C. Only A moves from F to Fm, down to A♭. Then A♭ slides down to G as you land.',
    chains: ['plagal'],
    stage: { scene: 'fractal', walk: [], dir: 'in', corners: ['dominant', 'plagal'], maxLevel: 1 },
  },
  {
    id: 'same-road',
    title: 'Same road, both directions',
    body: [
      'On the circle of fifths, G and C are neighbours. Drive from G to C and it’s V→I. Drive back from C to G and it’s IV→I – in the key of G.',
      'Dominant and plagal aren’t two roads; they’re one road driven in opposite directions. Every pair of neighbours works the same way.',
    ],
    drill: 'Play G→C, then C→G. Same two chords; where you stop decides which one is home.',
    stage: { scene: 'roads' },
  },
  {
    id: 'many-ways',
    title: 'Many ways home',
    body: [
      'Two more roads lead home. The backdoor, B♭7→C, is borrowed from C minor; the root climbs a whole step.',
      'The tritone sub, D♭7→C, holds the same tritone as G7 – F and C♭ – so it pulls the same way while the root slides down a half step.',
      'These are the four most common ways home. There are many more.',
    ],
    drill: 'Play all four into Cmaj7 (G7, F, B♭7, D♭7) and listen to how each one arrives.',
    chains: ['backdoor', 'tritone'],
    stage: { scene: 'fractal', walk: [], dir: 'in', corners: null, maxLevel: 1 },
  },
  {
    id: 'many-homes',
    title: 'Many homes to travel to',
    body: [
      'So far G has been the V of C. But a chord doesn’t know its job – the next chord tells it.',
      'Treat G as a IV and it goes home to D. As a ♭VII, to A. As a tritone sub, down to F♯. One chord, four homes.',
    ],
    drill: 'Play G7→C, Gmaj7→D, G7→A, G7→F♯.',
    stage: { scene: 'fractal', walk: [V], dir: 'out', corners: null, maxLevel: 1 },
  },
  {
    id: 'corners',
    title: 'Corners have corners',
    body: [
      'Every corner has four corners of its own: V has its own V, IV, ♭VII and ♭II, and so on all the way down.',
      'Any path from the outside in is a progression that lands home. Straight lines repeat one move: ↗↗ is ii–V–I. Zig-zags mix moves: ↙ then ↗ is the backdoor ii–V, iv–♭VII–I.',
    ],
    drill: 'Pick any path three steps deep and play it into C. Then play the four straight ones.',
    stage: { scene: 'fractal', walk: [], dir: 'in', corners: null, maxLevel: 3, grow: true },
  },
  {
    id: 'your-turn',
    title: 'Your turn',
    body: [
      'Click a chord to hear its move; double-click to travel there. Flip the arrows to see where a chord can go instead of how to reach it.',
      'The trail at the top is your progression: play it, or click back to any step.',
    ],
    drill: 'Walk five steps, play the trail, then play it from memory.',
    stage: { scene: 'explorer' },
  },
];
