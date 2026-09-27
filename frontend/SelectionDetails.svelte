<script lang="ts">
  import type { Selection } from '../core/selections';
  import type { JevCall } from '../core/trace';
  import JevCallDetails from './JevCallDetails.svelte';
  let {
    selections,
    calls = [],
  }: { selections: Selection[]; calls?: JevCall[] } = $props();
  function percent(value: number) {
    return value > 0 && value < 0.001
      ? '<0.1%'
      : `${(value * 100).toFixed(1)}%`;
  }
</script>

<div class="selections">
  {#each selections as selection}
    {@const call = calls.find((item) => item.id === selection.callId)}
    {#if selection.options?.length}
      <details class="decision">
        <summary>
          <svg
            class="toggle"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            aria-hidden="true"
            ><path d="M2 6h8" /><path class="vertical" d="M6 2v8" /></svg
          >
          <span class="label">{selection.label}</span>
          <span class="value">{selection.value}</span>
          <span class="score">{percent(selection.probability ?? 0)}</span>
        </summary>
        <div class="decision-body">
          {#if call}
            <details class="sent-call">
              <summary>Sent to Jev · call {call.id}</summary>
              <JevCallDetails {call} />
            </details>
          {/if}
          {#if selection.prompt}<p class="prompt-label">Question sent to Jev</p>
            <blockquote>{selection.prompt}</blockquote>{/if}
          {#if selection.source}<p>Selected text: “{selection.source}”</p>{/if}
          {#if selection.confidence !== undefined}<p>
              Model confidence: {percent(selection.confidence)}
            </p>{/if}
          <p class="legend">
            Options ranked by probability. The chosen option is marked.
          </p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable options need keyboard access.) -->
          <div
            class="options"
            tabindex="0"
            role="region"
            aria-label={`${selection.label} options`}
          >
            {#each selection.options as option}
              <div class="option" class:chosen={option.selected}>
                <div>
                  <span>{option.value}</span>{#if option.selected}<small
                      >Selected</small
                    >{/if}{#if option.description}<p>
                      {option.description}
                    </p>{/if}
                </div>
                <span class="score">{percent(option.probability)}</span>
              </div>
            {/each}
          </div>
        </div>
      </details>
    {:else}
      <div class="rule">
        <span class="label">{selection.label}</span><span
          >{selection.value}</span
        ><small>Rule</small>
      </div>
    {/if}
  {/each}
</div>

<style>
  .selections {
    border-top: 1px solid var(--line);
    margin-top: 12px;
    font-size: 14px;
  }
  .decision,
  .rule {
    border-bottom: 1px solid var(--line);
  }
  .decision {
    font-size: inherit;
    color: var(--ink);
  }
  summary {
    width: 100%;
    display: flex;
    gap: 12px;
    align-items: baseline;
    padding: 12px 0;
    cursor: pointer;
  }
  .toggle {
    flex-shrink: 0;
    color: var(--muted);
    align-self: center;
  }
  details[open] > summary .vertical {
    display: none;
  }
  blockquote {
    margin: 8px 0 18px;
    padding: 12px;
    background: var(--hover);
    color: var(--ink);
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .prompt-label {
    margin-top: 12px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .label {
    color: var(--muted);
    text-transform: capitalize;
  }
  .value {
    margin-left: auto;
    overflow-wrap: anywhere;
  }
  .score {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: var(--green);
    font-size: 12px;
  }
  .decision-body {
    padding: 0 0 16px 20px;
  }
  .sent-call {
    margin: 10px 0 18px;
    font-size: 14px;
  }
  .sent-call > summary {
    color: var(--green);
  }
  p {
    margin: 6px 0;
    font-size: 12px;
    color: var(--muted);
  }
  .legend {
    margin: 12px 0;
  }
  .options {
    display: block;
    padding: 0;
    margin: 12px 0 0;
    max-height: 280px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
  }
  .option {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding: 10px 12px;
    overflow-wrap: anywhere;
  }
  .option > div {
    min-width: 0;
  }
  .chosen {
    background: var(--hover);
  }
  small {
    font-size: 11px;
    color: var(--muted);
    margin-left: 10px;
  }
  .rule {
    display: flex;
    gap: 12px;
    padding: 12px 0;
  }
  .rule > span:nth-child(2) {
    margin-left: auto;
    max-width: 65%;
  }
  summary:focus-visible,
  .options:focus-visible {
    outline: 2px solid var(--green);
    outline-offset: 3px;
  }
</style>
