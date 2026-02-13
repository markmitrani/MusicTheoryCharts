import { Note } from "./note.js";

/**
 * Represents a musical scale in terms of consecutive intervals.
 * Each of the scales can be built by providing a start note.
 */
export class Scale {
    // standard major/minor scales
    static major = [2, 2, 1, 2, 2, 2, 1];
    static minor = [2, 1, 2, 2, 1, 2, 2];
    static melodicMinor = [2, 1, 2, 2, 2, 2, 1];
    static harmonicMinor = [2, 1, 2, 2, 1, 3, 1];
    static harmonicMajor = [2, 2, 1, 2, 1, 3, 1];

    // pentatonic and blues scales
    static pentatonicMajor = [2, 2, 3, 2, 3];
    static pentatonicMinor = [3, 2, 2, 3, 2];
    static bluesMajor = [2, 1, 1, 3, 2, 3];
    static bluesMinor = [3, 2, 1, 1, 3, 2];

    // modes of the major scale
    static dorian = [2, 1, 2, 2, 2, 1, 2];
    static phrygian = [1, 2, 2, 2, 1, 2, 2];
    static lydian = [2, 2, 2, 1, 2, 2, 1];
    static mixolydian = [2, 2, 1, 2, 2, 1, 2];
    static locrian = [1, 2, 2, 1, 2, 2, 2];

    // exotic and jazz scales
    static phrygianDominant = [1, 3, 1, 2, 1, 2, 2];
    static halfWholeDiminished = [1, 2, 1, 2, 1, 2, 1, 2];
    static altered = [1, 2, 1, 2, 2, 2, 2];
    static mixolydianFlat6 = [2, 2, 1, 2, 1, 2, 2];

    // bebop scales
    static dominantBebop = [2, 2, 1, 2, 2, 1, 1, 1];
    static majorBebop = [2, 2, 1, 2, 1, 1, 2, 1];
    static minorBebop = [2, 1, 2, 2, 1, 2, 1, 1];

    // chromatic scale
    static chromatic = Array(12).fill(1);

    /**
     * Scale patterns as semitone positions from root (for Circle of Fifths)
     * These represent absolute semitone positions rather than intervals
     */
    static scalePatterns: { [key: string]: number[] } = {
        major: [0, 2, 4, 5, 7, 9, 11],
        harmonicMajor: [0, 2, 4, 5, 7, 8, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
        melodicMinor: [0, 2, 3, 5, 7, 9, 11],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        phrygian: [0, 1, 3, 5, 7, 8, 10],
        lydian: [0, 2, 4, 6, 7, 9, 11],
        mixolydian: [0, 2, 4, 5, 7, 9, 10],
        phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
        halfWholeDiminished: [0, 1, 3, 4, 6, 7, 9],
        altered: [0, 1, 3, 4, 6, 8, 10],
        mixolydianFlat6: [0, 2, 4, 5, 7, 8, 10]
    };

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