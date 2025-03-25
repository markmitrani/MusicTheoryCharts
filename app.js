/**
 * Represents a musical note with an octave.
 */
var Note = /** @class */ (function () {
    function Note(name, octave) {
        if (!Note.scale.includes(name)) {
            throw new Error("Invalid note name: ".concat(name));
        }
        if (octave < 1 || octave > 8) {
            throw new Error("Invalid octave: ".concat(octave));
        }
        this.name = name;
        this.octave = octave;
    }
    Object.defineProperty(Note.prototype, "semitoneIndex", {
        // Returns the index of the note in the scale.
        get: function () {
            return Note.scale.indexOf(this.name);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Note.prototype, "totalSemitones", {
        // Calculates a total semitone value for the note (for comparison).
        get: function () {
            return (this.octave - 1) * 12 + this.semitoneIndex;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Moves the note by the given number of semitones.
     * Returns a new Note instance that is the result.
     */
    Note.prototype.move = function (semitones) {
        var newTotal = this.totalSemitones + semitones;
        // For this prototype, valid notes range from C1 (total 0) to B8 (total 95)
        if (newTotal < 0 || newTotal > ((8 - 1) * 12 + 11)) {
            throw new Error("Resulting note is out of valid range (C1 to B8)");
        }
        var newOctave = Math.floor(newTotal / 12) + 1;
        var newIndex = newTotal % 12;
        return new Note(Note.scale[newIndex], newOctave);
    };
    // Returns a string representation, e.g. "C4" or "F#5".
    Note.prototype.toString = function () {
        return "".concat(this.name).concat(this.octave);
    };
    // Creates a Note instance from a total semitone count.
    Note.fromTotalSemitones = function (total) {
        if (total < 0 || total > ((8 - 1) * 12 + 11)) {
            throw new Error("Total semitones out of valid range");
        }
        var octave = Math.floor(total / 12) + 1;
        var index = total % 12;
        return new Note(Note.scale[index], octave);
    };
    // Define the chromatic scale. (Order: C, C#, D, etc.)
    Note.scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return Note;
}());
/**
 * Generates a visual representation of a piano roll.
 */
var PianoRollGenerator = /** @class */ (function () {
    function PianoRollGenerator(containerId) {
        var container = document.getElementById(containerId);
        if (!container) {
            throw new Error("Container with id '".concat(containerId, "' not found."));
        }
        this.container = container;
    }
    // Clears the piano roll container.
    PianoRollGenerator.prototype.clearContainer = function () {
        this.container.innerHTML = "";
    };
    // Creates a visual key element for a given Note.
    PianoRollGenerator.prototype.createKeyElement = function (note) {
        var keyEl = document.createElement("div");
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
    };
    /**
     * Generates the basic piano roll.
     * Renders a standard one-octave setup from C4 to C5.
     */
    PianoRollGenerator.prototype.generateRollBasic = function () {
        this.clearContainer();
        var startNote = new Note("C", 4);
        var endNote = new Note("C", 5);
        for (var semitones = startNote.totalSemitones; semitones <= endNote.totalSemitones; semitones++) {
            var note = Note.fromTotalSemitones(semitones);
            var keyEl = this.createKeyElement(note);
            this.container.appendChild(keyEl);
        }
    };
    /**
     * Generates a piano roll for the given range.
     * Validates that the start note is lower than the end note.
     */
    PianoRollGenerator.prototype.generateRollRange = function (start, end) {
        if (start.totalSemitones >= end.totalSemitones) {
            throw new Error("Start note must be lower than end note.");
        }
        this.clearContainer();
        for (var semitones = start.totalSemitones; semitones <= end.totalSemitones; semitones++) {
            var note = Note.fromTotalSemitones(semitones);
            var keyEl = this.createKeyElement(note);
            this.container.appendChild(keyEl);
        }
    };
    return PianoRollGenerator;
}());
