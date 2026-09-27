<script lang="ts">
  import type { CalculationWork } from '../core/work';
  import SelectionDetails from './SelectionDetails.svelte';
  import JevCallDetails from './JevCallDetails.svelte';
  let { work }: { work: CalculationWork } = $props();
</script>

<details class="calculation-work">
  <summary class="work-summary">
    <span>How this was calculated</span>
    <span class="step-count"
      >{work.steps.length} {work.steps.length === 1 ? 'step' : 'steps'}</span
    >
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg
    >
  </summary>
  <section class="work-content" aria-label="Calculation steps">
    <ol>
      {#each work.steps as step, index (step.id)}
        <li>
          <details class="phrase-step">
            <summary class="phrase-summary">
              <span class="step-number">{index + 1}</span>
              <span class="phrase-text">{step.source || step.label}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg
              >
            </summary>
            <div class="step-body">
              {#if step.selections?.length}
                <SelectionDetails
                  selections={step.selections}
                  calls={work.calls}
                />
              {/if}
              <details class="calculation">
                <summary
                  >Calculation <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg
                  ></summary
                >
                <h3>{step.label}</h3>
                {#if step.calculation}<p class="equation">
                    {step.calculation}
                  </p>{/if}
                <p class="result" class:final={index === work.steps.length - 1}>
                  {step.result.value}<small>{step.result.unit}</small>
                </p>
                {#if step.note}<p class="note">{step.note}</p>{/if}
              </details>
            </div>
          </details>
        </li>
      {/each}
    </ol>
    {#if work.calls?.length}
      <details class="all-calls">
        <summary
          >All Jev calls <span>{work.calls.length} requests</span></summary
        >
        <p>In start order; independent calls can run concurrently.</p>
        {#each work.calls as call (call.id)}
          <details class="call">
            <summary
              >Call {call.id} · {Object.keys(call.request.questions).join(
                ', ',
              )}</summary
            >
            <JevCallDetails {call} />
          </details>
        {/each}
      </details>
    {/if}
    <div class="context">
      <span>Reference time</span><span
        >{work.referenceTime}<small>{work.timezone}</small></span
      >
    </div>
  </section>
</details>

<style>
  .calculation-work {
    margin-top: 8px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink);
  }
  summary {
    width: 100%;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:focus-visible {
    outline: 2px solid var(--green);
    outline-offset: 4px;
  }
  .work-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 0;
    color: var(--muted);
  }
  .work-summary:hover {
    color: var(--ink);
  }
  .step-count {
    margin-left: auto;
    font-size: 12px;
  }
  .work-summary svg {
    transition: transform 180ms ease-out;
  }
  .calculation-work[open] > summary svg {
    transform: rotate(180deg);
  }
  .work-content {
    border-top: 1px solid var(--line);
    padding-top: 12px;
  }
  ol {
    padding: 0;
    margin: 0;
    list-style: none;
  }
  li {
    border-bottom: 1px solid var(--line);
  }
  .phrase-step {
    color: var(--ink);
    font-size: 14px;
  }
  .phrase-summary {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px 0;
  }
  .phrase-text {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 16px;
  }
  .phrase-summary svg,
  .calculation summary svg {
    flex-shrink: 0;
    color: var(--muted);
  }
  .phrase-step[open] > summary svg,
  .calculation[open] > summary svg {
    transform: rotate(180deg);
  }
  .step-number {
    flex: 0 0 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--green);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .step-body {
    min-width: 0;
    margin: 0 0 22px 13px;
    padding-left: 24px;
    border-left: 1px solid var(--line);
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 2px 0 6px;
  }
  .equation {
    color: var(--muted);
    font-size: 14px;
    margin: 12px 0;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .result {
    margin: 8px 0;
    font-size: 20px;
    font-weight: 500;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .result small,
  .context small {
    display: block;
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
  }
  .final {
    color: var(--green);
  }
  .note {
    margin: 10px 0;
    color: var(--muted);
    font-size: 12px;
  }
  .calculation {
    margin-top: 14px;
  }
  .calculation > summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    color: var(--green);
    font-size: 14px;
    padding: 10px 0;
  }
  .context {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 0;
    font-size: 12px;
    color: var(--muted);
  }
  .all-calls {
    font-size: 14px;
    color: var(--ink);
    border-bottom: 1px solid var(--line);
    padding: 18px 0;
  }
  .all-calls > summary {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--green);
  }
  .all-calls > p {
    color: var(--muted);
    font-size: 12px;
  }
  .all-calls > summary span {
    font-size: 12px;
    color: var(--muted);
  }
  .call {
    margin-left: 14px;
    font-size: 14px;
    color: var(--ink);
    border-bottom: 1px solid var(--line);
  }
  .call > summary {
    padding: 14px 0;
    overflow-wrap: anywhere;
  }
  .context > span:last-child {
    text-align: right;
  }
  @media (max-width: 650px) {
    .step-body {
      padding-left: 14px;
      margin-left: 0;
    }
    .result {
      font-size: 18px;
    }
    .context {
      flex-direction: column;
      gap: 5px;
    }
    .context > span:last-child {
      text-align: left;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .work-summary svg {
      transition: none;
    }
  }
</style>
