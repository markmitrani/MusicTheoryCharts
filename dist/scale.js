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
// pentatonic and blues scales
Scale.pentatonicMajor = [2, 2, 3, 2, 3];
Scale.pentatonicMinor = [3, 2, 2, 3, 2];
Scale.bluesMajor = [2, 1, 1, 3, 2, 3];
Scale.bluesMinor = [3, 2, 1, 1, 3, 2];
// modes of the major scale
Scale.ionian = Scale.major; // Same as major
Scale.dorian = [2, 1, 2, 2, 2, 1, 2];
Scale.phrygian = [1, 2, 2, 2, 1, 2, 2];
Scale.lydian = [2, 2, 2, 1, 2, 2, 1];
Scale.mixolydian = [2, 2, 1, 2, 2, 1, 2];
Scale.aeolian = Scale.minor; // Same as minor
Scale.locrian = [1, 2, 2, 1, 2, 2, 2];
// chromatic scale
Scale.chromatic = Array(12).fill(1);
