import type { CalculationWork } from './work.js';
import { z } from 'zod';

export const requestSchema = z.strictObject({
  text: z.string().trim().min(1, 'Enter a calculation.').max(2000),
  timezone: z
    .string()
    .max(100)
    .default(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Use an IANA timezone such as America/New_York.'),
  referenceTime: z.string().datetime({ offset: true }).optional(),
});
export type CalculationRequest = z.infer<typeof requestSchema>;
export type CalculationResult = {
  usage?: { inputTokens: number | null; estimatedCostUsd: number | null };
} & (
  | {
      status: 'success';
      work?: CalculationWork;
      value: string;
      unit: string;
      interpretation: string;
      details: string[];
      timezone: string;
      referenceTime: string;
      approximate?: boolean;
      note?: string;
    }
  | {
      status: 'error';
      code:
        | 'invalid_request'
        | 'ambiguous'
        | 'unsupported'
        | 'configuration'
        | 'service'
        | 'calculation';
      message: string;
    }
);
