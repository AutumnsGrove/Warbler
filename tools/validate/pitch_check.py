"""Pitch validation report: synthetic voices, and Praat as a second opinion.

Two jobs:

1. Write the synthetic voices from `synth.py` into `out/`, with `truth.json`
   saying what pitch each one really is.
2. If parselmouth (Praat) is installed, measure every file with Praat too and
   print a table. Praat is the trusted tool voice scientists use; if Praat
   agrees with the known answer, the test sounds are sound, and any difference
   between Warbler and Praat is worth looking at.

Run it with:

    cd tools/validate
    uv run python pitch_check.py

The web test `web/src/lib/dsp/validation.test.ts` reads the same files in `out/`
and checks Warbler's own measurements against the known answers. It is skipped
when the files have not been generated, so CI never depends on this.

Honesty note, from docs/testing.md: on these synthetic sounds we know the true
answer. On real recordings nobody does, which is why the recordings comparison
below shows agreement with Praat rather than proof of correctness.
"""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

from synth import write_grid

HERE = Path(__file__).parent
OUT = HERE / "out"
RECORDINGS = HERE.parent.parent / "local-recordings"
TOLERANCE_PERCENT = 3.0


def median_pitch(path: Path, floor: float = 60.0, ceiling: float = 600.0) -> float | None:
    """Median pitch Praat reports for a file, or None when it hears no voice."""
    try:
        import parselmouth
    except ImportError:
        return None
    sound = parselmouth.Sound(str(path))
    pitch = sound.to_pitch(time_step=0.01, pitch_floor=floor, pitch_ceiling=ceiling)
    values = [float(v) for v in pitch.selected_array["frequency"] if v > 0]
    return statistics.median(values) if values else None


def report_synthetic() -> int:
    truth_path = write_grid(OUT)
    voices = json.loads(truth_path.read_text())
    print(f"Wrote {len(voices)} synthetic voices to {OUT}")
    print()

    rows: list[tuple[int, str, float, float | None, float | None]] = []
    for voice in voices:
        measured = median_pitch(OUT / voice["file"])
        error = None if measured is None else (measured - voice["pitch_hz"]) / voice["pitch_hz"] * 100
        rows.append((int(voice["pitch_hz"]), voice["vowel"], voice["pitch_hz"], measured, error))

    praat_available = any(row[3] is not None for row in rows)
    if not praat_available:
        print("Praat (parselmouth) is not installed, so there is no second opinion to show.")
        print("Run: uv sync   (then try again)")
        return 0

    print(f"{'pitch':>6} {'vowel':>5} {'expected':>9} {'Praat':>9} {'error %':>8}")
    worst = 0.0
    for pitch, vowel, expected, measured, error in rows:
        shown = "no voice" if measured is None else f"{measured:.1f}"
        error_text = "-" if error is None else f"{error:+.2f}"
        print(f"{pitch:>6} {vowel:>5} {expected:>9.1f} {shown:>9} {error_text:>8}")
        if error is not None:
            worst = max(worst, abs(error))

    print()
    print(f"Worst difference between Praat and the known answer: {worst:.2f}%")
    if worst > TOLERANCE_PERCENT:
        print(f"Outside the {TOLERANCE_PERCENT}% tolerance: the test sounds themselves need checking.")
        return 1
    print("Praat agrees with the known answers, so these files are usable as test material.")
    return 0


def report_recordings() -> int:
    """Compare Praat on the real recordings, if they exist on this machine."""
    files = sorted(RECORDINGS.glob("*.wav")) if RECORDINGS.exists() else []
    if not files:
        print()
        print("No recordings found in local-recordings/, so real-voice comparison is skipped.")
        print("See docs/testing.md layer 3 for the 20-minute recording protocol.")
        return 0

    print()
    print(f"Real recordings in {RECORDINGS}: {len(files)}")
    print(f"{'file':<40} {'Praat median':>13}")
    for path in files:
        measured = median_pitch(path)
        shown = "no voice" if measured is None else f"{measured:.1f} Hz"
        print(f"{path.name[:40]:<40} {shown:>13}")
    print()
    print("This is Praat's own view. Warbler's numbers for the same files come from")
    print("`uv run python compare_recordings.py` once Phase 2 stores them.")
    return 0


if __name__ == "__main__":
    status = report_synthetic()
    status = max(status, report_recordings())
    sys.exit(status)
