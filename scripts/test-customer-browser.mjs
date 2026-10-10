// Run only against the isolated database produced by seed-admin-audit.mts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = 'http://localhost:3019';
const fixture = JSON.parse(fs.readFileSync('.gh-task-cache/admin-audit-fixture.json', 'utf8'));
assert.equal(path.resolve(fixture.databasePath), path.resolve('prisma/admin-audit-e2e.db'));
assert.ok(fixture.customerToken);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
await context.addCookies([
  { name: 'fornextgen_travel_session', value: fixture.customerToken, url: origin },
]);
const results = {
  errors: [],
  links: [],
  mobile: [],
  pages: [],
  startedAt: new Date().toISOString(),
};
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  return url.origin === origin || ['data:', 'blob:'].includes(url.protocol)
    ? route.continue()
    : route.abort();
});
const page = await context.newPage();
page.on('pageerror', (error) => results.errors.push({ message: error.message, url: page.url() }));
const routes = [
  '/account',
  '/account/trips',
  '/account/trips/AUDIT-HOTEL-BOOKING',
  '/account/hotel-bookings/AUDIT-HOTEL-BOOKING',
  '/account/payments',
  '/account/documents',
  '/account/reviews',
  '/account/settings',
  '/account/travelers',
  '/account/notifications',
  '/account/consents',
  '/account/benefits',
  '/account/company-requests',
  '/account/support',
  '/account/support/AUDIT-SUPPORT',
];

async function inspect(route, target = page) {
  const response = await target.goto(`${origin}${route}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });
  assert.equal(response.status(), 200, `${route}: HTTP ${response.status()}`);
  assert.equal(new URL(target.url()).pathname, route, `${route}: unexpected redirect`);
  await target.locator('h1').first().waitFor({ state: 'visible', timeout: 10_000 });
  const record = await target.locator('body').evaluate((root) => ({
    controlsWithoutLabels: [...root.querySelectorAll('input,select,textarea')].filter(
      (node) =>
        !(node instanceof HTMLInputElement && node.type === 'hidden') &&
        !node.labels?.length &&
        !node.getAttribute('aria-label') &&
        !node.getAttribute('aria-labelledby') &&
        !node.getAttribute('title'),
    ).length,
    unnamedButtons: [...root.querySelectorAll('button')].filter(
      (node) =>
        !(
          node.textContent?.trim() ||
          node.getAttribute('aria-label') ||
          node.getAttribute('title')
        ),
    ).length,
    links: [...root.querySelectorAll('a[href]')].map((node) => node.getAttribute('href')),
    formsWithoutSubmit: [...root.querySelectorAll('form')].filter(
      (form) =>
        !form.querySelector('button[type="submit"],input[type="submit"],button:not([type])'),
    ).length,
  }));
  assert.equal(record.controlsWithoutLabels, 0, `${route}: unlabeled controls`);
  assert.equal(record.unnamedButtons, 0, `${route}: unnamed buttons`);
  assert.equal(record.formsWithoutSubmit, 0, `${route}: form without submit control`);
  assert.equal(
    record.links.some((href) => {
      const normalizedHref = href?.trim().toLowerCase();
      return (
        normalizedHref === '#' ||
        normalizedHref?.startsWith('javascript:') ||
        normalizedHref?.startsWith('data:') ||
        normalizedHref?.startsWith('vbscript:')
      );
    }),
    false,
  );
  assert.doesNotMatch(
    await target.locator('body').innerText(),
    /Application error:|Internal Server Error|Something went wrong/i,
  );
  return record;
}

try {
  for (const route of routes) results.pages.push({ route, ...(await inspect(route)) });
  const hrefs = [
    ...new Set(
      results.pages.flatMap((item) => item.links).filter((href) => href?.startsWith('/account')),
    ),
  ];
  for (const href of hrefs) {
    const response = await context.request.get(`${origin}${href}`, { maxRedirects: 0 });
    assert.ok(
      response.status() >= 200 && response.status() < 400,
      `${href}: HTTP ${response.status()}`,
    );
    results.links.push({ href, status: response.status() });
  }
  const mobile = await context.newPage();
  await mobile.setViewportSize({ height: 844, width: 390 });
  for (const route of routes) {
    await inspect(route, mobile);
    const width = await mobile.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(width.scroll <= width.client + 2, `${route}: mobile horizontal overflow`);
    results.mobile.push({ route, ...width });
  }
  await mobile.close();
  assert.deepEqual(results.errors, []);
  results.completedAt = new Date().toISOString();
  fs.writeFileSync('.gh-task-cache/customer-browser-audit.json', JSON.stringify(results, null, 2));
  console.log(`Customer browser audit passed: ${routes.length}/${routes.length} pages.`);
} finally {
  await browser.close();
}
