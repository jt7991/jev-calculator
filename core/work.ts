import type { Selection } from './selections.js';
import type { JevCall } from './trace.js';
import { dateAt, type DateContext } from './date-input.js';
import {
  ExpressionEvaluator,
  type Expression,
  type Value,
} from './expression.js';
import { units, convertDecimal } from './units.js';

export type DisplayValue = { value: string; unit: string };
export type WorkNode = {
  id: string;
  kind: string;
  label: string;
  source: string;
  result: DisplayValue;
  calculation: string;
  note?: string;
  step?: number;
  children: WorkNode[];
  selections?: Selection[];
};
export type CalculationWork = {
  calls?: JevCall[];
  tree: WorkNode;
  steps: WorkNode[];
  pieces: { text: string; role: string; nodeId: string }[];
  referenceTime: string;
  timezone: string;
};

export function displayValue(value: Value): DisplayValue {
  if (value.type === 'date')
    return {
      value: dateAt(value.epochMilliseconds, value.timezone).format(
        'MMM D, YYYY [\u00b7] HH:mm:ss.SSS',
      ),
      unit: value.timezone,
    };
  return {
    value: value.amount.isInteger()
      ? value.amount.toFixed()
      : value.amount.toSignificantDigits(30).toString(),
    unit: units[value.unit].symbol,
  };
}

export class WorkBuilder {
  private nextId = 0;
  private steps: WorkNode[] = [];
  constructor(private readonly evaluator: ExpressionEvaluator) {}

  build(
    expression: Expression,
    request: string,
    context: DateContext,
  ): CalculationWork {
    this.nextId = 0;
    this.steps = [];
    const tree = this.visit(expression);
    const pieces = this.steps
      .filter((node) => node.source && node.kind !== 'difference')
      .map((node) => ({
        text: node.source,
        role: node.kind === 'literal' ? 'Input' : node.label,
        nodeId: node.id,
      }));
    pieces.sort(
      (a, b) =>
        request.toLowerCase().indexOf(a.text.toLowerCase()) -
        request.toLowerCase().indexOf(b.text.toLowerCase()),
    );
    return {
      tree,
      steps: this.steps,
      pieces,
      referenceTime: dateAt(context.referenceTime, context.timezone).format(
        'MMM D, YYYY [\u00b7] HH:mm:ss.SSS',
      ),
      timezone: context.timezone,
    };
  }

  private visit(expression: Expression): WorkNode {
    const children: WorkNode[] = [];
    const selections = [...(expression.selections ?? [])];
    if (
      expression.type !== 'literal' &&
      !selections.some((item) => item.label === 'Operation')
    )
      selections.push({ label: 'Operation', value: expression.type });
    if ('amount' in expression)
      selections.push(...(expression.amount.selections ?? []));
    if (
      (expression.type === 'convert' || expression.type === 'difference') &&
      !selections.some((item) => item.label === 'Output unit')
    )
      selections.push({
        label: 'Output unit',
        value:
          expression.unit === 'date'
            ? 'Readable date'
            : units[expression.unit].label,
      });
    let label = 'Starting input';
    let calculation = '';
    let note = expression.note;
    if (expression.type === 'difference') {
      children.push(this.visit(expression.start), this.visit(expression.end));
      label = 'Find the difference';
      calculation = `${this.text(children[1].result)} minus ${this.text(children[0].result)}`;
      note =
        'Elapsed time between the two resolved dates, converted to ' +
        units[expression.unit].label.toLowerCase() +
        '.';
    } else if (expression.type !== 'literal') {
      const input = this.visit(expression.input);
      children.push(input);
      if (expression.type === 'convert') {
        label =
          expression.unit === 'date'
            ? 'Display as a date'
            : `Convert to ${units[expression.unit].label.toLowerCase()}`;
        const before = this.evaluator.evaluate(expression.input);
        if (before.type === 'quantity' && expression.unit !== 'date') {
          const from = units[before.unit];
          const to = units[expression.unit];
          if (from.family === 'temperature') {
            let celsius = input.result.value;
            if (before.unit === 'fahrenheit')
              celsius = `(${input.result.value} - 32) \u00d7 5 / 9`;
            if (before.unit === 'kelvin')
              celsius = `${input.result.value} - 273.15`;
            calculation = celsius;
            if (expression.unit === 'fahrenheit')
              calculation = `(${celsius}) \u00d7 9 / 5 + 32`;
            if (expression.unit === 'kelvin')
              calculation = `(${celsius}) + 273.15`;
            note = `Convert ${from.symbol} to ${to.symbol} using the temperature scale and offset.`;
          } else {
            const rate = convertDecimal('1', before.unit, expression.unit)
              .toSignificantDigits(16)
              .toString();
            calculation = `${input.result.value} \u00d7 ${rate}`;
            note = `1 ${from.symbol} = ${rate} ${to.symbol}`;
          }
        } else {
          calculation = this.text(input.result);
          note =
            expression.unit === 'date'
              ? 'Format the same instant in its timezone.'
              : `Elapsed ${expression.unit}s since January 1, 1970 at 00:00 UTC.`;
        }
      } else {
        const amount = displayValue(expression.amount);
        children.push({
          id: `node-${++this.nextId}`,
          kind: 'amount',
          label: 'Amount',
          source: '',
          result: amount,
          calculation: '',
          children: [],
        });
        const operationLabels = {
          add: 'Add',
          subtract: 'Subtract',
          multiply: 'Multiply by',
          divide: 'Divide by',
        };
        const operationSymbols = {
          add: '+',
          subtract: '\u2212',
          multiply: '\u00d7',
          divide: '\u00f7',
        };
        label = `${operationLabels[expression.type]} ${this.text(amount)}`;
        calculation = `${this.text(input.result)} ${operationSymbols[expression.type]} ${this.text(amount)}`;
        const before = this.evaluator.evaluate(expression.input);
        if (expression.type === 'multiply' || expression.type === 'divide')
          note = 'Combine quantities using their dimensions and unit scales.';
        else if (before.type === 'date')
          note = ['month', 'year'].includes(expression.amount.unit)
            ? 'Calendar arithmetic; clamps to the last valid day when necessary.'
            : 'Elapsed time; one day is exactly 24 hours.';
        else if (expression.amount.unit !== before.unit) {
          const after = this.evaluator.evaluate(expression);
          if (after.type === 'quantity') {
            const adjustment =
              expression.type === 'add'
                ? after.amount.minus(before.amount)
                : before.amount.minus(after.amount);
            const normalized = adjustment.toSignificantDigits(30).toString();
            calculation = `${input.result.value} ${expression.type === 'add' ? '+' : '\u2212'} ${normalized} ${units[before.unit].symbol}`;
            note = `${this.text(amount)} = ${normalized} ${units[before.unit].symbol}`;
          }
        }
      }
    }
    const evaluated = this.evaluator.evaluate(expression);
    const result = displayValue(evaluated);
    const node: WorkNode = {
      id: `node-${++this.nextId}`,
      kind: expression.type,
      label,
      source: expression.source ?? '',
      result,
      calculation,
      note: evaluated.note ?? note,
      step: this.steps.length + 1,
      children,
    };
    // Steps carry no duplicate subtrees; the tree itself retains the relationships.
    this.steps.push({ ...node, selections, children: [] });
    return node;
  }

  private text(value: DisplayValue) {
    return `${value.value} ${value.unit}`;
  }
}
