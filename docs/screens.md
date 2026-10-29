# Warbler screens

Rough text sketches of every screen, drawn phone-shaped. These show **what is on each screen and where**, not final colours or fonts. Change anything freely; it is far cheaper to change a sketch than finished code.

Terms used here:

- **Zone**: a range of pitch (or resonance) you are aiming for, drawn as a soft shaded band.
- **Ramp**: a setting that says "aim for X% of the way from where I start to where I want to end up". It keeps the goal gentle. See Safety rules in `PLAN.md`.
- **Trace**: the line on the graph that draws your pitch as time passes.

## Design rules for every screen

These come from the safety rules, so they apply everywhere.

1. **No red, no "wrong" states.** Being outside a zone is shown in a calm neutral colour with a plain description, never as a failure.
2. **Numbers are labelled "approximate".** The app never says "pass" or "fail".
3. **Big tap targets** (at least 44 px) and readable text, because you will use it while talking, often at arm's length.
4. **Calm motion.** Respect the phone's "reduce motion" setting.
5. **One main action per screen.**
6. **No emojis anywhere.** All icons come from the Lucide icon set. Symbols like check marks and arrows in these sketches stand in for Lucide icons.
7. **Warm, bird-themed look.** Soft cream and warm neutrals, a gentle accent colour taken from a warbler's plumage (a soft yellow, for example), rounded shapes. Bird touches stay subtle: the logo, the empty-state illustrations, the loading screen. Never cartoonish.
8. **Font: Lexend**, bundled with the app (no downloads from Google at runtime, so nothing leaves your network). Lexend was designed to be easy to read, which suits a tool used while concentrating on speaking.

## Navigation

A bar of five tabs at the bottom, always visible except during practice.

```
┌──────────────────────────────┐
│                              │
│        (screen content)      │
│                              │
├──────┬──────┬──────┬────┬────┤
│Today │Prac- │Hist- │Prog│Set-│
│ (sun)│tice  │ory   │ress│ings│
│      │(mic) │(list)│(ch)│(co)│
└──────┴──────┴──────┴────┴────┘
```

Icons in parentheses are placeholders for Lucide icons: `sun`, `mic`, `history`, `trending-up`, `settings`. Every tab has an icon **and** a text label.

---

## 1. First-run setup (shown once)

Three short steps. Nothing is pre-filled: the app ships with no targets, as the plan requires.

```
┌──────────────────────────────┐
│  Welcome to Warbler          │
│                              │
│  A private practice tool for │
│  your voice. Everything      │
│  stays on your own device    │
│  and server.                 │
│                              │
│  Warbler gives approximate   │
│  measurements. It is not     │
│  medical advice or therapy.  │
│                              │
│  Step 1 of 3                 │
│  ┌────────────────────────┐  │
│  │        Continue        │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

Step 2: **"Find your starting point"**. Record a few seconds of normal speaking. The app shows your current typical pitch and sets it as your starting zone. You can edit it by hand.

Step 3: **"Choose how to use Warbler"**

```
┌──────────────────────────────┐
│  How would you like to start?│
│                              │
│  ┌────────────────────────┐  │
│  │ Just show me my voice  │  │
│  │ No goals, only the     │  │
│  │ live graph             │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ I have a target        │  │
│  │ Set a goal zone and a  │  │
│  │ gentle ramp toward it  │  │
│  └────────────────────────┘  │
│                              │
│  You can change this any     │
│  time in Settings.           │
└──────────────────────────────┘
```

---

## 2. Today

Home screen. Shows the one thing to do today.

```
┌──────────────────────────────┐
│  Today                       │
│                              │
│  ┌────────────────────────┐  │
│  │ Today's lesson         │  │
│  │ Finding your range     │  │
│  │ Pitch · about 10 min   │  │
│  │ draft, unreviewed      │  │
│  │ ┌────────────────────┐ │  │
│  │ │       Start        │ │  │
│  │ └────────────────────┘ │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ This week's passage    │  │
│  │ Not recorded yet       │  │
│  │ [ Record passage ]     │  │
│  └────────────────────────┘  │
│                              │
│  This week: 3 sessions,      │
│  41 minutes                  │
├──────┬──────┬──────┬────┬────┤
│ Today│ ...                   │
└──────┴──────────────────────┘
```

Notes: no streak counter by default (optional in Settings). The weekly card turns into "See report" once recorded.

---

## 3. Before-you-practise screen (stop screen)

Shown at the start of every practice. Short and always the same, so it is easy to skim.

```
┌──────────────────────────────┐
│  Before you start            │
│                              │
│  Stop if you feel pain,      │
│  strain, tightness or        │
│  hoarseness. Rest and drink  │
│  some water.                 │
│                              │
│  If problems continue, a     │
│  speech-language pathologist │
│  (ideally one experienced in │
│  gender-affirming voice work)│
│  can help.                   │
│                              │
│  Session limit: 30 min       │
│  Break reminder: every 10    │
│                              │
│  ┌────────────────────────┐  │
│  │  I understand, begin   │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

## 4. Practice (live pitch)

The main screen. The phone should be readable at a glance while you speak.

```
┌──────────────────────────────┐
│ 08:42            [ Finish ]  │
│                              │
│ 300┤                         │
│    │      ░░░░░░░░░░░░░░░░░░ │ ← goal zone (soft band)
│ 220┤ ░░░░░░░░░░░░░░░░░░░░░░░ │
│    │   ╭─╮     ╭──╮          │ ← your pitch trace
│ 180┤ ──╯ ╰─╮ ╭─╯  ╰──        │
│    │        ╰─╯              │
│ 120┤ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │ ← starting zone
│    └─────────────────────────│
│                              │
│       198 Hz  ·  note G3     │
│  14 Hz below your goal zone  │
│                              │
│  Volume ▮▮▮▮▮▯▯▯▯▯           │
│                              │
│  ┌────────────────────────┐  │
│  │        Pause           │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

What to notice:

- The trace scrolls to the left over roughly the last 10 seconds.
- The note name next to the Hz number (G3 here) is the musical note closest to your pitch. See "Note names, briefly" below.
- Gaps in the line mean "not confident enough to draw". The app never guesses.
- The sentence under the number is neutral. "14 Hz below your goal zone", not "too low".
- The goal zone shown is the **ramped** zone, not the final target.
- "Just show me my voice" mode hides both zones and the sentence.

### Paused state (phone call, switched app)

```
┌──────────────────────────────┐
│                              │
│          Paused              │
│                              │
│  Warbler paused because the  │
│  microphone was interrupted. │
│                              │
│  ┌────────────────────────┐  │
│  │        Resume          │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   Finish and save      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Break prompt (every ~10 minutes)

A gentle sheet slides up. The session keeps its place.

```
┌──────────────────────────────┐
│  ...                         │
│ ┌──────────────────────────┐ │
│ │  Time for a short break  │ │
│ │  Sip some water, rest    │ │
│ │  your voice for a minute.│ │
│ │ [ Keep going ] [ Finish ]│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### Session limit reached

Same sheet, wording "You have reached your session limit. Good place to stop." Only a Finish button. The limit can be raised in Settings but not from here, on purpose.

---

## 5. Practice with vowel chart (arrives in Phase 4)

A second view on the same screen. Swipe or tap the tabs at the top to switch between Pitch and Resonance.

```
┌──────────────────────────────┐
│ 08:42       [Pitch|Resonance]│
│                              │
│  F1 (jaw openness)           │
│  ↑                           │
│  │ .  ·                      │
│  │  ··::                     │
│  │   :●::  ┌ ─ ─ ─ ┐         │
│  │    ··   │ goal  │         │
│  │         └ ─ ─ ─ ┘         │
│  └─────────────────→ F2      │
│        (tongue position)     │
│                              │
│  Recent sound clouds the     │
│  chart; ● is your median     │
│                              │
│  F1 520 · F2 1480 · F3 2600  │
│  approximate                 │
└──────────────────────────────┘
```

Note: the vowel chart is a dot-density picture of where your recent vowels landed. The "formant ceiling" setting lives in Settings, with a one-line explanation.

---

## 6. Session summary (after Finish)

```
┌──────────────────────────────┐
│  Session saved (check)            │
│                              │
│  18 minutes · practice       │
│                              │
│  Typical pitch    196 Hz     │
│  Range (10–90%)  168–241 Hz  │
│  Time speaking   62%         │
│                              │
│  [ small pitch graph of the  │
│    whole session ]           │
│                              │
│  How did it feel? (optional) │
│                              │
│  Voice                       │
│  (Easy) (Steady) (Effortful) │
│  (Tired) (Tight) (Scratchy)  │
│                              │
│  Today                       │
│  (Warmed up) (Rested)        │
│  (Thirsty) (Congested)       │
│  (Noisy room)                │
│                              │
│  ┌────────────────────────┐  │
│  │          Done          │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

If saving fails, this screen shows an unmistakable state instead:

```
│  NOT SAVED YET               │
│  Couldn't reach your server. │
│  Your recording is kept on   │
│  this phone and will keep    │
│  trying. Keep Warbler open.  │
│  [ Try again now ]           │
```

**Feel tags** (decided):

- Everything is tap-to-select chips. No typing needed. You can tap several, or none and just press Done.
- Two groups: how your **voice** felt, and what was going on **today** (things that change how a voice behaves).
- Tapping **Tight** or **Scratchy** shows one calm line: "Worth resting your voice for a bit. If it keeps happening, consider seeing a speech-language pathologist." No alarm, no colour change.
- The tags are saved with the session, so History can filter by them and the Weekly report can notice patterns in plain words (for example "sessions you tagged Tight were on average 9 minutes longer").
- The list is fixed in v1 and lives in one file, so adding or renaming chips later is a small change. Editable chips in Settings could come later if you want them.

---

## 7. History

```
┌──────────────────────────────┐
│  History        [Filter ▾]   │
│                              │
│  This week                   │
│  ┌────────────────────────┐  │
│  │ Thu 29 Oct · 18 min    │  │
│  │ Practice · 196 Hz      │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Wed 28 Oct · 11 min    │  │
│  │ Lesson: Finding range  │  │
│  └────────────────────────┘  │
│  Last week                   │
│  ┌────────────────────────┐  │
│  │ Sun 25 Oct · 6 min     │  │
│  │ Weekly passage         │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Session detail with replay

```
┌──────────────────────────────┐
│ ‹ Back            [ Delete ] │
│  Thu 29 Oct · practice       │
│                              │
│  [ pitch graph with a moving │
│    marker that follows the   │
│    audio ]                   │
│                              │
│  ▶  ───────●────────  06:12  │
│                              │
│  Typical pitch    196 Hz     │
│  Range            168–241    │
│  Time speaking    62%        │
│                              │
│  Felt: Easy, Warmed up       │
└──────────────────────────────┘
```

Delete asks "Delete this recording and its data? This cannot be undone." with Cancel as the default.

---

## 8. Progress

```
┌──────────────────────────────┐
│  Progress    [ 4w | 12w | all]│
│                              │
│  Typical pitch by week       │
│  230┤            ●           │
│  200┤      ●──●─╯            │
│  170┤ ●──╯                   │
│     └────────────────────    │
│       w1  w2  w3  w4         │
│       (shaded: your range)   │
│                              │
│  Minutes practised           │
│  ▂ ▅ ▃ ▇                     │
│                              │
│  [ Export all my data ]      │
└──────────────────────────────┘
```

Later (Phase 4) a second chart for resonance (F2 median by week) is added.

---

## 9. Weekly passage and report (Phase 5)

Reading screen: big readable text, same passage every week.

```
┌──────────────────────────────┐
│ Weekly passage     [ Finish ]│
│                              │
│  "When the sunlight strikes  │
│   raindrops in the air, they │
│   act as a prism and form a  │
│   rainbow..."                │
│                              │
│  Read it in your own natural │
│  way, at a comfortable pace. │
│                              │
│  Volume ▮▮▮▮▯▯▯▯             │
│  ┌────────────────────────┐  │
│  │     Start reading      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

Report after three or more weeks:

```
┌──────────────────────────────┐
│  Week 4 report               │
│                              │
│  Compared with week 1:       │
│  • Typical pitch +34 Hz      │
│  • Range wider by 12 Hz      │
│  • Resonance F2 +90 Hz       │
│  (all approximate)           │
│                              │
│  Listen                      │
│  ▶ Week 1      ▶ This week   │
│                              │
│  Suggested focus next week   │
│  • Resonance lessons         │
│  • Short pitch warm-up       │
│                              │
│  How this was chosen ▾       │
│  (shows the simple rule used)│
└──────────────────────────────┘
```

"How this was chosen" is on purpose: the rules are readable, never a mystery.

---

## 10. Lessons (Phase 6)

List, then a runner that walks through steps.

```
┌──────────────────────────────┐
│  Lessons                     │
│  Health & warm-ups           │
│  (check) Easing into your voice    │
│  Pitch                       │
│  ○ Finding your range        │
│  ○ Steady pitch              │
│  Resonance                   │
│  ○ ...                       │
└──────────────────────────────┘
```

Runner:

```
┌──────────────────────────────┐
│ ● ● ○ ○   Step 2 of 4   (x)  │
│                              │
│  Learn                       │
│                              │
│  Short plain-language        │
│  explanation of one idea.    │
│                              │
│  Sources: [1] [2]            │
│  draft, unreviewed           │
│                              │
│  ┌────────────────────────┐  │
│  │          Next          │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

The "practice" step reuses the live pitch screen inside the lesson, with the stop-if-strained note at its top.

---

## 11. Settings

```
┌──────────────────────────────┐
│  Settings                    │
│                              │
│  Goals                       │
│  Starting zone   170–200 Hz  │
│  Target zone     [not set]   │
│  Ramp            30%  [──●─] │
│                              │
│  Safety                      │
│  Session limit   30 min      │
│  Break reminder  10 min      │
│                              │
│  Measuring                   │
│  Pitch range     70–500 Hz   │
│  Formant ceiling 5500 Hz (?) │
│                              │
│  Display                     │
│  Show note names     [on]    │
│  Streaks             [off]   │
│                              │
│  Data                        │
│  [ Export everything ]       │
└──────────────────────────────┘
```

Each "(?)" opens a one-or-two sentence plain explanation.

---

## Note names, briefly

Musical notes are letters A to G, plus a number saying which octave (higher number = higher pitch). Middle C on a piano is C4, around 262 Hz. Each time the pitch doubles you move up one octave, so A3 is 220 Hz and A4 is 440 Hz.

Examples of roughly where speaking voices sit:

| Hz | Note |
|---|---|
| 110 | A2 |
| 165 | E3 |
| 196 | G3 |
| 220 | A3 |
| 262 | C4 |
| 330 | E4 |

The app shows Hz and the note together, always. A small "What are these?" link beside the readout opens this explanation so you can learn it at your own pace. The note name is secondary text (smaller and lighter than the Hz number) until you decide you want it prominent; a Settings toggle can hide it.

## Decided so far

- Bottom tabs: five (Today, Practice, History, Progress, Settings).
- Post-session feel tags: yes, chips only.
- Look: warm, subtle bird theme. Font Lexend. Icons Lucide. No emojis.
- Pitch display: Hz plus note name.

## Still open

1. **Weekly reading passage.** Not the Rainbow Passage. See `docs/passages.md` for the options.
