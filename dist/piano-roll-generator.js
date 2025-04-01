import { Note } from "./note.js";
/**
 * Generates a visual representation of a piano roll.
 */
export class PianoRollGenerator {
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
    /**
     * Creates an HTML key element for a note.
     * @param note Note to be represented.
     * @param labeled If true, the note will be labeled with its name.
     * @returns A key element for the note.
     */
    createKeyElement(note, label) {
        const keyEl = document.createElement("div");
        keyEl.classList.add("key");
        // Determine key color based on the note name.
        if (note.name.includes("#")) {
            keyEl.classList.add("black-key");
        }
        else {
            keyEl.classList.add("white-key");
        }
        if (label) {
            keyEl.textContent = note.toString();
        }
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
            const keyEl = this.createKeyElement(note, true);
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
            const keyEl = this.createKeyElement(note, true);
            this.container.appendChild(keyEl);
        }
    }
    /**
     * Generates a piano roll for the given range with highlighted notes.
     * @param start Beginning note of the range.
     * @param end Ending note of the range.
     * @param highlightNotes List of notes to be highlighted.
     * @param labels If true, notes will be labeled with their names.
     */
    generateRollRangeWithHighlight(start, end, highlightNotes, labels) {
        if (start.totalSemitones >= end.totalSemitones) {
            throw new Error("Start note must be lower than end note.");
        }
        this.clearContainer();
        for (let semitones = start.totalSemitones; semitones <= end.totalSemitones; semitones++) {
            const note = Note.fromTotalSemitones(semitones);
            const keyEl = this.createKeyElement(note, labels);
            if (highlightNotes.some(n => n.totalSemitones === semitones)) {
                keyEl.classList.add("highlight");
            }
            this.container.appendChild(keyEl);
        }
    }
}
