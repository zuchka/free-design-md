---
version: alpha
name: Builder.io Design System
description: "Builder.io is a developer-collaboration platform whose entire surface lives on pure black canvas — a stark, immersive dark system where a single electric cyan (#18b6f6) does all the heavy lifting as accent, CTA, and brand voice. Headlines break between white-on-black and cyan-on-black mid-sentence, creating a typographic split that announces the brand's bridging role between design and code. The rest is disciplined restraint: a muted charcoal card surface, a single sans-serif (Poppins) across every weight, and no gradients, no illustrations, no decorative chrome — just tight geometry, sharp corners, and the confidence of a platform that lets the product UI do the talking."

colors:
  primary: "#18b6f6"
  on-primary: "#000000"
  ink: "#ffffff"
  body: "#cccccc"
  mute: "#888888"
  hairline: "#2a2d2d"
  hairline-strong: "#3a3d3d"
  canvas: "#000000"
  canvas-soft: "#111414"
  canvas-card: "#202323"
  canvas-card-hover: "#252828"
  canvas-overlay: "#181b1b"
  link: "#18b6f6"
  link-deep: "#0e9fd8"
  accent-purple: "#A97FF2"
  accent-green: "#4ade80"
  on-canvas: "#ffffff"
  success: "#4ade80"
  error: "#ef4444"
  warning: "#f59e0b"
  banner-bg: "#000000"
  banner-text: "#ffffff"

typography:
  display-xl:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 69px
    letterSpacing: -0.5px
  display-lg:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 52px
    letterSpacing: -0.3px
  display-md:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.2px
  display-sm:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 28px
    letterSpacing: -0.1px
  body-lg:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 28px
  body-md:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body-md-strong:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 24px
  body-sm:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  body-sm-strong:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
  caption:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  caption-strong:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
  button-md:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
  button-lg:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
  nav-label:
    fontFamily: "Poppins, Avenir, Helvetica, Arial, sans-serif"
    fontSize: 15px
    fontWeight: 500
    lineHeight: 20px

rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 5px
  lg: 8px
  xl: 12px
  2xl: 16px
  pill: 100px
  full: 9999px

spacing:
  xxs: 5px
  xs: 8px
  sm: 10px
  md: 15px
  lg: 20px
  xl: 25px
  2xl: 30px
  3xl: 40px
  4xl: 60px
  5xl: 80px
  6xl: 120px
  section: 160px

components:
  nav-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-label}"
    height: 64px
    padding: "{spacing.xs} {spacing.3xl}"
    borderBottom: "1px solid {colors.hairline}"
  nav-link:
    textColor: "{colors.body}"
    typography: "{typography.nav-label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xxs} {spacing.sm}"
  nav-cta-contact:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.xxs} {spacing.lg}"
    border: "1px solid {colors.hairline-strong}"
  nav-cta-signup:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.xxs} {spacing.md}"
  banner-announcement:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    borderBottom: "1px solid {colors.hairline}"
    padding: "{spacing.sm} {spacing.2xl}"
    linkColor: "{colors.primary}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.xxs} {spacing.md}"
    border: "2px solid {colors.primary}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.xxs} {spacing.lg}"
    border: "1px solid {colors.hairline-strong}"
  button-ghost:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0px {spacing.xxs}"
  card-feature:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.2xl} {spacing.lg} {spacing.2xl} {spacing.lg}"
  card-feature-dark:
    backgroundColor: "{colors.canvas-overlay}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.2xl} {spacing.lg}"
  hero-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: "{spacing.5xl} {spacing.3xl}"
  hero-headline-accent:
    textColor: "{colors.primary}"
    typography: "{typography.display-xl}"
  feature-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    padding: "{spacing.4xl} {spacing.3xl}"
  feature-band-soft:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
    padding: "{spacing.4xl} {spacing.3xl}"
  tab-pill:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xxs} {spacing.md}"
  tab-pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xxs} {spacing.md}"
  badge-label:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.full}"
  form-input:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0px {spacing.sm}"
    height: 40px
  logo-strip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.mute}"
    typography: "{typography.caption}"
    padding: "{spacing.2xl} {spacing.3xl}"
  ui-panel-mockup:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    borderColor: "{colors.hairline}"
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: "{spacing.3xl} {spacing.3xl}"
    borderTop: "1px solid {colors.hairline}"
  link-inline:
    textColor: "{colors.link}"
    typography: "{typography.body-md}"
  icon-feature:
    textColor: "{colors.primary}"
    backgroundColor: "transparent"
    typography: "{typography.display-sm}"

  ex-pricing-tier:
    description: "Default pricing tier card on charcoal canvas-card surface with hairline border."
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.3xl}"
  ex-pricing-tier-featured:
    description: "Featured tier — primary cyan fill with black text CTA."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.3xl}"
  ex-product-selector:
    description: "Feature comparison summary card on canvas-overlay surface."
    backgroundColor: "{colors.canvas-overlay}"
    rounded: "{rounded.lg}"
    padding: "{spacing.2xl}"
  ex-cart-drawer:
    description: "Subscription summary — line items per plan tier on canvas-card."
    backgroundColor: "{colors.canvas-card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.2xl}"
    item-divider: "{colors.hairline}"
  ex-app-shell-row:
    description: "Sidebar nav row. Active state uses primary cyan as left-edge indicator."
    backgroundColor: "{colors.canvas-soft}"
    activeIndicator: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xxs} {spacing.sm}"
  ex-data-table-cell:
    description: "Data-table chrome. Header uses caption-strong; body uses body-sm."
    headerBackground: "{colors.canvas-overlay}"
    headerTypography: "{typography.caption-strong}"
    bodyTypography: "{typography.body-sm}"
    cellPadding: "{spacing.xs} {spacing.sm}"
    rowBorder: "{colors.hairline}"
  ex-auth-form-card:
    description: "Sign-in / sign-up card on canvas-card surface with form-input primitives."
    backgroundColor: "{colors.canvas-card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.3xl}"
  ex-modal-card:
    description: "Modal dialog surface — canvas-card chrome with hairline border."
    backgroundColor: "{colors.canvas-card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.3xl}"
  ex-empty-state-card:
    description: "Empty-state frame — generous padding on canvas-overlay."
    backgroundColor: "{colors.canvas-overlay}"
    rounded: "{rounded.lg}"
    padding: "{spacing.5xl}"
    captionTypography: "{typography.body-md}"
  ex-toast:
    description: "Toast notification on canvas-card with hairline border."
    backgroundColor: "{colors.canvas-card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sm} {spacing.lg}"
    typography: "{typography.body-sm}"

---


## Overview

Builder.io builds its entire visual identity on a hard black void. The canvas is `{colors.canvas}` `#000000` — not near-black, not 10% dark, but absolute black — and every typographic, interactive, and structural element sits directly against it. This is not a dark-mode toggle; it is the brand's default and only mode. There is no light-surface counterpart. The posture signals that Builder speaks first to engineers and product teams who live in dark editors and terminals.

The single chromatic accent is an electric cyan (`{colors.primary}` `#18b6f6`) that performs triple duty: it is the CTA colour, the brand icon colour, and the semantic highlight for concepts the brand wants to name as its own. The headline on the hero splits mid-sentence — "The **collaborative**" renders in cyan while "workspace for code" returns to white — a move that embeds the brand's value proposition directly into its typographic voice. No other colour carries this kind of semantic weight on the marketing surface.

Type is handled with quiet confidence by a single face, Poppins, across every role. Weight 700 carries all headlines; weight 400 handles body; weight 500 serves buttons and labels. There are no secondary display faces, no monospaced technical captions, no italic voices. Aggressive negative letter-spacing at hero scale (`-0.5px` at 56 px) tightens the geometry of the headline and reinforces the platform's sharp, engineered character.

Surface organisation is minimal: `{colors.canvas}` for backgrounds, `{colors.canvas-card}` `#202323` for elevated feature cards, and `{colors.canvas-overlay}` `#181b1b` for nested or inset panels. Cards carry no shadow — they sit on the black ground distinguished only by their charcoal fill and a `{rounded.lg}` 8 px radius. The UI-panel mockup visible in the screenshot renders at the same charcoal tone, making the product demo feel native to the brand rather than dropped in.

**Key Characteristics:**
- Absolute black canvas — the brand has no light surface and no gradient backdrop. The void IS the design.
- A single electric cyan accent carries every conversion target, every brand highlight, and the hero's typographic inflection point.
- One geometric sans (Poppins) at three weights. No mono face, no secondary display face.
- Sharp-cornered cards (8 px radius) on a black ground with no shadow — elevation is signalled by fill, not depth.
- The hero headline typographic split (white + cyan mid-sentence) is the brand's signature decorative device.
- An announcement banner strip runs full-width above the nav as the page's only secondary communication layer.

## Colors

### Brand & Accent
- **Primary Cyan** (`{colors.primary}` — `#18b6f6`): The single brand accent. Used as the CTA button fill, the builder logo icon, the mid-sentence headline inflection ("collaborative"), h3 section-label colour, and the link colour throughout. When in doubt about what is "brand," follow the cyan.
- **Accent Purple** (`{colors.accent-purple}` — `#A97FF2`): A secondary accent extracted from the CSS `--text-color` custom property. Appears in product-UI contexts and feature callouts — not a primary surface colour but a meaningful secondary voice.
- **Accent Green** (`{colors.accent-green}` — `#4ade80`): Visible in the product-UI mockup as a data-highlight colour (the "Gregory" avatar badge in the screenshot). Used semantically as success/positive-signal inside the product interface layer.

### Surface
- **Canvas** (`{colors.canvas}` — `#000000`): The page's only background. Pure black. Every section, every band, every nav sits on this surface. Nothing is softened to near-black at the page level.
- **Canvas Soft** (`{colors.canvas-soft}` — `#111414`): A very dark charcoal used for inset region backgrounds and occasional section differentiation where pure black would collapse the hierarchy.
- **Canvas Card** (`{colors.canvas-card}` — `#202323`): The elevated card surface. Feature cards, the `ui-panel-mockup`, and code-editor-style panels sit on this tone. Distinguished from pure black without requiring a border or shadow.
- **Canvas Overlay** (`{colors.canvas-overlay}` — `#181b1b`): A mid-step between canvas and canvas-card, used for nested panels, dropdown menus, and inner-panel regions.
- **Hairline** (`{colors.hairline}` — `#2a2d2d`): 1 px dividers, card borders where needed, and input field borders. The brand's version of a subtle separator on a dark ground.
- **Hairline Strong** (`{colors.hairline-strong}` — `#3a3d3d`): The slightly more assertive divider — used as the border on the secondary "Contact sales" nav button.

### Text
- **Ink** (`{colors.ink}` — `#ffffff`): Every primary heading, the nav text, and any text that needs full contrast on the black canvas.
- **Body** (`{colors.body}` — `#cccccc`): Secondary body paragraphs, nav link inactive states, card supporting copy.
- **Mute** (`{colors.mute}` — `#888888`): Lowest-priority text — placeholder states, fine print, deemphasised labels.
- **On Primary** (`{colors.on-primary}` — `#000000`): Text on the cyan CTA button surface. Black-on-cyan preserves legibility and reinforces the inversion.

### Semantic
- **Link** (`{colors.link}` — `#18b6f6`): Inline links. The brand collapses link colour and brand accent into the same value.
- **Success** (`{colors.success}` — `#4ade80`): Positive states, confirmation signals.
- **Error** (`{colors.error}` — `#ef4444`): Destructive actions and validation errors.
- **Warning** (`{colors.warning}` — `#f59e0b`): Caution and pending states.

## Typography

### Font Family
Builder.io uses a single typeface for every context: **Poppins** — a geometric humanist sans with distinctive rounded letterforms that feel both friendly and structured. The full stack is `Poppins, Avenir, Helvetica, Arial, sans-serif`. There is no monospace face, no secondary display face. Poppins at weight 700 / 500 / 400 is the complete working set.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 56px | 700 | 69px | -0.5px | Hero headline — the "The collaborative workspace for code" split. White + cyan two-tone. |
| `{typography.display-lg}` | 40px | 700 | 52px | -0.3px | Section headlines ("Build together", major feature headings). |
| `{typography.display-md}` | 28px | 700 | 36px | -0.2px | Sub-section headings, pricing tier names. |
| `{typography.display-sm}` | 20px | 700 | 28px | -0.1px | Card cluster mini-headings, feature card titles. |
| `{typography.body-lg}` | 18px | 400 | 28px | 0 | Lead paragraph under hero headline ("Push your branch to Builder…"). |
| `{typography.body-md}` | 16px | 400 | 24px | 0 | Default card body copy and feature descriptions. |
| `{typography.body-md-strong}` | 16px | 700 | 24px | 0 | Inline emphasis within body paragraphs. |
| `{typography.body-sm}` | 14px | 400 | 20px | 0 | Secondary body, nav link text, card supporting copy. |
| `{typography.body-sm-strong}` | 14px | 500 | 20px | 0 | Tab pill labels, button labels, metadata emphasis. |
| `{typography.caption}` | 12px | 400 | 16px | 0 | Fine print, small UI labels, ghost button text. |
| `{typography.caption-strong}` | 12px | 500 | 16px | 0 | Badge labels, section eyebrows, table headers. |
| `{typography.button-md}` | 14px | 500 | 20px | 0 | CTA buttons at nav scale and card scale. |
| `{typography.button-lg}` | 16px | 600 | 24px | 0 | Hero-scale and marketing-band CTA labels. |
| `{typography.nav-label}` | 15px | 500 | 20px | 0 | Nav link row labels and dropdown triggers. |

### Principles
- **The typographic split IS the brand moment.** The hero headline breaks mid-sentence between white (`{colors.ink}`) and cyan (`{colors.primary}`). This is not an animation or hover effect — it is a static, always-on typographic device. Do not flatten it to a single colour.
- **Weight 700 for every headline, no exceptions.** Poppins is never used at weight 800 or 900 on the marketing surface. The brand's heaviness ceiling is 700.
- **Negative tracking at hero scale.** The `-0.5px` letter-spacing at 56 px tightens Poppins's naturally open geometry into something more structural. Do not reset tracking at large sizes.
- **Sentence-case headlines.** The brand writes headlines in sentence case ("The collaborative workspace for code") — never title case, never all-caps.
- **No mono face.** Unlike developer-platform peers, Builder.io does not use a monospaced caption layer. Code snippets visible in the product mockup inherit the page's sans-serif system rather than switching to a mono face at the marketing level.

## Layout

### Spacing System
- **Base unit**: 5 px. The extracted scale is 5 / 8 / 10 / 15 / 20 / 25 / 30 / 40 / 60 px — a pragmatic 5 px base rather than the more common 4 px. This means `{spacing.xxs}` is 5 px and the scale builds from there.
- **Tokens**: `{spacing.xxs}` 5px · `{spacing.xs}` 8px · `{spacing.sm}` 10px · `{spacing.md}` 15px · `{spacing.lg}` 20px · `{spacing.xl}` 25px · `{spacing.2xl}` 30px · `{spacing.3xl}` 40px · `{spacing.4xl}` 60px · `{spacing.5xl}` 80px · `{spacing.6xl}` 120px · `{spacing.section}` 160px.
- **Section padding**: marketing bands use `{spacing.4xl}` to `{spacing.5xl}` top/bottom. The hero band stretches to `{spacing.5xl}` to give the split headline room.
- **Card interior padding**: feature cards sit at `{spacing.2xl}` horizontal by `{spacing.2xl}` vertical (30 px × 20 px extracted). The tighter interior keeps the dark card from feeling cavernous.
- **Inline gap**: button rows and nav clusters use `{spacing.sm}` to `{spacing.md}` (10–15 px) between siblings.

### Grid & Container
- **Max width**: approximately 1280 px content width. Horizontal gutters of `{spacing.3xl}` 40 px on desktop.
- **Column patterns**:
  - Hero: full-width text column left, product-UI mockup panel right (60 / 40 split at desktop).
  - Feature card grid: 2–3 up at desktop, 1-up at mobile.
  - Feature band: alternating text-left/panel-right or text-right/panel-left two-column layouts.
  - Logo strip: single horizontal row of partner/customer logos.

### Whitespace Philosophy
The black canvas absorbs whitespace differently from light surfaces — generous vertical spacing between bands is required to prevent the page from reading as a single undifferentiated dark mass. Section gaps are `{spacing.4xl}` to `{spacing.5xl}`. Inside cards, the tight `{spacing.2xl}` interior padding keeps the charcoal fill from overwhelming the content. The page reads as deliberate and engineered: large section gaps, tightly padded cards, no decorative fills to soften the transitions.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Level 0 — Flat | No shadow, no border. Pure `{colors.canvas}` black. | Hero bands, nav bar, footer, all full-bleed sections. |
| Level 1 — Card Fill | Background lifts to `{colors.canvas-card}` `#202323`. No shadow, no border. | Feature cards, UI panel mockup, inline code panels. |
| Level 2 — Overlay Fill | Background lifts to `{colors.canvas-overlay}` `#181b1b`. | Nested panels, inner panel regions, dropdown menus. |
| Level 3 — Hairline Card | `{colors.canvas-card}` fill + 1px `{colors.hairline}` border. | Cards that need edge definition against the black ground. |
| Level 4 — Soft Fill + Border | `{colors.canvas-soft}` fill + 1px `{colors.hairline}` border. | Pricing tiers, comparison cards, auth form cards. |

Builder.io uses **fill-based elevation only** — no drop shadows appear on the marketing surface. Cards are distinguished from the canvas purely by their `{colors.canvas-card}` fill. This keeps the system stark and flat, coherent with the brand's immersive-dark aesthetic. The absence of shadow is deliberate and non-negotiable.

### Decorative Depth
- **The hero product-UI mockup as depth**: the `ui-panel-mockup` panel sitting in the right half of the hero creates the only sense of physical depth on the page — a real product surface emerging from the black void.
- **Cyan highlight as focal depth**: the electric cyan accent functions as a visual Z-axis cue, drawing the eye forward against the black ground without requiring shadow or blur.
- **Black-on-black section rhythm**: alternating between `{colors.canvas}` and `{colors.canvas-soft}` / `{colors.canvas-card}` bands creates subtle section transitions without introducing any light surface.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed bands, the banner strip, footer. |
| `{rounded.xs}` | 2px | Tightest UI micro-elements. |
| `{rounded.sm}` | 4px | Ghost buttons, nav dropdown items, tab indicators. |
| `{rounded.md}` | 5px | The brand's primary interactive radius — CTA buttons, form inputs, nav CTA buttons. |
| `{rounded.lg}` | 8px | Feature cards, UI panel mockup, modal surfaces. |
| `{rounded.xl}` | 12px | Larger card variants hosting images. |
| `{rounded.2xl}` | 16px | Oversized panel containers. |
| `{rounded.pill}` | 100px | Pill badges and announcement banner chips. |
| `{rounded.full}` | 9999px | Circular avatar frames and icon containers. |

The brand's characteristic shape is the `{rounded.md}` 5 px button — noticeably tighter than a pill, slightly softer than a square. It reads as engineered rather than friendly.

## Components

### Buttons

**`button-primary`** — the canonical cyan CTA button.
- Background `{colors.primary}`, text `{colors.on-primary}` (black on cyan), label in `{typography.button-md}`, padding `{spacing.xxs} {spacing.md}`, border `2px solid {colors.primary}`, shape `{rounded.md}` 5 px. The "Start building →" and "Sign up" buttons follow this spec exactly.

**`button-secondary`** — the outlined ghost button paired with the primary CTA.
- Background transparent, text `{colors.ink}`, 1 px solid `{colors.hairline-strong}` border, same typography + padding as `button-primary`, shape `{rounded.md}`. Used for "Contact sales" and secondary page CTAs.

**`button-ghost`** — the ultra-low-contrast inline button for UI panel controls.
- Background `rgba(255,255,255,0.05)`, text `{colors.ink}`, label in `{typography.caption}` (12 px), padding `0px {spacing.xxs}`, shape `{rounded.sm}` 4 px. Visible inside the product-UI mockup panel.

**`tab-pill`** — inactive panel tab (Agent / Layers / Comments tabs in the UI mockup).
- Background `{colors.canvas-card}`, text `{colors.ink}`, label in `{typography.body-sm-strong}`, shape `{rounded.sm}`.

**`tab-pill-active`** — active panel tab (the "Style" tab selected state in the screenshot).
- Background `{colors.primary}`, text `{colors.on-primary}`, same shape + typography as `tab-pill`.

### Navigation

**`nav-bar`** — the sticky top navigation bar.
- Background `{colors.canvas}`, text `{colors.ink}`, height 64 px, padding `{spacing.xs} {spacing.3xl}`. Layout: logo left, link row centre, "Contact sales + Sign up" cluster right. Separated from the banner above by a 1 px `{colors.hairline}` bottom border.

**`nav-link`** — the centred dropdown-trigger links (Platform / Resources / Docs / Enterprise / Pricing).
- Text `{colors.body}`, label in `{typography.nav-label}`, padding `{spacing.xxs} {spacing.sm}`, shape `{rounded.sm}`.

**`nav-cta-contact`** — the "Contact sales" outlined button in the nav.
- Background transparent, text `{colors.ink}`, 1 px solid `{colors.hairline-strong}` border, shape `{rounded.md}`.

**`nav-cta-signup`** — the "Sign up" filled cyan button in the nav.
- Background `{colors.primary}`, text `{colors.on-primary}`, shape `{rounded.md}`.

**`banner-announcement`** — the full-width strip above the nav.
- Background `{colors.canvas}`, text `{colors.ink}`, body in `{typography.body-sm}`, padding `{spacing.sm} {spacing.2xl}`, with an inline cyan link + arrow for the CTA. The brand's dedicated channel for event announcements and product news.

### Cards & Containers

**`card-feature`** — the primary feature card in the "Build together" section.
- Background `{colors.canvas-card}`, text `{colors.ink}`, padding `{spacing.2xl} {spacing.lg} {spacing.2xl} {spacing.lg}`, shape `{rounded.lg}`. Icon at top-left in `{colors.primary}`, title in `{typography.display-sm}`, body in `{typography.body-md}`.

**`card-feature-dark`** — a slightly darker nested card variant.
- Background `{colors.canvas-overlay}`, same padding + shape as `card-feature`.

**`ui-panel-mockup`** — the product-UI demonstration panel in the hero.
- Background `{colors.canvas-card}`, text `{colors.ink}`, padding `{spacing.lg}`, shape `{rounded.lg}`, 1 px `{colors.hairline}` border. Contains actual product UI chrome (tabs, layout controls) rendered at the card level.

### Hero & Bands

**`hero-band`** — the primary hero section with the split headline.
- Background `{colors.canvas}`, text `{colors.ink}`, padding `{spacing.5xl} {spacing.3xl}`. Inside: the typographic split headline in `{typography.display-xl}` (white + cyan), body lead in `{typography.body-lg}`, then `button-primary` CTA row. The `ui-panel-mockup` fills the right column.

**`hero-headline-accent`** — the cyan portion of the split hero headline.
- Text `{colors.primary}`, typography `{typography.display-xl}`. This is a sub-element of `hero-band`, documented separately because it is the brand's most distinctive typographic device.

**`feature-band`** — a secondary content section with feature copy and a product panel.
- Background `{colors.canvas}`, text `{colors.ink}`, padding `{spacing.4xl} {spacing.3xl}`, section headline in `{typography.display-lg}`.

**`feature-band-soft`** — a softly differentiated band for alternating sections.
- Background `{colors.canvas-soft}`, text `{colors.ink}`, same padding as `feature-band`.

### Utility

**`badge-label`** — inline semantic label (h3-level section eyebrows in cyan).
- Text `{colors.primary}`, typography `{typography.caption-strong}`, no background fill.

**`form-input`** — the standard text input.
- Background `{colors.canvas-card}`, text `{colors.ink}`, 1 px `{colors.hairline}` border, body `{typography.body-sm}`, height 40 px, shape `{rounded.md}`.

**`logo-strip`** — partner/customer logo row.
- Background `{colors.canvas}`, text `{colors.mute}`, padding `{spacing.2xl} {spacing.3xl}`. Logos rendered as low-contrast monochrome marks consistent with the dark canvas.

**`footer`** — the bottom navigation and legal section.
- Background `{colors.canvas}`, text `{colors.body}`, body `{typography.body-sm}`, padding `{spacing.3xl} {spacing.3xl}`, 1 px `{colors.hairline}` top border.

**`link-inline`** — body-copy inline links.
- Text `{colors.link}` (`#18b6f6`), typography `{typography.body-md}`.

**`icon-feature`** — the icon mark above feature card titles.
- Text `{colors.primary}`, used at `{typography.display-sm}` scale.

## Do's and Don'ts

### Do
- Render the hero headline as a typographic split — white for the functional words, cyan for the brand concept word ("collaborative"). This is the brand's signature device.
- Use `{colors.primary}` `#18b6f6` for every primary CTA, every icon accent, and every h3 section label. The cyan is the entire accent system.
- Set every headline in `{typography.display-*}` Poppins weight 700, sentence-case, with negative letter-spacing at hero scale.
- Keep the canvas pure black `{colors.canvas}` `#000000` at the page level. Never soften the page background to near-black.
- Distinguish card surfaces from the canvas by fill alone — `{colors.canvas-card}` `#202323` without shadow or border is the brand's elevation language.
- Use `{rounded.md}` 5 px for every interactive button — tighter than a pill, softer than a square. This shape is the brand's interaction signature.
- Pair the primary cyan CTA with a secondary outlined `button-secondary` in every CTA cluster.

### Don't
- Don't introduce a light-mode surface. Builder.io has no white or near-white background variant in its marketing presentation.
- Don't add drop-shadows to cards. Elevation is communicated by fill colour only — the brand reads as flat and dark.
- Don't render headlines in title case or all-caps. Sentence-case is non-negotiable.
- Don't use the cyan accent as a background fill for section bands. Cyan is a foreground accent only — it never floods a section background.
- Don't introduce a second typeface. Poppins at three weights is the complete typographic system.
- Don't push Poppins above weight 700. The brand's display ceiling is 700; heavier weights break the visual rhythm.
- Don't reset letter-spacing to 0 at hero scale. The `-0.5px` tracking at 56 px is load-bearing — it tightens Poppins into the brand's engineered voice.
- Don't miniaturise the hero typographic split. The white/cyan two-tone headline works only at `{typography.display-xl}` scale — do not reproduce it at body or caption sizes.
