import { Decimal } from 'decimal.js';

Decimal.set({ precision: 40 });
export type Unit = {
  label: string;
  symbol: string;
  family: string;
  factor: string;
};
export const units: Record<string, Unit> = {};
function add(family: string, rows: [string, string, string, string][]) {
  for (const [id, label, symbol, factor] of rows)
    units[id] = { family, label, symbol, factor };
}
add('length', [
  ['millimeter', 'Millimeters', 'mm', '0.001'],
  ['centimeter', 'Centimeters', 'cm', '0.01'],
  ['meter', 'Meters', 'm', '1'],
  ['kilometer', 'Kilometers', 'km', '1000'],
  ['inch', 'Inches', 'in', '0.0254'],
  ['foot', 'Feet', 'ft', '0.3048'],
  ['yard', 'Yards', 'yd', '0.9144'],
  ['mile', 'Miles', 'mi', '1609.344'],
  ['nautical_mile', 'Nautical miles', 'nmi', '1852'],
]);
add('mass', [
  ['milligram', 'Milligrams', 'mg', '0.001'],
  ['gram', 'Grams', 'g', '1'],
  ['kilogram', 'Kilograms', 'kg', '1000'],
  ['ounce', 'Ounces (mass)', 'oz', '28.349523125'],
  ['pound', 'Pounds', 'lb', '453.59237'],
  ['stone', 'Stones', 'st', '6350.29318'],
  ['tonne', 'Metric tonnes', 't', '1000000'],
]);
add('temperature', [
  ['celsius', 'Celsius', '\u00b0C', '1'],
  ['fahrenheit', 'Fahrenheit', '\u00b0F', '1'],
  ['kelvin', 'Kelvin', 'K', '1'],
]);
add('volume', [
  ['milliliter', 'Milliliters', 'mL', '0.001'],
  ['liter', 'Liters', 'L', '1'],
  ['cubic_meter', 'Cubic meters', 'm\u00b3', '1000'],
  ['us_gallon', 'US gallons', 'US gal', '3.785411784'],
  ['imperial_gallon', 'Imperial gallons', 'imp gal', '4.54609'],
  ['us_quart', 'US quarts', 'US qt', '0.946352946'],
  ['imperial_quart', 'Imperial quarts', 'imp qt', '1.1365225'],
  ['us_pint', 'US pints', 'US pt', '0.473176473'],
  ['imperial_pint', 'Imperial pints', 'imp pt', '0.56826125'],
  ['us_fluid_ounce', 'US fluid ounces', 'US fl oz', '0.0295735295625'],
  [
    'imperial_fluid_ounce',
    'Imperial fluid ounces',
    'imp fl oz',
    '0.0284130625',
  ],
  ['us_cup', 'US customary cups', 'US cup', '0.2365882365'],
  ['us_teaspoon', 'US teaspoons (ts or tsp)', 'tsp', '0.00492892159375'],
  ['us_tablespoon', 'US tablespoons (tbsp)', 'tbsp', '0.01478676478125'],
  ['metric_cup', 'Metric cups', 'metric cup', '0.25'],
]);
add('data', [
  ['bit', 'Bits', 'bit', '0.125'],
  ['byte', 'Bytes', 'B', '1'],
  ['kilobyte', 'Kilobytes (decimal)', 'KB', '1000'],
  ['megabyte', 'Megabytes (decimal)', 'MB', '1000000'],
  ['gigabyte', 'Gigabytes (decimal)', 'GB', '1000000000'],
  ['terabyte', 'Terabytes (decimal)', 'TB', '1000000000000'],
  ['kibibyte', 'Kibibytes (binary)', 'KiB', '1024'],
  ['mebibyte', 'Mebibytes (binary)', 'MiB', '1048576'],
  ['gibibyte', 'Gibibytes (binary)', 'GiB', '1073741824'],
  ['tebibyte', 'Tebibytes (binary)', 'TiB', '1099511627776'],
]);
add('duration', [
  ['nanosecond', 'Nanoseconds', 'ns', '0.000001'],
  ['microsecond', 'Microseconds', '\u00b5s', '0.001'],
  ['millisecond', 'Milliseconds', 'ms', '1'],
  ['second', 'Seconds', 's', '1000'],
  ['minute', 'Minutes', 'min', '60000'],
  ['hour', 'Hours', 'h', '3600000'],
  ['day', 'Days', 'days', '86400000'],
  ['week', 'Weeks', 'weeks', '604800000'],
  ['month', 'Months', 'months', '2629746000'],
  ['year', 'Years', 'years', '31556952000'],
]);
// SI prefix factors: https://www.bipm.org/en/measurement-units/si-prefixes
// Non-SI factors: NIST SP 811, Appendix B.8. Factors below are exact
// definitions or computed from exact definitions at Decimal's precision.
const prefixes: Record<string, [string, string]> = {
  pico: ['p', '1e-12'],
  nano: ['n', '1e-9'],
  micro: ['\u00b5', '1e-6'],
  milli: ['m', '1e-3'],
  centi: ['c', '1e-2'],
  deci: ['d', '1e-1'],
  '': ['', '1'],
  deca: ['da', '1e1'],
  hecto: ['h', '1e2'],
  kilo: ['k', '1e3'],
  mega: ['M', '1e6'],
  giga: ['G', '1e9'],
  tera: ['T', '1e12'],
};

function addPrefixed(
  family: string,
  base: string,
  symbol: string,
  factor: string,
  names: string[],
) {
  for (const prefix of names) {
    const id = prefix + base;
    if (units[id]) continue;
    const [prefixSymbol, multiplier] = prefixes[prefix];
    const name =
      base === 'henry'
        ? prefix + 'henries'
        : id + (base === 'hertz' ? '' : 's');
    add(family, [
      [
        id,
        name.charAt(0).toUpperCase() + name.slice(1),
        prefixSymbol + symbol,
        new Decimal(factor).times(multiplier).toString(),
      ],
    ]);
  }
}
const metricRange = [
  'nano',
  'micro',
  'milli',
  'centi',
  'deci',
  '',
  'deca',
  'hecto',
  'kilo',
  'mega',
];
const engineeringRange = [
  'pico',
  'nano',
  'micro',
  'milli',
  '',
  'kilo',
  'mega',
  'giga',
  'tera',
];
addPrefixed('length', 'meter', 'm', '1', metricRange);
addPrefixed('mass', 'gram', 'g', '1', metricRange);
addPrefixed('volume', 'liter', 'L', '1', metricRange);
addPrefixed('duration', 'second', 's', '1000', [
  'pico',
  'nano',
  'micro',
  'milli',
  '',
  'kilo',
  'mega',
]);
addPrefixed('energy', 'joule', 'J', '1', engineeringRange);
addPrefixed('power', 'watt', 'W', '1', engineeringRange);
addPrefixed('pressure', 'pascal', 'Pa', '1', [
  'micro',
  'milli',
  '',
  'hecto',
  'kilo',
  'mega',
  'giga',
]);
addPrefixed('frequency', 'hertz', 'Hz', '1', [
  'milli',
  '',
  'kilo',
  'mega',
  'giga',
  'tera',
]);
addPrefixed('voltage', 'volt', 'V', '1', [
  'nano',
  'micro',
  'milli',
  '',
  'kilo',
  'mega',
]);
addPrefixed('current', 'ampere', 'A', '1', [
  'nano',
  'micro',
  'milli',
  '',
  'kilo',
  'mega',
]);
addPrefixed('resistance', 'ohm', '\u03a9', '1', [
  'micro',
  'milli',
  '',
  'kilo',
  'mega',
  'giga',
]);
addPrefixed('charge', 'coulomb', 'C', '1', [
  'nano',
  'micro',
  'milli',
  '',
  'kilo',
]);
addPrefixed('capacitance', 'farad', 'F', '1', [
  'pico',
  'nano',
  'micro',
  'milli',
  '',
  'kilo',
]);
addPrefixed('inductance', 'henry', 'H', '1', [
  'nano',
  'micro',
  'milli',
  '',
  'kilo',
]);
addPrefixed('force', 'newton', 'N', '1', [
  'micro',
  'milli',
  '',
  'kilo',
  'mega',
]);

add('length', [
  ['angstrom', 'Angstroms', '\u00c5', '1e-10'],
  ['mil', 'Mils (thousandths of an inch)', 'mil', '0.0000254'],
  ['fathom', 'Fathoms', 'fathom', '1.8288'],
  ['furlong', 'Furlongs', 'fur', '201.168'],
  ['chain', 'Chains (international)', 'ch', '20.1168'],
  ['rod', 'Rods', 'rd', '5.0292'],
]);
add('mass', [
  ['short_ton', 'US short tons (2000 pounds)', 'US ton', '907184.74'],
  ['long_ton', 'Imperial long tons (2240 pounds)', 'long ton', '1016046.9088'],
  ['carat', 'Metric carats', 'ct', '0.2'],
  ['grain', 'Grains', 'gr', '0.06479891'],
  ['troy_ounce', 'Troy ounces', 'oz t', '31.1034768'],
  ['troy_pound', 'Troy pounds', 'lb t', '373.2417216'],
]);
add('volume', [
  ['cubic_centimeter', 'Cubic centimeters (cc)', 'cm\u00b3', '0.001'],
  ['cubic_millimeter', 'Cubic millimeters', 'mm\u00b3', '0.000001'],
  ['cubic_inch', 'Cubic inches', 'in\u00b3', '0.016387064'],
  ['cubic_foot', 'Cubic feet', 'ft\u00b3', '28.316846592'],
  ['cubic_yard', 'Cubic yards', 'yd\u00b3', '764.554857984'],
  [
    'metric_teaspoon',
    'Metric teaspoons (explicit 5 mL)',
    'metric tsp',
    '0.005',
  ],
  [
    'metric_tablespoon',
    'Metric tablespoons (explicit 15 mL)',
    'metric tbsp',
    '0.015',
  ],
  [
    'australian_tablespoon',
    'Australian tablespoons (20 mL)',
    'AU tbsp',
    '0.02',
  ],
  ['oil_barrel', 'Petroleum barrels (42 US gallons)', 'bbl', '158.987294928'],
]);
add('area', [
  ['square_millimeter', 'Square millimeters', 'mm\u00b2', '0.000001'],
  ['square_centimeter', 'Square centimeters', 'cm\u00b2', '0.0001'],
  ['square_decimeter', 'Square decimeters', 'dm\u00b2', '0.01'],
  ['square_meter', 'Square meters', 'm\u00b2', '1'],
  ['square_kilometer', 'Square kilometers', 'km\u00b2', '1000000'],
  ['square_inch', 'Square inches', 'in\u00b2', '0.00064516'],
  ['square_foot', 'Square feet', 'ft\u00b2', '0.09290304'],
  ['square_yard', 'Square yards', 'yd\u00b2', '0.83612736'],
  ['square_mile', 'Square miles', 'mi\u00b2', '2589988.110336'],
  ['acre', 'Acres (international foot)', 'acre', '4046.8564224'],
  ['hectare', 'Hectares', 'ha', '10000'],
  ['are', 'Ares', 'a', '100'],
]);
// Meters per hour is the speed base, keeping these factors exact decimals.
add('speed', [
  ['meter_per_hour', 'Meters per hour', 'm/h', '1'],
  ['meter_per_second', 'Meters per second', 'm/s', '3600'],
  ['meter_per_minute', 'Meters per minute', 'm/min', '60'],
  ['kilometer_per_hour', 'Kilometers per hour', 'km/h', '1000'],
  ['kilometer_per_second', 'Kilometers per second', 'km/s', '3600000'],
  ['mile_per_hour', 'Miles per hour', 'mph', '1609.344'],
  ['foot_per_second', 'Feet per second', 'ft/s', '1097.28'],
  ['knot', 'Knots (nautical miles per hour)', 'kn', '1852'],
]);
add('energy', [
  ['watt_hour', 'Watt hours', 'Wh', '3600'],
  ['kilowatt_hour', 'Kilowatt hours', 'kWh', '3600000'],
  ['megawatt_hour', 'Megawatt hours', 'MWh', '3600000000'],
  ['calorie', 'Small thermochemical calories', 'cal', '4.184'],
  ['kilocalorie', 'Kilocalories (food Calories)', 'kcal', '4184'],
  ['electronvolt', 'Electronvolts', 'eV', '1.602176634e-19'],
  ['erg', 'Ergs', 'erg', '1e-7'],
]);
add('power', [
  [
    'mechanical_horsepower',
    'Mechanical horsepower (US)',
    'hp',
    '745.69987158227022',
  ],
  ['metric_horsepower', 'Metric horsepower', 'PS', '735.49875'],
]);
add('pressure', [
  ['bar', 'Bars', 'bar', '100000'],
  ['millibar', 'Millibars', 'mbar', '100'],
  ['atmosphere', 'Standard atmospheres', 'atm', '101325'],
  [
    'psi',
    'Pounds-force per square inch',
    'psi',
    new Decimal('4.4482216152605').div('0.00064516').toString(),
  ],
]);
add('force', [
  ['pound_force', 'Pounds-force', 'lbf', '4.4482216152605'],
  ['kilogram_force', 'Kilograms-force', 'kgf', '9.80665'],
  ['dyne', 'Dynes', 'dyn', '0.00001'],
]);
add('charge', [
  ['ampere_hour', 'Ampere hours', 'Ah', '3600'],
  ['milliampere_hour', 'Milliampere hours', 'mAh', '3.6'],
]);
add('duration', [
  ['fortnight', 'Fortnights (14 days)', 'fortnight', '1209600000'],
]);

// Bytes are the data-size base. SI and IEC prefixes stay separate choices.
const decimalData = [
  'kilo',
  'mega',
  'giga',
  'tera',
  'peta',
  'exa',
  'zetta',
  'yotta',
];
const binaryData = [
  'kibi',
  'mebi',
  'gibi',
  'tebi',
  'pebi',
  'exbi',
  'zebi',
  'yobi',
];
for (let index = 0; index < decimalData.length; index++) {
  const decimalPrefix = decimalData[index];
  const binaryPrefix = binaryData[index];
  const decimalSymbol = ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'][index];
  const binarySymbol = ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'][index];
  for (const base of ['bit', 'byte']) {
    const bitFactor = base === 'bit' ? '0.125' : '1';
    const symbol = base === 'bit' ? 'b' : 'B';
    const decimalId = decimalPrefix + base;
    const binaryId = binaryPrefix + base;
    if (!units[decimalId])
      add('data', [
        [
          decimalId,
          decimalId + 's (decimal)',
          decimalSymbol + symbol,
          new Decimal(1000)
            .pow(index + 1)
            .times(bitFactor)
            .toString(),
        ],
      ]);
    if (!units[binaryId])
      add('data', [
        [
          binaryId,
          binaryId + 's (binary)',
          binarySymbol + symbol,
          new Decimal(1024)
            .pow(index + 1)
            .times(bitFactor)
            .toString(),
        ],
      ]);
  }
}

export function unitChoices() {
  const result: Record<string, string> = {
    unsupported: 'No unit, unsupported unit, or genuinely ambiguous unit',
  };
  for (const id of Object.keys(units)) {
    const unit = units[id];
    result[id] = `${unit.label} (${unit.symbol}), ${unit.family}`;
  }
  return result;
}
export function convertDecimal(
  value: string | Decimal,
  source: string,
  target: string,
): Decimal {
  const from = units[source],
    to = units[target];
  if (!from || !to || from.family !== to.family)
    throw new Error('Choose source and target units in the same family.');
  let amount = new Decimal(value);
  if (!amount.isFinite()) throw new Error('Enter a finite number.');
  if (from.family === 'temperature') {
    if (source === 'fahrenheit') amount = amount.minus(32).times(5).div(9);
    if (source === 'kelvin') amount = amount.minus('273.15');
    if (amount.lt('-273.15'))
      throw new Error('That temperature is below absolute zero.');
    if (target === 'fahrenheit') amount = amount.times(9).div(5).plus(32);
    if (target === 'kelvin') amount = amount.plus('273.15');
  } else {
    amount = amount.times(from.factor).div(to.factor);
  }
  return amount;
}
export function convert(value: string, source: string, target: string): string {
  return convertDecimal(value, source, target)
    .toSignificantDigits(30)
    .toString();
}

export function durationEstimate(source: string, target: string) {
  const sourceIsCalendar = source === 'month' || source === 'year';
  const targetIsCalendar = target === 'month' || target === 'year';
  if (
    units[source]?.family !== 'duration' ||
    units[target]?.family !== 'duration' ||
    sourceIsCalendar === targetIsCalendar
  )
    return {};
  return {
    approximate: true,
    note: 'Average Gregorian year: 365.2425 days; month: 30.436875 days',
  };
}
