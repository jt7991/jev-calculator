<script lang="ts">
  import type { JevCall } from '../core/trace';
  let {
    call,
    showQuestions = false,
  }: { call: JevCall; showQuestions?: boolean } = $props();
  let state = $derived(call.request.state);
  function answer(name: string) {
    if (!call.answers || typeof call.answers !== 'object') return undefined;
    return (call.answers as Record<string, unknown>)[name];
  }
  function json(value: unknown) {
    return JSON.stringify(value, null, 2);
  }
</script>

<div class="call-data">
  <p class="call-meta">{call.request.model} · {call.milliseconds ?? '—'} ms</p>
  <h4>State sent to Jev</h4>
  {#if state && typeof state === 'object' && !Array.isArray(state)}
    {#each Object.keys(state) as key}
      <details class="state-field">
        <summary>{key}</summary>
        <pre>{json(state[key])}</pre>
      </details>
    {/each}
  {:else}
    <pre>{json(state)}</pre>
  {/if}
  {#if showQuestions}
    <h4>Questions in this request</h4>
    {#each Object.keys(call.request.questions) as name}
      {@const question = call.request.questions[name]}
      <details class="request-question">
        <summary>{name}</summary>
        <div class="question-body">
          <h4>Prompt</h4>
          {#if typeof question.instructions === 'string'}
            <p class="question-prompt">{question.instructions}</p>
          {:else}
            <pre>{json(question.instructions)}</pre>
          {/if}
          <details>
            <summary>Options sent</summary>
            <pre>{json(question.criteria)}</pre>
          </details>
          <details>
            <summary>Answer and confidence scores</summary>
            {#if answer(name) !== undefined}
              <pre>{json(answer(name))}</pre>
            {:else}
              <p>No answer recorded.</p>
            {/if}
          </details>
        </div>
      </details>
    {/each}
  {/if}
  <details class="payload">
    <summary>Full request · all questions and options</summary>
    <pre>{json(call.request)}</pre>
  </details>
  <details class="payload">
    <summary>Full response · answers and scores</summary>
    <pre>{json(call.answers)}</pre>
  </details>
</div>

<style>
  .call-data {
    padding: 8px 0 12px;
    font-size: 14px;
    color: var(--ink);
  }
  .call-meta {
    color: var(--muted);
    font-size: 12px;
    margin: 4px 0 16px;
  }
  h4 {
    font-size: 14px;
    font-weight: 500;
    margin: 12px 0 8px;
  }
  details {
    font-size: 14px;
    color: var(--ink);
    margin-left: 8px;
    border-bottom: 1px solid var(--line);
  }
  summary {
    width: 100%;
    padding: 10px 0;
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  summary:focus-visible {
    outline: 2px solid var(--green);
    outline-offset: 3px;
  }
  pre {
    margin: 4px 0 14px;
    padding: 12px;
    background: var(--hover);
    font: 12px/1.7 monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 360px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
  }
  .payload {
    margin-top: 10px;
  }
  .question-body {
    margin-left: 12px;
    padding-bottom: 12px;
  }
  .question-prompt {
    margin: 8px 0 16px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
</style>
