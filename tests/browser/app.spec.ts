import { test, expect } from '@playwright/test';

// Layout/interaction tests should not make extra paid Luna calls.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/luna', (route) =>
    route.fulfill({
      json: {
        status: 'success',
        answer: 'Example response',
        estimatedCostUsd: 0.0001,
      },
    }),
  );
});

test('desktop and mobile layouts, keyboard, history, and timezone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await expect(page.getByText('Powered by Jev')).toHaveCount(0);
  await page.keyboard.press('/');
  await expect(
    page.getByRole('textbox', { name: 'What would you like to calculate?' }),
  ).toBeFocused();
  await page.screenshot({
    path: '.impeccable/review/desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Recent calculations' }).click();
  await expect(
    page.getByText('Your calculations will appear here.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: /America|UTC|Europe|Asia/ })
    .last()
    .click();
  await page.getByLabel('Default timezone').fill('UTC');
  await page.getByRole('button', { name: 'Use timezone' }).click();
  await expect(
    page.getByRole('button', { name: 'UTC', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.impeccable/review/mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('shows a single-shot error and submits edited input as a fresh calculation', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/calculate', async (route) => {
    const request = route.request().postDataJSON();
    expect(route.request().method()).toBe('QUERY');
    calls++;
    if (calls === 1)
      await route.fulfill({
        json: {
          status: 'error',
          code: 'ambiguous',
          message:
            'The source unit is missing or ambiguous. Specify it explicitly, including US or imperial for volume units.',
        },
      });
    else {
      expect(request.selections).toBeUndefined();
      expect(request.replies).toBeUndefined();
      expect(request.text).toBe('2 imperial gallons in liters');
      await route.fulfill({
        json: {
          status: 'success',
          value: '9.09218',
          unit: 'L',
          interpretation: '2 imp gal â†’ L',
          details: ['Imperial gallons to liters'],
          timezone: 'UTC',
          referenceTime: request.referenceTime,
        },
      });
    }
  });
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'What would you like to calculate?' })
    .fill('2 gallons in liters');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    'source unit is missing or ambiguous',
  );
  await expect(page.getByRole('textbox')).toHaveValue('2 gallons in liters');
  await expect(
    page.getByRole('button', { name: 'Imperial gallons', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Clarification needed')).toHaveCount(0);
  await page.getByRole('textbox').fill('2 imperial gallons in liters');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Calculation result')).toContainText('9.09218');
  await expect(page.getByRole('textbox')).toHaveValue(
    '2 imperial gallons in liters',
  );
  await page.getByText('How this was calculated').click();
  await expect(page.getByText('2 imp gal â†’ L')).toBeVisible();
  await page.screenshot({
    path: '.impeccable/review/result.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Recent calculations' }).click();
  await expect(page.getByRole('complementary')).toContainText('9.09218');
});

test('falls back to POST on method rejection and shows errors', async ({
  page,
}) => {
  await page.route('**/api/calculate', async (route) => {
    if (route.request().method() === 'QUERY')
      await route.fulfill({ status: 405, json: {} });
    else
      await route.fulfill({
        status: 503,
        json: {
          status: 'error',
          code: 'configuration',
          message:
            'Add TYPESAFE_API_KEY to .env and restart the server to connect Jev.',
        },
      });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '6 feet in inches' }).click();
  await expect(page.getByRole('alert')).toContainText('TYPESAFE_API_KEY');
  await page.getByRole('button', { name: 'Edit calculation' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('6 feet in inches');
});

test('real Nitro endpoint handles QUERY, POST, and malformed requests', async ({
  request,
}) => {
  for (const method of ['QUERY', 'POST']) {
    const response = await request.fetch('/api/calculate', {
      method,
      data: { text: '6 feet in inches' },
    });
    const body = await response.json();
    // Without a key this must be an honest configuration error, never a fabricated answer.
    expect(['success', 'error']).toContain(body.status);
    if (body.status === 'error')
      expect(['configuration', 'calculation', 'service']).toContain(body.code);
  }
  expect((await request.get('/api/calculate')).status()).toBe(405);
  expect(
    (
      await request.post('/api/calculate', {
        headers: { 'Content-Type': 'application/json' },
        data: Buffer.from('{bad'),
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/calculate', {
        headers: { 'Content-Type': 'text/plain' },
        data: 'hello',
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post('/api/calculate', {
        data: { text: 'x'.repeat(17000) },
      })
    ).status(),
  ).toBe(413);
});

test('real calculation renders the answer, response time, and cost', async ({
  page,
}) => {
  await page.unroute('**/api/luna');
  await page.goto('/?compare=luna');
  await page
    .getByRole('textbox', { name: 'What would you like to calculate?' })
    .fill('1 cup in ml');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Calculation result')).toContainText(
    '236.5882365',
    { timeout: 40000 },
  );
  await expect(
    page.getByLabel('Response time and estimated cost', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.query-cost')).toContainText(/~\$0\.\d{6} USD/);
  const luna = page.getByRole('region', { name: 'Luna result', exact: true });
  await expect(luna.locator('.response-time')).toContainText(
    /~\$0\.\d{6} USD/,
    { timeout: 40000 },
  );
  await expect(luna.locator('.luna-text')).not.toBeEmpty();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: '.impeccable/review/comparison-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.impeccable/review/comparison-mobile.png',
    fullPage: true,
  });
});

test('drills from calculation steps into actual selections and option probabilities', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'What would you like to calculate?' })
    .fill('3 months after next tuesday');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Calculation result')).toBeVisible({
    timeout: 40000,
  });
  await page.getByText('How this was calculated', { exact: true }).click();
  const steps = page.getByRole('region', {
    name: 'Calculation steps',
    exact: true,
  });
  const phrase = steps
    .locator('.phrase-summary')
    .filter({ hasText: '3 months after' });
  await expect(phrase).toBeVisible();
  await expect(steps.locator('.selections').last()).not.toBeVisible();
  await phrase.click();
  await expect(steps).toContainText('Source unit');
  await expect(steps).toContainText('Months');
  await steps
    .locator('summary')
    .filter({ hasText: /^\s*Number/ })
    .click();
  await expect(steps).toContainText(
    'Which exact phrase is ONLY the starting numeric amount in input?',
  );
  await expect(
    page.getByRole('region', { name: 'Number options', exact: true }),
  ).toContainText('Selected');
  await expect(
    page.getByRole('region', { name: 'Number options', exact: true }),
  ).toContainText('%');
  await steps
    .locator('summary')
    .filter({ hasText: /^\s*Number/ })
    .click();
  await steps
    .locator('summary')
    .filter({ hasText: /^\s*Operation phrase/i })
    .click();
  const decision = steps.locator('.decision').filter({
    has: page.locator('.label').filter({ hasText: /^Operation phrase$/i }),
  });
  const state = decision.locator('.sent-call');
  await state.locator(':scope > summary').click();
  await state
    .locator('summary')
    .filter({ hasText: /^input$/ })
    .click();
  await state
    .locator('summary')
    .filter({ hasText: /^completedSections$/ })
    .click();
  await state
    .locator('summary')
    .filter({ hasText: /^remainingText$/ })
    .click();
  await expect(state).toContainText('next tuesday');
  await expect(state).toContainText('3 months after');
  await expect(steps.locator('.all-calls')).toContainText('All Jev calls');
  await phrase.click();
  const allCalls = steps.locator('.all-calls');
  await allCalls.locator(':scope > summary').click();
  const groupedRequest = allCalls
    .locator('.call')
    .filter({
      has: page.locator('.request-meta').filter({ hasText: '2 questions' }),
    })
    .first();
  await groupedRequest.locator(':scope > summary').click();
  await expect(groupedRequest.locator('.request-question')).toHaveCount(2);
  const question = groupedRequest.locator('.request-question').first();
  await question.locator(':scope > summary').click();
  await expect(question.locator('.question-prompt')).toBeVisible();
  await question.getByText('Options sent', { exact: true }).click();
  await question
    .getByText('Answer and confidence scores', { exact: true })
    .click();
  await expect(question).toContainText('probabilities');
  await page.screenshot({
    path: '.impeccable/review/work-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.impeccable/review/work-mobile.png',
    fullPage: true,
  });
});

test('displays server timings instead of delayed browser round trips', async ({
  page,
}) => {
  await page.route('**/api/calculate', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      json: {
        status: 'error',
        code: 'ambiguous',
        message: 'Test error',
        serverMs: 12,
      },
    });
  });
  await page.route('**/api/luna', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      json: {
        status: 'success',
        answer: 'Test answer',
        estimatedCostUsd: 0.0001,
        serverMs: 34,
      },
    });
  });
  await page.goto('/?compare=luna');
  await page.getByRole('textbox').fill('1 cup in ml');
  await page.keyboard.press('Enter');
  await expect(
    page.getByLabel('Response time and estimated cost', { exact: true }),
  ).toContainText('12 ms');
  await expect(
    page.getByLabel('Luna response time and estimated cost', { exact: true }),
  ).toContainText('34 ms');
});

test('Luna is opt-in and sends no requests on the normal page', async ({
  page,
}) => {
  let lunaCalls = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/luna') lunaCalls++;
  });
  await page.route('**/api/calculate', (route) =>
    route.fulfill({
      json: {
        status: 'success',
        value: '3600',
        unit: 'seconds',
        interpretation: '1 hour in seconds',
        details: [],
        timezone: 'UTC',
        referenceTime: '2026-09-28T12:00:00Z',
        serverMs: 100,
      },
    }),
  );
  for (const url of ['/', '/?compare=false']) {
    await page.goto(url);
    await page.getByRole('textbox').fill('1 hour in seconds');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Calculation result')).toContainText('3600');
    await expect(page.getByLabel('Luna result', { exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('.comparison-grid')).toHaveCount(0);
    expect(lunaCalls).toBe(0);
  }
});
