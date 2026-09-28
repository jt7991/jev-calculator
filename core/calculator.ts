import { choiceSelection, type Selection } from './selections.js';
import type { ChoiceResponse } from '@typesafe-ai/sdk';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { JevTrace } from './trace.js';
import { Engine, type StartingInput } from './engine.js';
import { DateInput, type DateContext } from './date-input.js';
import { Jev } from './jev.js';
import { QuantityParser } from './quantity.js';
import { OperationParser, type Operation } from './operations.js';
import { ExpressionEvaluator, type Expression } from './expression.js';
import { wordSections } from './phrases.js';
import { WorkBuilder, displayValue } from './work.js';
import { unitChoices, units } from './units.js';
import type { CalculationRequest, CalculationResult } from './types.js';

export class Calculator {
  private readonly trace: JevTrace;
  private readonly engine: Engine;
  private readonly dates: DateInput;
  private readonly jev: Jev;
  private readonly quantities: QuantityParser;
  private readonly operations: OperationParser;

  constructor(client = new TypeSafeClient()) {
    this.trace = new JevTrace(client);
    this.engine = new Engine(this.trace);
    this.dates = new DateInput(this.trace);
    this.jev = new Jev(this.trace);
    this.quantities = new QuantityParser(this.jev);
    this.operations = new OperationParser(this.jev, this.quantities);
  }

  usage() {
    return this.trace.usage();
  }

  async calculate(request: CalculationRequest): Promise<CalculationResult> {
    const referenceTime = request.referenceTime ?? new Date().toISOString();
    const context = {
      referenceTime: Date.parse(referenceTime),
      timezone: request.timezone,
    };
    const expression = await this.plan(request.text, context);
    const evaluator = new ExpressionEvaluator(this.dates);
    const result = evaluator.evaluate(expression);
    const { value, unit } = displayValue(result);
    const work = new WorkBuilder(evaluator).build(
      expression,
      request.text,
      context,
    );
    work.calls = this.trace.calls;
    return {
      status: 'success',
      work,
      value,
      unit,
      interpretation: request.text,
      details: [],
      timezone: request.timezone,
      referenceTime,
      approximate: result.approximate,
      note: result.note,
    };
  }

  async plan(
    text: string,
    context: DateContext,
    depth = 0,
  ): Promise<Expression> {
    if (depth > 3) throw new Error('This calculation is nested too deeply.');
    // Input selection can run while Jev decides which kind of plan is needed.
    // Ignore its answer (or error) when the request is a date difference.
    const [mode, input] = await Promise.allSettled([
      this.mode(text),
      this.engine.input(text),
    ]);
    if (mode.status === 'rejected') throw mode.reason;
    if (mode.value === 'difference')
      return this.difference(text, context, depth);
    if (input.status === 'rejected') throw input.reason;

    // Resolving the starting value doesn't depend on interpreting adjustments.
    const [startingValue, operations] = await Promise.all([
      this.startingValue(input.value, text, context),
      this.parseOperations(text, input.value),
    ]);
    let expression = startingValue;
    for (const operation of operations) {
      expression = { ...operation, input: expression };
    }
    return expression;
  }

  private async mode(text: string) {
    const modes = {
      expression:
        'Evaluate a starting value, optionally adjusting or converting it. A supplied duration before/after a date asks for the resulting DATE: 2 weeks before next Tuesday, 3 days after tomorrow, 15 years ago. Also covers ordinary quantities and unit conversions.',
      difference:
        'Measure an UNKNOWN elapsed duration between date endpoints: how many weeks until next Tuesday, days since yesterday, days between January 1 and February 1. The duration is the requested answer, not a supplied adjustment.',
    };
    const answers = await this.jev.ask(
      { request: text },
      {
        mode: {
          type: 'choice',
          instructions:
            'What result does request ask us to calculate? Choose expression to evaluate or adjust a value, including finding a date by adding/subtracting a GIVEN duration. Choose difference to MEASURE the elapsed duration between two dates (one endpoint may be now). Before/after alone does not imply a date difference: 2 weeks before next Tuesday gives the amount to subtract and asks for a date; how many weeks until next Tuesday asks for an unknown duration. Classify the whole request, including any nested date adjustments.',
          criteria: modes,
        },
      },
    );
    return this.jev.read(answers, 'mode', modes);
  }

  private async startingValue(
    input: StartingInput,
    text: string,
    context: DateContext,
  ): Promise<Expression> {
    let expression: Expression;
    if (input.type === 'numeric' || input.type === 'implicit_one') {
      if (!input.text) throw new Error('The starting quantity is missing.');
      expression = {
        type: 'literal',
        value: await this.quantities.parse(input.text, text),
      };
    } else {
      const timestamp =
        input.type === 'date'
          ? await this.quantities.timestamp(input.text ?? '', text)
          : null;
      const date =
        timestamp === null
          ? await this.dates.parse(input.text ?? 'now', context)
          : {
              epochMilliseconds: timestamp.epochMilliseconds,
              timezone: context.timezone,
            };
      expression = {
        type: 'literal',
        selections:
          timestamp === null && 'selections' in date
            ? date.selections
            : [
                ...(timestamp?.selections ?? []),
                { label: 'Timezone', value: context.timezone },
              ],
        value: {
          type: 'date',
          epochMilliseconds: date.epochMilliseconds,
          timezone: date.timezone,
        },
      };
    }
    expression.selections = [
      ...(input.selections ?? []),
      ...(expression.selections ??
        (expression.value.type === 'quantity'
          ? (expression.value.selections ?? [])
          : [])),
    ];
    expression.source = input.text ?? 'now (implicit)';
    return expression;
  }

  private async parseOperations(text: string, input: StartingInput) {
    const phrases: string[] = [];
    const resolved = new Map<string, Operation>();
    const phraseSelections = new Map<string, Selection[]>();
    for (let step = 0; step < 12; step++) {
      const next = await this.engine.nextSection(text, input, phrases);
      if (next.section === null) break;
      phrases.push(next.section);
      if (next.operation) resolved.set(next.section, next.operation);
      phraseSelections.set(next.section, next.selections ?? []);
      if (step === 11) throw new Error('Use at most 12 operations.');
    }
    // Each phrase can be interpreted independently of its execution position.
    const [ordered, parsed] = await Promise.all([
      this.operations.executionOrder(phrases, text),
      Promise.all(
        phrases.map(
          (phrase) =>
            resolved.get(phrase) ?? this.operations.parse(phrase, text),
        ),
      ),
    ]);
    return ordered.map((phrase) => ({
      ...parsed[phrases.indexOf(phrase)],
      source: phrase,
      selections: [
        ...(phraseSelections.get(phrase) ?? []),
        ...(parsed[phrases.indexOf(phrase)].selections ?? []),
      ],
    }));
  }

  private async difference(
    text: string,
    context: DateContext,
    depth: number,
  ): Promise<Expression> {
    const forms = {
      until: 'Time from now UNTIL a date',
      since: 'Time SINCE a date up to now',
      between: 'Time between two explicitly specified dates',
    };
    const formAnswers = await this.jev.ask(
      { request: text },
      {
        form: {
          type: 'choice',
          instructions:
            'How are the interval endpoints expressed: until a date, since a date, or between two dates?',
          criteria: forms,
        },
      },
    );
    const form = this.jev.read(formAnswers, 'form', forms);
    const endpoints = {
      ...wordSections(text),
      '[now]': 'The current reference time when an endpoint is implicit',
    };
    const output = unitChoices();
    const answers = await this.jev.ask(
      { request: text },
      {
        start: {
          type: 'choice',
          instructions:
            'Select the entire starting date expression of this elapsed-time interval, including its adjustments. Keep date modifiers such as next, this, and last with the weekday; never shorten next Tuesday to Tuesday. Exclude words such as days from. For days until X, start is [now]. For days since X, start is X.',
          criteria: endpoints,
        },
        end: {
          type: 'choice',
          instructions:
            'Select the entire ending date expression of this elapsed-time interval, including its adjustments. Keep date modifiers such as next, this, and last with the weekday; never shorten next Tuesday to Tuesday. For how many days until next Tuesday?, select next Tuesday? including its attached punctuation, not Tuesday? or days until next Tuesday?. For days until X, end is X. For days since X, end is [now]. For days from X to Y, end is Y.',
          criteria: endpoints,
        },
        unit: {
          type: 'choice',
          instructions:
            'What duration unit is requested for this date difference? Use days when no output unit is specified.',
          criteria: output,
        },
      },
    );
    const start =
      form === 'until' ? '[now]' : this.jev.read(answers, 'start', endpoints);
    const end =
      form === 'since' ? '[now]' : this.jev.read(answers, 'end', endpoints);
    const unit = this.jev.read(answers, 'unit', output);
    if (units[unit].family !== 'duration')
      throw new Error('A date difference needs a duration unit.');
    if (start === text || end === text)
      throw new Error('The date endpoints are unclear.');
    const [startExpression, endExpression] = await Promise.all([
      start === '[now]'
        ? this.now(context)
        : this.plan(start, context, depth + 1),
      end === '[now]' ? this.now(context) : this.plan(end, context, depth + 1),
    ]);
    return {
      type: 'difference',
      selections: [
        choiceSelection(
          'Interval type',
          formAnswers.form as ChoiceResponse,
          forms,
        ),
        choiceSelection('Output unit', answers.unit as ChoiceResponse, output),
      ],
      source: text,
      start: startExpression,
      end: endExpression,
      unit,
    };
  }

  private now(context: DateContext): Expression {
    return {
      type: 'literal',
      source: 'now (implicit)',
      value: {
        type: 'date',
        epochMilliseconds: context.referenceTime,
        timezone: context.timezone,
      },
    };
  }
}
