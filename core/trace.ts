import Decimal from 'decimal.js';
import type { TypeSafeClient } from '@typesafe-ai/sdk';

export type JevClient = Pick<TypeSafeClient, 'systemOne'>;
type Request = Parameters<TypeSafeClient['systemOne']>[0];
export type JevCall = {
  id: number;
  request: Pick<Request, 'model' | 'state' | 'questions'>;
  answers?: unknown;
  milliseconds?: number;
  inputTokens?: number;
  estimatedCostUsd?: number;
};

// One recorder per calculation. Only model input/output is copied, never SDK
// configuration, request headers, or credentials.
export class JevTrace implements JevClient {
  readonly calls: JevCall[] = [];
  private readonly pending: Promise<unknown>[] = [];

  async usage() {
    // A failed branch can leave parallel requests in flight. Include those too.
    let count = 0;
    do {
      count = this.pending.length;
      await Promise.allSettled(this.pending);
    } while (this.pending.length !== count);
    let cost = new Decimal(0);
    let inputTokens = 0;
    for (const call of this.calls) {
      if (call.estimatedCostUsd === undefined)
        return { inputTokens: null, estimatedCostUsd: null };
      inputTokens += call.inputTokens!;
      cost = cost.plus(call.estimatedCostUsd);
    }
    return { inputTokens, estimatedCostUsd: cost.toNumber() };
  }
  constructor(private readonly client: JevClient) {}

  systemOne: TypeSafeClient['systemOne'] = (request, options) => {
    const call: JevCall = {
      id: this.calls.length + 1,
      request: structuredClone({
        model: request.model,
        state: request.state,
        questions: request.questions,
      }),
    };
    this.calls.push(call);
    const started = performance.now();
    const response = this.client.systemOne(request, options);
    const recorded = response
      .then((result) => {
        call.answers = structuredClone(result.answers);
        call.inputTokens = result.usage?.input_tokens;
        // Published Jev 1.13 price, verified 2026-09-27:
        // https://docs.typesafe.ai/models ($0.042 / million input tokens).
        // Unknown models or missing usage must not appear free.
        if (
          result.model === 'jev-1.13.0' &&
          Number.isSafeInteger(call.inputTokens) &&
          call.inputTokens! >= 0
        )
          call.estimatedCostUsd = new Decimal(call.inputTokens!)
            .times('0.042')
            .div(1_000_000)
            .toNumber();
        call.milliseconds = Math.round(performance.now() - started);
        for (const name of Object.keys(result.answers)) {
          Object.assign(result.answers[name], { callId: call.id });
        }
      })
      .catch(() => {
        call.milliseconds = Math.round(performance.now() - started);
      });
    this.pending.push(recorded);
    return response;
  };
}
