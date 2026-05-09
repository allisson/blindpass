---
name: BlindPass
description: Self-hostable end-to-end encrypted password manager — a quiet, exact, sovereign vault.
colors:
  background: 'oklch(0.975 0.004 265)'
  foreground: 'oklch(0.145 0.006 285)'
  card: 'oklch(0.99 0.003 280)'
  card-foreground: 'oklch(0.145 0.006 285)'
  sidebar: 'oklch(0.952 0.013 285)'
  sidebar-border: 'oklch(0.902 0.008 285)'
  iris-violet: 'oklch(0.38 0.16 295)'
  iris-violet-dark: 'oklch(0.58 0.21 295)'
  signal-teal: 'oklch(0.55 0.12 195)'
  signal-teal-dark: 'oklch(0.72 0.155 195)'
  muted: 'oklch(0.965 0.008 290)'
  muted-foreground: 'oklch(0.556 0.008 285)'
  accent: 'oklch(0.945 0.014 285)'
  border: 'oklch(0.908 0.007 285)'
  input: 'oklch(0.908 0.007 285)'
  destructive: 'oklch(0.577 0.245 27.325)'
  background-dark: 'oklch(0.108 0.008 265)'
  foreground-dark: 'oklch(0.985 0 0)'
  card-dark: 'oklch(0.138 0.01 280)'
  sidebar-dark: 'oklch(0.122 0.01 270)'
  border-dark: 'oklch(0.21 0.014 280)'
  destructive-dark: 'oklch(0.628 0.24 22)'
typography:
  display:
    fontFamily: "'Bricolage Grotesque Variable', 'Geist Variable', sans-serif"
    fontWeight: 500
    letterSpacing: '-0.025em'
    lineHeight: 1.1
  body:
    fontFamily: "'Geist Variable', sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist Variable', sans-serif"
    fontWeight: 500
    fontSize: '0.875rem'
  mono:
    fontFamily: "ui-monospace, 'Cascadia Code', 'SFMono-Regular', monospace"
    letterSpacing: '0.06em'
rounded:
  sm: '0.375rem'
  md: '0.5rem'
  lg: '0.625rem'
  xl: '0.875rem'
  '2xl': '1.125rem'
  full: '9999px'
spacing:
  row-cozy: '0.625rem'
  row-compact: '0.375rem'
  gap-cozy: '0.75rem'
  gap-compact: '0.625rem'
  touch-target: '2.75rem'
components:
  button-primary:
    backgroundColor: '{colors.iris-violet}'
    textColor: '{colors.background}'
    rounded: '{rounded.md}'
    padding: '0.5rem 1rem'
  button-primary-active:
    backgroundColor: '{colors.iris-violet}'
    textColor: '{colors.background}'
  button-ghost:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
  input-default:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '0.5rem 0.75rem'
  input-password:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    typography: '{typography.mono}'
    rounded: '{rounded.md}'
    padding: '0.5rem 0.75rem'
  card-glass:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    padding: '1.5rem'
  panel-sidebar:
    backgroundColor: '{colors.sidebar}'
    textColor: '{colors.foreground}'
  field-label:
    textColor: '{colors.foreground}'
    typography: '{typography.label}'
---

# Design System: BlindPass

## 1. Overview

**Creative North Star: "The Quiet Vault"**

BlindPass is a tool that holds the most sensitive material the user owns and refuses to perform. The interface is calm, slightly cool, and exact — slate-white in the light, blue-shifted obsidian in the dark, with a single violet accent (Iris Violet) that signals brand and a single teal (Signal Teal) that signals state. Cards are flat at rest. Type is structured, not loud. Motion is reserved for the few moments that genuinely matter: unlocking, locking, focus, sync resolution. The whole system is built so the math, not the marketing, is what reassures the user.

Density is deliberate. The layout switches between _cozy_ (default) and _compact_ via `[data-density]`, and touch targets snap to 2.75rem on coarse pointers. There is a fractal-noise overlay at 3.5% opacity across every page (`body::before`) — the analog grain reads as paper texture, never as glitch. Beneath it, a subtle radial _glow_ sits behind the page header (violet in light, dual violet+teal in dark). These textures live underneath; nothing about them should ever land in the foreground.

The system explicitly rejects the SaaS-cream aesthetic of consumer password managers, the corporate-bootstrap charm-vacuum of Bitwarden, the neon-on-black "trustless" theatre of crypto-bro tools, and — the loudest forbidden — the untouched shadcn/v0 default look. shadcn is the substrate, not the design.

**Key Characteristics:**

- OKLCH everywhere; no `#000`, no `#fff`, every neutral tinted toward violet (chroma 0.004–0.014).
- Iris Violet is the brand. Signal Teal is the state accent. Two roles, never blurred.
- Flat surfaces with tonal layering: background → list-panel → card → sidebar.
- Glass effects are reserved for the three signature surfaces (`glass-card`, `glass-panel`, `glass-list-panel`).
- Mono-spaced password fields with 0.06em tracking — the type itself is the security cue.
- Quiet by default, expressive at the moments that matter.

## 2. Colors

A cool, restrained palette: violet-tinted slate-white in light, blue-shifted obsidian in dark, with two and only two saturated accents — Iris Violet for brand and Signal Teal for state.

### Primary

- **Iris Violet** (light: `oklch(0.38 0.16 295)`, dark: `oklch(0.58 0.21 295)`): The brand color and the focus ring color. Used on primary buttons, active route highlights, password-strength bar at full strength, and as the dominant tint in radial glows. Less saturated in light mode for AA contrast on white; more saturated in dark mode to read on obsidian.

### Secondary

- **Signal Teal** (light: `oklch(0.55 0.12 195)`, dark: `oklch(0.72 0.155 195)`): The state accent. Field-group focus dots, password-strength bar mid-progress, sync-state indicators, vital-sign callouts. Never used decoratively. If teal appears, something has changed — focus, validity, sync, alert.

### Neutral

- **Slate-White Background** (`oklch(0.975 0.004 265)` / dark: `oklch(0.108 0.008 265)`): Page background. Cool, tinted toward blue-violet, never pure white or pure black.
- **Cool Card** (`oklch(0.99 0.003 280)` / dark: `oklch(0.138 0.01 280)`): Card and popover surface. One step lighter than background in light, one step lifted from background in dark — tonal layering does the elevation work.
- **Sidebar Panel** (`oklch(0.952 0.013 285)` / dark: `oklch(0.122 0.01 270)`): Slightly more saturated than the page in light; _darker_ than cards in dark mode, since the sidebar sits behind everything.
- **Border** (`oklch(0.908 0.007 285)` / dark: `oklch(0.21 0.014 280)`): Faint violet-tinted divider. 1px max as a stripe; never a colored stripe.
- **Muted Foreground** (`oklch(0.556 0.008 285)` / dark: `oklch(0.62 0.015 265)`): Secondary text, timestamps, helper copy.

### Tertiary

- **Destructive** (`oklch(0.577 0.245 27.325)` / dark: `oklch(0.628 0.24 22)`): Errors, invalid field labels, destructive confirmation accents only. Treated like Signal Teal: if it appears, something is wrong, on purpose.

### Named Rules

**The Two-Accent Rule.** The interface has exactly two saturated colors: Iris Violet and Signal Teal. Iris is identity; Signal is state. Do not introduce a third saturated color for decoration, status, severity beyond destructive, or "data viz variety." If a new role appears, a chart neutral or destructive carries it.

**The OKLCH-Only Rule.** Every color in this codebase is OKLCH. `#000`, `#fff`, hex literals in component CSS, and HSL fallbacks are forbidden in product code. Rare exception: rgba in `inset 0 1px 0 rgba(255,255,255, X)` highlights inside `.glass-card` is allowed because the alpha highlight needs to read identically across both modes.

**The Tinted-Neutral Rule.** Every neutral has chroma between 0.003 and 0.018, biased toward violet/blue (hue 265–295). Pure greys (chroma 0) are forbidden in surface roles.

## 3. Typography

**Display Font:** Bricolage Grotesque Variable (with Geist Variable fallback)
**Body Font:** Geist Variable (with system sans fallback)
**Mono Font:** ui-monospace, Cascadia Code, SF Mono

**Character:** Bricolage's gentle inktraps and slightly wide proportions give headings a confident, editorial weight without theatricality. Geist underneath is technical and neutral — the body voice of a tool that takes itself seriously without raising it. Mono enters only where mono carries meaning: secrets, hashes, the password input itself.

### Hierarchy

- **Display** (Bricolage, 500 weight, clamped scale, `letter-spacing: -0.025em`, line-height 1.1): All `<h1>`–`<h6>` use the heading family. Reserved for page titles, modal titles, and section heads. Negative tracking is non-negotiable — Bricolage at default tracking reads loose.
- **Body** (Geist, 400 weight, 1rem, line-height 1.5): Default surface text. Cap line length at 65–75ch in long-form contexts (settings descriptions, recovery flows).
- **Label** (Geist, 500 weight, 0.875rem): Form labels and inline field titles. Pairs with the field-group accent dot (see Components).
- **Mono / Password** (`ui-monospace`, `letter-spacing: 0.06em`): Password inputs, recovery phrases, hex/base64 fingerprints, command palette accelerators (`⌘K`).

### Named Rules

**The Mono-as-Cue Rule.** Mono is not for "code-y" decoration. It appears only where the content itself is sensitive or literal: passwords, recovery phrases, key fingerprints, raw timestamps. The 0.06em letter-spacing is the visual security cue — wider spacing makes glyph differences (`l` vs `1`, `O` vs `0`) unambiguous.

**The No-Gradient-Text Rule.** Headings are solid color, never `background-clip: text` over a gradient. Hierarchy is carried by family, weight, and tracking — not by chroma.

## 4. Elevation

A **hybrid** system. Surfaces are flat at rest; depth is conveyed primarily through tonal layering (background → list-panel → card → sidebar), and only the signature `.glass-card` surface carries actual `box-shadow`. Sidebars get a single hairline `border-right` instead of a shadow.

### Shadow Vocabulary

- **Glass-Card Light** (`0 4px 6px -1px oklch(0 0 0 / 0.06), 0 2px 4px -2px oklch(0 0 0 / 0.06), inset 0 1px 0 rgba(255,255,255,0.8)`): The auth/unlock card and primary content cards in light mode. Subtle outer shadow with a strong inset top highlight that simulates a glass top edge.
- **Glass-Card Dark** (`0 20px 25px -5px oklch(0 0 0 / 0.5), 0 8px 10px -6px oklch(0 0 0 / 0.5), inset 0 1px 0 rgba(255,255,255,0.06)`): Same surface in dark mode — a much heavier outer shadow because there's no border, plus a faint inset highlight.
- **Input Focus Glow Light** (`0 0 0 2px oklch(0.38 0.16 295 / 0.12)`): 2px violet halo on focused inputs. Gentle, never a glow ring with bloom.
- **Input Focus Glow Dark** (`0 0 0 1px ... / 0.15, 0 0 20px ... / 0.1, inset 0 0 12px ... / 0.04`): A more layered violet halo in dark mode. The inset is what makes the input feel illuminated rather than outlined.

### Named Rules

**The Flat-By-Default Rule.** Most surfaces in this app — list rows, sidebar items, panels, vault items, settings tiles — have zero shadow. Depth comes from tonal layering. Shadows ship only on `.glass-card` and as the focus glow on inputs/textarea/select.

**The Glass-Is-Earned Rule.** `glass-card`, `glass-panel`, and `glass-list-panel` are the three sanctioned glass surfaces. Do not blur or glassify additional surfaces "for parity." Glassmorphism elsewhere is forbidden.

## 5. Components

### Buttons

- **Shape:** Medium radius (`0.5rem`), no internal stroke at rest.
- **Primary:** Iris Violet background, slate-white text. Padding `0.5rem 1rem` cozy. Hover slightly lifts the lightness; active triggers `transform: scale(0.97)` over 100ms ease (the only universal button motion in the system).
- **Ghost / Secondary:** Transparent at rest, accent surface on hover. Used in nav, command palette rows, account menu.
- **Touch targets:** Minimum `2.75rem` height on coarse pointers (set globally via media query).

### Inputs / Fields

- **Style:** Border 1px (`--input` token), radius `0.5rem`, padding `0.5rem 0.75rem`. Background matches page surface, not card.
- **Focus glow:** Violet halo at ~12% opacity in light, layered halo + inset glow in dark. Border shifts to Iris Violet at 60% opacity.
- **Password input:** `type="password"` automatically switches to mono with 0.06em tracking. The character bullet width is wider than body text — visual reinforcement that this content is sensitive.
- **Field group:** Wrap each field in `<div class="field-group">`. The label gets an accent dot after it (4px circle). On focus, label color and dot turn Signal Teal with a 6px teal glow. On `data-invalid="true"`, both turn destructive. On any disabled child, the label dims to 50%.
- **Form busy:** `<form aria-busy="true">` dims to 70% opacity and locks pointer events with a 0.15s ease — the only feedback during in-flight submissions.

### Cards

- **`.glass-card`:** The signature surface. Uses a CSS mask trick to draw a 1px gradient border (violet → teal → cool grey, 30% / 15% / 20% opacity) without a stacked element. Card title gets a 3px-wide vertical gradient pill (violet→teal) before it via `::before`. Card header has a 1px border-bottom separator. Used for the auth/unlock card and primary content modals.
- **Internal padding:** `1.5rem` cozy.
- **Radius:** `0.625rem` (`--radius-lg`).

### Panels

- **`.glass-panel`:** Sidebar. Backdrop-blur-xl, sidebar token background, hairline right border. Darker than cards in dark mode (the panel sits behind, not on top).
- **`.glass-list-panel`:** Mid-depth list panel. Backdrop-blur-md, between sidebar and card depth. Used for vault item lists.

### Password Strength Bar

- **Structure:** A `.pw-strength` grid of 4 segments, 3px tall, with `data-score="N"` driving how many segments fill.
- **Fill order:** segments 1-2 → Signal Teal (weak passing), segments 3-4 → Iris Violet (strong). Score 4 also adds a violet drop-shadow glow on the full bar — a single moment of "this password is genuinely strong" feedback.
- **Transitions:** 0.2s ease on background and shadow only.

### Scrollbars

- **Width:** 4px (vertical and horizontal). Track is transparent.
- **Thumb:** Violet-tinted neutral at 20% opacity light / 30% dark, lifting to 35% / 50% on hover. Scrollbars are present but never assertive.

### Signature: Field Label Dot

The 4px accent dot after every `[data-slot="label"]` is the system's most distinctive primitive. It is **not** decoration — it is the field's state read-out. Border grey at rest, Signal Teal on focus (with glow), destructive on invalid (with glow). New form components must include the dot; new state colors must extend the dot's transition palette.

### Background Texture

- **Glow:** A radial-gradient `--glow-bg` token sits behind the page header. Light mode: 5% violet ellipse at top-center. Dark mode: an 18% violet ellipse plus a 10% teal ellipse off to the right, two light sources.
- **Noise:** Fixed `body::before` pseudo-element with an inline SVG `feTurbulence` filter at 3.5% opacity. Breaks the flatness of large color fields without ever being legible.

## 6. Do's and Don'ts

### Do:

- **Do** use Iris Violet for identity and Signal Teal for state — never blur the two roles.
- **Do** keep neutrals tinted (chroma 0.003–0.018, hue 265–295). Pure grey is forbidden.
- **Do** use OKLCH in every new color declaration. Never `#000`, never `#fff`.
- **Do** apply the field-group label dot to every new form input. State color reads through the dot.
- **Do** switch password / recovery-phrase fields to mono with 0.06em tracking. Glyph clarity is a security feature.
- **Do** keep the active-button `scale(0.97)` micro-press as the primary tactile feedback.
- **Do** use tonal layering (background → list-panel → card → sidebar) for depth. Reach for a shadow only on `.glass-card` and input focus glows.
- **Do** respect `prefers-reduced-motion`. The global rule already neutralizes all animation/transition durations.
- **Do** keep page text under 75ch line length. Settings prose, recovery instructions, and error explanations must wrap.
- **Do** label state honestly. "Vault locked." "Unsynced changes: 3." "Conflict on item _github.com_." Cryptographic state is never softened.

### Don't:

- **Don't** ship the untouched shadcn/v0 default look. Slate is the wrong neutral; identical card grids are a smell. shadcn is the substrate, never the design.
- **Don't** reach for SaaS-cream. No marketing pastels, no friendly illustrations, no onboarding confetti. BlindPass is not 1Password.
- **Don't** introduce neon-on-black or web3 gradients. No animated hero blobs, no "trustless" aesthetics. We prove security with the codebase, not with chrome.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe on cards, list rows, or alerts. Forbidden across the system.
- **Don't** apply `background-clip: text` to a gradient on headings. Hierarchy is carried by Bricolage's weight and tracking, not by chroma.
- **Don't** add glassmorphism beyond the three sanctioned surfaces (`glass-card`, `glass-panel`, `glass-list-panel`). New blurred surfaces require an explicit reason and a name.
- **Don't** introduce a third saturated color. If a new state needs an accent, extend Signal Teal's role or use destructive — never invent "warning yellow" or "info blue."
- **Don't** add celebratory toasts, success confetti, or progress animations on routine actions. Save motion for unlock, lock, sync resolution, and destructive confirmation.
- **Don't** add em dashes or `--` in product copy. Use commas, colons, semicolons, periods, or parentheses.
- **Don't** soften timestamps to "a moment ago." Show ISO time or exact relative durations. The voice is exact.
- **Don't** add "Are you sure?" confirmations to non-destructive actions. Trust the operator.
- **Don't** introduce hero-metric templates (big number, small label, supporting stats). Forbidden across the system.
