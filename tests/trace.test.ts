import { expect, test, vi } from 'vitest';
import { JevTrace, type JevClient } from '../core/trace.js';

test('captures model payload without credentials and links answers to their call', async () => {
  const answer = { type: 'choice', choice: 'done', confidence: 1, probabilities: { done: 1 } };
  const client = { systemOne: vi.fn().mockResolvedValue({ answers: { section: answer } }), apiKey: 'private-test-key' };
  const trace = new JevTrace(client as unknown as JevClient);
  const state = { input: 'now', completedSections: ['3 years'], remainingText: 'and 3 days from' };
  await trace.systemOne({ model: 'jev-1.13.0', state, questions: { section: { type: 'choice', instructions: 'Next operation?', criteria: { done: 'No operations' } } } }, { headers: { Authorization: 'private-test-key' } });
  state.completedSections.push('3 days from');
  expect(trace.calls[0].request.state).toEqual({ input: 'now', completedSections: ['3 years'], remainingText: 'and 3 days from' });
  expect(answer).toHaveProperty('callId', 1);
  expect(JSON.stringify(trace.calls)).not.toContain('private-test-key');
  expect(trace.calls[0].answers).toEqual({ section: { type: 'choice', choice: 'done', confidence: 1, probabilities: { done: 1 } } });
  expect(client.systemOne).toHaveBeenCalledTimes(1);
});

test('totals reported usage across calls and waits for pending calls', async () => {
  const client = { systemOne: vi.fn()
    .mockResolvedValueOnce({ model: 'jev-1.13.0', usage: { input_tokens: 1000 }, answers: {} })
    .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ model: 'jev-1.13.0', usage: { input_tokens: 2000 }, answers: {} }), 10))) };
  const trace = new JevTrace(client as unknown as JevClient);
  trace.systemOne({ state: '', questions: {} });
  trace.systemOne({ state: '', questions: {} });
  expect(await trace.usage()).toEqual({ inputTokens: 3000, estimatedCostUsd: 0.000126 });
});

test('does not report missing usage or unknown model pricing as zero cost', async () => {
  for (const response of [{ answers: {} }, { model: 'future-model', usage: { input_tokens: 1000 }, answers: {} }]) {
    const trace = new JevTrace({ systemOne: vi.fn().mockResolvedValue(response) } as unknown as JevClient);
    await trace.systemOne({ state: '', questions: {} });
    expect((await trace.usage()).estimatedCostUsd).toBeNull();
  }
});
