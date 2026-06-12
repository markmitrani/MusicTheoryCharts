/**
 * Defines harmonic properties for scales and modes.
 * Includes Roman numeral notation and chord qualities for each degree.
 */
export interface ModeHarmony {
    name: string;
    numerals: string[];
    qualities: string[];
}

export class ScaleHarmonies {
    static modeDefinitions: { [key: string]: ModeHarmony } = {
        major: {
            name: 'Major',
            numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
            qualities: ['', 'm', 'm', '', '', 'm', 'dim']
        },
        harmonicMajor: {
            name: 'Harmonic Major',
            numerals: ['I', 'ii°', 'iii', 'ivm', 'V', '♭VI+', 'vii°'],
            qualities: ['', 'dim', 'm', 'm', '', 'aug', 'dim']
        },
        minor: {
            name: 'Natural Minor',
            numerals: ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'],
            qualities: ['m', 'dim', '', 'm', 'm', '', '']
        },
        harmonicMinor: {
            name: 'Harmonic Minor',
            numerals: ['i', 'ii°', '♭III+', 'iv', 'V', '♭VI', 'vii°'],
            qualities: ['m', 'dim', 'aug', 'm', '', '', 'dim']
        },
        melodicMinor: {
            name: 'Melodic Minor',
            numerals: ['i', 'ii', '♭III+', 'IV', 'V', 'vi°', 'vii°'],
            qualities: ['m', 'm', 'aug', '', '', 'dim', 'dim']
        },
        dorian: {
            name: 'Dorian',
            numerals: ['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII'],
            qualities: ['m', 'm', '', '', 'm', 'dim', '']
        },
        phrygian: {
            name: 'Phrygian',
            numerals: ['i', '♭II', '♭III', 'iv', 'v°', '♭VI', '♭vii'],
            qualities: ['m', '', '', 'm', 'dim', '', 'm']
        },
        lydian: {
            name: 'Lydian',
            numerals: ['I', 'II', 'iii', '♯iv°', 'V', 'vi', 'vii'],
            qualities: ['', '', 'm', 'dim', '', 'm', 'm']
        },
        mixolydian: {
            name: 'Mixolydian',
            numerals: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', '♭VII'],
            qualities: ['', 'm', 'dim', '', 'm', 'm', '']
        },
        phrygianDominant: {
            name: 'Phrygian Dominant',
            numerals: ['I', '♭II', 'III', 'iv', 'v°', '♭VI', '♭vii'],
            qualities: ['', '', '', 'm', 'dim', '', 'm']
        },
        halfWholeDiminished: {
            name: 'Half-Whole Diminished',
            numerals: ['i°', '♭ii°', '♭iii°', '♭iv°', '♭v°', '♭vi°', '♭vii°'],
            qualities: ['dim', 'dim', 'dim', 'dim', 'dim', 'dim', 'dim']
        },
        altered: {
            name: 'Altered',
            numerals: ['i°', '♭II', '♭iii', 'iv', '♭v', '♭VI', '♭vii'],
            qualities: ['dim', '', 'm', 'm', 'm', '', 'm']
        },
        mixolydianFlat6: {
            name: 'Mixolydian ♭6',
            numerals: ['I', 'ii', 'iii°', 'IV', 'v', '♭VI', '♭VII'],
            qualities: ['', 'm', 'dim', '', 'm', '', '']
        }
    };
}
