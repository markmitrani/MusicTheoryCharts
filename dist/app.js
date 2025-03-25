/**
 * Represents a musical note with an octave.
 */
class Note {
    constructor(name, octave) {
        if (!Note.scale.includes(name)) {
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
        return Note.scale.indexOf(this.name);
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
        return new Note(Note.scale[newIndex], newOctave);
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
        return new Note(Note.scale[index], octave);
    }
}
// Define the chromatic scale. (Order: C, C#, D, etc.)
Note.scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/**
 * Generates a visual representation of a piano roll.
 */
class PianoRollGenerator {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id '${containerId}' not found.`);
        }
        this.container = container;
    }
    // Clears the piano roll container.
    clearContainer() {
        this.container.innerHTML = "";
    }
    // Creates a visual key element for a given Note.
    createKeyElement(note) {
        const keyEl = document.createElement("div");
        keyEl.classList.add("key");
        // Determine key color based on the note name.
        if (note.name.includes("#")) {
            keyEl.classList.add("black-key");
        }
        else {
            keyEl.classList.add("white-key");
        }
        keyEl.textContent = note.toString();
        return keyEl;
    }
    /**
     * Generates the basic piano roll.
     * Renders a standard one-octave setup from C4 to C5.
     */
    generateRollBasic() {
        this.clearContainer();
        const startNote = new Note("C", 4);
        const endNote = new Note("C", 5);
        for (let semitones = startNote.totalSemitones; semitones <= endNote.totalSemitones; semitones++) {
            const note = Note.fromTotalSemitones(semitones);
            const keyEl = this.createKeyElement(note);
            this.container.appendChild(keyEl);
        }
    }
    /**
     * Generates a piano roll for the given range.
     * Validates that the start note is lower than the end note.
     */
    generateRollRange(start, end) {
        if (start.totalSemitones >= end.totalSemitones) {
            throw new Error("Start note must be lower than end note.");
        }
        this.clearContainer();
        for (let semitones = start.totalSemitones; semitones <= end.totalSemitones; semitones++) {
            const note = Note.fromTotalSemitones(semitones);
            const keyEl = this.createKeyElement(note);
            this.container.appendChild(keyEl);
        }
    }
}
