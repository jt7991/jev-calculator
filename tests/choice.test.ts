import { expect, test } from 'vitest';
import { assessChoice } from '../core/choice.js';

test('accepts a clear lead below the old cutoff', () => {
  expect(assessChoice('a', { a: 0.6, b: 0.1, c: 0.3 }).accepted).toBe(true);
});
test('requires a lead of at least twenty percentage points', () => {
  expect(assessChoice('a', { a: 0.6, b: 0.39, c: 0.01 }).accepted).toBe(true);
  expect(assessChoice('a', { a: 0.55, b: 0.45 }).accepted).toBe(false);
});
test('rejects weak or invalid answers', () => {
  expect(assessChoice('a', { a: 0.4, b: 0.2, c: 0.2, d: 0.2 }).accepted).toBe(
    false,
  );
  expect(assessChoice('missing', { a: 1 }).accepted).toBe(false);
  expect(assessChoice('a', { a: 0.8, b: NaN }).accepted).toBe(false);
  expect(assessChoice('a', { a: 0.2, b: 0.8 }).accepted).toBe(false);
});
