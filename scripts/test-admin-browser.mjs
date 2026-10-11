// Run against the isolated database produced by seed-admin-audit.mts only.
// Requires PLAYWRIGHT_MODULE pointing to an installed Playwright index.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = 'http://localhost:3019';
const fixture = JSON.parse(fs.readFileSync('.gh-task-cache/admin-audit-fixture.json', 'utf8'));
assert.equal(path.resolve(fixture.databasePath), path.resolve('prisma/admin-audit-e2e.db'));
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true });
const results = {
  origin,
  startedAt: new Date().toISOString(),
  pages: [],
  filters: [],
  actionTests: [],
  authorization: [],
  errors: [],
  blockedExternalRequests: [],
};
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addCookies([
  { name: 'fornextgen_travel_session', value: fixture.adminToken, url: origin },
]);
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
  results.blockedExternalRequests.push(url.origin);
  return route.abort();
});
const page = await context.newPage();
page.on('pageerror', (error) => results.errors.push({ url: page.url(), message: error.message }));
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );
const substitutions = {
  userId: 'audit-customer',
  partnerId: 'audit-hotel',
  organizationId: 'audit-org',
  confirmationCode: 'AUDIT-HOTEL-BOOKING',
  applicationId: 'audit-application-pending',
  inquiryId: 'audit-inquiry-0',
};
const routes = walk('app/admin')
  .filter((file) => file.endsWith('page.tsx'))
  .map((file) =>
    `/${file
      .replaceAll('\\', '/')
      .replace(/^app\//, '')
      .replace(/\/page.tsx$/, '')}`.replace(/\[(\w+)\]/g, (_, key) => substitutions[key]),
  )
  .sort();

async function navigate(route) {
  const response = await page.goto(`${origin}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  assert.equal(response.status(), 200, `${route}: HTTP ${response.status()}`);
  assert.equal(
    new URL(page.url()).pathname,
    new URL(`${origin}${route}`).pathname,
    `Unexpected redirect from ${route}`,
  );
  assert.ok(await page.locator('h1').count(), `${route} has no main heading`);
  assert.doesNotMatch(
    await page.locator('body').innerText(),
    /Application error:|Internal Server Error|Something went wrong/i,
  );
}
async function expectMutation(trigger, urlPart, expected = 200) {
  const reply = page.waitForResponse(
    (response) => response.url().includes(urlPart) && response.request().method() !== 'GET',
  );
  await trigger();
  const response = await reply;
  assert.equal(response.status(), expected, `${urlPart}: ${await response.text()}`);
  await page.waitForLoadState('domcontentloaded');
}
async function action(name, work) {
  try {
    await work();
    results.actionTests.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.actionTests.push({ name, pass: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

try {
  const customer = await browser.newContext();
  await customer.addCookies([
    { name: 'fornextgen_travel_session', value: fixture.customerToken, url: origin },
  ]);
  const signedIn = await customer.request.get(origin + '/account', { maxRedirects: 0 });
  assert.equal(
    signedIn.status(),
    200,
    'Customer fixture must be signed in before role-denial checks',
  );
  const customerResponse = await customer.request.patch(
    `${origin}/api/v1/admin/contact-inquiries/audit-inquiry-2`,
    {
      headers: { Origin: origin },
      data: {
        action: 'ACCEPT',
        expectedVersion: 1,
        reason: 'Customer must not decide this request',
      },
    },
  );
  results.authorization.push({
    name: 'Authenticated customer cannot review enquiries',
    status: customerResponse.status(),
    pass: customerResponse.status() === 403,
  });
  const customerPage = await customer.newPage();
  await customerPage.goto(`${origin}/admin/contact-inquiries/audit-inquiry-2`, {
    waitUntil: 'domcontentloaded',
  });
  await customerPage.waitForURL(`${origin}/account`);
  results.authorization.push({
    name: 'Authenticated customer cannot read enquiry details',
    pass: new URL(customerPage.url()).pathname === '/account',
  });
  await customer.close();
  // Every admin route, including nested records, plus every rendered GET filter form.
  for (const route of [
    ...routes,
    '/admin/partners/audit-car',
    '/admin/bookings/AUDIT-CAR-BOOKING',
  ]) {
    try {
      await navigate(route);
      const record = await page.locator('#workspace-main').evaluate((main) => ({
        headings: [...main.querySelectorAll('h1,h2,h3')].map((node) => node.textContent.trim()),
        buttons: [...main.querySelectorAll('button')].map((node) => ({
          text: node.textContent.trim(),
          disabled: node.disabled,
          type: node.type,
        })),
        links: [...main.querySelectorAll('a[href]')].map((node) => ({
          text: node.textContent.trim(),
          href: node.getAttribute('href'),
        })),
        details: main.querySelectorAll('details').length,
      }));
      // Expand every disclosure on the page, then capture its visible controls.
      await page.locator('details').evaluateAll((nodes) =>
        nodes.forEach((node) => {
          node.open = true;
        }),
      );
      results.pages.push({ route, pass: true, ...record });
      const filters = await page.locator('form').evaluateAll((forms) =>
        forms
          .map((form, index) => ({
            index,
            method: form.getAttribute('method'),
            action: form.getAttribute('action'),
          }))
          .filter(
            (form) => form.method?.toLowerCase() === 'get' && !form.action?.startsWith('/api/'),
          ),
      );
      for (const filter of filters) {
        const form = page.locator('form').nth(filter.index);
        const submit = form
          .locator('button[type="submit"],button:not([type]),input[type="submit"]')
          .first();
        if (await submit.count()) {
          await Promise.all([page.waitForLoadState('domcontentloaded'), submit.click()]);
          await page.waitForLoadState('domcontentloaded');
          assert.doesNotMatch(
            await page.locator('body').innerText(),
            /Application error:|Internal Server Error/,
          );
          results.filters.push({ route, pass: true });
        }
      }
      console.log(`PAGE ${route}: OK (${record.buttons.length} buttons)`);
    } catch (error) {
      results.pages.push({ route, pass: false, error: error.message });
      console.error(`PAGE ${route}: ${error.message}`);
    }
  }

  await action(
    'Request list: search, category/status filtering, pagination and detail links',
    async () => {
      await navigate('/admin/contact-inquiries');
      assert.equal(await page.locator('tbody tr').count(), 30);
      await page.getByRole('link', { name: 'Next page', exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get('page') === '2');
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 2);
      assert.equal(await page.locator('tbody tr').count(), 2);
      await page.getByLabel('Search requests').fill('AUDIT-000');
      await page.getByRole('button', { name: 'Filter requests' }).click();
      await page.waitForURL((url) => url.searchParams.get('q') === 'AUDIT-000');
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
      assert.equal(await page.locator('tbody tr').count(), 1);
      await page.getByRole('link', { name: 'Open request', exact: true }).click();
      await page.waitForURL('**/admin/contact-inquiries/audit-inquiry-0');
      await page.getByLabel('Internal decision note (required)').waitFor();
      assert.match(page.url(), /audit-inquiry-0/);
      assert.equal(
        await page.getByRole('button', { name: 'Accept request', exact: true }).isDisabled(),
        true,
      );
    },
  );
  await action(
    'Request lifecycle: start, accept, close, reopen, reject, persist and audit',
    async () => {
      await navigate('/admin/contact-inquiries/audit-inquiry-0');
      for (const name of [
        'Start review',
        'Accept request',
        'Close request',
        'Reopen request',
        'Reject request',
      ]) {
        await page.getByLabel('Internal decision note (required)').fill(`Isolated test: ${name}`);
        await expectMutation(
          () => page.getByRole('button', { name, exact: true }).click(),
          '/api/v1/admin/contact-inquiries/audit-inquiry-0',
        );
        await page.getByRole('status').filter({ hasText: 'Decision recorded.' }).waitFor();
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      assert.equal(await page.locator('li').filter({ hasText: 'Isolated test:' }).count(), 5);
      const stale = await context.request.patch(
        `${origin}/api/v1/admin/contact-inquiries/audit-inquiry-0`,
        {
          headers: { Origin: origin },
          data: { action: 'REOPEN', expectedVersion: 1, reason: 'Stale local test decision' },
        },
      );
      assert.equal(stale.status(), 409);
      await navigate('/admin/audit?domain=SUPPORT&q=AUDIT-000');
      assert.ok((await page.locator('tbody tr').count()) >= 5);
    },
  );
  await action('Request network failure shows error and permits retry', async () => {
    await navigate('/admin/contact-inquiries/audit-inquiry-1');
    await page
      .getByLabel('Internal decision note (required)')
      .fill('Testing network failure recovery');
    await page.route(
      '**/api/v1/admin/contact-inquiries/audit-inquiry-1',
      (route) => route.abort(),
      { times: 1 },
    );
    await page.getByRole('button', { name: 'Accept request', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'could not be reached' }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Accept request', exact: true }).isEnabled(),
      true,
    );
    await expectMutation(
      () => page.getByRole('button', { name: 'Accept request', exact: true }).click(),
      '/api/v1/admin/contact-inquiries/audit-inquiry-1',
    );
  });
  await action(
    'Application detail: KYC start/request-changes, locked verification, signed receipt, rejection history',
    async () => {
      await navigate('/admin/partner-applications/audit-application-pending');
      assert.equal(
        await page.getByRole('button', { name: 'Approve supplier', exact: true }).isDisabled(),
        true,
      );
      await expectMutation(
        () => page.getByRole('button', { name: 'Start review', exact: true }).click(),
        '/api/v1/admin/partner-kyc-documents/audit-kyc',
      );
      await page.getByRole('button', { name: 'Request changes', exact: true }).waitFor();
      assert.equal(
        await page.getByRole('button', { name: 'Verify', exact: true }).isDisabled(),
        true,
      );
      const verify = await context.request.patch(
        `${origin}/api/v1/admin/partner-kyc-documents/audit-kyc`,
        {
          headers: { Origin: origin },
          data: {
            targetStatus: 'VERIFIED',
            expectedVersion: 2,
            reviewNote: 'Cannot verify without secure evidence',
          },
        },
      );
      assert.equal(verify.status(), 409);
      await page
        .getByLabel('Review note', { exact: true })
        .first()
        .fill('Please supply the missing verified evidence');
      await expectMutation(
        () => page.getByRole('button', { name: 'Request changes', exact: true }).click(),
        '/api/v1/admin/partner-kyc-documents/audit-kyc',
      );
      await page
        .getByLabel('Review note', { exact: true })
        .last()
        .fill('Synthetic signed agreement received for test');
      await expectMutation(
        () =>
          page
            .getByRole('button', {
              name: 'Record additional signed or stamped copy received',
              exact: true,
            })
            .click(),
        '/api/v1/admin/partner-applications/audit-application-pending',
      );
      await page.getByText('Complete signed agreement recorded.', { exact: true }).waitFor();
      await page
        .getByLabel('Review note', { exact: true })
        .last()
        .fill('Rejecting synthetic local application only');
      await expectMutation(
        () => page.getByRole('button', { name: 'Reject', exact: true }).click(),
        '/api/v1/admin/partner-applications/audit-application-pending',
      );
      await page.getByText('Decision: REJECTED', { exact: true }).waitFor();
      await navigate('/admin/partner-applications?status=REJECTED');
      await page.getByRole('link', { name: 'Audit Application PENDING', exact: true }).waitFor();
    },
  );
  await action('Privacy review advances to the next action without full-page reload', async () => {
    await navigate('/admin/privacy?status=ALL');
    const controls = page.locator('.admin-support-action').first();
    await controls.getByLabel('Review note').fill('Synthetic local privacy review started');
    await expectMutation(
      () => controls.getByRole('button', { name: 'Start review', exact: true }).click(),
      '/api/v1/admin/privacy/requests/audit-privacy',
    );
    await controls.getByRole('button', { name: 'Mark fulfilled', exact: true }).waitFor();
    await controls.getByLabel('Review outcome').selectOption('REJECT');
    await controls.getByLabel('Review note').fill('Synthetic request rejected as test record');
    await expectMutation(
      () => controls.getByRole('button', { name: 'Reject with reason', exact: true }).click(),
      '/api/v1/admin/privacy/requests/audit-privacy',
    );
    await controls.getByRole('button', { name: 'Reopen review', exact: true }).waitFor();
    await controls.getByLabel('Review note').fill('Reopen synthetic record to verify next action');
    await expectMutation(
      () => controls.getByRole('button', { name: 'Reopen review', exact: true }).click(),
      '/api/v1/admin/privacy/requests/audit-privacy',
    );
    // Reopening returns to IN_REVIEW, not OPEN; either valid review outcome is allowed.
    await controls.getByLabel('Review outcome').waitFor();
    assert.ok(
      ['COMPLETE', 'REJECT'].includes(await controls.getByLabel('Review outcome').inputValue()),
    );
  });
  await action('Customer support close/reopen is functional', async () => {
    await navigate('/admin/support?type=CUSTOMER&status=ALL');
    await page.getByLabel('Resolution note').fill('Resolved isolated synthetic support case');
    await expectMutation(
      () => page.getByRole('button', { name: 'Close case', exact: true }).click(),
      '/api/v1/admin/customer-support/audit-support',
    );
    await page.getByRole('button', { name: 'Reopen case', exact: true }).waitFor();
    await expectMutation(
      () => page.getByRole('button', { name: 'Reopen case', exact: true }).click(),
      '/api/v1/admin/customer-support/audit-support',
    );
  });
  await action('Business support close/reopen is functional', async () => {
    await navigate('/admin/support?type=BUSINESS&status=ALL');
    for (const name of ['Close case', 'Reopen case']) {
      await expectMutation(
        () => page.getByRole('button', { name, exact: true }).click(),
        '/api/v1/admin/support/audit-business-support',
      );
      await page
        .getByRole('button', {
          name: name === 'Close case' ? 'Reopen case' : 'Close case',
          exact: true,
        })
        .waitFor();
    }
  });
  await action('Release control pauses and restores a synthetic feature with history', async () => {
    await navigate('/admin/configuration');
    const form = page.locator('#workspace-main form').first();
    for (const name of ['Pause feature', 'Restore feature']) {
      await form
        .getByLabel('Required change reason')
        .fill('Isolated feature toggle regression test');
      await expectMutation(
        () => form.getByRole('button', { name, exact: true }).click(),
        '/api/v1/admin/configuration/features/',
      );
      await form
        .getByRole('button', {
          name: name === 'Pause feature' ? 'Restore feature' : 'Pause feature',
          exact: true,
        })
        .waitFor();
    }
    assert.ok(
      (await page
        .locator('tbody tr')
        .filter({ hasText: 'Isolated feature toggle regression test' })
        .count()) >= 2,
    );
  });
  await action('Search projection maintenance runs against isolated draft inventory', async () => {
    await navigate('/admin/search');
    await page.getByLabel('Operational reason').fill('Isolated search maintenance regression');
    await page.getByLabel('Type REBUILD HOTEL SEARCH to confirm').fill('REBUILD HOTEL SEARCH');
    await expectMutation(
      () => page.getByRole('button', { name: 'Rebuild search projections', exact: true }).click(),
      '/api/v1/admin/search-projections',
    );
    await page.getByRole('status').filter({ hasText: 'Rebuilt' }).waitFor();
  });
  await action('Destination editor saves a synthetic draft', async () => {
    await navigate('/admin/content');
    await page.locator('details').evaluateAll((nodes) =>
      nodes.forEach((node) => {
        node.open = true;
      }),
    );
    const form = page
      .locator('form')
      .filter({ has: page.locator('[name="slug"]') })
      .first();
    await form.getByLabel('Destination name', { exact: true }).fill('Isolated Audit Destination');
    await form.getByLabel('URL slug').fill('isolated-audit-destination');
    await form.getByLabel('State or region').fill('Himachal Pradesh');
    await form
      .getByLabel('Card summary')
      .fill('Synthetic editorial content for isolated browser checks only.');
    await form.getByLabel('Required change reason').fill('Verify synthetic destination draft save');
    await expectMutation(
      () => form.getByRole('button', { name: 'Save content', exact: true }).click(),
      '/api/v1/admin/content/destinations',
      201,
    );
    await page.getByRole('heading', { name: 'Isolated Audit Destination', exact: true }).waitFor();
  });
  await action('Account suspend and restore controls work on a synthetic customer', async () => {
    await navigate('/admin/users/audit-access-user');
    await page.getByLabel('Operational reason').fill('Isolated account suspension test only');
    await page
      .locator('input[name="confirmation"]')
      .fill('SUSPEND audit-access-user@example.invalid');
    await expectMutation(
      () => page.getByRole('button', { name: 'Suspend account', exact: true }).click(),
      '/api/v1/admin/users/audit-access-user/access',
    );
    await page.getByRole('button', { name: 'Restore account', exact: true }).waitFor();
    await page.getByLabel('Operational reason').fill('Restore isolated local account for testing');
    await page
      .locator('input[name="confirmation"]')
      .fill('RESTORE audit-access-user@example.invalid');
    await expectMutation(
      () => page.getByRole('button', { name: 'Restore account', exact: true }).click(),
      '/api/v1/admin/users/audit-access-user/access',
    );
  });
  await action('Service advisory creation persists as a draft', async () => {
    await navigate('/admin/service-advisories');
    const form = page.locator('#service-advisory-create-form');
    await form.locator('[name="title"]').fill('Isolated admin audit advisory');
    await form
      .locator('[name="message"]')
      .fill('This is a synthetic draft notice, not for real customers.');
    await form.locator('[name="reason"]').fill('Local browser audit of draft creation');
    await expectMutation(
      () => form.getByRole('button', { name: 'Create advisory', exact: true }).click(),
      '/api/v1/admin/service-advisories',
      201,
    );
    await page.getByText('Isolated admin audit advisory', { exact: true }).waitFor();
  });
  await action('Hotel moderation buttons work on a synthetic review', async () => {
    await navigate('/admin/reviews?status=ALL');
    await page
      .getByLabel('Moderation note')
      .fill('Synthetic audit review accepted for isolated test');
    await expectMutation(
      () => page.getByRole('button', { name: 'Publish', exact: true }).click(),
      '/api/v1/admin/hotel-reviews/audit-review',
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('#workspace-main').innerText(), /PUBLISHED/i);
  });
  await action('Mobile request page remains readable with reachable actions', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate('/admin/contact-inquiries/audit-inquiry-2');
    await page.getByLabel('Internal decision note (required)').fill('Mobile layout test note');
    await page
      .getByRole('button', { name: 'Accept request', exact: true })
      .scrollIntoViewIfNeeded();
    assert.equal(
      await page.getByRole('button', { name: 'Accept request', exact: true }).isVisible(),
      true,
    );
    await page.screenshot({ path: '.gh-task-cache/admin-request-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate('/admin/contact-inquiries/audit-inquiry-0');
    await page.screenshot({ path: '.gh-task-cache/admin-request-desktop.png', fullPage: true });
  });

  // No credentials: every mutating administrator endpoint must reject before parsing data.
  const anonymous = await browser.newContext();
  const apiRoutes = walk('app/api/v1/admin').filter((file) => file.endsWith('route.ts'));
  for (const file of apiRoutes) {
    const source = fs.readFileSync(file, 'utf8');
    const endpoint = `/${file
      .replaceAll('\\', '/')
      .replace(/^app\//, '')
      .replace(/\/route.ts$/, '')}`.replace(/\[[^\]]+\]/g, 'audit-nonexistent');
    for (const match of source.matchAll(
      /export\s+async\s+function\s+(POST|PATCH|DELETE|PUT)\s*\(/g,
    )) {
      const response = await anonymous.request.fetch(`${origin}${endpoint}`, {
        method: match[1],
        headers: { Origin: origin },
        data: {},
      });
      results.authorization.push({
        endpoint,
        method: match[1],
        status: response.status(),
        pass: response.status() === 403 || response.status() === 401,
      });
    }
  }
  const unauthPage = await anonymous.newPage();
  for (const route of routes) {
    await unauthPage.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    // App Router can deliver redirect metadata in a streamed response after DOMContentLoaded.
    await unauthPage.waitForURL((url) => url.pathname === '/login');
    results.authorization.push({
      page: route,
      pass:
        new URL(unauthPage.url()).pathname === '/login' &&
        (await unauthPage.locator('#workspace-main').count()) === 0,
    });
  }
  await anonymous.close();
  const csrf = await context.request.patch(
    `${origin}/api/v1/admin/contact-inquiries/audit-inquiry-2`,
    {
      headers: { Origin: 'https://example.invalid', 'Sec-Fetch-Site': 'cross-site' },
      data: { action: 'ACCEPT', expectedVersion: 1, reason: 'Must not be allowed' },
    },
  );
  results.authorization.push({
    name: 'Cross-origin request rejected',
    status: csrf.status(),
    pass: csrf.status() === 403,
  });
} finally {
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync('.gh-task-cache/admin-browser-results.json', JSON.stringify(results, null, 2));
  await browser.close();
}
const failures = [...results.pages, ...results.actionTests, ...results.authorization].filter(
  (item) => !item.pass,
);
console.log(
  JSON.stringify(
    {
      pageChecks: results.pages.length,
      filterChecks: results.filters.length,
      actionChecks: results.actionTests.length,
      authorizationChecks: results.authorization.length,
      browserErrors: results.errors.length,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length || results.errors.length) process.exitCode = 1;
