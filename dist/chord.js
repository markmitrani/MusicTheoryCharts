import { Note } from "./note.js";
/**
 * Chord utilities for building triads from a scale.
 */
export class Chord {
    /**
     * Builds all triads of a scale:
     * - Uses the scale degrees excluding the final repeated octave root.
     * - For each degree i, triad degrees are i, i+2, i+4 (mod N).
     * - If an index wraps (modulo back to beginning), the note's octave is incremented by +1.
     */
    static buildTriadsFromScale(scale) {
        if (!scale || scale.length < 4) {
            throw new Error("Scale must contain at least 4 notes (including the octave).");
        }
        // Remove the final repeated root (octave) if present.
        const degrees = Chord.getScaleDegreesWithoutRepeatedRoot(scale);
        const n = degrees.length;
        if (n < 3) {
            throw new Error("Scale must have at least 3 unique degrees to build triads.");
        }
        const triads = [];
        for (let i = 0; i < n; i++) {
            triads.push(Chord.buildTriadAtDegree(degrees, i));
        }
        return triads;
    }
    /**
     * Builds a triad rooted at `rootDegreeIndex` (0-based) from the provided scale degrees.
     * Triad notes: degree i, i+2, i+4 (mod N), with octave bump on wrapped degrees.
     */
    static buildTriadAtDegree(scaleDegrees, rootDegreeIndex) {
        const n = scaleDegrees.length;
        if (rootDegreeIndex < 0 || rootDegreeIndex >= n) {
            throw new Error(`rootDegreeIndex out of range: ${rootDegreeIndex}`);
        }
        const i1 = rootDegreeIndex;
        const i3 = (rootDegreeIndex + 2) % n;
        const i5 = (rootDegreeIndex + 4) % n;
        const root = Chord.cloneNote(scaleDegrees[i1]);
        const third = Chord.cloneNoteWithWrapOctave(scaleDegrees[i3], i3 < i1);
        const fifth = Chord.cloneNoteWithWrapOctave(scaleDegrees[i5], i5 < i1);
        return [root, third, fifth];
    }
    static getScaleDegreesWithoutRepeatedRoot(scale) {
        if (scale.length < 2)
            return [...scale];
        const last = scale[scale.length - 1];
        const first = scale[0];
        // If last note is the same pitch class as first and exactly one octave higher, drop it.
        const isRepeatedOctaveRoot = last.name === first.name &&
            last.octave === first.octave + 1;
        return isRepeatedOctaveRoot ? scale.slice(0, -1) : [...scale];
    }
    static cloneNote(note) {
        return new Note(note.name, note.octave);
    }
    static cloneNoteWithWrapOctave(note, wrapped) {
        return new Note(note.name, wrapped ? note.octave + 1 : note.octave);
    }
}
