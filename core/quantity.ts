import type { ChoiceResponse } from '@typesafe-ai/sdk';
import { choiceSelection, type Selection } from './selections.js';
import { Decimal } from 'decimal.js';
import { wordsToNumbers } from '@insomnia-dev/words-to-numbers';
import { Jev } from './jev.js';
import { wordSections } from './phrases.js';
import { unitChoices, units as unitDefinitions } from './units.js';

export type Quantity = {
  type: 'quantity';
  amount: Decimal;
  unit: string;
  selections?: Selection[];
};
export class QuantityParser {
  constructor(private readonly jev: Jev) {}

  amountChoices(text: string) {
    // Numeric spans are candidates only: Jev still selects their role and unit.
    // Preserve signs, decimals, and exponents verbatim in compact inputs (3kg).
    const numbers = Object.fromEntries(
      [
        ...text.matchAll(
          /(?<![\p{L}\p{N}_.])[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/gu,
        ),
      ].map(([number]) => [number, null]),
    );
    const choices = {
      ...wordSections(text),
      ...numbers,
      implicit_one: 'An implied quantity of one, as in a mile or an hour',
      unsupported: 'No amount is supplied',
    };
    if (Object.keys(choices).length > 255)
      throw new Error('Use a shorter quantity expression.');
    return choices;
  }

  number(text: string): Decimal {
    if (text === 'implicit_one') return new Decimal(1);
    let value: Decimal;
    try {
      value = new Decimal(text);
    } catch {
      const words = wordsToNumbers(text);
      if (typeof words !== 'number' || !Number.isSafeInteger(words))
        throw new Error('Use digits for this amount.');
      value = new Decimal(words);
    }
    if (!value.isFinite() || value.abs().gt('1e100'))
      throw new Error('Enter a finite number within the supported range.');
    return value;
  }

  async parse(text: string, request: string): Promise<Quantity> {
    const amounts = this.amountChoices(text);
    const units = unitChoices();
    const answers = await this.jev.ask(
      { request, input: text },
      {
        amount: {
          type: 'choice',
          instructions:
            'Which exact phrase is ONLY the numeric amount of the quantity in input? Input may be a starting quantity OR an isolated operation operand. Exclude units and relationship words such as minus, plus, times, divided by, over, and for. For minus 6 inches select 6, not minus 6; subtraction is handled separately. For divided by 5 minutes select 5; for times 3 meters select 3. Keep a written numeric sign attached to digits, as in -2.5kg. For one cup select one. For a cup select implicit_one. Numbers may touch units: for 3kg select 3, for -2.5kg select -2.5, for 1e3mA select 1e3. Preserve digits exactly.',
          criteria: amounts,
        },
        unit: {
          type: 'choice',
          instructions:
            'What is the source unit of the starting input? Interpret its role in the whole request. Use US customary cups, teaspoons, tablespoons, gallons, pints, and fluid ounces unless another system is explicitly specified. Keep mass ounces distinct from fluid ounces. KB/MB/GB are decimal and KiB/MiB/GiB binary. The abbreviation m alone can mean meters or minutes: select unsupported unless other context establishes length or duration. Select unsupported for genuine ambiguity.',
          criteria: units,
        },
      },
    );
    const numberText = this.jev.read(answers, 'amount', amounts);
    const amount = this.number(numberText);
    const unit = this.jev.read(answers, 'unit', units);
    return {
      type: 'quantity',
      amount,
      unit,
      selections: [
        {
          ...choiceSelection(
            'Number',
            answers.amount as ChoiceResponse,
            amounts,
          ),
          source: numberText === 'implicit_one' ? 'Implied one' : numberText,
          value: amount.toString(),
        },
        {
          ...choiceSelection(
            'Source unit',
            answers.unit as ChoiceResponse,
            units,
          ),
          value: unitDefinitions[unit].label,
        },
        { label: 'Unit family', value: unitDefinitions[unit].family },
      ],
    };
  }

  async timestamp(text: string, request: string) {
    const kinds = {
      calendar: 'Calendar date, relative day, or clock time',
      seconds: 'Unix epoch timestamp in seconds',
      milliseconds: 'Unix epoch timestamp in milliseconds',
      unsupported: 'Bare timestamp with an unspecified or ambiguous scale',
    };
    const amounts = this.amountChoices(text);
    const answers = await this.jev.ask(
      { request, input: text },
      {
        kind: {
          type: 'choice',
          instructions:
            'How is the starting date/time represented? A Unix timestamp is a number of seconds or milliseconds since the Unix epoch. Use the scale explicitly stated in the request. Ordinary calendar dates and clock times are calendar. Do not mistake an output unit for the source timestamp scale.',
          criteria: kinds,
        },
        amount: {
          type: 'choice',
          instructions:
            'If input is a Unix timestamp, which exact phrase contains only its numeric value? Otherwise select unsupported.',
          criteria: amounts,
        },
      },
    );
    const kind = this.jev.read(answers, 'kind', kinds);
    if (kind === 'calendar') return null;
    const numberText = this.jev.read(answers, 'amount', amounts);
    const number = this.number(numberText);
    const milliseconds = number.times(kind === 'seconds' ? 1000 : 1);
    if (!milliseconds.isInteger() || milliseconds.abs().gt('8640000000000000'))
      throw new Error('Timestamp is outside the supported millisecond range.');
    return {
      epochMilliseconds: milliseconds.toNumber(),
      selections: [
        {
          ...choiceSelection(
            'Number',
            answers.amount as ChoiceResponse,
            amounts,
          ),
          source: numberText,
          value: number.toString(),
        },
        {
          ...choiceSelection(
            'Source unit',
            answers.kind as ChoiceResponse,
            kinds,
          ),
          value: 'Unix ' + kind,
        },
        {
          label: 'Normalized timestamp',
          value: milliseconds.toString() + ' milliseconds',
        },
      ],
    };
  }
}
