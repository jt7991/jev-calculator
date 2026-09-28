import { afterEach, expect, test, vi } from 'vitest';
import Decimal from 'decimal.js';
import { OperationParser, type Operation } from '../core/operations';
import { Jev } from '../core/jev';
import { QuantityParser } from '../core/quantity';
import { Engine } from '../core/engine';
import type { JevClient } from '../core/trace';
const client = { systemOne: vi.fn() } as unknown as JevClient;
const jev = new Jev(client);
const parser = new OperationParser(jev, new QuantityParser(jev));
function addition(value = '45', unit = 'milliliter') {
  return {
    type: 'add' as const,
    amount: { type: 'quantity' as const, amount: new Decimal(value), unit },
  };
}
afterEach(() => vi.restoreAllMocks());

test('parses both boundaries, compares Decimal values, and consumes the longer phrase', async () => {
  const parse = vi
    .spyOn(parser, 'parse')
    .mockResolvedValueOnce(addition('45'))
    .mockResolvedValueOnce(addition('45.0'));
  const result = await parser.equivalentPhrases(
    ['add 45 ml', 'add 45 ml to'],
    'add 45 ml to 25 cups',
  );
  expect(result.section).toBe('add 45 ml to');
  expect(parse.mock.calls.map((call) => call[0])).toEqual([
    'add 45 ml',
    'add 45 ml to',
  ]);
});

test('rejects different meanings even when phrases overlap', async () => {
  const alternatives: Operation[] = [
    addition('46'),
    addition('45', 'liter'),
    { ...addition(), type: 'subtract' },
    { type: 'convert', unit: 'milliliter' },
  ];
  for (const alternative of alternatives) {
    vi.spyOn(parser, 'parse')
      .mockResolvedValueOnce(addition())
      .mockResolvedValueOnce(alternative);
    await expect(
      parser.equivalentPhrases(['add 45 ml', 'add 45 ml to'], 'request'),
    ).rejects.toThrow('disagree');
    vi.restoreAllMocks();
  }
});

test('rejects separate operations, whole coordinated lists, and uncertain candidate parses', async () => {
  const parse = vi
    .spyOn(parser, 'parse')
    .mockRejectedValue(new Error('The unit is unclear.'));
  await expect(
    parser.equivalentPhrases(['45 minutes after', '2 hours ago'], 'request'),
  ).rejects.toThrow('unclear');
  await expect(
    parser.equivalentPhrases(
      ['1 month', '1 month and 2 days before'],
      'request',
    ),
  ).rejects.toThrow('unclear');
  expect(parse).not.toHaveBeenCalled();
  await expect(
    parser.equivalentPhrases(['add 45 ml', 'add 45 ml to'], 'request'),
  ).rejects.toThrow('unit is unclear');
});

test('resolves split phrase probability only after both operations agree, retaining original evidence', async () => {
  const localClient = {
    systemOne: vi.fn().mockResolvedValue({
      answers: {
        section: {
          type: 'choice',
          choice: 'add 45 ml',
          confidence: 0.2,
          probabilities: {
            'add 45 ml': 0.49,
            'add 45 ml to': 0.45,
            done: 0.06,
          },
        },
      },
    }),
  } as unknown as JevClient;
  vi.spyOn(OperationParser.prototype, 'parse').mockResolvedValue(addition());
  const next = await new Engine(localClient).nextSection(
    'add 45 ml to 25 cups',
    { type: 'numeric', text: '25 cups' },
  );
  expect(next.section).toBe('add 45 ml to');
  expect(next.operation?.type).toBe('add');
  expect(next.selections?.[0].probability).toBe(0.49);
  expect(next.selections?.[1].label).toBe('Equivalent phrases');
});
