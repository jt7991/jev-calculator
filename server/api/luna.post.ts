import {
  assertBodySize,
  assertMethod,
  readBody,
  requireContentType,
  type H3Event,
} from 'h3';
import { calculateLuna } from '../luna';

export default async function luna(event: H3Event) {
  assertMethod(event, 'POST');
  const headers = { 'Cache-Control': 'no-store' };
  try {
    requireContentType(event, 'application/json');
    assertBodySize(event, 16_384);
    const input = await readBody(event, { type: 'json' });
    const started = performance.now();
    const result = await calculateLuna(input);
    const serverMs = Math.round(performance.now() - started);
    return Response.json(
      { ...result, serverMs },
      {
        headers,
        status: result.status === 'success' ? 200 : 422,
      },
    );
  } catch {
    return Response.json(
      {
        status: 'error',
        message: 'Invalid calculator request.',
        estimatedCostUsd: null,
      },
      { headers, status: 400 },
    );
  }
}
