import { expect, test } from 'vitest';
import { Decimal } from 'decimal.js';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { combineQuantities } from '../core/dimensions';
import { convertDecimal } from '../core/units';
import { DateInput } from '../core/date-input';
import { ExpressionEvaluator, type Expression } from '../core/expression';
import { WorkBuilder, displayValue } from '../core/work';

const quantity = (amount: string, unit: string) => ({
  type: 'quantity' as const,
  amount: new Decimal(amount),
  unit,
});
const evaluator = new ExpressionEvaluator(
  new DateInput(new TypeSafeClient({ apiKey: 'test-only' })),
);

test.each([
  ['3', 'ampere', '5', 'minute', 'milliampere_hour', '250'],
  ['500', 'milliampere', '30', 'minute', 'milliampere_hour', '250'],
  ['60', 'mile_per_hour', '20', 'minute', 'mile', '20'],
  ['30', 'minute', '3', 'mile_per_hour', 'mile', '1.5'],
  ['100', 'watt', '3', 'hour', 'watt_hour', '300'],
  ['2', 'meter', '30', 'centimeter', 'square_meter', '0.6'],
  ['2', 'square_meter', '3', 'meter', 'liter', '6000'],
  ['12', 'volt', '2', 'ampere', 'watt', '24'],
])(
  'multiplies %s %s by %s %s, in either order',
  (a, au, b, bu, target, expected) => {
    for (const [left, right] of [
      [quantity(a, au), quantity(b, bu)],
      [quantity(b, bu), quantity(a, au)],
    ]) {
      const result = combineQuantities(left, right, 'multiply');
      expect(
        convertDecimal(result.amount, result.unit, target)
          .toSignificantDigits(30)
          .toString(),
      ).toBe(expected);
    }
  },
);

test.each([
  ['250', 'milliampere_hour', '5', 'minute', 'ampere', '3'],
  ['20', 'mile', '2', 'hour', 'mile_per_hour', '10'],
  ['300', 'watt_hour', '3', 'hour', 'watt', '100'],
  ['300', 'watt_hour', '100', 'watt', 'hour', '3'],
  ['6', 'liter', '2', 'square_meter', 'millimeter', '3'],
  ['24', 'watt', '12', 'volt', 'ampere', '2'],
])(
  'divides %s %s by %s %s with correct base scales',
  (a, au, b, bu, target, expected) => {
    const result = combineQuantities(
      quantity(a, au),
      quantity(b, bu),
      'divide',
    );
    expect(
      convertDecimal(result.amount, result.unit, target)
        .toSignificantDigits(30)
        .toString(),
    ).toBe(expected);
  },
);

test('rejects unsupported dimensions, offset temperatures, and division by zero', () => {
  expect(() =>
    combineQuantities(
      quantity('3', 'ampere'),
      quantity('5', 'meter'),
      'multiply',
    ),
  ).toThrow('unsupported quantity dimension');
  expect(() =>
    combineQuantities(
      quantity('20', 'celsius'),
      quantity('5', 'second'),
      'multiply',
    ),
  ).toThrow('not supported');
  expect(() =>
    combineQuantities(
      quantity('1', 'coulomb'),
      quantity('0', 'second'),
      'divide',
    ),
  ).toThrow('zero');
  expect(() =>
    combineQuantities(
      quantity('Infinity', 'ampere'),
      quantity('5', 'second'),
      'multiply',
    ),
  ).toThrow('finite');
  const result = combineQuantities(
    quantity('3', 'ampere'),
    quantity('5', 'minute'),
    'multiply',
  );
  expect(() => convertDecimal(result.amount, result.unit, 'liter')).toThrow(
    'same family',
  );
});

test('preserves zero, negative current, and month/year estimate metadata', () => {
  expect(
    combineQuantities(
      quantity('0', 'ampere'),
      quantity('5', 'minute'),
      'multiply',
    ).amount.isZero(),
  ).toBe(true);
  expect(
    combineQuantities(
      quantity('-3', 'ampere'),
      quantity('5', 'minute'),
      'multiply',
    ).amount.toString(),
  ).toBe('-900');
  const estimate = combineQuantities(
    quantity('1', 'watt'),
    quantity('1', 'year'),
    'multiply',
  );
  expect(estimate.approximate).toBe(true);
  expect(estimate.note).toContain('Gregorian');
  expect(
    combineQuantities(estimate, quantity('1', 'second'), 'divide').approximate,
  ).toBe(true);
});

test('evaluates and explains the product followed by output conversion', () => {
  const expression: Expression = {
    type: 'convert',
    unit: 'milliampere_hour',
    source: 'to mAh',
    input: {
      type: 'multiply',
      amount: quantity('5', 'minute'),
      source: 'over 5 minutes',
      input: {
        type: 'literal',
        value: quantity('3', 'ampere'),
        source: '3 amps',
      },
    },
  };
  expect(displayValue(evaluator.evaluate(expression))).toEqual({
    value: '250',
    unit: 'mAh',
  });
  const work = new WorkBuilder(evaluator).build(
    expression,
    '3 amps over 5 minutes to mAh',
    {
      timezone: 'UTC',
      referenceTime: Date.parse('2026-09-26T20:15:45.123Z'),
    },
  );
  expect(work.steps.map((step) => step.kind)).toEqual([
    'literal',
    'multiply',
    'convert',
  ]);
  expect(work.steps[1].calculation).toBe('3 A × 5 min');
  expect(work.tree.result).toEqual({ value: '250', unit: 'mAh' });
});

test('does not multiply dates by durations', () => {
  expect(() =>
    evaluator.evaluate({
      type: 'multiply',
      amount: quantity('5', 'minute'),
      input: {
        type: 'literal',
        value: { type: 'date', epochMilliseconds: 0, timezone: 'UTC' },
      },
    }),
  ).toThrow('not dates');
});
