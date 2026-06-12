/**
 * A data structure defining notes by name (e.g C#) and octave (e.g. 4).
 * Supports conversion between name-note combinations and semitones,
 * and transposition of notes.
 */
export class Note {
    constructor(name, octave) {
        if (!Note.notesInOrder.includes(name)) {
            throw new Error(`Invalid note name: ${name}`);
        }
        if (octave < 1 || octave > 8) {
            throw new Error(`Invalid octave: ${octave}`);
        }
        this.name = name;
        this.octave = octave;
    }
    // Returns the index of the note in the scale.
    get semitoneIndex() {
        return Note.notesInOrder.indexOf(this.name);
    }
    // Calculates a total semitone value for the note (for comparison).
    get totalSemitones() {
        return (this.octave - 1) * 12 + this.semitoneIndex;
    }
    /**
     * Moves the note by the given number of semitones.
     * Returns a new Note instance that is the result.
     */
    move(semitones) {
        const newTotal = this.totalSemitones + semitones;
        // For this prototype, valid notes range from C1 (total 0) to B8 (total 95)
        if (newTotal < 0 || newTotal > ((8 - 1) * 12 + 11)) {
            throw new Error("Resulting note is out of valid range (C1 to B8)");
        }
        const newOctave = Math.floor(newTotal / 12) + 1;
        const newIndex = newTotal % 12;
        return new Note(Note.notesInOrder[newIndex], newOctave);
    }
    // Returns a string representation, e.g. "C4" or "F#5".
    toString() {
        return `${this.name}${this.octave}`;
    }
    // Creates a Note instance from a total semitone count.
    static fromTotalSemitones(total) {
        if (total < 0 || total > ((8 - 1) * 12 + 11)) {
            throw new Error("Total semitones out of valid range");
        }
        const octave = Math.floor(total / 12) + 1;
        const index = total % 12;
        return new Note(Note.notesInOrder[index], octave);
    }
    // Builds a scale from a starting note and a list of intervals.
    static buildScaleFromIntervals(startNote, intervals) {
        let scale = [startNote];
        let currentNote = startNote;
        for (let i = 0; i < intervals.length; i++) {
            currentNote = currentNote.move(intervals[i]);
            scale.push(currentNote);
        }
        return scale;
    }
}
// Define the order followed by all notes.
Note.notesInOrder = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
