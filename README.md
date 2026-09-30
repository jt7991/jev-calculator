# Jev calculator

Svelte web app, Nitro API, and CLI sharing one TypeScript calculator core. Jev selects meanings and source phrases; Decimal.js and Day.js perform calculations.

## Run

```sh
npm install
# Set TYPESAFE_API_KEY in an ignored .env file
npm run dev
npm run cli -- "1 cup in ml"
npm run cli -- "3 days after 15 years ago" --timezone America/New_York
npm run cli -- "now in ms" --json
npm run build
npm start
```

Node 22.12+ is required. The web app runs at localhost:5173 in development. The CLI can call an existing server with `--url http://localhost:5174`. The Tailscale proxy on this machine serves port 8082 and forwards to the production server on 127.0.0.1:5174.

For the web comparison, also set `OPENAI_API_KEY` in the ignored `.env` file; both API keys stay server-side. Jev selects interpretations and uses deterministic Decimal.js/Day.js math. Luna answers directly with one `gpt-5.6-luna` call and reasoning set to `none`, so this compares two calculation approaches. Both receive the same request, timezone, and reference time. Each result has its own server processing time (including provider calls, excluding browser-to-server transfer and rendering).

## Project layout

- `frontend/`: Svelte app, components, styles, and browser entry point.
- `server/`: Nitro HTTP endpoints and the server-only Luna integration.
- `core/`: Shared calculator interpretation, arithmetic, dates, and types.
- `cli/`: Command-line frontend for the shared calculator.
- `tests/`: Unit, integration, and browser checks.
- `evals/`: Live Jev interpretation cases and reports.
- `public/`: Static browser assets.

The HTML entry, build configuration, and ignored `.env` stay at the project root.

## Read the code

Start with `core/calculator.ts`. Its `plan` method builds an expression, then `ExpressionEvaluator` evaluates it.

- `engine.ts`: identify the starting input and select operation phrases.
- `phrases.ts`: offer all contiguous word sections as choices; no unit-token parser.
- `quantity.ts`: Jev selects the number and unit. Decimal preserves digit strings; the word-number package handles selected whole-number words.
- `operations.ts`: interpret each operation and choose execution order separately from extraction order.
- `expression.ts`: the shared expression tree and deterministic evaluator. Dates and quantities use literal, add, subtract, convert, and difference nodes; quantities also support multiply and divide.
- `work.ts`: builds the intermediate results shown under “How this was calculated”. Each step expands into its parsing selections; `selections.ts` preserves the original Jev options, probabilities, and confidence for further inspection without extra model calls.
- `trace.ts`: captures each call's model, state, questions, answers, and duration. Fields link to their call, and “All Jev calls” includes routing, ordering, and completion checks. SDK configuration and authentication headers are never included.
- `date-questions.ts`, `date-input.ts`: date extraction adapted from the TypeSafe date cookbook, with time/timezone choices and Day.js validation.
- `units.ts`: conversion factors and temperature formulas.
- `dimensions.ts`: dimension checks and coherent unit scales for multiplying/dividing quantities.
- `choice.ts`: provisional acceptance policy (at least 50% probability and a 20-point lead).
- `service.ts`, `types.ts`: validate requests and return the same success/error contract to every frontend.

Operation extraction goes left to right. Execution order is a separate Jev decision because calendar months and years are order-sensitive. If two leading phrase candidates differ by one boundary word, both are parsed independently. We accept the longer phrase only when their combined probability passes the existing acceptance rule and both parses confidently agree on the operation, amount, and unit (or conversion target). Distinct operations and combined multi-amount phrases remain errors. The parsed operation is reused, and the original probabilities and both Jev calls remain available in the explanation. No reply sessions or clarification forms: missing/uncertain information returns an error for the user to edit.

## Behavior

Supports 232 units across length, mass, temperature, volume, data sizes, duration, area, speed, energy, power, pressure, frequency, force, voltage, current, resistance, charge, capacitance, and inductance. Unix seconds/milliseconds, date adjustments, and date differences share the same calculator. The largest unit Choice has 234 options including unsupported and readable-date output, below Jev's 255-option limit.

SI prefixes follow [BIPM](https://www.bipm.org/en/measurement-units/si-prefixes); customary conversion definitions follow [NIST SP 811](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8). Binary and decimal data prefixes remain distinct. Multiplication/division combines dimensions deterministically: current times duration produces charge, speed times duration produces distance, and power times duration produces energy. Jev interprets the requested relationship; code validates the dimensions and calculates. Unsupported resulting dimensions, offset-temperature products, and division by zero return errors.

- Compact quantities such as `3kg`, `500mA`, and `5min` preserve their exact numeric values.
- Constant-rate examples: `3 amps over 5 minutes to mAh` = 250 mAh; `60 mph for 20 minutes to miles` = 20 miles; `100 watts for 3 hours to Wh` = 300 Wh.
- Generic years use 365.2425 days; months use one twelfth of a year. Results crossing these units are marked approximate.
- A generic day is 24 hours. Calendar months and years use Day.js and require whole amounts.
- Now and today share the reference instant. Yesterday/tomorrow preserve the current local clock time on the adjacent calendar day.
- Date-only inputs preserve the reference clock. Time-only inputs use the reference date. Explicit times default missing minutes/seconds to zero.
- Bare Thursday means its next occurrence including today; this Thursday means this calendar week; next Thursday means the following calendar week. Weeks start Monday.
- Last Thursday means the most recent Thursday strictly before today, preserving the local clock unless a time is specified.
- Missing years use the reference year. Explicit calendar years currently support 1900-2050.
- Impossible dates and DST gaps/repeated local times produce errors. A repeated time can be resolved with an explicit offset.
- Bare volume units use US customary measurements; imperial and metric cups are explicit choices.
- Cooking `ts`/`tsp` means US teaspoons and `tbsp` means US tablespoons by default. Explicit metric teaspoons/tablespoons use 5/15 mL; Australian tablespoons use 20 mL.
- Addition/subtraction keeps the starting quantity's unit unless a conversion is requested. Temperature adjustments are interpreted as temperature differences.

Limits are explicit: at most 22 words, 12 operations per expression, and bounded nesting. Free-form timezone choices include the request timezone, UTC, several common IANA zones, and quarter-hour UTC offsets; unsupported zones return errors. The request timezone itself accepts any valid IANA zone. Numeric calendar extraction does not currently support fractional seconds. Model decisions can still fail or be uncertain; live evals measure representative cases, not all language.

## API

`QUERY /api/calculate` and `POST /api/calculate` share a handler. OPTIONS advertises both methods. Clients retry POST if QUERY is rejected. JSON bodies are limited to 16 KB.

```json
{
  "text": "Days until 3 months after January 29 2027",
  "timezone": "America/New_York",
  "referenceTime": "2026-09-26T20:15:45.123Z"
}
```

`referenceTime` is optional and captured once per calculation. Browser/CLI supply the current timezone; direct API calls default to the server timezone. Responses have `status: success` or `error` and are not cached. Keys stay server-side in `.env`.

## Verify

```sh
npm test
npm run check
npm run build
npm run eval                 # live final-answer evals
npm run eval -- --steps      # live input/operation extraction evals
npm run eval -- --dates      # live date component and timestamp evals
npm run test:browser         # requires a running server; set PLAYWRIGHT_BASE_URL
```

Live evals require the configured key and save reports under `evals/results`. Old tests for the replaced parser are archived in `.local/legacy-tests`; the active suite tests the new expression evaluator, request contract, date rules, and choice acceptance.

Luna comparison is opt-in at `/?compare=luna`. The default page shows only Jev and makes no Luna requests.

## Deploy with Coolify

Use the repository's [Dockerfile build pack](https://coolify.io/docs/applications/builds/dockerfile):

- Repository: `https://github.com/jt7991/jev-calculator`, branch `main`.
- Base directory: `/`; Dockerfile location: `/Dockerfile`.
- Ports Exposes: `3000`. The container listens on `0.0.0.0`.
- Set `TYPESAFE_API_KEY` as a **runtime-only** environment variable in Coolify.
- Optionally set `TYPESAFE_MODEL` (defaults to `jev-1.13.0`).
- Set `OPENAI_API_KEY` at runtime only if you want the `/?compare=luna` comparison.
- Assign your domain and deploy. No persistent volume is needed; recent calculations stay in browser storage.

No API keys are needed during the build. `.dockerignore` excludes all `.env` files, local artifacts, and dependencies. The final image runs as a non-root user and contains only Node.js and the built application. Its health check requests `/` without making paid API calls.

To run with Docker locally:

```sh
docker build -t jev-calculator .
docker run --rm -p 3000:3000 --env-file .env jev-calculator
```

The env file in this command is read at container startup; it is not copied into the image.
