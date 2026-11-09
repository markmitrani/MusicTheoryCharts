import type { NoteName } from './note';
import { NOTE_NAMES } from './note';
import { getChordDef } from './chords';
import { mod12 } from './cadence';
import {
  followsFlow,
  homeId,
  isGroup,
  mapChords,
  mapMoves,
  resolveChord,
  spellFrom,
  type ProgressionMap,
  type ResolvedChord,
} from './progressions';

/**
 * Portals: chords off the map that lead into it, opening a key up. Secondary
 * dominants lead into the map's chords; one the map already has as a borrowed
 * chord keeps its arrow (unless a road carries it) instead of a copy. Tritone
 * subs stand in for a dominant, sliding a half step down into the same chord.
 */

export type PortalKind = 'secondary' | 'tritone';

export interface PortalChord extends ResolvedChord {
  kind: 'secondary' | 'tritone';
  /** Map chord ids it resolves into (perfect for a dominant, half step down for a sub). */
  into: string[];
  /** A sub's dominant: a portal chord or a map chord id. */
  standsFor?: string;
}

export interface PortalMove {
  from: string;
  to: string;
  kind: PortalKind;
}

export interface Portals {
  chords: PortalChord[];
  moves: PortalMove[];
}

const label = (rootName: string, quality: string) => `${rootName}${getChordDef(quality).label}`;

export function mapPortals(
  map: ProgressionMap,
  root: NoteName,
  sevenths: boolean,
  borrowed: boolean,
  kinds: PortalKind[],
): Portals {
  const on = new Set(kinds);
  const shown = mapChords(map).filter((ch) => borrowed || !map.borrowed.includes(ch as never));
  const triads = shown.map((ch) => resolveChord(map, ch, root, false));
  const has = (pc: number, quality: string) => triads.find((r) => r.pc === pc && r.quality === quality);
  const rootPc = NOTE_NAMES.indexOf(root);
  const roads = mapMoves(map, borrowed);
  const lent = new Set(map.borrowed.map((bc) => bc.id));
  // A borrowed chord stands in for its slot's chords and goes where they go, so a
  // dominant into both draws one arrow: to the stand-in when its twin is a
  // bracket's lower chord (below the line, as the stand-in is), else to the twin.
  const lower = new Set(map.spine.flatMap((s) => (isGroup(s) ? [s.bottom.id] : [])));
  const twinsOf = (id: string) => {
    const bc = map.borrowed.find((b) => b.id === id);
    const slot = bc && map.spine.find((s) => s.id === bc.slot);
    return !slot ? [] : isGroup(slot) ? [slot.top.id, slot.bottom.id] : [slot.id];
  };
  const prune = (into: string[]) =>
    into.filter((id) => {
      const standIn = into.find((l) => twinsOf(l).includes(id));
      if (standIn) return !lower.has(id);
      return !twinsOf(id).some((t) => into.includes(t) && !lower.has(t));
    });
  const chords: PortalChord[] = [];
  const moves: PortalMove[] = [];

  // Secondary dominants: a major chord a fifth above each major or minor chord.
  const doms = new Map<number, PortalChord>();
  const borrowedDoms = new Map<string, { chord: ResolvedChord; into: string[] }>();
  if (on.has('secondary')) {
    for (const t of triads) {
      if (t.quality !== 'maj' && t.quality !== 'min') continue;
      const pc = mod12(t.pc + 7);
      const there = has(pc, 'maj');
      if (there) {
        if (lent.has(there.id) && !followsFlow(map, roads, there.id, t.id)) {
          const known = borrowedDoms.get(there.id) ?? { chord: there, into: [] };
          known.into.push(t.id);
          borrowedDoms.set(there.id, known);
        }
        continue;
      }
      const known = doms.get(pc);
      if (known) {
        known.into.push(t.id);
        continue;
      }
      const quality = sevenths ? '7' : 'maj';
      const d: PortalChord = {
        id: `sd${pc}`,
        kind: 'secondary',
        numeral: '',
        name: '',
        quality,
        pc,
        colour: false,
        borrowed: false,
        into: [t.id],
      };
      doms.set(pc, d);
      chords.push(d);
    }
    // Named after the first chord it leads into, once the twins are settled.
    for (const d of doms.values()) {
      d.into = prune(d.into);
      const t = triads.find((r) => r.id === d.into[0])!;
      d.numeral = `${sevenths ? 'V7' : 'V'}/${t.numeral}`;
      d.name = label(spellFrom(t.name, 4, mod12(rootPc + d.pc)), d.quality);
    }
    for (const d of borrowedDoms.values()) d.into = prune(d.into);
    for (const d of doms.values()) for (const to of d.into) moves.push({ from: d.id, to, kind: 'secondary' });
    for (const { chord, into } of borrowedDoms.values())
      for (const to of into) moves.push({ from: chord.id, to, kind: 'secondary' });
  }

  // Tritone subs: for the map's own V of home and every secondary dominant shown.
  if (on.has('tritone')) {
    const home = triads.find((r) => r.id === homeId(map))!;
    const primary = has(mod12(home.pc + 7), 'maj');
    const dominants: Array<{ id: string; pc: number; into: string[]; target: ResolvedChord }> = [];
    if (primary) dominants.push({ id: primary.id, pc: primary.pc, into: [home.id], target: home });
    for (const d of doms.values())
      dominants.push({ id: d.id, pc: d.pc, into: d.into, target: triads.find((r) => r.id === d.into[0])! });
    for (const { chord, into } of borrowedDoms.values()) {
      dominants.push({ id: chord.id, pc: chord.pc, into, target: triads.find((r) => r.id === into[0])! });
    }
    for (const dom of dominants) {
      const pc = mod12(dom.pc + 6);
      const s: PortalChord = {
        id: `ts${pc}`,
        kind: 'tritone',
        numeral: dom.target.id === home.id ? '♭II7' : `♭II7/${dom.target.numeral}`,
        name: label(spellFrom(dom.target.name, 1, mod12(rootPc + pc)), '7'),
        quality: '7',
        pc,
        colour: false,
        borrowed: false,
        into: dom.into,
        standsFor: dom.id,
      };
      chords.push(s);
      for (const to of s.into) moves.push({ from: s.id, to, kind: 'tritone' });
    }
  }
  return { chords, moves };
}
