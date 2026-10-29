# Test strategy

The goal: when Warbler says "your median pitch is 196 Hz" or "your F2 is 1480 Hz", that number must be right, and when it cannot be right, the app must say nothing instead of guessing. A chart that looks plausible but is wrong is worse than no chart, because you would be training toward a wrong picture.

## Words used here

- **Ground truth:** the real answer, known for certain. We only know it for sounds we build ourselves (synthetic voices), where we choose the pitch and the resonances.
- **Synthetic voice:** a computer-made vowel sound with settings we picked, such as "150 Hz pitch, first resonance at 700 Hz".
- **Tolerance:** how far off a result may be and still count as correct (for example, within 3%).
- **Octave error:** the most famous pitch mistake. The detector reports double or half the true pitch, such as 400 Hz when you are at 200 Hz.
- **Fixture:** a small saved input (a sound file or a made-up history) used by a test.
- **Regression:** something that used to work and breaks later. Tests catch these.
- **Praat / parselmouth:** Praat is the standard, long-trusted program that voice scientists use to measure pitch and resonances. Parselmouth lets us run Praat from Python. We compare Warbler against it.
- **Fuzzing:** throwing lots of random or broken inputs at code to find crashes.

## The big idea: three ways to be sure

No single test proves the numbers are right, so we use three independent lines of evidence:

1. **Known answers.** Build voices where we know the truth, and check Warbler recovers it.
2. **A trusted second opinion.** Run the same recordings through Praat and compare.
3. **Your own ears and a tuner.** Human checks on a real phone, which no automated test can replace.

If all three agree, we can trust the result. If they disagree, we investigate before shipping.

A key rule: **the tool that makes the test sounds must be written separately from the code being tested.** The synthetic voices and Praat comparison live in Python (`tools/validate/`), while Warbler's measurement is TypeScript. If both shared code, a single bug could hide in both and every test would pass anyway.

## Layer 1: Pitch tests

Warbler finds pitch with a method called YIN. Tests go in `web/src/lib/dsp/` next to the code, run by vitest.

| Test | What it proves |
|---|---|
| Pure tones from 70 to 500 Hz, steps of 5 Hz | Basic accuracy across the whole range |
| The same tones at 44.1 kHz, 48 kHz and the decimated 12 kHz | The sample-rate rule from the plan: never hardcoded |
| Rich, voice-like sounds (a buzz with many harmonics, like a real voice) | Real voices are not pure tones |
| "Missing fundamental" sounds (a voice where the lowest harmonic is weak, as happens on phone mics) | The classic trap: the detector must still report the right pitch, not a higher one |
| Noise added at several levels (from clean to quite noisy) | Accuracy degrades gracefully, and low-confidence frames are dropped, not plotted |
| Gliding pitch (sliding up and down) and vibrato (wobble) | Tracking pitch that changes |
| Silence and hiss (no voice) | No pitch is reported. Never a fake number |
| Very quiet to loud versions of the same sound | Loudness must not change the pitch |
| Octave error counting | Across all of the above, count how often the result is near 2x or 0.5x the truth |
| Speech-like on/off patterns (voice, gap, voice) | Starts and stops do not cause garbage frames |

**Starting thresholds to ship pitch** (proposed, to be tightened if easy):

- Within 3% of the truth on at least 99% of voiced frames in clean conditions (the plan's stated tolerance).
- Octave errors under 0.5% of voiced frames in clean conditions, and under 2% with moderate noise.
- Zero pitch values reported on silence.
- Everything deterministic: the same input always gives the same output.

## Layer 2: Resonance (formant) tests

This is where mistakes hide best, so it gets the most weight.

### Build voices with known answers

`tools/validate/` creates source-filter vowels: a buzzing source (like vocal folds) passed through resonators set to chosen F1, F2 and F3. We then check Warbler recovers those numbers.

The grid of voices deliberately covers the cases where this method is known to struggle:

| Variable | Values | Why it matters |
|---|---|---|
| Pitch | 90, 120, 150, 200, 250, 300 Hz | At high pitch, harmonics are far apart and the method can lock onto a harmonic instead of the true resonance |
| Vowel | /a/, /e/, /i/, /o/, /u/ and a few in between | Different resonance patterns, including F2 and F3 close together |
| Vocal tract size | 0.85 to 1.25 times a reference voice, in steps | Covers a wide range of voices without assuming any direction or "normal" |
| Formant ceiling setting | 4500, 5000, 5500, 6000 Hz | Wrong ceilings are the commonest user error. We learn exactly how wrong they can make results |
| Added noise | clean, moderate | Real recordings are never clean |
| Loudness | quiet to loud | The result must not depend on volume |

For every combination, we record the error and produce a report: median error, 90th-percentile error, and the worst cases. **We do not hide the hard cases.** If the method is unreliable above 250 Hz, that is a finding we write down and design for.

### Honest tolerances

`PLAN.md` starts at plus or minus 8% for formants. Tests will show where that is achievable. Likely outcome: good at low and middle pitches, weaker at high pitches. The plan for that is **confidence gating**: when the situation is one the method handles badly, Warbler shows nothing for that moment (or "not enough confidence"), rather than a number. Tests check this directly:

- Where truth is known and the method is unreliable, the confidence flag must be low.
- When the confidence flag is high, the error must be within tolerance on at least 95% of cases.

This is better than loosening the tolerance, because it keeps what you see trustworthy.

### Cross-checking against Praat

On the same synthetic voices **and** on real recordings, compare Warbler with Praat using the exact same settings (Praat's "Burg" method, the same ceiling, the same 5 formants, the same window length, the same pre-emphasis). We report:

- Median difference per formant.
- 90th-percentile difference.
- Percentage of frames where one says "voiced" and the other disagrees.
- Pitch-octave disagreements.

**Important honesty:** Praat is trusted but not infallible. On real speech there is no ground truth, so agreement with Praat shows we match a trusted tool, not that we are perfect. Synthetic voices are where the absolute truth is known. That is why we need both.

**Starting thresholds to ship formants** (proposed):

- Synthetic: within 8% on at least 95% of high-confidence frames across the reliable region of the grid.
- Against Praat on real recordings: median difference under 5% for F1 and F2, 90th percentile under 12%, and under 3% disagreement about whether a frame is voiced.
- Results that disagree strongly with Praat are inspected by eye on a plot, never ignored.

## Layer 3: Real recordings from you

Test sounds made by computer cannot catch everything that real voices and real phones do. The plan already says you supply recordings, kept on your machine only (never committed).

**Recording protocol** (about 20 minutes, one time, then again after any big change):

1. Sustained vowels "ah", "ee", "oo", "oh", "eh", each held about 5 seconds, at three comfortable pitches (low, middle, high).
2. A pitch slide from your lowest comfortable sound to your highest.
3. Counting 1 to 20 in your normal speaking voice.
4. The weekly passage read twice.
5. A hum.
6. A whisper (a deliberate **negative test**: the app should report no pitch).
7. The same sentence at three phone distances (close, arm's length, further).
8. The same sentence in a quiet room and with a fan or kettle on.
9. If possible, the same sentences recorded on a second device (your Mac) for comparison.

These go in `local-recordings/`, which is listed in `.gitignore`. The harness reads them and prints reports. Nothing leaves your machine, and the public repo never sees them.

## Layer 4: Does the streaming code match the batch code?

On the phone, sound arrives in tiny pieces (128 samples at a time, roughly 3 thousandths of a second). A famous source of bugs is what happens at the **seams** between pieces: dropped samples, off-by-one errors, windows that straddle two pieces.

Tests:

- **Chunk equivalence:** feed the same recording once in one piece and once in random-sized pieces (including awkward sizes like 1, 127, 129). The results must be identical.
- **Real-time shape:** simulate dropped or delayed pieces and confirm the code recovers without crashing or reporting nonsense.
- **Design rule:** the live worklet is a thin wrapper around the same pure functions the tests call. There is no "special live version" that escapes testing.

## Layer 5: Speed and heat

The audio part must run comfortably on a phone.

- A Node benchmark measures time per 128-sample piece. Budget: **no more than 25% of the time available per piece** (about 0.7 ms out of 2.9 ms at 44.1 kHz). Over budget fails the test.
- The formant worker must run at least twice as fast as real time.
- A 10-minute session on your actual phone (manual, from the plan): no heat, no stutter, no growing delay. You report the result in `NOTES.md`.

## Layer 6: Real device checks

Some things only your iPhone can show. These are the **[HUMAN]** items.

| Check | How |
|---|---|
| Worklet path on the phone | A hidden **Self-test** screen generates a known tone inside the app and runs it through the same analysis path as the microphone. Shows "expected 220 Hz, measured 220.4 Hz". This proves the code and sample rate on the real device, without needing the mic |
| Mic path | Play a steady tone from a trusted free tuner app on another device near the phone and compare readings |
| Your voice | Hum a note and compare with a trusted tuner app |
| Interruptions | Phone call, lock screen, switch app, notification sounds. Does it pause cleanly and resume? |
| Permission behaviour | The Phase 0 checklist in `docs/phase-0.md` |

Everything automated can use Chromium with a **fake microphone fed from a WAV file** (a supported testing feature), so we can run full flows through a real browser engine without a person. But Safari behaves differently, so iPhone-only issues stay in this manual list.

## Layer 7: Rules that must always hold (property tests)

Instead of one example, these check a rule across thousands of random inputs.

- Same sound at different loudness gives the same pitch.
- Same sound resampled to a different sample rate gives the same pitch and formants (within tolerance).
- Doubling the frequency of a tone doubles the reported pitch.
- Output never contains `NaN`, infinity, or negative frequencies.
- Silence in means nothing out.
- Same input twice gives identical output.

## Layer 8: Server and data tests (Go)

| Test | Why |
|---|---|
| Saving the same session twice does not duplicate it (idempotent) | Retries after a dropped connection must be safe |
| Broken audio files are rejected: truncated, wrong header, wrong sample rate, absurd length | The plan says WAV headers are validated |
| Fuzzing the WAV reader with random bytes (Go has this built in) | A malformed upload cannot crash or confuse the server |
| Attempts to use paths like `../../etc` | The server never trusts client file paths |
| Files over the size limit are refused | Request-size rule |
| Audio served with "Range" (seeking in a recording) works for start, middle, end, and bad ranges | Replay depends on it |
| Deleting a session removes the files, not just the database row | Privacy: delete means deleted |
| The export zip opens, contains everything, and re-imports | Your data is yours |
| A fresh database builds from migrations; an old one upgrades | No broken updates |
| Concurrent uploads run with Go's race detector on | Catches timing bugs |

## Layer 9: Coach tests

As written in `docs/coach.md`:

- Fixture histories with the expected plan.
- Safety rules always win over goal rules.
- The coach never raises the ramp, never exceeds your session cap.
- **Word check:** all generated text is scanned for forbidden words ("failed", "behind", "best week", "too low", "too high", and so on) and for emojis.

## Layer 10: Safety rules as tests

Each safety rule in `PLAN.md` gets its own automated test, so a later change cannot quietly break one.

| Rule | Test |
|---|---|
| 1. Ramped targets only | The zone drawn is the ramped zone; no code path draws 100% of a target |
| 2. Session cap and breaks | With a fake clock, the break sheet appears at 10 minutes and the session ends at the cap; cap cannot be raised from the practice screen |
| 3. Stop screen | Starting any practice (including lessons and calls) passes through the stop screen first |
| 4. Neutral tone | No red styling on target state; the word check passes |
| 5. Tight/Scratchy note | Tagging either shows the rest line |
| 6. Approximate labels | Every screen showing measurements carries the "approximate" label |
| 7. No medical claims | The word check scans lessons and copy |

## Layer 11: Interface and accessibility

- Automated accessibility scan on every screen (contrast, labels, tap size).
- Reduce-motion setting honoured.
- No emojis anywhere in the built app or content (a scan).
- All fonts and icons are bundled: a check confirms the built app makes **zero requests to outside addresses**.

## What runs when

| Command | What it runs | When |
|---|---|---|
| `make test` | All automated layers except real recordings | Before every commit |
| `make test-validate` | Synthetic grid and Praat comparison (Python) | When DSP code changes, and Phase 4 |
| `make test-real` | Your private recordings through the harness | After DSP changes, when you have recordings available |
| Manual checklists | Layer 6 | End of each phase, results in `NOTES.md` |

The validation reports (numbers only, no audio) are saved in `docs/validation/` and committed, so we can see accuracy over time and notice if a change makes it worse.

## When tests come in the build

| Phase | Tests added |
|---|---|
| 0 | Build checks, no-outside-requests scan, Go health endpoint, the Phase 0 manual checklist |
| 1 | Layer 1 (pitch), Layer 4 (chunking), Layer 5 (speed), safety tests for rules 1 to 4, device Self-test screen |
| 2 | Layer 8 (server), tag note test, replay checks |
| 3 | Export tests, chart data checks |
| 4 | Layer 2 (resonance), Layer 3 (your recordings), Praat comparison. **No formant feature ships without passing** |
| 5 | Layer 9 (coach), retry-without-duplicate test |
| 6, 6b | Lesson file validation (every lesson has sources, status draft, prerequisites exist, safety line present), call-script checks |
| 7 | Weight measure validated against Praat or not shipped |
| 8 | Restore-from-backup test, reboot test |

## Honest limits

- Automated tests prove the code does what we intended, but not that Safari or your phone's microphone behaves as hoped. Only your device checks show that.
- Different phones, cases and mics shape sound differently. The numbers are right for **your** phone and room, and best compared with yourself over time.
- Resonance measurement from a single voice recording is hard even for experts. Where the method is weak, the app should say so, not hide it.
- None of this makes Warbler a medical instrument.

## Decisions for you

1. **Thresholds.** Are you comfortable with the proposed starting thresholds (within 3% for pitch, 8% for formants, 5% median difference against Praat), knowing we will tighten them once we see real data?
2. **Confidence gating.** Do you agree the app should show nothing, instead of a doubtful number, when the method is unreliable?
3. **Automatic test runs.** GitHub can run the tests for free on every push (a service called GitHub Actions). The plan says not to add services without asking. Do you want it, or should tests run only on your Mac?
4. **Recording session.** The recordings protocol takes about 20 minutes. When we reach Phase 1 for pitch and Phase 4 for resonance, would you rather do it as one long session or two?
