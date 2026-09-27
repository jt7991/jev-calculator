import { TypeSafeClient } from '@typesafe-ai/sdk';
import { writeFile } from 'node:fs/promises';
import { runCalculation } from '../core/service.js';

// Run before and after an optimization with the same prompts and reference time.
const client = new TypeSafeClient();
const systemOne = client.systemOne.bind(client);
let calls: { questions: string[]; start: number; milliseconds: number }[] = [];
let started = 0;
client.systemOne = (request, options) => {
  const start = performance.now();
  const response = systemOne(request, options);
  void response
    .then(() => {
      calls.push({
        questions: Object.keys(request.questions),
        start: Math.round(start - started),
        milliseconds: Math.round(performance.now() - start),
      });
    })
    .catch(() => {});
  return response;
};
const records = [];
for (let run = 1; run <= 3; run++) {
  for (const text of [
    '3 months after next tuesday',
    '1 cup in ml',
    '3 days after 15 years ago',
  ]) {
    calls = [];
    started = performance.now();
    const result = await runCalculation(
      { text, timezone: 'UTC', referenceTime: '2026-09-26T20:15:45.123Z' },
      client,
    );
    const record = {
      run,
      text,
      milliseconds: Math.round(performance.now() - started),
      status: result.status,
      calls,
    };
    records.push(record);
    console.log(JSON.stringify(record));
  }
}
await writeFile(
  `evals/results/latency-${process.argv[2] ?? Date.now()}.json`,
  JSON.stringify(records, null, 2),
);
