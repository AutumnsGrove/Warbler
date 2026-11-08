# Validation tools

Python programs that build test sounds with known answers, and compare Praat
with them. Read `docs/testing.md` first for the reasoning.

These are deliberately separate from the app. If the tool that makes the test
sounds shared code with the thing being tested, one bug could hide in both and
every test would still pass.

## What is here

| File | What it does |
|---|---|
| `synth.py` | Builds synthetic voices: a buzz for the vocal folds, three resonators for the throat and mouth shape. Writes 16-bit mono WAV files and `out/truth.json`, which says what each file really is |
| `pitch_check.py` | Runs the generator, then measures every file with Praat (through parselmouth) and prints a table of known pitch against Praat's answer |
| `out/` | Generated, ignored by git (the repo ignores `*.wav`) |

The app's own measurement of these same files is checked by
`web/src/lib/dsp/validation.test.ts`. It reads `out/truth.json`, so it skips
itself when the files have not been generated, and CI never depends on Python.

## Running it

```bash
make validate-pitch
```

or step by step:

```bash
cd tools/validate
python3 synth.py          # sound files only, needs no extra packages
uv run python pitch_check.py   # adds the Praat comparison
cd ../../web && pnpm exec vitest run src/lib/dsp/validation.test.ts
```

`synth.py` uses only the standard library, so it always works. Praat support
needs `parselmouth`, which `uv sync` installs.

## What the report means

- **Praat agrees with the known answer.** Good: the test sounds are trustworthy,
  so comparing Warbler against them is meaningful.
- **Praat disagrees.** The test sounds are wrong, not Warbler. Fix the generator
  before drawing any conclusion about the app.
- **Warbler disagrees with a sound Praat agrees with.** That is a real finding.
  Write it in `NOTES.md` with the file name and the numbers.

## Real recordings

`pitch_check.py` also looks for WAV files in `local-recordings/` and reports
Praat's view of them. Those files are Autumn's own recordings, never committed
(the repo ignores `/local-recordings/` and `*.wav`). The 20-minute protocol is
in `docs/testing.md`, layer 3.

On real speech nobody knows the true pitch, so agreement with Praat shows that
Warbler matches a trusted tool, not that either one is perfect.
