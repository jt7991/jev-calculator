import { mkdir, writeFile } from 'node:fs/promises';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { Engine } from '../core/engine.js';
import type { DateParts } from '../core/date-input.js';

const context = {
  referenceTime: Date.parse('2026-09-26T20:15:45.123Z'),
  timezone: 'America/New_York',
};
const empty: DateParts = {
  year: null,
  month: null,
  day: null,
  hour: null,
  minute: null,
  second: null,
  relativeDay: null,
  timezone: null,
};
const cases = [
  {
    text: 'July 4 2027',
    parts: { year: 2027, month: 7, day: 4 },
    iso: '2027-07-04T20:15:45.123Z',
  },
  {
    text: 'July 4 2027 at 3:30 pm',
    parts: { year: 2027, month: 7, day: 4, hour: 15, minute: 30 },
    iso: '2027-07-04T19:30:00.000Z',
  },
  {
    text: '3:30 pm',
    parts: { hour: 15, minute: 30 },
    iso: '2026-09-26T19:30:00.000Z',
  },
  {
    text: 'tomorrow at noon',
    parts: { relativeDay: 1, hour: 12 },
    iso: '2026-09-27T16:00:00.000Z',
  },
  {
    text: 'today at midnight',
    parts: { relativeDay: 0, hour: 0 },
    iso: '2026-09-26T04:00:00.000Z',
  },
  {
    text: 'July 4 at 15:30 UTC',
    parts: { month: 7, day: 4, hour: 15, minute: 30, timezone: 'UTC' },
    iso: '2026-07-04T15:30:00.000Z',
  },
  {
    text: 'July 4 2027 at 15:30 -04:00',
    parts: {
      year: 2027,
      month: 7,
      day: 4,
      hour: 15,
      minute: 30,
      timezone: '-04:00',
    },
    iso: '2027-07-04T19:30:00.000Z',
  },
  {
    text: 'yesterday',
    parts: { relativeDay: -1 },
    iso: '2026-09-25T20:15:45.123Z',
  },
  {
    text: '3 days after July 4 2027 at 3:30 pm',
    parts: { year: 2027, month: 7, day: 4, hour: 15, minute: 30 },
    iso: '2027-07-04T19:30:00.000Z',
  },

  {
    text: 'next Thursday',
    parts: { weekday: 3, weekOffset: 'next' },
    iso: '2026-10-01T20:15:45.123Z',
  },
  {
    text: 'this Thursday',
    parts: { weekday: 3, weekOffset: 'current' },
    iso: '2026-09-24T20:15:45.123Z',
  },
  {
    text: 'Thursday',
    parts: { weekday: 3, weekOffset: null },
    iso: '2026-10-01T20:15:45.123Z',
  },
  {
    text: 'next Thursday at 3:30 pm',
    parts: { weekday: 3, weekOffset: 'next', hour: 15, minute: 30 },
    iso: '2026-10-01T19:30:00.000Z',
  },
  { text: 'February 30 2027', error: 'Invalid calendar date or time.' },
] as const;

const client = new TypeSafeClient();
let traces: unknown[] = [];
const call = client.systemOne.bind(client);
client.systemOne = (request, options) => {
  const snapshot = structuredClone(request);
  const response = call(request, options);
  void response
    .then((result) => {
      traces.push({
        state: snapshot.state,
        questions: snapshot.questions,
        answers: result.answers,
      });
    })
    .catch(() => {});
  return response;
};
const engine = new Engine(client);
const records = [];
for (const test of cases) {
  traces = [];
  const start = performance.now();
  const failures: string[] = [];
  let actual;
  try {
    actual = await engine.parseDateInput(test.text, context);
    if ('error' in test) failures.push('Expected an invalid-date error.');
    else {
      const expected = { ...empty, ...test.parts };
      for (const field of Object.keys(expected) as (keyof DateParts)[]) {
        if (actual.parts[field] !== expected[field])
          failures.push(
            `${field}: expected ${expected[field]}, got ${actual.parts[field]}`,
          );
      }
      const iso = new Date(actual.epochMilliseconds).toISOString();
      if (iso !== test.iso) failures.push(`Expected ${test.iso}, got ${iso}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    if (!('error' in test) || message !== test.error) failures.push(message);
  }
  records.push({
    text: test.text,
    expected: test,
    actual,
    failures,
    traces,
    passed: failures.length === 0,
    milliseconds: Math.round(performance.now() - start),
  });
  console.log(
    `${failures.length ? 'FAIL' : 'PASS'} ${test.text}${failures.length ? ': ' + failures.join('; ') : ''}`,
  );
}
const summary = {
  total: records.length,
  passed: records.filter((record) => record.passed).length,
  failed: records.filter((record) => !record.passed).length,
};
await mkdir('evals/results', { recursive: true });
const path = `evals/results/dates-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(path, JSON.stringify({ context, summary, records }, null, 2));
console.log(summary);
console.log(`Saved ${path}`);
process.exitCode = summary.failed ? 1 : 0;
