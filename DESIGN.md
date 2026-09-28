---
name: Jev Calculator
description: A minimal dark natural-language calculator with a centered input.
colors:
  primary: "#b6cfa5"
  background: "#171a18"
  surface: "#242925"
  ink: "#edf0e9"
  muted: "#a6aea2"
  line: "#3b433c"
  hover: "#303830"
typography:
  body:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  input:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "18px"
    lineHeight: 1.65
  result:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(28px, 4vw, 43px)"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.035em"
rounded:
  input: "20px"
  button: "13px"
  choice: "8px"
spacing:
  page: "46px"
  input: "24px"
---

## Overview
Operate mode. The large centered chat bar is the primary surface. A dark charcoal-green canvas, slightly lighter input, pale sage action color, and generous empty space establish the visual character. The user explicitly removed the top-left wordmark, headline, and slogans.

## Colors
Canonical CSS variables live in frontend/tokens.css. Pale sage identifies the active action, focus, and result. Light body text and muted secondary text sit on dark backgrounds. The page declares a dark color scheme. Send-button hover uses #c6dfb4; its disabled background is #343d34. The enabled send icon uses #1b271a.

## Typography
Self-hosted Manrope is used for all controls and data. There is no display heading or serif font. Results use tabular numerals. The input uses 18px type with 1.65 line height, reduced to 16px on mobile. Results use the documented clamp on desktop and 30px on mobile.

## Layout
Desktop workspace maximum width is 780px (820px from 1450px), centered between the header and footer. Desktop page padding is 32px 46px 25px; main padding is 60px 0 100px. At 650px and below, page padding is 22px 22px 18px and main padding is 40px 0 72px. Examples stay centered and wrap. Desktop input padding is 24px 24px 16px; mobile input padding is 20px 19px 14px with a 17px radius. Results and errors appear directly under the input. Optional history is at the top right; the timezone control is at the bottom right.

## Elevation & Depth
Only the input uses a soft offset shadow: `0 6px 20px #00000018, 0 24px 70px #00000012`. Focus changes it to `0 6px 28px #00000024, 0 24px 70px #00000018` with a 2px sage outline offset by 4px. Other interactive controls use a 2px sage focus outline offset by 5px. Secondary panels use a thin border. No ornamental gradients or grain.

## Shapes
The primary input is a generous rounded rectangle. Choice controls use restrained 8px radii. Icon buttons are circular.

## Components
The Jev/Luna comparison uses two answer columns on desktop, stacked at 650px and below, with Jev's expandable interpretation spanning the workspace below. Both use the same request timezone and reference time. Each answer shows its own server processing time (including provider calls, excluding browser-to-server transfer and rendering) and estimated USD cost to six decimal places; missing usage displays "Cost unavailable". Jev cost sums reported usage; Luna uses one `gpt-5.6-luna` call with reasoning set to `none`.
The input submits on Enter, permits Shift+Enter, and focuses with /. It has no manual resize handle. The resting input has no slogan; loading shows a short calculation status. Each submission is independent; missing or ambiguous details show an error so the user can edit the full input. Results offer copy and expandable interpretation. History stays local. A footer editor changes the default timezone. Loading, error, empty, and success states are implemented.

## Do's and Don'ts
Keep the input dominant. Preserve the centered layout and honest empty state. Use concise functional copy. Respect reduced motion. Do not restore the wordmark, hero heading, or slogans. Do not introduce fake results, success metrics, or extra navigation.

The web input is single-shot. Missing or ambiguous values produce an actionable inline error, not follow-up buttons. The original text stays editable after both success and error.

Luna comparison is opt-in at `/?compare=luna`. The default page shows only Jev and makes no Luna requests.
