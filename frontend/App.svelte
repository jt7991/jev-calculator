<script lang="ts">
  import { onMount } from 'svelte';
  import LunaComparison from './LunaComparison.svelte';
  import CalculationWork from './CalculationWork.svelte';
  import type { CalculationResult as CoreResult } from '../core/types';
  type CalculationResult = CoreResult & { serverMs?: number };
  type Recent = { text: string; value: string; unit: string };
  let input = $state('');
  let original = $state('');
  let comparisonRequest = $state('');
  let compareLuna = $state(false);
  let result = $state<CalculationResult | null>(null);
  let busy = $state(false);
  let responseMs = $state<number | null>(null);
  let timezone = $state(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  let zoneDraft = $state(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  let zoneError = $state('');
  let showTimezone = $state(false);
  let showHistory = $state(false);
  let recent = $state<Recent[]>([]);
  let textarea: HTMLTextAreaElement;
  let copied = $state(false);
  let notice = $state('');
  const examples = [
    '6 feet in inches',
    '2 hours in seconds',
    'Add 3 days to today',
  ];

  onMount(() => {
    compareLuna =
      new URLSearchParams(window.location.search).get('compare') === 'luna';
    try {
      const stored = JSON.parse(localStorage.getItem('jev-recent') || '[]');
      if (Array.isArray(stored))
        recent = stored
          .filter(
            (r) =>
              r &&
              typeof r.text === 'string' &&
              typeof r.value === 'string' &&
              typeof r.unit === 'string',
          )
          .slice(0, 8);
    } catch {
      /* Storage is optional. */
    }
  });
  function shortcut(event: KeyboardEvent) {
    if (
      event.key === '/' &&
      !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)
    ) {
      event.preventDefault();
      textarea?.focus();
    }
    if (event.key === 'Escape' && !busy) {
      showTimezone = false;
      showHistory = false;
    }
  }
  async function send(text: string) {
    if (busy || !text.trim()) return;
    responseMs = null;
    result = null;
    original = text.trim();
    busy = true;
    notice = '';
    copied = false;
    try {
      const body = JSON.stringify({
        text: original,
        timezone,
        referenceTime: new Date().toISOString(),
      });
      comparisonRequest = compareLuna ? body : '';
      let response = await fetch('/api/calculate', {
        method: 'QUERY',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(40000),
      });
      if ([405, 501].includes(response.status))
        response = await fetch('/api/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(40000),
        });
      const data = (await response.json()) as CalculationResult;
      if (!data || !['success', 'error'].includes(data.status))
        throw new Error('Unexpected response');
      result = data;
      responseMs =
        typeof data.serverMs === 'number' &&
        Number.isFinite(data.serverMs) &&
        data.serverMs >= 0
          ? data.serverMs
          : null;
      if (data.status === 'success') {
        recent = [
          {
            text: original,
            value: `${data.approximate ? '≈ ' : ''}${data.value}`,
            unit: data.unit,
          },
          ...recent.filter((r) => r.text !== original),
        ].slice(0, 8);
        try {
          localStorage.setItem('jev-recent', JSON.stringify(recent));
        } catch {
          /* Optional. */
        }
      }
    } catch (error) {
      result = {
        status: 'error',
        code: 'service',
        message:
          error instanceof Error && error.name === 'TimeoutError'
            ? 'This is taking longer than expected. Please try again.'
            : 'Could not reach the calculator. Check your connection and try again.',
      };
    } finally {
      busy = false;
    }
  }
  function fresh(text = '') {
    if (busy) return;
    result = null;
    comparisonRequest = '';
    responseMs = null;
    original = '';
    input = text;
    textarea?.focus();
  }
  async function copy() {
    if (result?.status !== 'success') return;
    try {
      await navigator.clipboard.writeText(
        `${result.approximate ? '≈ ' : ''}${result.value} ${result.unit}`,
      );
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      notice =
        'Copy is unavailable. You can select and copy the answer directly.';
    }
  }
  function saveZone() {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zoneDraft.trim() });
      timezone = zoneDraft.trim();
      zoneError = '';
      showTimezone = false;
    } catch {
      zoneError = 'Use a timezone such as America/New_York or UTC.';
    }
  }
</script>

<svelte:window onkeydown={shortcut} />

<div class="page-shell">
  <header>
    <div class="header-actions">
      <button
        class="icon-button history-toggle"
        aria-label="Recent calculations"
        aria-expanded={showHistory}
        onclick={() => (showHistory = !showHistory)}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          ><path d="M3 11a9 9 0 1 1 2.7 7M3 5v6h6M12 7v5l3 2" /></svg
        >
      </button>
    </div>
  </header>

  {#if showHistory}
    <aside class="history-panel" aria-label="Recent calculations">
      <div class="history-heading">
        <h2>Recent calculations</h2>
        <button
          class="text-button"
          onclick={() => {
            recent = [];
            try {
              localStorage.removeItem('jev-recent');
            } catch {}
          }}
          disabled={!recent.length}>Clear</button
        >
      </div>
      {#if recent.length}
        {#each recent as item}<button
            class="history-item"
            onclick={() => {
              fresh(item.text);
              showHistory = false;
            }}
            disabled={busy}
            ><span>{item.text}</span><strong
              >{item.value} <small>{item.unit}</small></strong
            ></button
          >{/each}
      {:else}<p>
          Your calculations will appear here.<br />Saved only in this browser.
        </p>{/if}
    </aside>
  {/if}

  <main class:has-result={result !== null}>
    <section class="calculator" aria-label="Natural-language calculator">
      <form
        class="input-surface"
        class:working={busy}
        onsubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <label class="sr-only" for="calculation"
          >What would you like to calculate?</label
        >
        <textarea
          id="calculation"
          bind:this={textarea!}
          bind:value={input}
          rows="2"
          maxlength="2000"
          disabled={busy}
          placeholder="What would you like to calculate?"
          onkeydown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}></textarea>
        <div class="input-bottom">
          <span class="input-hint">{busy ? 'Calculating…' : ''}</span>
          <button
            class="send-button"
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={busy ? 'Calculating' : 'Calculate'}
          >
            {#if busy}<span class="spinner"></span>{:else}<svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg
              >{/if}
          </button>
        </div>
      </form>

      <div class:comparison-grid={!!comparisonRequest}>
        <div aria-live="polite" aria-busy={busy}>
          {#if comparisonRequest}<h2 class="model-name">Jev</h2>{/if}
          {#if busy}<p class="model-pending">Calculating…</p>{/if}
          {#if result?.status === 'success'}
            <section
              class="answer result-enter"
              aria-label="Calculation result"
            >
              <div class="answer-top">
                <span>{original}</span><button
                  class="icon-button"
                  onclick={copy}
                  aria-label={copied ? 'Copied' : 'Copy answer'}
                  title={copied ? 'Copied' : 'Copy answer'}
                  >{#if copied}<svg
                      viewBox="0 0 24 24"
                      width="19"
                      height="19"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.7"><path d="m5 12 4 4L19 6" /></svg
                    >{:else}<svg
                      viewBox="0 0 24 24"
                      width="19"
                      height="19"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.7"
                      aria-hidden="true"
                      ><rect x="8" y="8" width="12" height="13" rx="2" /><path
                        d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
                      /></svg
                    >{/if}</button
                >
              </div>
              <div class="answer-value">
                {result.approximate ? '≈ ' : ''}{result.value}<span
                  >{result.unit}</span
                >
              </div>
              {#if result.note}<p class="notice">{result.note}</p>{/if}
              {#if notice}<p class="notice">{notice}</p>{/if}
            </section>
          {:else if result?.status === 'error'}
            <section class="error-state result-enter" role="alert">
              <h2>
                {result.code === 'configuration'
                  ? 'API key required'
                  : 'Unable to calculate'}
              </h2>
              <p>{result.message}</p>
              <button
                class="text-button"
                disabled={busy}
                onclick={() => fresh(original)}>Edit calculation</button
              >
            </section>
          {:else if !busy}
            <div class="examples">
              {#each examples as example}<button
                  onclick={() => {
                    input = example;
                    send(example);
                  }}
                  >{example}<svg
                    viewBox="0 0 16 16"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.3"
                    aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" /></svg
                  ></button
                >{/each}
            </div>
          {/if}
          {#if result && !busy}
            <p
              class="response-time"
              aria-label="Response time and estimated cost"
              title="Server processing time, including provider calls; excludes browser-to-server transfer and rendering"
            >
              {responseMs === null
                ? 'Time unavailable'
                : responseMs < 1000
                  ? `${responseMs} ms`
                  : `${(responseMs / 1000).toFixed(2)} s`}
              <span aria-hidden="true"> · </span>
              <span
                class="query-cost"
                title="Estimated Jev cost in USD from reported input tokens and published pricing; excludes any unreported retry usage"
              >
                {#if result.usage?.estimatedCostUsd != null}
                  ~${result.usage.estimatedCostUsd.toFixed(6)} USD
                {:else}
                  Cost unavailable
                {/if}
              </span>
            </p>
          {/if}
        </div>
        {#if comparisonRequest}<LunaComparison
            request={comparisonRequest}
          />{/if}
      </div>
      {#if result?.status === 'success' && result.work}
        {#key result}<CalculationWork work={result.work} />{/key}
      {:else if result?.status === 'success'}
        <details>
          <summary>How this was calculated</summary>
          <p>{result.interpretation}</p>
          {#each result.details as detail}<p>{detail}</p>{/each}
        </details>
      {/if}
    </section>
  </main>

  <footer>
    <div class="timezone-control">
      <button
        class="timezone-button"
        onclick={() => {
          showTimezone = !showTimezone;
          zoneDraft = timezone;
        }}
        disabled={busy}
        aria-expanded={showTimezone}
      >
        <svg
          viewBox="0 0 20 20"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          aria-hidden="true"
          ><circle cx="10" cy="10" r="7" /><path
            d="M3 10h14M10 3c4 4 4 10 0 14-4-4-4-10 0-14Z"
          /></svg
        >{timezone.replaceAll('_', ' ')}
      </button>
      {#if showTimezone}<form
          class="timezone-editor"
          onsubmit={(event) => {
            event.preventDefault();
            saveZone();
          }}
        >
          <label for="timezone">Default timezone</label><input
            id="timezone"
            bind:value={zoneDraft}
            placeholder="America/New_York"
          />
          <p>Explicit timezones in your question take priority.</p>
          {#if zoneError}<p role="alert">{zoneError}</p>{/if}<button
            type="submit">Use timezone</button
          >
        </form>{/if}
    </div>
  </footer>
</div>
