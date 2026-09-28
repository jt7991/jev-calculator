import { mkdir, writeFile } from 'node:fs/promises';
import { runCalculation } from '../core/service.js';
import { TypeSafeClient } from '@typesafe-ai/sdk';
const cases = [
  ['16 feet plus 100 yards in feet', '316', 'ft'],
  ['5 feet minus 6 inches in inches', '54', 'in'],
  ['2 kilograms plus 500 grams to grams', '2500', 'g'],
  ['in 3 days', 'Sep 29, 2026 \u00b7 20:15:45.123', 'UTC'],
  ['25 cups plus 45 mililiters', '25.1902038776978668590735279436', 'US cup'],
  ['25 cups plus 45 milliliters', '25.1902038776978668590735279436', 'US cup'],
  ['5 feet minus 6 inches', '4.5', 'ft'],
  ['add 45 ml to 25 cups', '25.1902038776978668590735279436', 'US cup'],
  ['2 kilograms plus 500 grams', '2.5', 'kg'],
  ['6 feet in inches', '72', 'in'],
  ['1 cup in ml', '236.5882365', 'mL'],
  ['25 cups in ts', '1200', 'tsp'],
  ['25 cups in tsp', '1200', 'tsp'],
  ['25 cups in tbsp', '400', 'tbsp'],
  ['3 ts in tbsp', '1', 'tbsp'],
  ['1 teaspoon in ml', '4.92892159375', 'mL'],
  ['2.5 kilograms in grams', '2500', 'g'],
  ['32 Fahrenheit in Celsius', '0', '\u00b0C'],
  ['1 GiB in MiB', '1024', 'MiB'],
  ['one day in hours', '24', 'h'],
  ['25 years to days', '9131.0625', 'days'],
  ['3 meters more than a mile', '1.00186411357671200190885230255', 'mi'],
  ['now in ms', '1790453745123', 'ms'],
  [
    '1700000000 Unix seconds to date',
    'Nov 14, 2023 \u00b7 22:13:20.000',
    'UTC',
  ],
  ['1 day after tomorrow', 'Sep 28, 2026 \u00b7 20:15:45.123', 'UTC'],
  ['2 weeks before next tuesday', 'Sep 15, 2026 \u00b7 20:15:45.123', 'UTC'],
  ['last Tuesday', 'Sep 22, 2026 \u00b7 20:15:45.123', 'UTC'],
  ['last Tuesday at 3 pm', 'Sep 22, 2026 \u00b7 15:00:00.000', 'UTC'],
  ['2 weeks before last Tuesday', 'Sep 8, 2026 \u00b7 20:15:45.123', 'UTC'],
  ['Days since last Tuesday', '4', 'days'],
  ['2 weeks after next tuesday', 'Oct 13, 2026 \u00b7 20:15:45.123', 'UTC'],
  ['3 days before tomorrow', 'Sep 24, 2026 \u00b7 20:15:45.123', 'UTC'],
  ['How many days until next Tuesday?', '3', 'days'],
  ['How many weeks until October 10 2026?', '2', 'weeks'],
  ['3 years and 3 days from now', 'Sep 29, 2029 \u00b7 20:15:45.123', 'UTC'],
  ['2 hours and 30 minutes ago', 'Sep 26, 2026 \u00b7 17:45:45.123', 'UTC'],
  [
    '1 month and 2 days before next Tuesday',
    'Aug 27, 2026 \u00b7 20:15:45.123',
    'UTC',
  ],
  [
    '1 month and 1 day after January 30 2027',
    'Mar 1, 2027 \u00b7 20:15:45.123',
    'UTC',
  ],
  [
    '1 day and 1 month after January 30 2027',
    'Feb 28, 2027 \u00b7 20:15:45.123',
    'UTC',
  ],
  ['3 days after 15 years ago', 'Sep 29, 2011 \u00b7 20:15:45.123', 'UTC'],
  ['2 hours after 1 hour ago', 'Sep 26, 2026 \u00b7 21:15:45.123', 'UTC'],
  ['next Thursday at 3:30 pm', 'Oct 1, 2026 \u00b7 15:30:00.000', 'UTC'],
  ['Days until 3 months after January 29 2027', '215', 'days'],
  ['days from January 1 2027 to February 1 2027', '31', 'days'],
  ['Add 3 days to today', 'Sep 29, 2026 \u00b7 20:15:45.123', 'UTC'],
  [
    '1700000000000 Unix milliseconds to date',
    'Nov 14, 2023 \u00b7 22:13:20.000',
    'UTC',
  ],
  [
    '1 day after 1 month after January 30 2027',
    'Mar 1, 2027 \u00b7 20:15:45.123',
    'UTC',
  ],
  [
    'Days from 2 days after January 1 2027 to 3 days before February 1 2027',
    '26',
    'days',
  ],
  ['Hours since 2 days after September 23 2026', '24', 'h'],
  ['1 liter in cups', '4.22675283773037464607839874575', 'US cup'],
  ['2 imperial gallons in liters', '9.09218', 'L'],
  ['1 micrometer in nanometers', '1000', 'nm'],
  ['1 carat in milligrams', '200', 'mg'],
  ['1 troy ounce in grams', '31.1034768', 'g'],
  ['1 US ton in pounds', '2000', 'lb'],
  ['1 cubic foot in liters', '28.316846592', 'L'],
  ['1 metric teaspoon in ml', '5', 'mL'],
  ['1 Australian tablespoon in ml', '20', 'mL'],
  ['1 acre in square feet', '43560', 'ft\u00b2'],
  ['2 hectares in square meters', '20000', 'm\u00b2'],
  ['60 mph in km/h', '96.56064', 'km/h'],
  ['10 meters per second in km/h', '36', 'km/h'],
  ['1 knot in km/h', '1.852', 'km/h'],
  ['1 kWh in joules', '3600000', 'J'],
  ['1 kcal in joules', '4184', 'J'],
  ['1 kilowatt in watts', '1000', 'W'],
  ['1 bar in kilopascals', '100', 'kPa'],
  ['1 atmosphere in pascals', '101325', 'Pa'],
  ['1 gigahertz in megahertz', '1000', 'MHz'],
  ['1 volt in millivolts', '1000', 'mV'],
  ['1 ampere in milliamperes', '1000', 'mA'],
  ['2 kiloohms in ohms', '2000', '\u03a9'],
  ['1 ampere hour in coulombs', '3600', 'C'],
  ['1 microfarad in nanofarads', '1000', 'nF'],
  ['1 henry in millihenries', '1000', 'mH'],
  ['1 pound force in newtons', '4.4482216152605', 'N'],
  ['1 fortnight in days', '14', 'days'],
  ['1 megabit in bytes', '125000', 'B'],
  ['1 mebibit in bytes', '131072', 'B'],
  ['1 pebibyte in tebibytes', '1024', 'TiB'],
  ['1 petabyte in terabytes', '1000', 'TB'],
  ['10 m', 'ERROR', 'ambiguous'],
  ['1 kilogram in meters', 'ERROR', 'calculation'],
  ['February 30 2027', 'ERROR', 'calculation'],
] as const;
const client = new TypeSafeClient();
const call = client.systemOne.bind(client);
let traces: unknown[] = [];
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
const records = [];
for (const [text, value, unit] of cases) {
  traces = [];
  const start = performance.now();
  const actual = await runCalculation(
    {
      text,
      timezone: 'UTC',
      referenceTime: '2026-09-26T20:15:45.123Z',
    },
    client,
  );
  const passed =
    value === 'ERROR'
      ? actual.status === 'error' && actual.code === unit
      : actual.status === 'success' &&
        actual.value === value &&
        actual.unit === unit;
  records.push({
    text,
    expected: { value, unit },
    actual,
    traces,
    passed,
    milliseconds: Math.round(performance.now() - start),
  });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${text}: ${JSON.stringify(actual)}`);
}
const summary = {
  total: records.length,
  passed: records.filter((record) => record.passed).length,
  failed: records.filter((record) => !record.passed).length,
};
await mkdir('evals/results', { recursive: true });
const path = `evals/results/final-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(path, JSON.stringify({ summary, records }, null, 2));
console.log(summary);
console.log(`Saved ${path}`);
process.exitCode = summary.failed ? 1 : 0;
