---
name: "Rental App"
description: "The Verity visual family, specialized for rental operations."
colors:
  primary: "hsl(221 94% 48%)"
  primary-hover: "hsl(221 94% 41%)"
  primary-foreground: "hsl(0 0% 100%)"
  background: "hsl(240 7% 96%)"
  foreground: "hsl(240 8% 10%)"
  card: "hsl(0 0% 100%)"
  secondary: "hsl(240 6% 93%)"
  secondary-foreground: "hsl(240 8% 15%)"
  muted: "hsl(240 6% 95%)"
  muted-foreground: "hsl(240 4% 43%)"
  accent: "hsl(221 100% 97%)"
  destructive: "hsl(0 70% 45%)"
  success: "hsl(151 55% 31%)"
  warning: "hsl(31 78% 30%)"
  border: "hsl(240 6% 90%)"
  input: "hsl(240 5% 81%)"
  sidebar: "hsl(240 7% 98%)"
typography:
  headline:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline-desktop:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  control:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  control: "0.875rem"
  panel: "1rem"
  dialog: "1.5rem"
  pill: "9999px"
spacing:
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
  navigation-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  status-neutral:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: Rental App

## Overview

**Creative North Star: "The Verity family, specialized for rentals"**

Rental App shares Verity’s pearl workspace, graphite text, Inter typography and blue actions. Its content and navigation center on properties, tenancies, rent, deposits, mortgages and costs. This records the user-selected family resemblance already implemented in the source; it does not introduce a new visual direction.

The desktop workspace is calm and compact: broad page margins, quiet dividers and clearly grouped values. Existing responsive compositions remain intact. Functional color explains actions or status; rental information carries the page.

**Key Characteristics:**

- Pearl workspace with white content surfaces and graphite text.
- Inter with restrained headings and aligned financial numerals.
- Blue actions, visible keyboard focus and explicit status labels.
- Grouped financial values within one parent panel.

## Colors

The palette follows the current Verity family. The frontmatter records the normative light-theme values from `src/app/globals.css`; use those values through semantic roles.

### Primary

- **Action blue** (`primary`): save, sign in, create and selected controls. `primary-hover` provides hover feedback, and `accent` supplies a quiet selected background.
- **Success green**, **warning brown** and **destructive red** explain outcomes and attention states. Keep a visible text label; status badges also retain their established status palettes from `src/types/index.ts`.

### Neutral

- **Pearl** (`background`) provides the workspace; **white** (`card`) holds content.
- **Graphite** (`foreground`) carries headings and financial values. `muted-foreground` carries supporting explanations.
- `border` provides quiet panel boundaries; the stronger `input` stroke identifies editable fields. `sidebar` is a slightly lighter navigation surface.

Dark variables exist in the stylesheet. This design record documents the light default; it does not claim a completed dark-mode product flow.

## Typography

Inter is loaded through `next/font/google`, with system sans-serif fallbacks. The same family covers headings, labels and content. Page titles use the headline role and increase to the desktop headline role at the large breakpoint. Compact section titles typically use 14px semibold text. Explanatory paragraphs use relaxed line spacing where needed.

Financial figures use tabular, lining numerals. Global heading tracking is slightly tight, and headings balance across lines. Keep currency values easy to compare; use regular text labels rather than decorative display type. Monospace is reserved for actual codes or machine-readable content.

## Layout

The shared page container tops out at 1480px, with 16px padding initially, 24px from the small breakpoint and 32px from the large breakpoint. The page-header inner width is 1416px. The desktop sidebar is 232px wide at the large breakpoint; the existing smaller-screen navigation is retained.

Spacing follows the existing 4px Tailwind rhythm. Common panels use 20–24px internal padding. Use the existing property subsection navigation and page-header hierarchy. Mortgage summaries retain two columns, increasing to four on large screens; cost subtotals retain three columns; deposit subtotals retain two. Related values share their parent surface instead of receiving individual card backgrounds. Wide ledgers keep horizontal overflow inside their table container.

## Elevation & Depth

Borders and surface tones do most of the work. Content panels have one quiet boundary. Selected navigation has a small offset shadow, segmented controls retain their existing small selection shadow, and dialogs use the stronger existing modal shadow. Shadow values are captured in the sidecar from the installed Tailwind theme. Do not add halos or decorative depth around financial values.

## Shapes

Controls use the rounded control token; panels use the panel token. Dialogs retain their larger corner radius, while small status badges use pills. Shapes support grouping and interaction, rather than turning every number into its own surface.

## Components

### Buttons

Primary buttons use action blue, white text, medium weight and a minimum height of 40px. Secondary buttons use the white surface and quiet border. Hover changes color; disabled controls reduce opacity and show a disabled cursor. The sidebar’s Add property action is graphite, matching the current navigation treatment.

### Inputs / Fields

Fields use white surfaces, the input border and a 40px minimum height. Focus shifts the border toward action blue. Global keyboard focus is a 2px blue outline with a 3px offset, including the label around visually hidden rental-mode radios. Placeholder text uses the supporting-text role. Visible labels, per-instance IDs, associated hints and alert/status messages remain part of the component behavior.

### Cards / Containers

The shared panel is a white surface with one border and the panel radius. The component has no universal padding; callers choose the established spacing for their content. Mortgage, cost and deposit subtotals are definition lists within this surface. Keep the status or action next to the section title when it applies to the entire section.

### Navigation

The sidebar uses compact icon-and-label rows. The active row is white with a quiet border, graphite text, a small blue marker and `aria-current`. Property subsection navigation is a muted segmented strip with a white selected segment and blue text. Keep existing link destinations and mobile navigation behavior.

### Chips / Status

Status badges are compact labeled pills. Preserve the existing meaning of payment, occupancy, tenant and deposit statuses. Labels carry the meaning even when a hue is not perceived.

### Interaction States

The default color transition is 150ms with the installed theme’s standard easing. Reduced-motion preferences shorten animation and transition durations. Selection, caret, underline offset and scrollbars follow the same palette. Auth forms show expected sign-in failures inline and retain entered values; successful redirects and two-factor behavior remain intact.

## Do's and Don'ts

### Do

- Do use the shared semantic colors and existing components for new screens.
- Do keep rental labels and billing scope visible beside financial values.
- Do associate each field label with its control and preserve hints, error messages and pending states.
- Do use one parent panel for related subtotal values and retain existing responsive breakpoints.
- Do keep hypothetical mortgage scenarios visibly separate from saved loan terms.

### Don't

- Do not introduce decorative gradients or an unrelated brand palette.
- Do not nest a new card around each subtotal inside an existing panel.
- Do not use color as the only indicator of status.
- Do not redesign the mobile composition as part of a desktop styling pass.
- Do not imply bank reconciliation, live production data or connector success through a visual state without evidence.

Source record: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/layout/{Sidebar,TopBar}.tsx`, `src/components/properties/PropertySubnav.tsx`, shared status badges, auth components and the summary components. This file describes the implemented source; deployment and provider verification are separate evidence.
