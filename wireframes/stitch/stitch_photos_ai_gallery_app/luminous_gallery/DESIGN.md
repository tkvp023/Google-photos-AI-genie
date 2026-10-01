---
name: Luminous Gallery
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1b1c'
  on-surface-variant: '#544339'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#877367'
  outline-variant: '#dac2b4'
  surface-tint: '#944a07'
  primary: '#944a07'
  on-primary: '#ffffff'
  primary-container: '#ff9f5a'
  on-primary-container: '#733700'
  inverse-primary: '#ffb786'
  secondary: '#0056c3'
  on-secondary: '#ffffff'
  secondary-container: '#1f6feb'
  on-secondary-container: '#fefcff'
  tertiary: '#6b5c4d'
  on-tertiary: '#ffffff'
  tertiary-container: '#c7b3a1'
  on-tertiary-container: '#534537'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc6'
  primary-fixed-dim: '#ffb786'
  on-primary-fixed: '#311300'
  on-primary-fixed-variant: '#723600'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#afc6ff'
  on-secondary-fixed: '#001944'
  on-secondary-fixed-variant: '#004299'
  tertiary-fixed: '#f4dfcc'
  tertiary-fixed-dim: '#d7c3b1'
  on-tertiary-fixed: '#24190e'
  on-tertiary-fixed-variant: '#524437'
  background: '#fcf9f8'
  on-background: '#1b1b1c'
  surface-variant: '#e5e2e1'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 0.125rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system reimagines the contemporary mobile media gallery experience. It pairs the structural discipline of Material Design 3 with an experimental identity anchored around a radiant peach AI sparkle signature. While traditional photo managers rely on sterile neutral canvases and predictable utility blues, this system shifts intelligent curation, conversational search, and generative memory-making to the forefront of the visual narrative.

The aesthetic fuses crisp modern minimalism with soft, warm tactile accents. Precision-engineered typography introduces a futuristic, computational tone through geometric display forms, grounded by a human, readable body typeface. The experience feels fast, fluid, and delightfully perceptive—turning a static digital archive into a living, intelligent visual journal.

## Colors

The palette establishes an inverted visual hierarchy: warmth and discovery take precedence over cold utility. 

- **Primary (`#FF9F5A`):** The vibrant radiant peach anchors intelligence, four-point sparkle accents, active filter states, and expressive highlights.
- **Secondary (`#1F6FEB`):** A sharp cobalt blue reserved strictly for explicit operational actions, batch confirmations, and key utilitarian commitments.
- **Tertiary (`#FFE9D6`):** A gentle peach mist utilized for conversational containers, contextual discovery summaries, and AI coach cards. Selected filter chips utilize `#FFD3AE` for enhanced contrast against white backdrops.
- **Neutrals & Surfaces:** Pure white (`#FFFFFF`) serves as the base viewport backdrop, allowing photography to remain color-accurate. System containers, search pills, and floating sheets step through `#F5F6F8` and `#EEF0F3`. Text hierarchies use `#1F1F1F` for primary legibility and `#5F6368` for secondary metadata and timestamps, bounded by delicate `#E3E5E8` dividers.

## Typography

The type system creates tension between machine-guided curation and organic memories. 

Space Grotesk commands display moments, month-and-year chronological transitions, and assistant dialogue headers with geometric edge and technical presence. Plus Jakarta Sans handles body copy, file attributes, metadata, and interactive touch controls with balanced counters and humanist legibility.

In alignment with accessibility requirements, no interactive body or functional reading text drops below 14px. Display titles gracefully scale via dedicated mobile typography tokens to ensure headers never crowd edge margins on compact viewports.

## Layout & Spacing

The layout employs a high-density, media-optimized rhythm.

- **Photo Stream Architecture:** Main gallery views use a 3-column fluid grid connected by tight 2px gutters (`gutter: 0.125rem`), maximizing visual coverage while retaining clean edge separation.
- **Edge Boundaries:** Top toolbars, memory carousels, assistant notifications, and floating navigation modules conform to a 16px lateral margin (`margin: 1rem`).
- **Responsive Adaptations:** On tablet viewports (600px+), the media stream expands to a 5-column grid; desktop widths (1024px+) utilize a 6-to-8-column structure capped within a centered 1280px max-width container, transitioning bottom floating controls into an anchored navigation rail.

## Elevation & Depth

Visual depth is achieved through layered tonal surfaces and ultra-diffused ambient shadows rather than harsh physical borders.

- **Level 0 (Base Canvas):** `#FFFFFF` static canvas for pure image viewing.
- **Level 1 (Docked Containers & Headers):** `#EEF0F3` search capsule and `#F5F6F8` memory backdrops, relying solely on tonal distinction with zero drop shadow.
- **Level 2 (Assistant Insights):** Soft peach cards (`#FFE9D6`) featuring an ambient glow: `0px 8px 24px -4px rgba(255, 159, 90, 0.18)`.
- **Level 3 (Floating Controls):** Floating navigation capsules and the AI Floating Action Button (FAB) sit elevated over the image grid using dual-layer diffusion: `0px 4px 12px rgba(0, 0, 0, 0.06), 0px 12px 32px rgba(0, 0, 0, 0.08)`. Translucent blur treatments (`backdrop-filter: blur(16px)`) ensure scrolling imagery beneath the floating nav stays subdued.

## Shapes

The design system embraces an expressive pill-shaped geometry (`roundedness: 3`). 

Interactive touch points—including search bars, chips, floating docks, and primary callouts—utilize full 28px–32px radii, conveying friendly tactile accessibility. In stark, deliberate contrast, individual media thumbnails in the primary photo grid maintain sharp 0px corners to treat photography with gallery-grade discipline. Curated memory clusters, algorithmic reels, and conversational cards take a moderate 8px radius to preserve their identity as bundled artifacts.

## Components

### Search Bar
- **Dimensions & Geometry:** Height 56px, fully rounded pill (28px radius).
- **Surfaces & Borders:** Background `#EEF0F3`, no border.
- **Layout:** Leading search icon (`#5F6368`), centered Space Grotesk "Photos" logo or input placeholder (`#1F1F1F`), trailing 32px circular user profile avatar with subtle `#E3E5E8` outer boundary.
- **Interactive State:** Expands slightly on active focus, swapping leading icon for a back arrow and revealing AI sparkled search prompts.

### Filter & Category Chips
- **Dimensions & Geometry:** Height 40px, fully rounded pill form factor, minimum tap width 48px.
- **Unselected:** Transparent surface, 1px border `#C7CBD1`, text `#1F1F1F` in 14px `label-md`.
- **Selected:** Solid fill `#FFD3AE`, no border, text `#1F1F1F`, accompanied by a leading 16px checkmark icon rendered in `#1F1F1F`.

### Photo Stream & Memory Tiles
- **Gallery Grid:** 3 columns, square (1:1) aspect ratio, sharp 0px edges, separated by 2px gutters.
- **Memory Highlights:** Aspect ratio 4:5 or 16:9 cards, 8px border radius, subtle dark-gradient scrim at bottom for date and location legibility.

### Floating Navigation & AI Action System
- **Floating Dock:** Height 64px, pill capsule with 32px radius, `#FFFFFF` with 85% opacity and 16px backdrop blur, elevated by Level 3 ambient shadow. Accommodates "Photos" (active), "Collections", and "Create" with 24px iconography and 12px labels.
- **Active Navigation Pill:** Active destinations highlighted with a soft peach indicator fill (`#FFE9D6`) and `#FF9F5A` icon tint.
- **AI "Ask Photos" FAB:** Distinct 56px circular floating action button positioned adjacent to the main dock. Coated in `#FF9F5A` with white iconography featuring a combined magnifying lens and four-point sparkle mark.

### AI Insight Cards
- **Structure:** 8px border radius, `#FFE9D6` surface container, 16px internal padding.
- **Accents:** Leading `#FF9F5A` four-point sparkle badge, Space Grotesk headline, and actionable suggestion chips along the base.

### Primary Action Buttons
- **Geometry:** Height 48px, full pill shape (24px radius).
- **Surfaces:** Utilitarian actions use `#1F6FEB` with crisp `#FFFFFF` text. Generative and curation confirmations utilize `#FF9F5A` with `#FFFFFF` text. Minimum tap target strictly 48px.