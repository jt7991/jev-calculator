#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { stdout, stderr } from 'node:process';
import { runCalculation } from '../core/service';
import type { CalculationResult } from '../core/types';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      timezone: { type: 'string' },
      url: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    stdout.write(
      'Jev calculator\n\nUsage: npm run cli -- "6 feet in inches" [--json] [--timezone UTC]\n       npm run cli -- "add 3 days to today" --url http://localhost:5173\n\nWithout --url, calls the shared engine locally with TYPESAFE_API_KEY.\nOne calculation per invocation. Success exits 0; errors exit 1.\n',
    );
    return;
  }
  const text = positionals.join(' ');
  if (!text)
    throw new Error(
      'Pass a calculation as an argument. Use --help for examples.',
    );
  const request = {
    text,
    timezone:
      values.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    referenceTime: new Date().toISOString(),
  };
  let result: CalculationResult;
  if (values.url) {
    const endpoint = new URL('/api/calculate', values.url);
    const options = {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(40000),
    };
    let response = await fetch(endpoint, { ...options, method: 'QUERY' });
    if ([405, 501].includes(response.status))
      response = await fetch(endpoint, { ...options, method: 'POST' });
    result = (await response.json()) as CalculationResult;
  } else result = await runCalculation(request);
  if (values.json) {
    stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.status === 'error' ? 1 : 0;
    return;
  }
  if (result.status === 'error') throw new Error(result.message);
  if (result.status === 'success') {
    stdout.write(
      `${result.approximate ? '≈ ' : ''}${result.value} ${result.unit}\n${result.interpretation}\n${result.note ? result.note + '\n' : ''}`,
    );
    return;
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : 'Calculation failed.';
  if (process.argv.includes('--json'))
    stdout.write(
      JSON.stringify({ status: 'error', code: 'service', message }) + '\n',
    );
  else stderr.write(message + '\n');
  process.exitCode = 1;
});
