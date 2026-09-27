import { expect, test } from 'vitest';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { DateInput, type DateParts } from '../core/date-input.js';
const parser = new DateInput(new TypeSafeClient({ apiKey: 'test-only' }));
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
const context = {
  referenceTime: Date.parse('2026-09-26T20:15:45.123Z'),
  timezone: 'America/New_York',
};
test('date-only preserves reference clock; explicit zero is midnight', () => {
  expect(
    new Date(
      parser.resolve({ ...empty, year: 2027, month: 7, day: 4 }, context)
        .epochMilliseconds,
    ).toISOString(),
  ).toBe('2027-07-04T20:15:45.123Z');
  expect(
    new Date(
      parser.resolve({ ...empty, hour: 0, minute: 0 }, context)
        .epochMilliseconds,
    ).toISOString(),
  ).toBe('2026-09-26T04:00:00.000Z');
});
test('validates leap days rather than rolling over', () => {
  expect(() =>
    parser.resolve({ ...empty, year: 2027, month: 2, day: 29 }, context),
  ).toThrow('Invalid calendar');
  expect(
    Number.isFinite(
      parser.resolve({ ...empty, year: 2028, month: 2, day: 29 }, context)
        .epochMilliseconds,
    ),
  ).toBe(true);
});
test('relative calendar day preserves clock across DST', () => {
  const before = {
    ...context,
    referenceTime: Date.parse('2026-03-07T17:15:45.123Z'),
  };
  expect(
    new Date(
      parser.resolve({ ...empty, relativeDay: 1 }, before).epochMilliseconds,
    ).toISOString(),
  ).toBe('2026-03-08T16:15:45.123Z');
});
test('rejects nonexistent and repeated local times', () => {
  expect(() =>
    parser.resolve(
      { ...empty, year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      context,
    ),
  ).toThrow('does not exist');
  expect(() =>
    parser.resolve(
      { ...empty, year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      context,
    ),
  ).toThrow('occurs twice');
  expect(
    new Date(
      parser.resolve(
        {
          ...empty,
          year: 2026,
          month: 11,
          day: 1,
          hour: 1,
          minute: 30,
          timezone: '-04:00',
        },
        context,
      ).epochMilliseconds,
    ).toISOString(),
  ).toBe('2026-11-01T05:30:00.000Z');
});

test('weekday rules use Monday-based calendar weeks', () => {
  const thursday = {
    ...context,
    referenceTime: Date.parse('2026-09-24T20:15:45.123Z'),
  };
  expect(
    new Date(
      parser.resolve({ ...empty, weekday: 3, weekOffset: null }, thursday)
        .epochMilliseconds,
    ).toISOString(),
  ).toBe('2026-09-24T20:15:45.123Z');
  expect(
    new Date(
      parser.resolve({ ...empty, weekday: 3, weekOffset: 'next' }, thursday)
        .epochMilliseconds,
    ).toISOString(),
  ).toBe('2026-10-01T20:15:45.123Z');
});

test.each([
  ['2026-09-26T20:15:45.123Z', '2026-09-22T20:15:45.123Z'],
  ['2026-09-22T20:15:45.123Z', '2026-09-15T20:15:45.123Z'],
  ['2026-09-21T20:15:45.123Z', '2026-09-15T20:15:45.123Z'],
])('last Tuesday is strictly earlier than %s', (reference, expected) => {
  const result = parser.resolve(
    { ...empty, weekday: 1, weekOffset: 'previous' },
    { ...context, referenceTime: Date.parse(reference) },
  );
  expect(new Date(result.epochMilliseconds).toISOString()).toBe(expected);
});
