import { describe, it, expect } from 'vitest';
import {
  MAP_GROUPS,
  followsFlow,
  getProgressionMap,
  hasProgressionMap,
  homeId,
  mapChords,
  mapMoves,
  progressionSpecs,
  resolveChord,
  resolveStep,
  stepFollows,
  stepRoad,
  stepSpecs,
  stepTwins,
  tonicName,
} from './progressions';

const names = (scaleId: string, root: Parameters<typeof resolveChord>[2], sevenths = false) => {
  const map = getProgressionMap(scaleId);
  return mapChords(map).map((ch) => resolveChord(map, ch, root, sevenths));
};

describe('progression maps', () => {
  it('covers major, minor and the five other modes', () => {
    const ids = MAP_GROUPS.flatMap((grp) => grp.ids);
    expect(ids.sort()).toEqual(['dorian', 'locrian', 'lydian', 'major', 'minor', 'mixolydian', 'phrygian']);
    expect(hasProgressionMap('harmonicMinor')).toBe(false);
  });

  it('draws the major chart: vii° iii vi [ii IV] [V vii°] I', () => {
    const chords = names('major', 'C').filter((ch) => !ch.borrowed);
    expect(chords.map((ch) => ch.numeral)).toEqual(['vii°', 'iii', 'vi', 'ii', 'IV', 'V', 'vii°', 'I']);
    expect(chords.map((ch) => ch.name)).toEqual(['Bdim', 'Em', 'Am', 'Dm', 'F', 'G', 'Bdim', 'C']);
  });

  it('draws the minor chart with harmonic-minor dominants and a minor tonic', () => {
    const chords = names('minor', 'A').filter((ch) => !ch.borrowed);
    expect(chords.map((ch) => ch.numeral)).toEqual(['♭VII', '♭III', '♭VI', 'ii°', 'iv', 'V', 'vii°', 'i']);
    expect(chords.map((ch) => ch.name)).toEqual(['G', 'C', 'F', 'Bdim', 'Dm', 'E', 'G♯dim', 'Am']);
  });

  it('stacks the diatonic sevenths, fully diminished on the harmonic-minor vii', () => {
    const chords = names('minor', 'C', true).filter((ch) => !ch.borrowed);
    expect(chords.map((ch) => ch.numeral)).toEqual(['♭VII7', '♭IIImaj7', '♭VImaj7', 'iiø7', 'iv7', 'V7', 'vii°7', 'i7']);
    expect(chords.find((ch) => ch.id === 'vii')!.quality).toBe('dim7');
    expect(chords.find((ch) => ch.id === 'ii')!.name).toBe('Dm7♭5');
  });

  it('spells keys from their parent major', () => {
    expect(tonicName('G#', getProgressionMap('minor'))).toBe('G♯');
    expect(tonicName('D#', getProgressionMap('dorian'))).toBe('E♭');
    expect(tonicName('C#', getProgressionMap('lydian'))).toBe('D♭');
    expect(tonicName('A#', getProgressionMap('minor'))).toBe('B♭');
    expect(names('minor', 'G#').filter((ch) => !ch.borrowed).map((ch) => ch.name)).toEqual([
      'F♯', 'B', 'E', 'A♯dim', 'C♯m', 'D♯', 'Gdim', 'G♯m',
    ]);
    expect(names('major', 'A#').find((ch) => ch.id === 'bVI')!.name).toBe('G♭');
  });

  it('marks each mode’s colour chords', () => {
    const colour = (id: string) => names(id, 'C').filter((ch) => ch.colour).map((ch) => ch.numeral);
    expect(colour('dorian')).toEqual(['ii', 'IV']);
    expect(colour('phrygian')).toEqual(['♭II', '♭vii']);
    expect(colour('lydian')).toEqual(['II', 'vii']);
    expect(colour('mixolydian')).toEqual(['v', '♭VII']);
    expect(colour('major')).toEqual([]);
  });

  it('gives every chord a unique id, and every move a real chord', () => {
    for (const grp of MAP_GROUPS) {
      for (const id of grp.ids) {
        const map = getProgressionMap(id);
        const ids = mapChords(map).map((ch) => ch.id);
        expect(new Set(ids).size, id).toBe(ids.length);
        for (const move of mapMoves(map, true)) {
          for (const end of move.split('>')) expect(ids, `${id} ${move}`).toContain(end);
        }
        for (const step of map.demo) expect(ids, `${id} demo`).toContain(step);
      }
    }
  });

  it('follows the flow, the arcs and the swaps; I goes anywhere', () => {
    const map = getProgressionMap('major');
    const moves = mapMoves(map);
    expect(followsFlow(map, moves, 'vi', 'ii')).toBe(true); // vi → [ii IV]
    expect(followsFlow(map, moves, 'IV', 'ii')).toBe(true); // swap
    expect(followsFlow(map, moves, 'V', 'vi')).toBe(true); // deceptive arc
    expect(followsFlow(map, moves, 'IV', 'I')).toBe(true); // plagal arc
    expect(followsFlow(map, moves, 'iii', 'IV')).toBe(true);
    expect(followsFlow(map, moves, 'I', 'vii0')).toBe(true);
    expect(followsFlow(map, moves, 'V', 'IV')).toBe(false); // retrogression
    expect(followsFlow(map, moves, 'ii', 'vi')).toBe(false);
  });

  it('lets borrowed chords go where the chords they stand in for go', () => {
    const map = getProgressionMap('major');
    const moves = mapMoves(map, true);
    expect(followsFlow(map, moves, 'IV', 'iv')).toBe(true); // IV → iv
    expect(followsFlow(map, moves, 'iv', 'I')).toBe(true); // minor plagal
    expect(followsFlow(map, moves, 'iv', 'bVII')).toBe(true); // backdoor ii–V
    expect(followsFlow(map, moves, 'bIII', 'bVI')).toBe(true); // as iii → vi
    expect(followsFlow(map, moves, 'bVII', 'iv')).toBe(false);
    expect(followsFlow(map, moves, 'bVII', 'I')).toBe(true); // backdoor
    expect(followsFlow(map, moves, 'bII', 'V')).toBe(true); // Neapolitan
    expect(followsFlow(map, moves, 'bVI', 'bVII')).toBe(true); // lane move
    expect(followsFlow(map, mapMoves(map), 'iv', 'I')).toBe(false); // overlay off
    const minor = getProgressionMap('minor');
    expect(followsFlow(minor, mapMoves(minor, true), 'V', 'I')).toBe(true); // Picardy
  });

  it('turns a written progression into voicing specs', () => {
    const map = getProgressionMap('major');
    expect(progressionSpecs(map, ['ii', 'V', 'I'], 'C', true)).toEqual([
      { pc: 2, quality: 'm7' },
      { pc: 7, quality: '7' },
      { pc: 0, quality: 'maj7' },
    ]);
    expect(homeId(map)).toBe('I');
  });
});

describe('written steps', () => {
  it('resolve and voice in their own mode', () => {
    expect(resolveStep('dorian:IV', 'D')).toMatchObject({ numeral: 'IV', name: 'G' });
    expect(resolveStep('phrygian:II', 'E')).toMatchObject({ numeral: '♭II', name: 'F' });
    expect(resolveStep('major:nope', 'C')).toBeUndefined();
    expect(resolveStep('IV', 'C')).toBeUndefined();
    expect(stepSpecs(['dorian:i', 'mixolydian:VII', 'major:I'], 'C')).toEqual([
      { pc: 0, quality: 'min' },
      { pc: 10, quality: 'maj' },
      { pc: 0, quality: 'maj' },
    ]);
  });

  it('find the chords on another map that sound the same', () => {
    expect(stepTwins('major:IV', 'mixolydian')).toEqual(['IV']);
    expect(stepTwins('mixolydian:VII', 'major')).toEqual(['bVII']); // borrowed there
    expect(stepTwins('lydian:vii', 'major')).toEqual([]); // no Bm in C major
    expect(stepTwins('major:vii', 'major')).toEqual(['vii']);
    expect(stepTwins('lydian:V', 'major')).toEqual(['V']);
  });

  it('follow the flow on the later chord’s map, and change mode freely', () => {
    expect(stepFollows('major:ii', 'major:V')).toBe(true);
    expect(stepFollows('major:V', 'major:IV')).toBe(false); // retrogression
    expect(stepFollows('major:IV', 'mixolydian:VII')).toBe(true); // IV ⇄ ♭VII in Mixolydian
    expect(stepFollows('mixolydian:I', 'dorian:IV')).toBe(true); // no I in Dorian: a change of mode
    expect(stepFollows('dorian:IV', 'minor:i')).toBe(true); // as melodic minor's IV, into i
    expect(stepRoad('major:IV', 'mixolydian:VII')).toEqual({ mode: 'mixolydian', from: 'IV', to: 'VII' });
    expect(stepRoad('mixolydian:I', 'dorian:IV')).toBeUndefined();
  });
});
