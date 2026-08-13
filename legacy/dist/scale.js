/**
 * Represents a musical scale in terms of consecutive intervals.
 * Each of the scales can be built by providing a start note.
 */
export class Scale {
    /**
     * Builds a scale from a starting note and a list of intervals.
     */
    static buildScale(startNote, intervals) {
        let scale = [startNote];
        let currentNote = startNote;
        for (let interval of intervals) {
            currentNote = currentNote.move(interval);
            scale.push(currentNote);
        }
        return scale;
    }
}
// standard major/minor scales
Scale.major = [2, 2, 1, 2, 2, 2, 1];
Scale.minor = [2, 1, 2, 2, 1, 2, 2];
Scale.melodicMinor = [2, 1, 2, 2, 2, 2, 1];
Scale.harmonicMinor = [2, 1, 2, 2, 1, 3, 1];
Scale.harmonicMajor = [2, 2, 1, 2, 1, 3, 1];
// pentatonic and blues scales
Scale.pentatonicMajor = [2, 2, 3, 2, 3];
Scale.pentatonicMinor = [3, 2, 2, 3, 2];
Scale.bluesMajor = [2, 1, 1, 3, 2, 3];
Scale.bluesMinor = [3, 2, 1, 1, 3, 2];
// modes of the major scale
Scale.dorian = [2, 1, 2, 2, 2, 1, 2];
Scale.phrygian = [1, 2, 2, 2, 1, 2, 2];
Scale.lydian = [2, 2, 2, 1, 2, 2, 1];
Scale.mixolydian = [2, 2, 1, 2, 2, 1, 2];
Scale.locrian = [1, 2, 2, 1, 2, 2, 2];
// exotic and jazz scales
Scale.phrygianDominant = [1, 3, 1, 2, 1, 2, 2];
Scale.halfWholeDiminished = [1, 2, 1, 2, 1, 2, 1, 2];
Scale.altered = [1, 2, 1, 2, 2, 2, 2];
Scale.mixolydianFlat6 = [2, 2, 1, 2, 1, 2, 2];
// bebop scales
Scale.dominantBebop = [2, 2, 1, 2, 2, 1, 1, 1];
Scale.majorBebop = [2, 2, 1, 2, 1, 1, 2, 1];
Scale.minorBebop = [2, 1, 2, 2, 1, 2, 1, 1];
// chromatic scale
Scale.chromatic = Array(12).fill(1);
/**
 * Scale patterns as semitone positions from root (for Circle of Fifths)
 * These represent absolute semitone positions rather than intervals
 */
Scale.scalePatterns = {
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
