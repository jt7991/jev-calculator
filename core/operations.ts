import { choiceSelection, type Selection } from './selections.js';
import type { ChoiceResponse } from '@typesafe-ai/sdk';
import { Jev } from './jev.js';
import { QuantityParser, type Quantity } from './quantity.js';
import { unitChoices } from './units.js';
export type Operation = (
  | { type: 'add' | 'subtract'; amount: Quantity }
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
            'Which operation does phrase represent in request: addition, subtraction, or conversion? Conversion changes the output unit or format: in ms, in inches, and to date are convert, including now in ms and Unix seconds to date. For adjustments, use request to resolve shared relationship words: amounts joined by and share from now/after (add) or ago/before (subtract). Thus 3 years in 3 years and 3 days from now is add; 2 hours in 2 hours and 30 minutes ago is subtract. An explicit relationship on phrase overrides a shared one.',
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
    return { type: type as 'add' | 'subtract', amount, selections };
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
