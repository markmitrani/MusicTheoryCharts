import * as Tone from 'tone';
import { gsap } from 'gsap';
import { NOTE_NAMES } from '@/lib/theory/note';
import type { SoundId } from '@/lib/canvas-store/store';
import type { AudioSink } from '@/lib/playback/playback';

/**
 * Warm, bassy pad voice for element playback, modeled on the reference
 * audio.js graph: fat detuned saws → slowly wandering lowpass → chorus →
 * long reverb → limiter. A sine sub doubles the bass note of chords an
 * octave down. GSAP drives gain ramps so audio shares the visual easing.
 */
const toneNote = (pitch: number) => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) + 1}`;

class AudioEngine implements AudioSink {
  private started = false;
  private starting = false;
  private volume = 0.9;
  private muted = false;
  private sound: SoundId = 'pad';

  private master: Tone.Gain;
  private limiter: Tone.Limiter;
  // Time-domain tap on the master bus for the harmonics visualizer.
  private waveform: Tone.Waveform;
  private reverb: Tone.Reverb;
  private reverbSend: Tone.Gain;
  private padFilter: Tone.Filter;
  private padFilterLFO: Tone.LFO;
  private chorus: Tone.Chorus;
  private pad: Tone.PolySynth<Tone.Synth>;
  private sub: Tone.Synth;
  private pluck: Tone.Synth;
  // Piano voice: a real sampled grand (Salamander samples, bundled under
  // /public) pushed through a short modulated delay (flanger) and the shared
  // reverb for an expansive shimmer.
  private pianoFlanger: Tone.Chorus;
  private piano: Tone.Sampler;

  constructor() {
    this.master = new Tone.Gain(this.volume);
    this.limiter = new Tone.Limiter(-3);
    this.master.chain(this.limiter, Tone.getDestination());

    // Analyser branch (does not affect the audio path). Tapped on the DRY
    // voices below — not the master — so the long reverb tail doesn't keep the
    // harmonics wave alive for seconds after a note ends.
    this.waveform = new Tone.Waveform(1024);

    this.reverb = new Tone.Reverb({ decay: 7, preDelay: 0.04, wet: 1 });
    this.reverbSend = new Tone.Gain(0.3).connect(this.reverb);
    this.reverb.connect(this.master);

    this.padFilter = new Tone.Filter(750, 'lowpass', -24);
    this.padFilterLFO = new Tone.LFO({ frequency: 0.045, min: 550, max: 950 });
    this.padFilterLFO.connect(this.padFilter.frequency);
    this.chorus = new Tone.Chorus({ frequency: 0.18, delayTime: 6, depth: 0.55, wet: 0.5 });

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
      envelope: { attack: 0.04, decay: 0.3, sustain: 0.55, release: 1.2 },
    });
    this.pad.volume.value = -8;
    this.pad.chain(this.padFilter, this.chorus, this.master);
    this.chorus.connect(this.reverbSend);

    this.sub = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 1.0 },
    });
    this.sub.volume.value = -14;
    this.sub.connect(this.master);

    // Piano: short flanger (fast LFO, tiny delay) + reverb send for space.
    this.pianoFlanger = new Tone.Chorus({
      frequency: 0.7,
      delayTime: 3.5,
      depth: 0.7,
      spread: 180,
      wet: 0.35,
    });
    this.piano = new Tone.Sampler({
      urls: {
        A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', A1: 'A1.mp3',
        C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3',
        C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3',
        C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
        C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
        C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3',
        C7: 'C7.mp3',
      },
      baseUrl: '/samples/piano/',
      release: 1.1,
    });
    this.piano.volume.value = -7;
    this.piano.chain(this.pianoFlanger, this.master);
    this.pianoFlanger.connect(this.reverbSend);

    // Feed the analyser the dry voices only (post-chorus/flanger, pre-reverb),
    // so the harmonics wave tracks the notes and fades with their release.
    this.chorus.connect(this.waveform);
    this.pianoFlanger.connect(this.waveform);
    this.sub.connect(this.waveform);

    // barely-there triangle pluck for chrome interactions (reference ui.js feel)
    this.pluck = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.22, sustain: 0, release: 0.3 },
    });
    this.pluck.volume.value = -18;
    this.pluck.connect(this.master);
    this.pluck.connect(this.reverbSend);
  }

  /** Must resolve from a user gesture before any trigger makes sound. */
  async ensureStarted() {
    if (this.started || this.starting) return;
    this.starting = true;
    try {
      await Tone.start();
      await this.reverb.ready;
      // Wait for the piano sample buffers so the first piano note isn't dropped.
      await Tone.loaded();
      this.padFilterLFO.start();
      this.chorus.start();
      this.pianoFlanger.start();
      this.started = true;
    } finally {
      this.starting = false;
    }
  }

  setSound(sound: SoundId) {
    this.sound = sound;
  }

  /** Latest time-domain samples (-1..1) from the master bus; ~silence when idle. */
  getWaveform(): Float32Array {
    return this.waveform.getValue() as Float32Array;
  }

  /** The polyphonic voice for the active sound (pad synth or sampled piano). */
  private get voice(): Tone.PolySynth<Tone.Synth> | Tone.Sampler {
    return this.sound === 'piano' ? this.piano : this.pad;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    gsap.to(this.master.gain, {
      value: muted ? 0 : this.volume,
      duration: 0.5,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }

  /** New playback taking over: release held notes so tails cross-fade. */
  interrupt() {
    if (!this.started) return;
    this.pad.releaseAll(Tone.now());
    this.piano.releaseAll(Tone.now());
    this.sub.triggerRelease(Tone.now());
  }

  triggerNote(pitch: number, durationMs: number, velocity = 0.7) {
    if (!this.started || this.muted) return;
    this.voice.triggerAttackRelease(toneNote(pitch), durationMs / 1000, Tone.now(), velocity);
  }

  uiTick(step: number) {
    if (!this.started || this.muted) return;
    // A-major pentatonic, like the reference interaction sounds
    const notes = ['A4', 'B4', 'C#5', 'E5', 'F#5'];
    this.pluck.triggerAttackRelease(notes[((step % 5) + 5) % 5], 0.12, Tone.now(), 0.35);
  }

  triggerChord(pitches: number[], durationMs: number) {
    if (!this.started || this.muted) return;
    const now = Tone.now();
    const dur = durationMs / 1000;
    this.voice.triggerAttackRelease(pitches.map(toneNote), dur, now, 0.62);
    // sine sub doubles the bass note an octave down for warmth (pad only)
    if (this.sound === 'pad') {
      const bass = Math.min(...pitches) - 12;
      if (bass >= 0) this.sub.triggerAttackRelease(toneNote(bass), dur, now, 0.8);
    }
  }
}

let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as unknown as { __audioEngine?: AudioEngine }).__audioEngine = engine;
  }
  return engine;
}

/** The engine if it already exists — never constructs one (for visualizers). */
export function peekAudioEngine(): AudioEngine | null {
  return engine;
}
