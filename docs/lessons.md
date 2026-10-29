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

## 3. Proposed curriculum (18 lessons)

Order numbers follow the plan's `order:` field. "Needs" shows what in the app must exist.

### Health (3)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 1 | health-01 | Easing in | How Warbler works, what strain feels like, water, rest, when to see a professional | Phase 1 |
| 2 | health-02 | A gentle warm-up | Humming, lip trills, and straw-style blowing sounds that ease the voice in. Explained simply: partly blocking the mouth makes the voice work less hard | Phase 1 |
| 3 | health-03 | Cooling down and resting | Short voice naps, easy cool-down sounds, signs it is time to stop for the day | Phase 1 |

### Pitch (4)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 4 | pitch-01 | Exploring your range | Slide from your lowest comfortable sound to your highest comfortable sound, with no target. See where your voice lives | Phase 1 |
| 5 | pitch-02 | Matching a pitch | Hold a steady pitch against a line on the graph | Phase 1 |
| 6 | pitch-03 | Steps | Move between a few set pitches in order | Phase 1 |
| 7 | pitch-04 | From sounds to phrases | Carry a chosen pitch from a hum to a word to a short phrase, then at normal speed | Phase 1 |

### Resonance (3)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 8 | res-01 | Listening for bright and dark | Contrast a rounder "ah" with a forward "ee". Find how tongue position changes the sound. **No gripping or lifting the throat** | Phase 1 (listening only) |
| 9 | res-02 | Reading your vowel chart | What the chart shows and how your vowels move on it as you explore | Phase 4 |
| 10 | res-03 | Resonance in words and phrases | Keep the explored sound across a short list of words | Phase 4 |

### Vocal quality (2)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 11 | qual-01 | Light and easy starts | Starting words gently, with a little airflow, without pushing. Marked optional | Phase 1 |
| 12 | qual-02 | Relaxed breathing | Calm breath for speaking, relaxed shoulders and jaw | Phase 1 |

### Prosody, meaning how pitch moves in speech (2)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 13 | pros-01 | Gliding and sliding | Move pitch up and down on words and phrases for expression | Phase 1 |
| 14 | pros-02 | Emphasis and questions | Stress the important word. How a question can rise or fall. Two words that sound different by stress (such as "record" the noun and the verb) | Phase 1 |

### Articulation (1)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 15 | art-01 | Clear and relaxed speech | Easy lip and jaw movement, speaking at a comfortable pace | Phase 1 |

### Carry-over into daily life (3)

| # | id | Title | What it teaches | Needs |
|---|---|---|---|---|
| 16 | xfer-01 | Anchor phrases | Pick a few everyday phrases you practise until they feel natural | Phase 2 |
| 17 | xfer-02 | Easy situations first | List situations from easiest to hardest and pick the first to try (the plan's ranking idea) | Phase 2 |
| 18 | xfer-03 | Quick resets | Short check-ins during the day, recording a short clip, being kind to yourself when the voice drifts | Phase 2 |

## 4. Lesson file template

Matches the frontmatter in `PLAN.md`. Body sections are fixed so the app can render every lesson the same way.

```markdown
---
id: pitch-02-matching-a-pitch
topic: pitch
order: 50
minutes: 10
status: draft
needs_phase: 1
sources:
  - id: truvox
    url: https://formative.jmir.org/2025/1/e73841
    tier: A
steps:
  - type: warmup
  - type: learn
  - type: practice
  - type: done
---

## Warm-up
(2 minutes. Always the same gentle sounds, linked to health-02.)

## Learn
(One idea, plain words, explain every technical term.)

## Practice
Stop if you feel pain, strain, tightness or hoarseness. Rest and drink some water.
(Guided steps with live feedback. Minutes per step.)

## Done
(Summary, then the feel-tag chips, then rest reminder.)
```

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

## 6. Open questions for you

1. **Direction-neutral wording** is my reading of the plan's "assumes no direction". Is that right, or do you want lessons written for your own goals specifically?
2. **18 lessons** is the top of the plan's 14 to 20. Should I trim to 14 for a faster first release? The quality and articulation lessons are the thinnest in evidence and are easiest to cut.
3. **Do you plan to see an SLP at some point?** If yes, lessons can include a short "bring this to your appointment" note in each topic, which suits the draft-then-review workflow.
