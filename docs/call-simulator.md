# Call simulator

A way to practise your voice in a believable phone call, so you step out of the "practice booth" and into a real-world situation. The calls are **recorded ahead of time** (not generated live), so nothing is spent per practice and the app still makes no outside calls while you use it.

## The idea in one paragraph

On your Mac, a small authoring tool turns a written call script into spoken audio using a very lifelike text-to-speech voice (a service that turns text into natural speech). Each line the "other person" says becomes one audio file. In the app, the caller's lines play one at a time. You speak your part. Warbler measures your voice exactly as in a normal session, and saves the call as a session you can replay and compare over time.

## Rule change this needs

`PLAN.md` currently says "LLM calls of any kind" are a non-goal and "no external network calls at runtime". Both stay true **for the app while you use it**. What changes: the Mac-side authoring tool is allowed to call outside services (an AI model to help draft scripts, and a speech service to voice them). Nothing from those services is ever contacted by the app or the potato.

| Where | Outside calls? |
|---|---|
| The app on your phone | Never |
| The server on the potato | Never |
| The authoring tool on your Mac (`tools/callsim/`) | Yes, only when you run it, only with your approval, only for scripts you have already read |

## How a call plays

1. **Pick a scenario**, for example "Ordering a pizza" or "Booking a haircut".
2. **A card shows the setup.** Who you are calling, what you want, and a few key details you may use ("two people, Friday, 7pm"). This keeps the call natural without making you invent everything.
3. **Ring tone, then the caller picks up.** A pre-recorded greeting plays.
4. **You speak.** Warbler notices when you start and when you finish (it already tracks whether you are speaking). A short, natural pause later, the caller's next line plays.
5. **Curveballs.** Some calls include a line like "Sorry, could you say that again?" or hold music for a few seconds, so it does not feel like a script.
6. **The call ends.** You can hang up at any time with one tap, no questions asked.
7. **Summary** uses the same neutral numbers and feel-tags as every other session. There is no score and no pass or fail.

### Why it works without understanding your words

Warbler does not need to know what you said. Each caller line is written so that a natural pause and a plausible answer follows it ("What would you like to order?"). A card on screen suggests what to say. If you wander off script, the caller's next line is still a sensible, generic reaction ("Okay, great, one moment.").

For the first version, turn-taking is automatic from your voice going quiet, with a **big "Next" button as backup** in case the quiet detection misfires (a noisy room, say).

## What goes in a scenario

Each scenario is one small file plus its audio. The audio is not stored in git (see below).

```yaml
id: pizza-order-01
title: Ordering a pizza
difficulty: easy            # easy | medium | hard
setup: You are ordering for delivery. Two people, one large pizza.
you_might_say:
  - A large margherita, please
  - Delivery to 12 Elm Street
caller:
  voice: casual_man_30s      # voice name from a fixed, reviewed list
nodes:
  - id: greet
    say: "Thanks for calling Marco's, this is Dan. What can I get for you?"
    then: order
  - id: order
    wait_for: user_turn
    say: "Okay, got it. Anything else, or is that it?"
    then: address
  - id: address
    wait_for: user_turn
    say: "And what's the address for delivery?"
    ...
curveballs:
  - after: order
    say: "Sorry, the line is a bit bad. Could you say that again?"
    chance: 0.25
```

Notes:
- Every node's text is reviewed by you **before** any audio is generated.
- A few alternative lines per spot ("Sure thing", "Okay, great", "Got it") are recorded, and the app picks one at random so repeat calls feel different.
- Difficulty is about the situation (easy: a friendly pizza order; hard: a busy, slightly impatient receptionist), not about your voice.

## Scenario ideas (to discuss)

Easy: ordering food, asking a shop if an item is in stock, confirming an appointment.
Medium: booking a haircut or restaurant, calling a pharmacy, leaving a voicemail.
Harder: phoning a utility company, a slightly rushed receptionist, a call where you have to spell your name.

You choose which to write first.

## Authoring tool (`tools/callsim/`)

Runs on your Mac only, written in Python (like `tools/validate/`).

1. `uv run python -m callsim draft` : ask an AI model to propose a scenario script from a short brief. Output is plain text for you to edit.
2. **You edit and approve the script.** Nothing continues until you do.
3. `uv run python -m callsim voice` : generates one audio file per line with the speech service.
4. `uv run python -m callsim preview` : plays the whole call back so you can hear it before it ships.
5. `uv run python -m callsim bundle` : packs approved audio for deployment to the potato.

Cost controls (the spend is real, so these matter):

- Audio is cached by a fingerprint of (text + voice + settings). Re-running never pays twice for the same line.
- A **dry run** prints how many characters would be sent and an estimate before any money is spent.
- A configurable spending cap per run. The tool stops and asks if it would exceed it.
- Scripts are final before voicing, so no money goes on lines you later change.
- The API key lives in an environment variable on your Mac. Never in the repo, never on the potato, never in the app.

## Where the audio lives

- **Not committed to git.** The repo is public. Generated speech may be covered by the speech service's terms, and audio files would bloat the repo. Scripts (plain text) are committed; audio is not.
- Stored in a folder on your Mac, then copied into the potato's `data/` folder (or baked into the Docker image) at deploy time.
- If we want a clean rebuild, the authoring tool can re-create any audio from the scripts, minus the cost.

## Data and screens

- New session kind `call_sim` with a `scenario_id` (added to the `kind` list in `PLAN.md`).
- History shows these calls like any session, with a small phone icon (Lucide `phone`).
- Replay plays your voice and the caller's recorded lines together, so you can hear the whole conversation back.
- A Today-screen card, "Try a practice call", appears once Phase 6b is done.

Mockup of the in-call screen:

```
┌──────────────────────────────┐
│  Marco's Pizza        02:14  │
│                              │
│          (phone icon)        │
│     Dan is speaking...       │
│                              │
│  You might say:              │
│  - A large margherita        │
│  - Delivery to 12 Elm St     │
│                              │
│  Volume ▮▮▮▮▯▯▯▯             │
│                              │
│  ┌────────────┐ ┌──────────┐ │
│  │    Next    │ │ Hang up  │ │
│  └────────────┘ └──────────┘ │
└──────────────────────────────┘
```

## Safety and tone

- Calls are low pressure by design: friendly callers by default, easy hang-up, no scoring.
- The normal stop screen, session cap and break prompts apply.
- No scenario involves emotionally charged, medical or crisis situations.
- Callers never comment on the user's voice or gender. They are just people on a call.
- Voices and scripts follow the same direction-neutral rule as the lessons.

## Open checks (verify before building, not assumed)

1. **Does OpenRouter serve ElevenLabs voices?** OpenRouter is best known as a gateway to text models. I have not confirmed it offers ElevenLabs speech, or which version name the newest model has. If it does not, the options are ElevenLabs's own API directly, or another high-quality speech service. Same authoring tool either way: the speech provider is one small swappable piece.
2. **Usage terms for the generated audio.** Check what the speech service's plan allows (personal use, storing, and playing back from your own server). Likely fine for private use, but we should read it, not assume.
3. **Voice consent and licensing.** Use only the service's stock voices, never a clone of a real person.
4. **Roughly how much it costs.** The cost depends on total characters spoken. Once we know how many scenarios and lines, the dry-run feature gives a real number before any spend.

## Where it fits in the phases

New **Phase 6b: Call simulator**, after Phase 6 (lessons), because it reuses the live feedback, session recording, and replay pieces. It also gives lesson xfer-05 ("Phone calls and ordering") a real home.

**Done when:** one scenario can be authored, voiced, previewed and bundled; a full call can be played from the installed app, hung up at any point, saved as a `call_sim` session and replayed with both sides audible.
