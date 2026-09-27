import { Decimal } from 'decimal.js';
import { DateInput, dateAt, type DateParts } from './date-input.js';
import { convertDecimal, durationEstimate, units } from './units.js';
import type { Quantity } from './quantity.js';
import type { Selection } from './selections.js';

export type Value = (
  Quantity | { type: 'date'; epochMilliseconds: number; timezone: string }
) & { approximate?: boolean; note?: string };
export type Expression = (
  | { type: 'literal'; value: Value }
  | { type: 'add' | 'subtract'; input: Expression; amount: Quantity }
  | { type: 'convert'; input: Expression; unit: string }
  | { type: 'difference'; start: Expression; end: Expression; unit: string }
) & { source?: string; note?: string; selections?: Selection[] };

export class ExpressionEvaluator {
  constructor(private readonly dates: DateInput) {}

  evaluate(expression: Expression): Value {
    if (expression.type === 'literal') return expression.value;
    if (expression.type === 'difference') {
      const start = this.evaluate(expression.start);
      const end = this.evaluate(expression.end);
      if (start.type !== 'date' || end.type !== 'date')
        throw new Error('A date difference needs two dates.');
      return this.convert(
        {
          type: 'quantity',
          amount: new Decimal(end.epochMilliseconds).minus(
            start.epochMilliseconds,
          ),
          unit: 'millisecond',
        },
        expression.unit,
      );
    }
    const value = this.evaluate(expression.input);
    if (expression.type === 'convert')
      return this.convert(value, expression.unit);
    const sign = expression.type === 'add' ? 1 : -1;
    if (value.type === 'date')
      return this.shiftDate(value, expression.amount, sign);
    const adjustment = expression.amount;
    let amount: Decimal;
    if (
      units[value.unit].family === 'temperature' &&
      units[adjustment.unit].family === 'temperature'
    ) {
      amount = adjustment.amount;
      if (adjustment.unit === 'fahrenheit') amount = amount.times(5).div(9);
      if (value.unit === 'fahrenheit') amount = amount.times(9).div(5);
    } else
      amount = convertDecimal(adjustment.amount, adjustment.unit, value.unit);
    const result = value.amount.plus(amount.times(sign));
    // Also validates absolute-zero constraints for temperatures.
    convertDecimal(result, value.unit, value.unit);
    return {
      ...value,
      amount: result,
      ...durationEstimate(adjustment.unit, value.unit),
    };
  }

  private convert(value: Value, target: string): Value {
    if (target === 'date') {
      if (value.type !== 'date')
        throw new Error(
          'Specify a Unix timestamp in seconds or milliseconds to convert it to a date.',
        );
      return value;
    }
    if (!units[target]) throw new Error('Unsupported target unit.');
    if (value.type === 'date') {
      if (!['second', 'millisecond'].includes(target))
        throw new Error(
          'Convert dates to Unix seconds or milliseconds, or ask for a date difference.',
        );
      return {
        type: 'quantity',
        amount: new Decimal(value.epochMilliseconds).div(
          target === 'second' ? 1000 : 1,
        ),
        unit: target,
      };
    }
    return {
      ...value,
      amount: convertDecimal(value.amount, value.unit, target),
      unit: target,
      ...durationEstimate(value.unit, target),
    };
  }

  private shiftDate(
    value: Extract<Value, { type: 'date' }>,
    quantity: Quantity,
    sign: number,
  ): Value {
    if (units[quantity.unit]?.family !== 'duration')
      throw new Error('A date adjustment needs a duration.');
    const amount = quantity.amount.times(sign);
    if (quantity.unit === 'month' || quantity.unit === 'year') {
      if (!amount.isInteger() || amount.abs().gt(10000))
        throw new Error(
          'Calendar adjustments need whole months or years within 10,000.',
        );
      const shifted = dateAt(value.epochMilliseconds, value.timezone).add(
        amount.toNumber(),
        quantity.unit,
      );
      const parts: DateParts = {
        year: shifted.year(),
        month: shifted.month() + 1,
        day: shifted.date(),
        hour: null,
        minute: null,
        second: null,
        relativeDay: null,
        timezone: null,
      };
      const resolved = this.dates.resolve(parts, {
        referenceTime: value.epochMilliseconds,
        timezone: value.timezone,
      });
      return { ...value, epochMilliseconds: resolved.epochMilliseconds };
    }
    const milliseconds = convertDecimal(
      amount,
      quantity.unit,
      'millisecond',
    ).plus(value.epochMilliseconds);
    if (!milliseconds.isInteger() || milliseconds.abs().gt('8640000000000000'))
      throw new Error(
        'Result is outside the supported millisecond date range.',
      );
    return { ...value, epochMilliseconds: milliseconds.toNumber() };
  }
}
