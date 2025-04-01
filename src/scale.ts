import { Note } from "./note.js";

/**
 * Represents a musical scale in terms of consecutive intervals.
 * Each of the scales can be built by providing a start note.
 */
export class Scale {
    // standard major/minor scales
    static major = [2, 2, 1, 2, 2, 2, 1];
    static minor = [2, 1, 2, 2, 1, 2, 2];

    // pentatonic and blues scales
    static pentatonicMajor = [2, 2, 3, 2, 3];
    static pentatonicMinor = [3, 2, 2, 3, 2];
    static bluesMajor = [2, 1, 1, 3, 2, 3];
    static bluesMinor = [3, 2, 1, 1, 3, 2];

    // modes of the major scale
    static ionian = Scale.major; // Same as major
    static dorian = [2, 1, 2, 2, 2, 1, 2];
    static phrygian = [1, 2, 2, 2, 1, 2, 2];
    static lydian = [2, 2, 2, 1, 2, 2, 1];
    static mixolydian = [2, 2, 1, 2, 2, 1, 2];
    static aeolian = Scale.minor; // Same as minor
    static locrian = [1, 2, 2, 1, 2, 2, 2];

    // chromatic scale
    static chromatic = Array(12).fill(1);

    /**
     * Builds a scale from a starting note and a list of intervals.
     */
    static buildScale(startNote: Note, intervals: number[]): Note[] {
        let scale = [startNote];
        let currentNote = startNote;
        for (let interval of intervals) {
            currentNote = currentNote.move(interval);
            scale.push(currentNote);
        }
        return scale;
    }
}