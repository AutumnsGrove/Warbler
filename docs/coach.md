# Weekly coach

The coach reads your weekly passage recording, compares it with earlier weeks, and suggests a gentle plan for next week. It is a set of **plain rules written by us**, not an AI. Every suggestion can say exactly which rule produced it.

Terms:

- **Weekly passage:** the same text you read aloud once a week (see `docs/passages.md`), so differences come from your voice, not the words.
- **Median:** the middle value. "Median pitch 196 Hz" means half your speaking was above that and half below. It is steadier than an average.
- **Semitone:** a musical step. 12 semitones is one octave (a doubling of pitch). Semitones are how we measure change fairly across low and high voices, because 10 Hz is a big change at 100 Hz but a small one at 300 Hz.
- **Goal zone / ramp:** your target range, softened by your ramp setting (see Safety rules in `PLAN.md`). The coach only ever uses the **ramped** zone you currently have set.

## Principles

1. **Safety beats progress.** If anything about rest or strain shows up, it wins over every goal rule.
2. **Never push.** The coach never raises your ramp, never suggests more minutes than your own session cap, and never says to "try harder".
3. **Direction-neutral.** Rules talk about "toward your goal zone", never "higher" or "lower" as a good thing.
4. **Honest about uncertainty.** Measurements are approximate. Small changes are reported as "about the same", not as wins or losses.
5. **No shame framing.** No "best week", "worst week", "behind", "missed" or streak-breaking language.
6. **Few suggestions.** At most two focus areas and five lessons per week, so the plan feels doable.
7. **Always explainable.** Each suggestion links to a "How this was chosen" note showing the rule in plain words.
8. **No target set means no goal rules.** If you chose "just show me my voice", the coach describes and suggests variety only.

## What the coach looks at

| Input | Where it comes from |
|---|---|
| Weekly passage stats: median pitch, spread (10th to 90th percentile), pitch variability, time speaking, and later median F1 to F3 | The `weekly_passage` session summaries |
| Your zones and ramp as they were when each recording was made | `settings_snapshot` stored with every session |
| Practice volume: sessions, minutes, how often the session cap was reached | All sessions |
| Feel tags | Post-session chips |
| Lesson progress | `lesson_progress` |

## Step 1: Is the recording usable?

A weekly report is only built from a recording passing these checks. If it fails, the app says why in plain words and offers to try again. Nothing is saved to the history charts as a "week" until it passes.

| Check | Fails when | Message |
|---|---|---|
| Enough speech | Time speaking is under about 60% of the passage length expected | "We heard quite a bit of silence. Try reading the whole passage." |
| Not too quiet | Typical loudness is very low | "The recording was very quiet. Hold the phone a little closer." |
| Not clipped | Loud peaks are cut off | "The recording was too loud and got distorted. Try a bit more distance." |
| Not too noisy | Background noise is high compared to your voice | "There was a lot of background sound. A quieter spot will give more accurate numbers." |
| Same passage | Passage id matches the current weekly passage | (internal check) |

All thresholds are named constants in one file (see "Where the rules live"), starting with cautious guesses to be tuned with your real recordings.

If you record more than once in a week, the latest usable one is used. All of them are kept, and you can pick a different one in the report.

## Step 2: Describe the week (no judging)

For each measure, the coach produces a neutral statement. Rounding is deliberate: whole Hz, no false precision.

**Comparing with last week and with week 1**

A change counts only if it is larger than the "noise band" for that measure. Anything smaller is "about the same".

| Measure | Noise band (starting guess) | Why |
|---|---|---|
| Median pitch | 1 semitone | The validation plan allows about 3% error, roughly half a semitone, plus natural day-to-day variation |
| Pitch spread | 2 semitones | Spread is noisier than the median |
| Formants (later) | 8% | Matches the validation tolerance in `PLAN.md` |
| Time speaking | 10 percentage points | Depends on reading speed and pauses |

**Where you are relative to your goal zone** (only if a zone is set):

| Position | Statement |
|---|---|
| Inside the zone | "Your median pitch was inside your goal zone." |
| Outside, close | "Your median pitch was about 1 semitone (7 Hz) from your goal zone." |
| Outside, further | "Your median pitch was about 3 semitones (22 Hz) from your goal zone." |

"Outside" always names the distance and never a direction word like "too low".

**Trend** (needs 4 or more weeks): the coach fits a straight line through the last 4 weekly medians. It reports a trend only if the line moves more than the noise band across those weeks. Otherwise it says "steady".

## Step 3: Pick the plan

Rules run **in this order, top to bottom**. The first rule group that fires decides the plan's character. Later groups can still add a second focus if room remains (max two).

### Group A: Rest and safety (always checked first)

| Id | Fires when | Plan |
|---|---|---|
| A1 | In the last 7 days, 2 or more sessions were tagged **Tight** or **Scratchy** | Focus: rest and gentle health. Suggest health-03, health-04, health-05. Suggest shorter sessions and an extra rest day. Skip goal rules this week. |
| A2 | A1 fired two weeks in a row | Same as A1, plus the line: "A tight or scratchy voice two weeks in a row is worth getting checked by a doctor who specialises in the voice, such as an ear, nose and throat doctor. Health organisations such as NIDCD list hoarseness and a strained voice as reasons to see one." |
| A3 | You reached your session cap 3 or more times this week | Suggest shorter sessions and spreading practice over more days. Never suggests more time. |
| A4 | The ramp was raised by you this week | A friendly reminder to check in with how your voice feels. (Does not question the change.) |

The coach does not change settings itself. It may **offer** to lower your ramp after A1, and you choose.

### Group B: Goal rules (only if a zone is set, and only if Group A did not fire)

Pitch (needs only pitch):

| Id | Fires when | Suggested focus |
|---|---|---|
| B1 | Median pitch is outside your goal zone by more than the noise band | Pitch: pitch-02 to pitch-04, pitch-05 |
| B2 | Median pitch is inside the zone, but spread reaches outside it on many frames (more than a third of speaking time) | Pitch steadiness: pitch-06, pitch-05 |
| B3 | Median pitch inside the zone and steady for 2 weeks | Maintenance: carry-over (xfer lessons), prosody, and call simulator |

Resonance (needs Phase 4 and a resonance zone set):

| Id | Fires when | Suggested focus |
|---|---|---|
| B4 | Median F1 and F2 outside the goal zone by more than the noise band | Resonance: res-01 to res-03 first (listening), then res-04 and res-05 |
| B5 | Resonance inside the zone and steady for 2 weeks | Carry-over and prosody |

**Which comes first, if both pitch and resonance are outside the zone?** The one **farthest away, measured in the same units** (semitones for pitch, percent for formants converted to semitones) gets the first focus. The other gets the second. If they are within a semitone of each other, pitch goes first, because it is the most widely researched starting point.

**Prerequisites:** a lesson is only suggested if its prerequisites are done. Prerequisites are listed in each lesson's file (for example res-04 needs res-01).

### Group C: Variety and coverage (fills open slots)

| Id | Fires when | Suggested focus |
|---|---|---|
| C1 | A topic has not been touched in 4 or more weeks | One lesson from that topic |
| C2 | A lesson was completed 3 or more weeks ago and is tagged `revisit: yes` | Offer it again |
| C3 | There is room left and no zone is set | Next unfinished lessons in curriculum order |
| C4 | You have done fewer than 2 sessions this week | A gentle "an easy 5-minute warm-up is plenty today" |

### Group D: First weeks

| Id | Fires when | Plan |
|---|---|---|
| D1 | First weekly recording (no history) | Baseline report: "This is your starting point." No comparison, no goal rules, suggests health-01, health-02, pitch-01 |
| D2 | Second weekly recording | Comparison with week 1 only. Trend not shown yet. |
| D3 | You skipped one or more weeks | Compare with the most recent earlier week and say so ("comparing with 3 weeks ago"). No remark about the gap. |

## How many lessons, how often

The plan picks up to **five lessons**, in a sensible order, plus the **gentle warm-up (health-02) as the daily opener** for every lesson day. How many lesson days per week is your setting. The coach shows "Suggested: 4 short sessions this week, with rest days in between. Fewer is completely fine", using your own preference as the starting point. No research gives a proven dose, so this is stated as a suggestion.

## What the report looks like

```
Week 4 report                      (approximate measurements)

How your week went
- 3 sessions, 41 minutes, 2 lessons finished
- You tagged: Easy (2), Warmed up (3)

Your passage this week
- Median pitch 214 Hz. About the same as last week.
- Compared with week 1: 3 semitones (34 Hz) toward your goal zone.
- Your median pitch was inside your goal zone.
- Time speaking 64%.

Listen
[ Week 1 ]   [ This week ]

Suggested for next week
1. Pitch steadiness     (rule B2)
   pitch-06 Finishing sentences steady
   pitch-05 Counting and everyday words
2. Variety               (rule C1)
   pros-03 Pace and pauses
Warm up first: health-02

How this was chosen  (tap)
```

"How this was chosen" expands to something like: "Rule B2: your median pitch was inside your goal zone, but more than a third of your speaking time was outside it, so two lessons on steadiness are suggested." Plain, short, no jargon.

## Edge cases

| Case | Behaviour |
|---|---|
| No zone set | Only Group C and D rules, plus Group A safety. Report is descriptive. |
| Ramp changed between weeks | Each week is compared against the zone that applied **at the time**, and the report says "your ramp changed on 12 Oct". |
| Formant ceiling changed | Formants from before and after are not directly comparable. Because all audio is stored, the coach **re-analyses older recordings** with the new setting before comparing. |
| Week start day | Setting, default Sunday. Weeks are by your phone's local time. |
| Daylight-saving / travel | Dates stored as local dates with the session, so a week is never split wrongly. |
| Recording fails checks repeatedly | After two failed attempts, the report offers to use the best of the attempts, flagged "lower confidence". |
| Pitch outside the search range | Counted as missing frames, not as errors. If many frames are missing, the report suggests widening the pitch range in Settings. |

## Where the rules live

- The coach is **TypeScript in the web app**, in `web/src/lib/coach/`. It uses the same summary numbers the app already computes, so there is one language for all the analysis. The Go server only stores the finished report (`weekly_reports`). This avoids writing and testing the same rules twice.
- `rules.ts` holds the rule list. Each rule is a small object: `id`, `when` (a function), `suggests` (topic and lesson ids), and `explain` (the plain sentence shown to you). Reading `rules.ts` top to bottom should read like this document.
- `constants.ts` holds every threshold (noise bands, the one-third rule, week counts) with a comment explaining the guess.
- **Tests:** a folder of fixtures, each a small invented history of weeks. Each fixture states the plan it must produce. Tests also check the safety rules never lose to a goal rule, that the coach never suggests raising the ramp, and that wording never contains forbidden words (like "failed", "behind", "best", "worst", "too low", "too high").

## Decisions (confirmed)

1. **Lesson days per week:** default 4, configurable. The report never counts a lower number as a miss. Wording: "Suggested: about 4 short sessions. Fewer is completely fine."
2. **Week start:** Sunday (a setting).
3. **Offer to lower the ramp** after a Tight or Scratchy week: yes. The coach offers, you choose.
4. **"Listen to week 1 vs now" player:** can compare week 1, last week, or any chosen week.
5. **Professional-care line in rule A2:** approved. Appears only after two consecutive Tight/Scratchy weeks.
