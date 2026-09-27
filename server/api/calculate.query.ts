import {
  assertBodySize,
  assertMethod,
  readBody,
  requireContentType,
  type H3Event,
} from 'h3';
import { runCalculation } from '../../core/service';
export const calculationHeaders = {
  'Cache-Control': 'no-store',
  'Accept-Query': 'application/json',
  Allow: 'QUERY, POST, OPTIONS',
};

const invalidRequest = (message: string, status: number) =>
  Response.json(
    { status: 'error', code: 'invalid_request', message },
    { status, headers: calculationHeaders },
  );
export default async function calculate(event: H3Event) {
  assertMethod(event, ['QUERY', 'POST']);
  let input: unknown;
  try {
    requireContentType(event, 'application/json');
    assertBodySize(event, 16_384);
    input = await readBody(event, { type: 'json' });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    const message =
      status === 413
        ? 'Request is too large.'
        : status === 415
          ? 'Send a JSON request body.'
          : 'Invalid JSON request body.';
    return invalidRequest(message, status);
  }
  const started = performance.now();
  const result = await runCalculation(input);
  const serverMs = Math.round(performance.now() - started);
  const status =
    result.status !== 'error'
      ? 200
      : result.code === 'configuration'
        ? 503
        : result.code === 'invalid_request'
          ? 400
          : 422;
  return Response.json(
    { ...result, serverMs },
    { status, headers: calculationHeaders },
  );
}
