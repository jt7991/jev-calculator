# Jev Calculator
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-selected Svelte, TypeScript, Nitro, Day.js, and Jev. A CLI shares the calculation engine; future adapters may include Raycast.

## Product Purpose
Calculate conversions and dates from natural language, asking focused follow-up questions when meaning is ambiguous or information is missing.

## Capabilities and Constraints
Length, mass, temperature, volume, data sizes, duration conversions, Unix timestamps, date arithmetic, and date differences. Support date arithmetic followed by timestamp formatting. Jev identifies units from the full request, with close probabilities prompting clarification. Numeric values are preserved in code. Frontend timezone is the default; explicit timezone wins. Calendar days preserve wall time; hours are elapsed time. Month addition clamps to month end. US/imperial volume ambiguity is clarified. Decimal and binary data units are distinct.

## Operating Context
Web and CLI first. One stateless calculation endpoint accepts QUERY and POST. API credentials stay on the server or in the CLI environment. CLI has readable and JSON output.

## Open Decisions
No hosting provider or public authentication model selected. No supplied brand assets.

## Interface Direction
The user requested a polished, large centered chat bar with a dark color scheme. No Jev wordmark, headline, slogans, or promotional copy. Supporting results and clarifications should keep the primary input dominant.

## Duration and Date Semantics
Generic durations are distinct from calendar dates. The user selected an average Gregorian year of 365.2425 days and a month equal to one twelfth of that year. Mark conversions to fixed time units as estimates. Calendar arithmetic retains real leap years, varying month lengths, and timezone behavior.

## Web Interaction
The user selected single-shot web input: one submission returns a result or an actionable error. Never show clarification choices or a conversational follow-up flow in the web app. Keep the submitted input editable. The API and CLI may retain structured clarification support. Shorthand such as now in ms means a Unix timestamp, not a generic duration.
