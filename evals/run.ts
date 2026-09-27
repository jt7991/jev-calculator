import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  Engine,
  type StartingInput,
  type NextSection,
} from '../core/engine.js';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { cases } from './steps.js';
import { assessChoice } from '../core/choice.js';

const { values } = parseArgs({
  options: {
    dates: { type: 'boolean' },
    final: { type: 'boolean' },
    steps: { type: 'boolean' },
    filter: { type: 'string' },
    repeat: { type: 'string', default: '1' },
  },
});
if (!process.env.TYPESAFE_API_KEY)
  throw new Error('Set TYPESAFE_API_KEY in .env.');
if (values.final || (!values.steps && !values.dates)) {
  await import('./final.js');
  process.exit(process.exitCode ?? 0);
}
if (values.dates) {
  await import('./dates.js');
  process.exit(process.exitCode ?? 0);
}
const repeat = Number(values.repeat);
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 5)
  throw new Error('--repeat must be from 1 to 5');
const selected = cases.filter(
  (test) => !values.filter || test.id.includes(values.filter),
);
if (!selected.length) throw new Error('No matching eval cases.');
const client = new TypeSafeClient();
const systemOne = client.systemOne.bind(client);
let traces: unknown[] = [];
let expectedChoices: Record<string, string> = {};
let judgments: {
  question: string;
  expected: string;
  selected: string;
  probability: number;
  runnerUp: number;
  margin: number;
  correct: boolean;
  accepted: boolean;
}[] = [];
client.systemOne = (request, options) => {
  const snapshot = structuredClone(request);
  const expected = { ...expectedChoices };
  const response = systemOne(request, options);
  void response
    .then((result) => {
      for (const question of Object.keys(expected)) {
        const answer = result.answers[question];
        if (answer?.type !== 'choice') continue;
        const assessment = assessChoice(answer.choice, answer.probabilities);
        judgments.push({
          question,
          expected: expected[question],
          selected: answer.choice,
          ...assessment,
          correct: answer.choice === expected[question],
        });
      }
      traces.push({
        state: snapshot.state,
        questions: snapshot.questions,
        answers: result.answers,
      });
    })
    .catch(() => {});
  return response;
};
const engine = new Engine(client);
const records = [];

for (let run = 1; run <= repeat; run++) {
  for (const test of selected) {
    const start = performance.now();
    traces = [];
    judgments = [];
    expectedChoices = {
      input: test.inputType,
      text:
        test.inputText === null ||
        ['now', 'today'].includes(test.inputText.toLowerCase())
          ? 'now'
          : test.inputText,
    };
    const failures: string[] = [];
    const sections: string[] = [];
    const steps: NextSection[] = [];
    let input: StartingInput | undefined;
    try {
      input = await engine.input(test.text);
      if (input.type !== test.inputType)
        failures.push(
          `Input type: expected ${test.inputType}, got ${input.type}`,
        );
      if (input.text !== test.inputText)
        failures.push(
          `Input text: expected ${JSON.stringify(test.inputText)}, got ${JSON.stringify(input.text)}`,
        );
    } catch (error) {
      failures.push(
        `Input type: ${error instanceof Error ? error.message : 'Request failed'}`,
      );
    }
    try {
      if (!input) throw new Error('Skipped because input selection failed.');
      // Feed actual answers back into Jev, never the expected sections.
      for (let index = 0; index < 24; index++) {
        expectedChoices = { section: test.sections[index] ?? 'done' };
        const step = await engine.nextSection(test.text, input, sections);
        steps.push(step);
        const expectedSection = test.sections[index] ?? null;
        if (step.section !== expectedSection)
          failures.push(
            `Step ${index + 1}: expected ${JSON.stringify(expectedSection)}, got ${JSON.stringify(step.section)}`,
          );
        if (step.section === null) break;
        sections.push(step.section);
        if (index === 23) failures.push('Exceeded 24 operation steps.');
      }
    } catch (error) {
      failures.push(
        `Sections: ${error instanceof Error ? error.message : 'Request failed'}`,
      );
    }
    if (JSON.stringify(sections) !== JSON.stringify(test.sections))
      failures.push('Complete section sequence does not match.');
    const milliseconds = Math.round(performance.now() - start);
    records.push({
      id: test.id,
      run,
      text: test.text,
      expected: test,
      actual: { input, steps },
      traces,
      judgments,
      failures,
      passed: failures.length === 0,
      milliseconds,
    });
    console.log(
      `${failures.length ? 'FAIL' : 'PASS'} ${test.id} (${milliseconds} ms)`,
    );
    for (const failure of failures) console.log(`  ${failure}`);
  }
}
const summary = {
  total: records.length,
  passed: records.filter((record) => record.passed).length,
  failed: records.filter((record) => !record.passed).length,
  observedChoices: records.flatMap((record) => record.judgments).length,
  correctTopChoices: records
    .flatMap((record) => record.judgments)
    .filter((judgment) => judgment.correct).length,
  wrongButAccepted: records
    .flatMap((record) => record.judgments)
    .filter((judgment) => !judgment.correct && judgment.accepted).length,
  correctButRejected: records
    .flatMap((record) => record.judgments)
    .filter((judgment) => judgment.correct && !judgment.accepted).length,
};
await mkdir('evals/results', { recursive: true });
const path = `evals/results/${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(path, JSON.stringify({ summary, records }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Saved ${path}`);
process.exitCode = summary.failed ? 1 : 0;
