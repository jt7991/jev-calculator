# Project guidance

- Use `.agents/skills/typesafe-ai/SKILL.md` for Jev/TypeSafe work; consult live TypeSafe docs before changing API integration or question design.
- Keep `core/` independent of Nitro, Svelte, and the CLI. All frontends share the same single-input calculation contract: one request returns success or an error, with no reply/session fields.
- Jev interprets the entire request and selects unit/value roles. Do not add a unit-token parser. Code preserves numeric values and performs deterministic math.
- Preserve uncertain category alternatives when choosing unit candidates. Do not hide ambiguity by narrowing too early.
- Use Day.js for date manipulation, Decimal.js for arithmetic, and explicit timezone/reference time for reproducible date behavior.
- Keep keys in ignored `.env` files; never print them, put them in browser bundles, or include them in eval reports.
- Run `npm test`, `npm run check`, and `npm run build` after core changes. Use `npm run eval` with a configured key to measure interpretation quality; fixtures do not count as live evals.
- UI is a polished centered input, with answers and errors below. Follow `DESIGN.md`; do not add a dashboard.
