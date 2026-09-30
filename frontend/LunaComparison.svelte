<script lang="ts">
  import type { LunaResult } from '../server/luna';
  let { request }: { request: string } = $props();
  let result = $state<LunaResult | null>(null);
  let milliseconds = $state<number | null>(null);
  $effect(() => {
    const controller = new AbortController();
    result = null;
    milliseconds = null;
    void calculate(request, controller.signal);
    return () => controller.abort();
  });
  async function calculate(body: string, signal: AbortSignal) {
    try {
      const response = await fetch('/api/luna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.any([signal, AbortSignal.timeout(40000)]),
      });
      const data = await response.json();
      if (!['success', 'error'].includes(data?.status))
        throw new Error('Invalid response');
      if (!signal.aborted) {
        result = data;
        milliseconds =
          typeof data.serverMs === 'number' &&
          Number.isFinite(data.serverMs) &&
          data.serverMs >= 0
            ? data.serverMs
            : null;
      }
    } catch {
      if (!signal.aborted)
        result = {
          status: 'error',
          message: 'Could not reach Luna. Try again.',
          estimatedCostUsd: null,
        };
    }
  }
</script>

<section
  class="luna-answer"
  aria-label="Luna result"
  aria-live="polite"
  aria-busy={!result}
>
  <h2>GPT-5.6 Luna</h2>
  <p class="model-detail">One call · Reasoning off</p>
  {#if !result}
    <p class="pending">Calculating…</p>
  {:else}
    <p class="luna-text" class:error={result.status === 'error'}>
      {result.status === 'success' ? result.answer : result.message}
    </p>
    <p
      class="response-time"
      aria-label="Luna response time"
      title="Server processing time, including provider calls; excludes browser-to-server transfer and rendering"
    >
      {milliseconds === null
        ? 'Time unavailable'
        : milliseconds < 1000
          ? `${milliseconds} ms`
          : `${(milliseconds / 1000).toFixed(2)} s`}
    </p>
  {/if}
</section>

<style>
  .luna-answer {
    min-width: 0;
    padding-top: 30px;
  }
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px;
  }
  .model-detail,
  .pending {
    color: var(--muted);
    font-size: 12px;
  }
  .model-detail {
    margin: 0 0 24px;
  }
  .luna-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 23px;
    line-height: 1.5;
    color: var(--green);
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .luna-text.error {
    font-size: 15px;
    color: var(--ink);
  }
</style>
