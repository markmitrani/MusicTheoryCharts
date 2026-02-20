import { Note } from "./note.js";
import { Scale } from "./scale.js";
import { ScaleHarmonies } from "./scale-harmonies.js";
import { PianoRollGenerator } from "./piano-roll-generator.js";
/**
 * Circle of Fifths data and logic for harmony visualization
 */
export class CircleOfFifths {
    constructor(pianoRollContainerId) {
        this.currentKeyIndex = 0;
        this.activeModes = [];
        this.currentRotation = 0;
        this.pianoRollGenerator = new PianoRollGenerator(pianoRollContainerId);
    }
    getNote(rootIndex, interval) {
        const noteIndex = (rootIndex + interval) % 12;
        let note = CircleOfFifths.chromaticScale[noteIndex];
        const root = CircleOfFifths.keys[this.currentKeyIndex];
        if (note.includes('/')) {
            const [sharp, flat] = note.split('/');
            if (root.includes('♯') || ['G', 'D', 'A', 'E', 'B'].includes(root)) {
                note = sharp;
            }
            else {
                note = flat;
            }
        }
        return note;
    }
    buildChord(note, quality) {
        if (quality === 'm')
            return note + 'm';
        if (quality === 'dim')
            return note + 'dim';
        if (quality === 'aug')
            return note + '+';
        return note;
    }
    getChordType(quality) {
        if (quality === 'm')
            return 'minor';
        if (quality === 'dim')
            return 'diminished';
        if (quality === 'aug')
            return 'augmented';
        return 'major';
    }
    generateChords(modeName) {
        const mode = ScaleHarmonies.modeDefinitions[modeName];
        const pattern = Scale.scalePatterns[modeName];
        const root = CircleOfFifths.keys[this.currentKeyIndex];
        let rootIndex = CircleOfFifths.chromaticScale.findIndex(n => {
            if (n.includes('/')) {
                return n.split('/').some(x => root.includes(x));
            }
            return n === root || root.includes(n);
        });
        const chords = [];
        for (let i = 0; i < 7; i++) {
            const note = this.getNote(rootIndex, pattern[i]);
            const chord = this.buildChord(note, mode.qualities[i]);
            chords.push({
                name: chord,
                numeral: mode.numerals[i],
                type: this.getChordType(mode.qualities[i])
            });
        }
        return chords;
    }
    generateScalePianoRoll(modeName) {
        const mode = ScaleHarmonies.modeDefinitions[modeName];
        const pattern = Scale.scalePatterns[modeName];
        const root = CircleOfFifths.keys[this.currentKeyIndex];
        // Convert root to Note format
        const rootNote = new Note(root.replace('♯', '#').replace('♭', 'b').split('/')[0], 4);
        // Build scale notes
        const scaleNotes = Note.buildScaleFromIntervals(rootNote, this.getIntervalsFromPattern(pattern));
        // Generate piano roll
        const startNote = scaleNotes[0];
        const endNote = scaleNotes[scaleNotes.length - 1];
        this.pianoRollGenerator.generateRollRangeWithHighlight(startNote, endNote, scaleNotes, true);
    }
    getIntervalsFromPattern(pattern) {
        const intervals = [];
        for (let i = 1; i < pattern.length; i++) {
            intervals.push(pattern[i] - pattern[i - 1]);
        }
        return intervals;
    }
}
CircleOfFifths.keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯/G♭', 'C♯/D♭', 'G♯/A♭', 'D♯/E♭', 'A♯/B♭', 'F'];
CircleOfFifths.chromaticScale = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
