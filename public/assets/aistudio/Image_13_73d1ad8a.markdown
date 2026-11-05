---
name: Apex Security & Ledger
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#ffb3ad'
  on-secondary: '#68000a'
  secondary-container: '#a40217'
  on-secondary-container: '#ffaea8'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ad'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#930013'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a high-contrast, security-first aesthetic built specifically for critical fintech operations and threat intelligence platforms. The tone is authoritative, analytical, and uncompromisingly precise. 

The UI evokes an immediate sense of absolute control and vigilance. It communicates stability through deep, light-absorbing dark backgrounds while using high-frequency neon accents to draw instant focus to risk factors, anomalies, and active ledger states. Every visual element is optimized for rapid cognitive processing during high-stress monitoring scenarios.

## Colors

The palette is anchored by deep slate foundations (`#0B0F19` for primary canvas surfaces and `#0F172A` for elevated card containers) designed to reduce eye strain during prolonged monitoring sessions. 

Electric blue (`#3B82F6` and `#60A5FA`) serves as the primary system accent for interactive states and standard navigational elements. Critical risk indicators and threat vectors are rendered in high-visibility neon red (`#EF4444`), while system warnings, pending transactions, and cautionary states rely on high-contrast amber (`#F59E0B`). Text hierarchy uses crisp cool whites and silver-grays to maintain maximum legibility against dark backdrops.

## Typography

The typography pairing cleanly separates standard interface copy from financial and cryptographic data. `Inter` drives the core UI, providing a neutral, highly legible sans-serif structure for dashboards, navigation, and long-form data tables. 

`JetBrains Mono` is strictly reserved for transaction IDs, cryptographic hashes, block heights, and currency amounts. The monospaced treatment ensures precise vertical alignment of financial figures and scannability of complex identifiers. Font sizes above 32px automatically scale down on mobile viewports to prevent layout overflow.

## Layout & Spacing

The layout relies on a strict 12-column fluid grid system paired with dense, highly structured data density rules. The design uses fixed canvas margins (`2rem` on desktop, `1rem` on mobile) with consistent `1.5rem` gutters to organize complex telemetry feeds, multi-pane security monitors, and high-volume transaction ledgers.

Spacing scales down proportionally on mobile viewports, converting multi-column threat maps into single-column vertical feed stacks while maintaining precise component padding intervals.

## Elevation & Depth

Depth is established primarily through low-contrast outlines and tonal surface layering rather than heavy drop shadows. 

Surfaces utilize crisp, ultra-thin borders (`1px` solid slate lines) to delineate containers against the deep background. Floating elements like command palettes and modal overlays incorporate subtle ambient glows—tinted with electric blue or neon red depending on context—to signal interactivity and urgency without breaking the flat, technical precision of the interface.

## Shapes

The design system enforces a restrained, sharp-edged shape language (`0` to `1` roundedness scale). UI elements feature tight radii (`0.25rem` for standard components, `0.5rem` for major containers) to preserve an engineered, utilitarian aesthetic. Pill shapes are strictly reserved for status badges, risk level indicators, and tag counters.

## Components

Components are engineered for high-density information display and rapid user response times.

- **Buttons:** Built with crisp borders and minimal corner rounding. Primary actions use solid electric blue; destructive or high-risk overrides use neon red. Focus states feature high-contrast luminous outlines.
- **Chips & Badges:** Pill-shaped indicators mapped directly to risk metrics. Critical risks utilize flashing or solid neon red backgrounds; warnings use amber; operational states use electric blue or muted slate.
- **Lists & Tables:** Dense data rows separated by hairline borders. Monospace fonts align numerical data, currencies, and cryptographic hashes natively. Hover states instantly highlight full-width telemetry rows.
- **Checkboxes & Radios:** Sharp, square geometry with high-contrast active states. Selected states fill entirely with the primary electric blue accent.
- **Input Fields:** Dark slate wells featuring subtle border illumination on focus. Monospaced variants are available for direct hash or currency entry.
- **Cards:** Elevated `#0F172A` containers featuring thin borders, clear header telemetry, and dedicated zones for real-time sparklines or risk meters.
- **Additional Components:** Command palettes for rapid navigation, terminal-style log output streams with auto-scroll toggles, and multi-factor authentication prompt modals.