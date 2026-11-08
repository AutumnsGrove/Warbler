"""Synthetic voices with known answers, for checking Warbler's pitch measurements.

This is written separately from Warbler's own code on purpose. `docs/testing.md`
explains why: if the test sounds and the measurement shared code, one bug could
hide in both and every test would still pass. Nothing here is imported by the
app, and nothing here knows how the app works.

A "voice" here is the classic source-filter model, in plain words:

  - a buzz represents the vocal folds: a pulse once per pitch period, then a
    gentle low-pass so the harmonics fall away like a real voice
  - three resonators represent the throat and mouth shape: each one boosts a
    narrow band of frequencies, at F1, F2 and F3
  - optionally, a little hiss is added, because real recordings are never clean

Only the Python standard library is used to make the sound, so this runs
anywhere. Praat (through parselmouth) is used separately, in `pitch_check.py`,
and is optional.
"""

from __future__ import annotations

import json
import math
import random
import struct
import wave
from dataclasses import dataclass, asdict
from pathlib import Path

SAMPLE_RATE = 48_000
DURATION_SECONDS = 1.5
AMPLITUDE = 0.5

# Rough vowel resonances (F1, F2, F3 in Hz) for an average adult voice. These are
# starting points for a test signal, not a claim about anyone's voice.
VOWELS: dict[str, tuple[float, float, float]] = {
    "a": (730.0, 1090.0, 2440.0),
    "e": (530.0, 1840.0, 2480.0),
    "i": (270.0, 2290.0, 3010.0),
    "o": (570.0, 840.0, 2410.0),
    "u": (300.0, 870.0, 2240.0),
}

# How wide each resonance is. Wider means a softer, less distinct peak.
BANDWIDTHS = (80.0, 100.0, 140.0)


@dataclass(frozen=True)
class Voice:
    """One synthetic sound and the truth about it."""

    name: str
    pitch_hz: float
    vowel: str
    tract_scale: float
    noise: float
    formants: tuple[float, float, float]
    sample_rate: int
    duration: float
    file: str


def formants_for(vowel: str, tract_scale: float) -> tuple[float, float, float]:
    """A larger vocal tract has lower resonances, and the other way round."""
    base = VOWELS[vowel]
    return tuple(value * tract_scale for value in base)  # type: ignore[return-value]


def resonator(frequency: float, bandwidth: float, sample_rate: int) -> tuple[float, float, float]:
    """Three numbers that make a two-pole filter ring at one frequency."""
    radius = math.exp(-math.pi * bandwidth / sample_rate)
    b = 2.0 * radius * math.cos(2.0 * math.pi * frequency / sample_rate)
    c = -(radius * radius)
    a = 1.0 - b - c  # unity gain at low frequencies
    return a, b, c


def buzz(pitch_hz: float, sample_rate: int, count: int, tilt: float = 0.94) -> list[float]:
    """A pulse train with a spectral tilt, standing in for vocal folds."""
    out = [0.0] * count
    period = sample_rate / pitch_hz
    previous = 0.0
    for i in range(count):
        # One narrow impulse per period, then a one-pole low-pass for tilt.
        impulse = 1.0 if (i % round(period)) < 1.0 + 1e-9 else 0.0
        previous = impulse + tilt * previous
        out[i] = previous
    return out


def synthesise(voice: Voice, seed: int = 3) -> list[float]:
    """Build the sound described by `voice`."""
    count = int(voice.duration * voice.sample_rate)
    source = buzz(voice.pitch_hz, voice.sample_rate, count)

    # Cascade the three resonances, as the real tract does.
    signal = source
    for frequency, bandwidth in zip(voice.formants, BANDWIDTHS):
        a, b, c = resonator(frequency, bandwidth, voice.sample_rate)
        filtered = [0.0] * count
        y1 = y2 = 0.0
        for i, x in enumerate(signal):
            y = a * x + b * y1 + c * y2
            y2, y1 = y1, y
            filtered[i] = y
        signal = filtered

    if voice.noise > 0:
        random.seed(seed)
        signal = [value + voice.noise * (random.random() * 2 - 1) for value in signal]

    peak = max(abs(value) for value in signal) or 1.0
    return [AMPLITUDE * value / peak for value in signal]


def write_wav(path: Path, samples: list[float], sample_rate: int) -> None:
    """Write 16-bit mono PCM, the simplest thing every player understands."""
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, value)) * 32767)) for value in samples)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(frames)


def build_grid(pitches: list[float] | None = None) -> list[Voice]:
    """The set of voices used for pitch validation: a range of pitches and vowels."""
    pitches = pitches or [70.0, 90.0, 120.0, 150.0, 196.0, 220.0, 250.0, 300.0, 400.0, 500.0]
    voices: list[Voice] = []
    for pitch in pitches:
        for vowel in ("a", "i", "u"):
            formants = formants_for(vowel, 1.0)
            voices.append(
                Voice(
                    name=f"pitch-{int(pitch)}-{vowel}",
                    pitch_hz=pitch,
                    vowel=vowel,
                    tract_scale=1.0,
                    noise=0.0,
                    formants=formants,
                    sample_rate=SAMPLE_RATE,
                    duration=DURATION_SECONDS,
                    file=f"pitch-{int(pitch)}-{vowel}.wav",
                )
            )
    # A few harder cases on purpose: a small and a large tract, and some hiss.
    for pitch, vowel, scale, noise in (
        (150.0, "a", 0.85, 0.0),
        (150.0, "a", 1.25, 0.0),
        (150.0, "a", 1.0, 0.02),
        (200.0, "i", 0.9, 0.01),
    ):
        name = f"pitch-{int(pitch)}-{vowel}-scale{int(scale * 100)}-noise{int(noise * 1000)}"
        voices.append(
            Voice(
                name=name,
                pitch_hz=pitch,
                vowel=vowel,
                tract_scale=scale,
                noise=noise,
                formants=formants_for(vowel, scale),
                sample_rate=SAMPLE_RATE,
                duration=DURATION_SECONDS,
                file=f"{name}.wav",
            )
        )
    return voices


def write_grid(out_dir: Path) -> Path:
    """Write every voice to `out_dir`, plus truth.json describing them."""
    voices = build_grid()
    out_dir.mkdir(parents=True, exist_ok=True)
    for voice in voices:
        write_wav(out_dir / voice.file, synthesise(voice), voice.sample_rate)
    truth = out_dir / "truth.json"
    truth.write_text(json.dumps([asdict(voice) for voice in voices], indent=2) + "\n")
    return truth


if __name__ == "__main__":
    path = write_grid(Path(__file__).parent / "out")
    print(f"Wrote synthetic voices and {path.name} to {path.parent}")
