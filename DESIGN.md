# Praxis Landing Design System

## Stack Decision

- Use **Tailwind CSS** as the primary styling system.
- Use **shadcn/ui** as an accessibility-first component base where needed.
- Rule of thumb:
  - **Layout, spacing, typography, color, motion** -> Tailwind utility classes + CSS variables.
  - **Interactive primitives** (Button, Dialog, Popover, etc.) -> shadcn components customized to this spec.

Why:
- Tailwind gives fast control for custom cinematic layouts.
- shadcn gives reliable keyboard/focus behavior and component structure.
- Together they keep speed + quality without locking us into rigid prebuilt design kits.

## Core Direction: Image-First, Dark Glass

The landing page is an **image-led, cinematic experience**, not an editorial paper layout.

- Every (or nearly every) section is a **full-bleed image** that fills its block edge-to-edge.
- UI — headings, body, buttons, controls — sits **on top of the image** inside **dark frosted-glass panels**, never in white cards.
- The warm paper theme used elsewhere in the app does **not** lead here; it appears rarely, if at all, on the landing page.
- The one consistent warm note is the blue accent (`--primary`), used sparingly for primary action and focus.

Treatment summary:
- Full-bleed imagery per section.
- Dark translucent glass panels (backdrop blur + whisper border) carry the text.
- Light text on dark glass; blue accent as the single pop.

## Design Intent (Theme + Lore)

The visual tone should match a calm, reflective journey:
- quiet confidence, not aggressive hype
- atmospheric, immersive imagery as the primary surface
- high-contrast readability achieved through glass + scrim, not flat backgrounds
- restrained motion and a single warm accent

Use this emotional arc across sections:
1. stillness (hero)
2. proof (stats)
3. discovery (exam cards/search)
4. guidance (how it works)
5. belonging (programs)
6. commitment (final CTA)

Imagery can carry the arc directly: a brighter, serene frame for stillness; moodier frames for tension; a resolved warm frame for commitment.

## Color System

The page reads **dark over imagery**. Existing app variables in `src/index.css` still supply the accent and semantic colors; the surfaces are mostly image + glass.

Core usage:
- Section surface:
  - the **image itself** is the background — no `bg-background` / `bg-card` block fills on full-bleed sections
- Glass panels (the UI containers over images):
  - dark translucent base (e.g. `bg-black/40`–`bg-black/60`) + `backdrop-blur`
  - whisper border via `border-white/10`–`border-white/15`
  - soft layered shadow for separation from the image
- Text over imagery:
  - primary text light (`text-white` / `text-white/90`)
  - secondary text `text-white/70`
- Accent:
  - `bg-primary` / `text-primary` / `ring-primary/40` — the single warm pop, used for primary CTA and focus

Legibility rules:
- Where text sits directly on an image (no panel), add a **gradient scrim** (e.g. dark-to-transparent) sized to the text block, not the whole frame.
- Keep glass dark enough to clear AA contrast against the brightest part of the image behind it.
- Borders stay whisper-light; never hard outlines.
- Shadows stay soft and layered, never harsh.

## Typography

Fonts:
- **Body / UI:** Geist (`--body-font` / `font-body`, via `@fontsource-variable/geist`). Inter remains the fallback in the stack.
- **Display headline:** Instrument Serif (`--display-font` / `font-display`, via `@fontsource/instrument-serif`). Used large for the hero headline; italic carries emphasis instead of an extra weight.
- The serif headline against the Geist body is the page's typographic signature — keep the serif for display only, not body or controls.

Hierarchy:
- Hero display: 72/48 (desktop/mobile), weight 700, tight tracking.
- Major section heading: 40, weight 700.
- Card title: 18, weight 600-700.
- Body copy: 16, weight 400.
- Metadata/labels: 12-14, weight 500-600.

Tracking rules:
- Large text gets tighter tracking.
- Body text remains normal tracking for readability.

Over-image rules:
- Light text by default; rely on glass or scrim for contrast rather than heavy text shadows.
- A subtle text shadow is allowed only where a scrim is impractical.

## Buttons

All buttons live over imagery, so they must hold up against a busy background.

Primary CTA:
- `bg-primary text-primary-foreground`
- strong visual weight, subtle hover brightening
- rounded 4-6px
- medium/semibold label
- clearly readable over any frame (the accent is opaque, not glass)

Secondary CTA:
- dark frosted glass (`bg-white/10` + `backdrop-blur`, `border-white/20`)
- light text
- hover to a slightly stronger glass tint

Interaction:
- all buttons must have clear keyboard focus rings (`ring-primary/40` or a light ring over dark glass)
- active state should feel deliberate (small scale/opacity shift allowed)

## Layout Flow

Landing page flow (each is a full-bleed image section with glass UI on top):
1. Hero (full viewport image, minimal glass content)
2. Stats bar
3. Exam type cards
4. Search block
5. How it works
6. Programs
7. Final CTA

Rhythm:
- Full-bleed sections stack edge-to-edge; rhythm comes from changing imagery and glass placement, not from alternating flat surfaces.
- Vary glass panel position/size between sections so the page does not feel like one repeated template.
- Major section spacing inside panels: 64-96px desktop, 48px mobile.
- Base spacing unit: 8px.

## Animation & Motion

Motion should be subtle and meaningful.

Allowed patterns:
- Hero entrance: staggered fade + slight upward translate (eyebrow -> headline -> sub -> CTAs -> portraits, ~110ms apart).
- Background: slow Ken-Burns drift (`.animate-kenburns`, ~18s scale) on the hero image; reduced-motion safe via `prefers-reduced-motion: no-preference`.
- Buttons: subtle lift + brighten on hover.
- Card hover: small lift + border tint + arrow nudge.
- CTA hover: slight brightness/depth shift.
- Scroll indicator: gentle bounce loop.

Timing:
- Fast interactions: 120-180ms.
- Section reveals: 240-400ms.
- Easing: prefer smooth ease-out.

Do not:
- use heavy parallax
- use long decorative animation loops
- animate everything; animate intent-critical cues only

## Imagery Rules

Asset source: `src/assets/`.

Two asset groups:
- **Cinematic stills** (wide `.png`) -> section/hero backgrounds.
- **Character portraits** (square-ish `.jpeg`) -> people, avatars, program/feature cards.

Usage:
- Each section gets **one** dominant full-bleed image; do not stack competing images in a single section.
- Match the frame's mood to the section's place in the arc (serene for stillness, dramatic for tension, warm/resolved for commitment).
- Always pair imagery with the legibility treatment (dark glass panel and/or gradient scrim) so overlaid UI clears AA contrast.
- Bright frames still need a scrim under text; dark frames may need a lighter touch.

Performance:
- Several source stills are 9-11MB PNGs. Compress/resize and prefer `.webp` before shipping any full-bleed background.
- Provide responsive sizes; do not serve multi-MB heroes to mobile.
- Lazy-load below-the-fold section images; eager-load only the hero.

## Accessibility Baseline

- Preserve semantic heading order.
- Ensure visible focus for all interactive elements (rings must be visible over dark glass and imagery).
- Maintain AA contrast for text and controls **against the image behind them**, using glass/scrim to guarantee it.
- Add labels for search inputs and icon-only actions.
- Use `aria-live` for async loading/result states where relevant.
- Background images are decorative: keep them out of the accessibility tree (empty `alt` / CSS backgrounds), and never put essential text inside an image.
- Respect `prefers-reduced-motion`: drop entrance/scroll animations to simple fades or none.

## Responsive Rules

- Mobile-first composition.
- Full-bleed images use `object-cover` with sensible focal points so the subject survives cropping across aspect ratios.
- Hero display scales down to ~48px.
- Multi-column sections collapse to 1 column on small screens.
- Glass panels go full-width with comfortable padding on small screens.
- Inputs and CTAs become full-width where needed.

## Implementation Strategy

1. Build section skeleton: full-bleed image container + semantic headings + glass panel.
2. Apply the dark-glass + scrim legibility system and typography scale.
3. Add the button system (opaque primary, glass secondary) over imagery.
4. Wire real data into cards/search/stats.
5. Add restrained motion (respecting reduced-motion).
6. Validate responsive cropping, performance (image weight), and accessibility passes.

## Non-goals (for this pass)

- No full brand-system redesign of the entire app (this image-first language is landing-page only).
- No complex animation framework.
- No component-library migration beyond selective shadcn usage.
- No reintroduction of white-card / editorial-paper layouts on the landing page.
