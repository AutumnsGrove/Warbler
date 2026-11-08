/**
 * Turning a frequency in Hz into a musical note name.
 *
 * People read pitch two ways: "198 Hz" is the measurement, and "G3" is the
 * name a musician would use. screens.md says show both together, because the
 * note name is easier to remember and to compare with a tuner app.
 *
 * Middle C (C4) is about 262 Hz, and each doubling of frequency is one octave
 * up: A3 is 220 Hz, A4 is 440 Hz.
 */

/** Note names in order, using sharps rather than flats (G# rather than Ab). */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** A4 is 440 Hz and is note number 69 in the MIDI numbering musicians use. */
const A4_MIDI = 69;
const A4_HZ = 440;

/** Fractional MIDI note number for a frequency. A4 (440 Hz) gives exactly 69. */
export function hzToMidi(hz: number): number {
	return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

/** The nearest note name for a frequency, such as "G3", or '' when unusable. */
export function hzToNoteName(hz: number): string {
	if (!(hz > 0) || !Number.isFinite(hz)) return '';
	const rounded = Math.round(hzToMidi(hz));
	const octave = Math.floor(rounded / 12) - 1;
	const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
	return `${name}${octave}`;
}

/**
 * How far the frequency is from the nearest exact note, in cents (hundredths of
 * a semitone). Useful later for "you are 30 cents under the note".
 */
export function hzToCentsFromNote(hz: number): number {
	if (!(hz > 0) || !Number.isFinite(hz)) return 0;
	const midi = hzToMidi(hz);
	return (midi - Math.round(midi)) * 100;
}
