import { Decimal } from 'decimal.js';
import type { Quantity } from './quantity.js';
import { durationEstimate, units } from './units.js';

// Exponents of length, mass, time, and electric current. Each canonical
// unit uses coherent SI scales; the catalog's existing family bases differ.
type Dimensions = readonly [number, number, number, number];
const families: Record<string, { dimensions: Dimensions; unit: string }> = {
  length: { dimensions: [1, 0, 0, 0], unit: 'meter' },
  area: { dimensions: [2, 0, 0, 0], unit: 'square_meter' },
  volume: { dimensions: [3, 0, 0, 0], unit: 'cubic_meter' },
  mass: { dimensions: [0, 1, 0, 0], unit: 'kilogram' },
  duration: { dimensions: [0, 0, 1, 0], unit: 'second' },
  speed: { dimensions: [1, 0, -1, 0], unit: 'meter_per_second' },
  current: { dimensions: [0, 0, 0, 1], unit: 'ampere' },
  charge: { dimensions: [0, 0, 1, 1], unit: 'coulomb' },
  energy: { dimensions: [2, 1, -2, 0], unit: 'joule' },
  power: { dimensions: [2, 1, -3, 0], unit: 'watt' },
  force: { dimensions: [1, 1, -2, 0], unit: 'newton' },
  pressure: { dimensions: [-1, 1, -2, 0], unit: 'pascal' },
  frequency: { dimensions: [0, 0, -1, 0], unit: 'hertz' },
  voltage: { dimensions: [2, 1, -3, -1], unit: 'volt' },
  resistance: { dimensions: [2, 1, -3, -2], unit: 'ohm' },
  capacitance: { dimensions: [-2, -1, 4, 2], unit: 'farad' },
  inductance: { dimensions: [2, 1, -2, -2], unit: 'henry' },
};

export function combineQuantities(
  left: Quantity & { approximate?: boolean; note?: string },
  right: Quantity & { approximate?: boolean; note?: string },
  operation: 'multiply' | 'divide',
): Quantity & { approximate?: boolean; note?: string } {
  const from = units[left.unit];
  const by = units[right.unit];
  const a = from && families[from.family];
  const b = by && families[by.family];
  if (!a || !b)
    throw new Error(
      'Multiplication and division are not supported for these units.',
    );
  if (!left.amount.isFinite() || !right.amount.isFinite())
    throw new Error('Enter finite quantities.');
  if (operation === 'divide' && right.amount.isZero())
    throw new Error('Cannot divide by zero.');
  const sign = operation === 'multiply' ? 1 : -1;
  const dimensions = a.dimensions.map(
    (power, i) => power + sign * b.dimensions[i],
  );
  const result = Object.values(families).find((family) =>
    family.dimensions.every((power, i) => power === dimensions[i]),
  );
  if (!result)
    throw new Error(
      'This combination produces an unsupported quantity dimension.',
    );

  // Keep normalization as a fraction until the last division. This avoids
  // rounding a speed in m/h to m/s before multiplying it by a duration.
  let numerator = left.amount.times(from.factor);
  let denominator = new Decimal(units[a.unit].factor);
  if (operation === 'multiply') {
    numerator = numerator.times(right.amount).times(by.factor);
    denominator = denominator.times(units[b.unit].factor);
  } else {
    numerator = numerator.times(units[b.unit].factor);
    denominator = denominator.times(right.amount).times(by.factor);
  }
  const amount = numerator.div(denominator);
  if (!amount.isFinite())
    throw new Error('The result is outside the supported range.');
  return {
    type: 'quantity',
    amount,
    unit: result.unit,
    ...durationEstimate(left.unit, 'second'),
    ...durationEstimate(right.unit, 'second'),
    ...(left.approximate ? { approximate: true, note: left.note } : {}),
    ...(right.approximate ? { approximate: true, note: right.note } : {}),
  };
}
