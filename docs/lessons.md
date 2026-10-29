# Warbler lessons: research and curriculum

Status: **planning draft.** Nothing here is clinical advice. Every lesson ships as `status: draft` (see `PLAN.md`) until a human reviews it.

## 1. What the research says, in plain words

I read the two systematic reviews and the TruVox paper cited in the plan, plus public guidance from NIDCD (a US government health institute), the NHS, and ASHA (the US speech-language professional body), and several clinician-written guides. Here is what I could and could not establish.

### What is reasonably well supported

- **Pitch and resonance are the two things most often trained**, and they have the biggest effect on how voices are perceived. Pitch was targeted in 11 of 14 studies in one review, oral resonance in 9. Intonation (how pitch moves) and voice quality came next, with vocal health education alongside. (Systematic review, PMC10553375.)
- **Measured pitch did rise with training.** Averages in reading tasks were around 5 semitones in one review, and 25 to 39 Hz in the other. Resonance (formants) was measured in far fewer studies and results were mixed between vowels. (PMC10553375, PMC10363306.)
- **Therapy usually means weekly sessions of about an hour with a speech-language pathologist (SLP)**, ranging from a handful to 80+ sessions. Duration did not predict how much pitch changed. (Both reviews.)
- **Moving practice into everyday life is a distinct step.** A common order is: single sounds, then words, then phrases, then reading, then conversation. Several sources also rank real-life situations from easiest to hardest. (JSLHR protocol and clinician guides.)
- **Basic vocal health advice** is consistent across NIDCD, NHS and ASHA: water, rest, avoid shouting and throat clearing, and see a professional if hoarseness lasts more than about two weeks.

### Weaker or uncertain (lessons must not overclaim these)

- **The evidence is low quality.** Most studies were small case series with no control group, and the review authors themselves call for better trials. Pitch gains often faded at long follow-up.
- **No recommended pitch numbers.** The "ambiguous zone" differs between papers (150 to 185 Hz in one, 145 to 165 in another), and what sounds feminine or masculine varies by region, age and culture. **Lessons must not hardcode any target Hz.** All targets come from the user's own settings.
- **Warm-ups with a straw or lip trill:** there is good evidence for what they do mechanically (they lower the effort needed to start the voice). Evidence that they improve healthy voices as a warm-up is limited, mostly small studies. Describe them as a gentle way to ease in, not a proven fix.
- **Larynx position:** sources agree you should never grip or force the voice box into place, and that daily forced manipulation can cause chronic tension. Lessons about resonance will frame it as gentle exploration through vowels and tongue position only.
- **Breathy voice and "upspeak":** appear in clinician guides but not in strong research. Lessons offer them as optional options to explore, with a "may not suit everyone" note.
- **Articulation** is named in reviews but with little specific method. This topic gets one short lesson.
- **Practice amounts:** clinician guides suggest 15 to 30 minutes, daily, short and often. This is advice, not tested dosing. The safety defaults in the plan (30 min cap, break prompts) are deliberately more cautious.
- **SLP support matters.** Several sources note an SLP can hear tension patterns an app cannot. Lessons mention this honestly, without implying Warbler replaces therapy.

### Source quality tiers

| Tier | What | How we use it |
|---|---|---|
| A | Peer-reviewed reviews and trials (PMC reviews, JMIR TruVox, JSLHR) | May support statements of fact, with their limits stated |
| B | Public health bodies (NIDCD, NHS, ASHA) | May support health and safety statements |
| C | Clinician blogs and guides | Ideas for exercises only. Never cited as proof of an effect. Never copied; exercises are re-described in our own words and names |

## 2. How the lessons should be written

1. **Direction-neutral wording.** The plan says the app assumes no direction. Lessons talk about "your goal zone", "brighter or darker resonance" and "your own range", never "sound more X". Exploration first.
2. **One idea per lesson, about 10 minutes.** Flow: warm-up, learn one thing, practise with live feedback, done.
3. **Every practice step opens with the stop-if-strained line** and ends with a prompt to rest.
4. **Plain language.** Every technical word is explained the first time it appears, in the lesson itself.
5. **Measure only what Warbler can measure.** If a lesson needs formants, it is marked as needing Phase 4 and stays hidden until then.
6. **Sources listed on every lesson.** Statements of effect are phrased as "studies of voice training report..." not "this will...".
7. **No emojis. No promises. No timelines** ("in 4 weeks you will...").
8. **Our own wording and our own exercise names.** Source ideas are paraphrased, never copied.

## 3. Proposed curriculum (30 lessons)

You asked for more variety, so this is 30 lessons, above the plan's original 14 to 20. "Needs" shows what in the app must exist first.

**All 30 are written and reviewed before the app is built** (your call). Drafting happens in batches of about five. You read each batch, and we approve or tweak it before the next. Lesson xfer-05 connects to the call simulator (`docs/call-simulator.md`).

### Health (5)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 1 | health-01 | Easing in | How Warbler works, what strain feels like, when to stop, when to get help | Phase 1 |
| 2 | health-02 | A gentle warm-up | Humming, lip trills and straw-style blowing sounds. Partly blocking the mouth makes the voice work less hard | Phase 1 |
| 3 | health-03 | Cooling down and resting | Short voice naps, easy cool-down sounds, signs it is time to stop for the day | Phase 1 |
| 4 | health-04 | Everyday voice care | Water, humidity, throat clearing, shouting, caffeine and alcohol (from NIDCD and NHS guidance) | Phase 1 |
| 5 | health-05 | Checking for tension | Quick check of jaw, neck and shoulders, and simple ways to loosen them | Phase 1 |

### Pitch (6)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 6 | pitch-01 | Exploring your range | Slide from your lowest comfortable sound to your highest, with no target | Phase 1 |
| 7 | pitch-02 | Matching a pitch | Hold a steady pitch against a line on the graph | Phase 1 |
| 8 | pitch-03 | Steps | Move between a few set pitches in order | Phase 1 |
| 9 | pitch-04 | From sounds to phrases | Carry a chosen pitch from a hum to a word to a short phrase, then at normal speed | Phase 1 |
| 10 | pitch-05 | Counting and everyday words | Use your chosen pitch on automatic speech: counting, days of the week, greetings | Phase 1 |
| 11 | pitch-06 | Finishing sentences steady | Notice whether pitch drifts at the end of sentences, and practise keeping it level | Phase 1 |

### Resonance (5)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 12 | res-01 | Listening for bright and dark | Contrast a rounder "ah" with a forward "ee". **No gripping or lifting the throat** | Phase 1 (listening only) |
| 13 | res-02 | Shaping with your lips | How lip shape changes the sound, using spread and rounded lips | Phase 1 (listening only) |
| 14 | res-03 | Where your tongue sits | Move the tongue forward and back on a set of vowels and listen to the change | Phase 1 (listening only) |
| 15 | res-04 | Reading your vowel chart | What the chart shows and how your vowels move on it | Phase 4 |
| 16 | res-05 | Resonance in words and phrases | Keep the explored sound across short word lists, checked on the chart | Phase 4 |

### Vocal quality (3)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 17 | qual-01 | Light and easy starts | Starting words gently, with a little airflow, without pushing. Optional | Phase 1 |
| 18 | qual-02 | Relaxed breathing | Calm breath for speaking, relaxed shoulders and jaw | Phase 1 |
| 19 | qual-03 | Comfortable volume | Finding a volume that carries without pushing or straining | Phase 1 |

### Prosody, meaning how pitch moves in speech (4)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 20 | pros-01 | Gliding and sliding | Move pitch up and down on words and phrases for expression | Phase 1 |
| 21 | pros-02 | Emphasis and questions | Stress the important word. How a question can rise or fall. Words that change by stress ("record" noun versus verb) | Phase 1 |
| 22 | pros-03 | Pace and pauses | Slowing down, pausing between ideas, and how that changes how speech feels | Phase 1 |
| 23 | pros-04 | Expressive reading | Read a short passage with more variety in pitch and emphasis | Phase 2 |

### Articulation (2)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 24 | art-01 | Clear and relaxed speech | Easy lip and jaw movement, speaking at a comfortable pace | Phase 1 |
| 25 | art-02 | Clean word endings | Finishing words lightly and clearly. Optional, thin evidence | Phase 1 |

### Carry-over into daily life (5)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 26 | xfer-01 | Anchor phrases | Pick a few everyday phrases and practise them until they feel natural | Phase 2 |
| 27 | xfer-02 | Easy situations first | List situations from easiest to hardest and choose the first to try | Phase 2 |
| 28 | xfer-03 | Quick resets | Short check-ins during the day, and being kind to yourself when the voice drifts | Phase 2 |
| 29 | xfer-04 | Listening back | Replay a session, notice what you like, and pick one thing to work on | Phase 2 |
| 30 | xfer-05 | Phone calls and ordering | Practise common short exchanges: ordering food, booking, phoning a shop | Phase 2 |

## 4. Lesson file template

Matches the frontmatter in `PLAN.md`, with extras the app needs. Body sections are fixed so the app can render every lesson the same way.

```markdown
---
id: pitch-02-matching-a-pitch
title: Matching a pitch
topic: pitch
order: 70
minutes: 10
status: draft
needs_phase: 1
prereq: []                    # lesson ids that must be done first
revisit: no                   # yes = coach may offer it again after a few weeks
live_feedback: pitch_goals    # none | volume_only | just_my_voice | pitch_no_goals
                              # | volume_and_pitch_no_goals | pitch_goals | chart
sources:
  - id: truvox
    url: https://formative.jmir.org/2025/1/e73841
    tier: A
    used_for: what the claim in the lesson relies on
steps:
  - type: warmup
  - type: learn
  - type: practice
  - type: done
---

## Warm-up
- (30s) Timed action. A line starting with a time in brackets becomes a step with a timer.

## Learn
(One idea, plain words, every technical term explained.)

## Practice
**Stop if you feel pain, strain, tightness or hoarseness. Rest and drink some water.**

## Done
(Summary, feel-tag chips, rest reminder.)
```

Conventions:

- `(30s)`, `(90s)` at the end of a line (or the start of a bullet) set that step's timer.
- The stop line is mandatory at the top of every Practice section. A check fails the build if it is missing.
- `used_for` says which statement a source supports. Every factual claim in a lesson must be traceable to one.

## 5. Sources used (all checked in this planning pass)

Tier A:
- Systematic review, speech therapy for transgender women: https://pmc.ncbi.nlm.nih.gov/articles/PMC10553375
- Systematic review and meta-analysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC10363306
- TruVox (pitch training software, 5 structured exercises): https://formative.jmir.org/2025/1/e73841
- Gender-affirming voice training, patient outcomes (JSLHR, task hierarchy): https://pubs.asha.org/doi/10.1044/2023_JSLHR-23-00258
- Semi-occluded vocal tract exercises in non-disordered voices: https://pmc.ncbi.nlm.nih.gov/articles/PMC12353171/
- Immediate effects of SOVT as warm-up in singers: https://pubmed.ncbi.nlm.nih.gov/34256979/

Tier B:
- NIDCD, taking care of your voice: https://www.nidcd.nih.gov/health/taking-care-your-voice
- NHS (Cambridge), SOVT exercises leaflet: https://www.cuh.nhs.uk/patient-information/semi-occluded-vocal-tract-exercises/
- Rainbow Health Ontario, speech guidelines: https://www.rainbowhealthontario.ca/wp-content/uploads/2009/05/Guidelines-speech.pdf

Tier C (ideas only):
- Connected Speech Pathology, Seattle Voice Lab, Emerge Pediatric Therapy and similar clinician pages.

**Not verified:** I could read the TruVox paper only through search summaries (the direct page fetch failed), and the Rainbow Health Ontario PDF and the JSLHR paper only through search excerpts. Before any lesson cites them for a specific claim, they must be read in full.

## 6. Decisions

1. **Direction-neutral wording:** confirmed. Keep it general. No lesson prescribes a direction.
2. **More lessons:** confirmed. 30 lessons, released in waves.
3. **Home-only, no SLP:** confirmed. The safety screen still mentions a speech-language pathologist for persistent problems, because that is the safety net of last resort and the plan's safety rules require it. It stays a gentle mention, not a requirement or a sales pitch. Because there is no professional listening, the plan leans harder on the built-in guardrails: conservative ramp, session cap, break prompts, tag-based rest note. Lessons also avoid anything that looks like clinical technique (such as hands-on neck or larynx manipulation).

## 7. Batch status

| Batch | Lessons | Status |
|---|---|---|
| 1 | health-01 to health-05 | Drafted, awaiting Autumn's review |
| 2 | pitch-01 to pitch-05 | Not started |
| 3 | pitch-06, res-01 to res-04 | Not started |
| 4 | res-05, qual-01 to qual-03, pros-01 | Not started |
| 5 | pros-02 to pros-04, art-01, art-02 | Not started |
| 6 | xfer-01 to xfer-05 | Not started |

## 8. Working process

1. I draft a batch of about 5 lessons as files in `web/content/lessons/`, status `draft`, with sources.
2. You read them and say approve or tweak. I revise.
3. Approved lessons are committed and pushed. Then the next batch.
4. All 30 are done before Phase 0 starts. Approved by you means content-reviewed by you, not clinically reviewed; they stay marked `draft` in the app, as the plan requires.
