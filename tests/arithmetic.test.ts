import { expect, test } from 'vitest';
import { Decimal } from 'decimal.js';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { convertDecimal } from '../core/units.js';
import { DateInput } from '../core/date-input.js';
import { ExpressionEvaluator, type Expression } from '../core/expression.js';
import { QuantityParser } from '../core/quantity.js';
import { Jev } from '../core/jev.js';
import { WorkBuilder } from '../core/work.js';
import { runCalculation } from '../core/service.js';

const client = new TypeSafeClient({ apiKey: 'test-only' });
const evaluator = new ExpressionEvaluator(new DateInput(client));
const quantities = new QuantityParser(new Jev(client));
function date(iso: string, timezone = 'UTC'): Expression {
  return {
    type: 'literal',
    value: { type: 'date', epochMilliseconds: Date.parse(iso), timezone },
  };
}
function shift(input: Expression, amount: string, unit: string): Expression {
  return {
    type: 'add',
    input,
    amount: { type: 'quantity', amount: new Decimal(amount), unit },
  };
}

test.each([
  ['6', 'foot', 'inch', '72'],
  ['1', 'us_cup', 'milliliter', '236.5882365'],
  ['1', 'pound', 'gram', '453.59237'],
  ['25', 'us_cup', 'us_teaspoon', '1200'],
  ['25', 'us_cup', 'us_tablespoon', '400'],
  ['3', 'us_teaspoon', 'us_tablespoon', '1'],
  ['32', 'fahrenheit', 'celsius', '0'],
  ['273.15', 'kelvin', 'celsius', '0'],
  ['1', 'gibibyte', 'mebibyte', '1024'],
  ['25', 'year', 'day', '9131.0625'],
  ['1', 'month', 'day', '30.436875'],
  ['9007199254740993', 'byte', 'byte', '9007199254740993'],
])('converts %s %s to %s', (amount, source, target, expected) => {
  expect(convertDecimal(amount, source, target).toString()).toBe(expected);
});

test('rejects incompatible units and invalid temperatures', () => {
  expect(() => convertDecimal('1', 'meter', 'second')).toThrow('same family');
  expect(() => convertDecimal('-1', 'kelvin', 'celsius')).toThrow(
    'absolute zero',
  );
});
test('preserves numeric digits and supports number words', () => {
  expect(quantities.number('9007199254740993').toString()).toBe(
    '9007199254740993',
  );
  expect(quantities.number('one').toString()).toBe('1');
  expect(quantities.number('twenty five').toString()).toBe('25');
  expect(() => quantities.number('one cup')).toThrow();
  expect(() => quantities.number('Infinity')).toThrow();
});
test('calendar order affects the result', () => {
  const base = date('2027-01-30T12:00:00.123Z');
  const monthFirst = evaluator.evaluate(
    shift(shift(base, '1', 'month'), '1', 'day'),
  );
  const dayFirst = evaluator.evaluate(
    shift(shift(base, '1', 'day'), '1', 'month'),
  );
  expect(
    monthFirst.type === 'date' &&
      new Date(monthFirst.epochMilliseconds).toISOString(),
  ).toBe('2027-03-01T12:00:00.123Z');
  expect(
    dayFirst.type === 'date' &&
      new Date(dayFirst.epochMilliseconds).toISOString(),
  ).toBe('2027-02-28T12:00:00.123Z');
});
test('a generic day is 24 hours even across DST', () => {
  const result = evaluator.evaluate(
    shift(date('2026-03-07T17:00:00.000Z', 'America/New_York'), '1', 'day'),
  );
  expect(result.type === 'date' && result.epochMilliseconds).toBe(
    Date.parse('2026-03-08T17:00:00Z'),
  );
});
test('date differences compose with nested adjustments', () => {
  const result = evaluator.evaluate({
    type: 'difference',
    start: date('2027-04-01T12:00:00Z'),
    end: shift(date('2027-01-29T12:00:00Z'), '3', 'month'),
    unit: 'day',
  });
  expect(result.type === 'quantity' && result.amount.toString()).toBe('28');
});
test('fixed-offset inputs work in calendar adjustments', () => {
  const result = evaluator.evaluate(
    shift(date('2027-01-30T16:00:00Z', '-04:00'), '1', 'month'),
  );
  expect(
    result.type === 'date' && new Date(result.epochMilliseconds).toISOString(),
  ).toBe('2027-02-28T16:00:00.000Z');
});
test('service validates requests before calling Jev', async () => {
  expect(
    await runCalculation({ text: '', timezone: 'UTC' }, client),
  ).toMatchObject({ status: 'error', code: 'invalid_request' });
  expect(
    await runCalculation({ text: 'hello', timezone: 'Fake/Zone' }, client),
  ).toMatchObject({ status: 'error', code: 'invalid_request' });
  expect(
    await runCalculation({ text: 'hello', replies: [] }, client),
  ).toMatchObject({ status: 'error', code: 'invalid_request' });
});

test('show-work values and tree reflect actual execution', () => {
  const base = date('2027-01-30T12:00:00.123Z');
  base.source = 'January 30 2027';
  const expression = shift(shift(base, '1', 'month'), '1', 'day');
  const work = new WorkBuilder(evaluator).build(
    expression,
    '1 day after 1 month after January 30 2027',
    { referenceTime: Date.parse('2026-09-26T12:00:00Z'), timezone: 'UTC' },
  );
  expect(work.steps.map((step) => step.label)).toEqual([
    'Starting input',
    'Add 1 months',
    'Add 1 days',
  ]);
  expect(work.tree.result.value).toContain('Mar 1, 2027');
  expect(work.tree.children[0].result.value).toContain('Feb 28, 2027');
  expect(work.tree.children[1].result).toEqual({ value: '1', unit: 'days' });
  expect(work.steps[0].source).toBe('January 30 2027');
  expect(work.steps.every((step) => step.children.length === 0)).toBe(true);
});

test.each([
  ['3kg', '3'],
  ['-2.5kg', '-2.5'],
  ['.5h', '.5'],
  ['1e3mA', '1e3'],
  ['2.5e-3A', '2.5e-3'],
  ['9007199254740993B', '9007199254740993'],
])('exposes exact numeric candidates in %s', (input, number) => {
  expect(Object.hasOwn(quantities.amountChoices(input), number)).toBe(true);
  expect(quantities.number(number).eq(number)).toBe(true);
});
