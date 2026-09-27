import { TypeSafeClient } from '@typesafe-ai/sdk';
import { Calculator } from './calculator.js';
import { requestSchema, type CalculationResult } from './types.js';

export async function runCalculation(
  input: unknown,
  client?: TypeSafeClient,
): Promise<CalculationResult> {
  const request = requestSchema.safeParse(input);
  if (!request.success)
    return {
      status: 'error',
      code: 'invalid_request',
      message: request.error.issues[0].message,
    };
  if (!client && !process.env.TYPESAFE_API_KEY)
    return {
      status: 'error',
      code: 'configuration',
      message: 'Set TYPESAFE_API_KEY in .env and restart the server.',
    };
  const calculator = new Calculator(client);
  try {
    const result = await calculator.calculate(request.data);
    return { ...result, usage: await calculator.usage() };
  } catch (error) {
    const usage = await calculator.usage();
    // SDK errors can contain request details. Never expose their raw bodies.
    if (
      error instanceof Error &&
      ('status' in error ||
        error.name.includes('API') ||
        error.name === 'TypeSafeError')
    )
      return {
        status: 'error',
        usage,
        code: 'service',
        message: 'Jev could not complete the request. Please try again.',
      };
    const message =
      error instanceof Error ? error.message : 'Calculation failed.';
    return {
      status: 'error',
      usage,
      code:
        message.includes('unclear') || message.includes('ambiguous')
          ? 'ambiguous'
          : 'calculation',
      message,
    };
  }
}
