import * as Tone from 'tone';
import { gsap } from 'gsap';
import { NOTE_NAMES } from '@/lib/theory/note';
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

  private master: Tone.Gain;
  private limiter: Tone.Limiter;
  private reverb: Tone.Reverb;
  private reverbSend: Tone.Gain;
  private padFilter: Tone.Filter;
  private padFilterLFO: Tone.LFO;
  private chorus: Tone.Chorus;
  private pad: Tone.PolySynth<Tone.Synth>;
  private sub: Tone.Synth;
  private pluck: Tone.Synth;

  constructor() {
    this.master = new Tone.Gain(this.volume);
    this.limiter = new Tone.Limiter(-3);
    this.master.chain(this.limiter, Tone.getDestination());

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
      this.padFilterLFO.start();
      this.chorus.start();
      this.started = true;
    } finally {
      this.starting = false;
    }
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
    this.sub.triggerRelease(Tone.now());
  }

  triggerNote(pitch: number, durationMs: number, velocity = 0.7) {
    if (!this.started || this.muted) return;
    this.pad.triggerAttackRelease(toneNote(pitch), durationMs / 1000, Tone.now(), velocity);
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
    this.pad.triggerAttackRelease(pitches.map(toneNote), dur, now, 0.62);
    // sine sub doubles the bass note an octave down for warmth
    const bass = Math.min(...pitches) - 12;
    if (bass >= 0) this.sub.triggerAttackRelease(toneNote(bass), dur, now, 0.8);
  }
}

let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}
