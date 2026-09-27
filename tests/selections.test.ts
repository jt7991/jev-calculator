import { expect, test } from 'vitest';
import { choiceSelection } from '../core/selections.js';

test('keeps option probabilities distinct from model confidence', () => {
  const selection = choiceSelection('Number', {
    type: 'choice', choice: '3', confidence: 0.72,
    probabilities: { '3 months': 0.1, '3': 0.9 },
  }, { '3': '3', '3 months': '3 months' });
  expect(selection.probability).toBe(0.9);
  expect(selection.confidence).toBe(0.72);
  expect(selection.options).toEqual([
    { value: '3', probability: 0.9, selected: true },
    { value: '3 months', probability: 0.1, selected: false },
  ]);
});
