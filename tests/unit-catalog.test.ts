import { expect, test } from 'vitest';
import { Decimal } from 'decimal.js';
import { units, unitChoices, convertDecimal } from '../core/units.js';

test('catalog fits one choice question with reserved output choices', () => {
  expect(Object.keys(units).length).toBeGreaterThanOrEqual(220);
  expect(Object.keys(unitChoices()).length + 1).toBeLessThanOrEqual(255);
  for (const unit of Object.values(units)) {
    expect(new Decimal(unit.factor).isPositive()).toBe(true);
    expect(new Decimal(unit.factor).isFinite()).toBe(true);
  }
});

test.each([
  ['1', 'acre', 'square_foot', '43560'],
  ['60', 'mile_per_hour', 'kilometer_per_hour', '96.56064'],
  ['1', 'kilowatt_hour', 'joule', '3600000'],
  ['1', 'kilocalorie', 'joule', '4184'],
  ['1', 'atmosphere', 'pascal', '101325'],
  ['1', 'megahertz', 'hertz', '1000000'],
  ['1', 'volt', 'millivolt', '1000'],
  ['1', 'ampere', 'milliampere', '1000'],
  ['1', 'kiloohm', 'ohm', '1000'],
  ['1', 'ampere_hour', 'coulomb', '3600'],
  ['1', 'microfarad', 'nanofarad', '1000'],
  ['1', 'henry', 'millihenry', '1000'],
  ['1', 'pound_force', 'newton', '4.4482216152605'],
  ['1', 'pebibyte', 'tebibyte', '1024'],
  ['1', 'mebibit', 'byte', '131072'],
  ['1', 'megabit', 'byte', '125000'],
  ['1', 'troy_ounce', 'gram', '31.1034768'],
  ['1', 'metric_teaspoon', 'milliliter', '5'],
  ['1', 'australian_tablespoon', 'milliliter', '20'],
])('converts %s %s to %s', (amount, source, target, expected) => {
  expect(convertDecimal(amount, source, target).toString()).toBe(expected);
});

test('new families keep distinct dimensions', () => {
  expect(() => convertDecimal('1', 'kilowatt', 'kilowatt_hour')).toThrow(
    'same family',
  );
  expect(() => convertDecimal('1', 'square_meter', 'meter')).toThrow(
    'same family',
  );
  expect(() => convertDecimal('1', 'ampere_hour', 'watt_hour')).toThrow(
    'same family',
  );
});
