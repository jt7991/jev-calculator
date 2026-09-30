import { choiceSelection, type Selection } from './selections.js';
import type { ChoiceResponse } from '@typesafe-ai/sdk';
import { Jev } from './jev.js';
import { QuantityParser, type Quantity } from './quantity.js';
import { unitChoices } from './units.js';
export type Operation = (
  | { type: 'add' | 'subtract' | 'multiply' | 'divide'; amount: Quantity }
  | { type: 'convert'; unit: string }
) & { selections?: Selection[] };

export class OperationParser {
  constructor(
    private readonly jev: Jev,
    private readonly quantities: QuantityParser,
  ) {}

  async parse(phrase: string, request: string): Promise<Operation> {
    const kinds = {
      add: 'Add an amount: after, more than, plus, from now, add',
      subtract: 'Subtract an amount: before, ago, less than, minus, subtract',
      multiply:
        'Multiply by a quantity, including a constant rate sustained for a duration',
      divide: 'Divide by a quantity to find a rate or ratio',
      convert:
        'Convert to an output unit or display a timestamp as a readable date',
      unsupported: 'Not one supported operation',
    };
    const units = {
      ...unitChoices(),
      date: 'A readable calendar date or date and time',
    };
    const answers = await this.jev.ask(
      { phrase, request },
      {
        operation: {
          type: 'choice',
          instructions:
            'Classify the selected phrase as addition, subtraction, multiplication, division, or conversion using its relationship to the starting quantity in request. An output-only phrase such as to mph, in miles, or to mAh is convert, not multiply or divide: it requests the display unit without supplying an operand. Do not classify an output conversion by the arithmetic elsewhere in request. A constant current, speed, or power sustained for/over a duration means multiply by that duration. The reversed form, a duration at a constant rate, means multiply by the rate: at 3 mph in 30 minutes at 3 mph means multiply, as do at 3 amps and at 100 watts when applied to a duration. At a clock time remains a date/time relationship, not multiplication. For 3 amps over 5 minutes to mAh, over 5 minutes means multiply. A total amount spread over a duration to find a rate means divide: 20 miles over 2 hours to mph. Explicit times/multiplied by mean multiply; divided by means divide. Do not map over to division without interpreting the whole request. Explicit relationship words in phrase take priority: ago/before/minus mean subtract; after/plus/add mean add. Ignore conflicting words in other operations in request. Only consult request when phrase has NO relationship of its own, to inherit a relationship shared by coordinated amounts. A phrase naming the requested OUTPUT unit in a "how many OUTPUT units are in SOURCE quantity" question is a conversion, even without in/to in the selected phrase and even when the units are incompatible. Conversion changes the output unit or format: in ms, in inches, and to date are convert, including now in ms and Unix seconds to date. For adjustments, use request to resolve shared relationship words: amounts joined by and share from now/after (add) or ago/before (subtract). Thus 3 years in 3 years and 3 days from now is add; 2 hours in 2 hours and 30 minutes ago is subtract. A bare amount is not unsupported when its coordinated list supplies the relationship. For 1 month and 2 days before next Tuesday, the phrase 1 month inherits before and means subtract. An explicit relationship on phrase overrides a shared one.',
          criteria: kinds,
        },
      },
    );
    const type = this.jev.read(answers, 'operation', kinds);
    const selections = [
      choiceSelection('Operation', answers.operation as ChoiceResponse, kinds),
    ];
    if (type === 'convert') {
      const target = await this.jev.ask(
        { phrase, request },
        {
          unit: {
            type: 'choice',
            instructions:
              'What OUTPUT unit does this conversion phrase request? Ignore source units elsewhere in request. Use US customary volume unless explicitly specified otherwise. Select date only for readable calendar output.',
            criteria: units,
          },
        },
      );
      selections.push(
        choiceSelection('Output unit', target.unit as ChoiceResponse, units),
      );
      return { type, unit: this.jev.read(target, 'unit', units), selections };
    }
    // The amount parser sees only this adjustment, never other operations.
    const amount = await this.quantities.parse(phrase, phrase);
    return {
      type: type as 'add' | 'subtract' | 'multiply' | 'divide',
      amount,
      selections,
    };
  }

  async equivalentPhrases(phrases: string[], request: string) {
    const [first, second] = phrases;
    const longer = first.length >= second.length ? first : second;
    const shorter = longer === first ? second : first;
    // Only resolve a small boundary difference, not two separate operations or
    // a phrase containing several amounts. Prefer the longer span so a trailing
    // relationship word is consumed along with its amount.
    if (
      longer.split(/\s+/).length - shorter.split(/\s+/).length !== 1 ||
      !` ${longer} `.includes(` ${shorter} `)
    )
      throw new Error('The next operation phrase is unclear.');
    const parsed = await Promise.all(
      phrases.map((phrase) => this.parse(phrase, request)),
    );
    const [a, b] = parsed;
    const same =
      a.type === b.type &&
      (a.type === 'convert' && b.type === 'convert'
        ? a.unit === b.unit
        : a.type !== 'convert' &&
          b.type !== 'convert' &&
          a.amount.unit === b.amount.unit &&
          a.amount.amount.eq(b.amount.amount));
    if (!same)
      throw new Error(
        'The candidate operation phrases disagree. Be more specific.',
      );
    return { section: longer, operation: parsed[phrases.indexOf(longer)] };
  }

  async executionOrder(phrases: string[], request: string): Promise<string[]> {
    if (phrases.length < 2) return phrases;
    const ordered: string[] = [];
    const remaining = [...phrases];
    while (remaining.length > 1) {
      const choices: Record<string, string> = {};
      for (let index = 0; index < remaining.length; index++)
        choices[String(index)] = remaining[index];
      const answers = await this.jev.ask(
        {
          request,
          completedOperations: ordered,
          remainingOperations: remaining,
        },
        {
          next: {
            type: 'choice',
            instructions:
              'Which remaining operation executes next? First distinguish a coordinated list from nested dependencies. A list joined by and with one shared relationship executes LEFT TO RIGHT, even for calendar units: 1 day and 1 month after a date means day first; 1 month and 1 day after a date means month first. A nested expression with separate relationships executes inside out: 3 days after 15 years ago means subtract years first; A after B after a date means B then A. Conversions execute at the requested position, with final output conversion last. Otherwise preserve written order.',
            criteria: choices,
          },
        },
      );
      const index = Number(this.jev.read(answers, 'next', choices));
      ordered.push(remaining.splice(index, 1)[0]);
    }
    return [...ordered, ...remaining];
  }
}
