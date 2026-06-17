# Gate paper entry behind an explicit Timed Run / Open Run choice

**Status:** accepted

Opening a paper variant now shows a cover plate that makes the user choose a
**Timed Run** (clock starts immediately, auto-submits at 0:00) or an **Open Run**
(no clock, free reading and review) before any questions appear. The chosen mode
is persisted per session (`runMode` on the saved practice-run session) and only a
Timed Run mounts the exam clock.

## Why

Praxis is both a timed-mock tool and a browse/review archive, so not every paper
open is an attempt. The previous design defaulted the clock to **off** behind a
play button — which meant a user intending a timed mock could silently sit an
**untimed** one without noticing. Making intent explicit at the threshold removes
that failure mode while keeping casual browsing free of a clock.

## Considered options

- **Auto-start the clock on first answer** — zero gate, but trips the clock for
  someone who is only reading, and the "am I timed right now?" ambiguity remains.
- **Auto-start on paper open** — strongest exam pressure, but punishes the common
  review/browse case the archive exists to serve.
- **Keep it opt-in, make the OFF state louder** — lowest-friction change, but
  still relies on the user noticing and acting; the silent-untimed gap survives.

We chose the explicit gate because the cost of a *silently untimed* attempt
(wasted, untrustworthy practice) outweighs one extra click, and the threshold
doubles as a natural home for the deck's cover/crest moment.

## Consequences

- Entry now has a required interstitial; deep links land on the cover plate, not
  straight on question 1. A restored *finished* run skips the gate (it resolves
  to an Open Run for review).
- `runMode` is part of the persisted session schema. Older saves without it fall
  back to the cover plate (or Open Run if already in results), so the change is
  backward-compatible with existing local sessions.
- The timer's presence is now driven by `runMode === 'timed'`, not by the paper's
  stored `duration`.
