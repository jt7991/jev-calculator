import { afterEach, expect, test, vi } from 'vitest';
import { calculateLuna } from '../server/luna';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('one Luna request includes shared context and prices cached input and output', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'private-test-key');
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      status: 'completed',
      model: 'gpt-5.6-luna',
      usage: {
        input_tokens: 1000,
        output_tokens: 100,
        input_tokens_details: { cached_tokens: 500 },
      },
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: '236.5882365 mL' }],
        },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const result = await calculateLuna({
    text: '1 cup in ml',
    timezone: 'UTC',
    referenceTime: '2026-09-27T00:00:00Z',
  });
  expect(result).toEqual({
    status: 'success',
    answer: '236.5882365 mL',
    estimatedCostUsd: 0.00023,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(fetch.mock.calls[0][1].body);
  expect(payload.reasoning).toEqual({ effort: 'none' });
  expect(JSON.parse(payload.input).referenceTime).toBe('2026-09-27T00:00:00Z');
  expect(JSON.stringify(result)).not.toContain('private-test-key');
});

test('provider failures do not expose raw bodies', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'private-test-key');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response('private-test-key', { status: 401 })),
  );
  expect(await calculateLuna({ text: '1 cup in ml' })).toEqual({
    status: 'error',
    message: 'Luna request failed (HTTP 401).',
    estimatedCostUsd: null,
  });
});

test('truncated responses are errors and retain reported cost', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'private-test-key');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        status: 'incomplete',
        model: 'gpt-5.6-luna',
        usage: {
          input_tokens: 100,
          output_tokens: 100,
          input_tokens_details: { cached_tokens: 0 },
        },
      }),
    ),
  );
  const result = await calculateLuna({ text: '1 cup in ml' });
  expect(result.status).toBe('error');
  expect(result.estimatedCostUsd).toBe(0.00014);
});
