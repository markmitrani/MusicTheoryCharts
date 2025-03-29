import { Note } from "./note.js";

/**
 * Generates a visual representation of a piano roll.
 */
export class PianoRollGenerator {
  container: HTMLElement;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id '${containerId}' not found.`);
    }
    this.container = container;
  }

  // Clears the piano roll container.
  clearContainer(): void {
    this.container.innerHTML = "";
  }

  // Creates a visual key element for a given Note.
  createKeyElement(note: Note): HTMLElement {
    const keyEl = document.createElement("div");
    keyEl.classList.add("key");
    // Determine key color based on the note name.
    if (note.name.includes("#")) {
      keyEl.classList.add("black-key");
    } else {
      keyEl.classList.add("white-key");
    }
    keyEl.textContent = note.toString();
    return keyEl;
  }

  /**
   * Generates the basic piano roll.
   * Renders a standard one-octave setup from C4 to C5.
   */
  generateRollBasic(): void {
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
  generateRollRange(start: Note, end: Note): void {
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

  /**
   * Generates a piano roll for the given range with the listed notes highlighted.
   */
  generateRollRangeWithHighlight(start: Note, end: Note, highlightNotes: Note[]): void {
    if (start.totalSemitones >= end.totalSemitones) {
      throw new Error("Start note must be lower than end note.");
    }
    this.clearContainer();
    for (let semitones = start.totalSemitones; semitones <= end.totalSemitones; semitones++) {
      const note = Note.fromTotalSemitones(semitones);
      const keyEl = this.createKeyElement(note);
      if (highlightNotes.some(n => n.totalSemitones === semitones)) {
        keyEl.classList.add("highlight");
      }
      this.container.appendChild(keyEl);
    }
  }
}
