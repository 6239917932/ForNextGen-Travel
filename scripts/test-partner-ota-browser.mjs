// Run against the isolated database produced by seed-admin-audit.mts only.
// Requires PLAYWRIGHT_MODULE pointing to an installed Playwright index.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = 'http://localhost:3019';
const fixture = JSON.parse(fs.readFileSync('.gh-task-cache/admin-audit-fixture.json', 'utf8'));
assert.equal(path.resolve(fixture.databasePath), path.resolve('prisma/admin-audit-e2e.db'));
assert.ok(fixture.partnerToken, 'Partner browser token is missing from the isolated fixture.');

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { height: 1000, width: 1440 } });
await context.addCookies([
  { name: 'fornextgen_travel_session', value: fixture.partnerToken, url: origin },
]);
const results = {
  origin,
  startedAt: new Date().toISOString(),
  pages: [],
  responsivePages: [],
  internalLinks: [],
  errors: [],
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
  '/partner',
  '/partner/bookings',
  '/partner/amendments',
  '/partner/properties',
  '/partner/inventory',
  '/partner/reviews',
  '/partner/settlements',
  '/partner/compliance',
  '/partner/tax',
  '/partner/activity',
  '/partner/access',
  '/partner/reports',
].toSorted();

try {
  for (const route of routes) {
    const response = await page.goto(`${origin}${route}`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    assert.equal(response.status(), 200, `${route}: HTTP ${response.status()}`);
    assert.equal(new URL(page.url()).pathname, route, `${route}: unexpected redirect`);
    await page
      .locator('h1')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => assert.fail(`${route}: missing main heading`));
    assert.doesNotMatch(
      await page.locator('body').innerText(),
      /Application error:|Internal Server Error|Something went wrong|This page could not be found/i,
      `${route}: rendered an application error`,
    );
    const contentRoot = (await page.locator('#workspace-main').count())
      ? page.locator('#workspace-main').first()
      : (await page.locator('main').count())
        ? page.locator('main').first()
        : (await page.locator('.booking-document-page').count())
          ? page.locator('.booking-document-page')
          : page.locator('body');
    const record = await contentRoot.evaluate((main) => ({
      buttons: [...main.querySelectorAll('button')].map((node) => ({
        accessibleName:
          node.getAttribute('aria-label')?.trim() ||
          node.getAttribute('title')?.trim() ||
          node.textContent?.trim() ||
          '',
        disabled: node.disabled,
        text: node.textContent?.trim() ?? '',
        type: node.type,
      })),
      forms: [...main.querySelectorAll('form')].map((form) => ({
        action: form.getAttribute('action') ?? '',
        method: (form.getAttribute('method') ?? 'get').toLowerCase(),
        submitControls: form.querySelectorAll(
          'button[type="submit"], input[type="submit"], button:not([type])',
        ).length,
      })),
      headings: [...main.querySelectorAll('h1,h2,h3')].map(
        (node) => node.textContent?.trim() ?? '',
      ),
      controlsWithoutLabels: [...main.querySelectorAll('input, select, textarea')]
        .filter(
          (node) =>
            !(node instanceof HTMLInputElement && node.type === 'hidden') &&
            !node.labels?.length &&
            !node.getAttribute('aria-label')?.trim() &&
            !node.getAttribute('aria-labelledby')?.trim() &&
            !node.getAttribute('title')?.trim(),
        )
        .map((node) => `${node.tagName.toLowerCase()}[name="${node.getAttribute('name') ?? ''}"]`),
      tablesWithoutScrollContainer: [...main.querySelectorAll('table')]
        .filter(
          (table) => !table.closest('.business-report__table-scroll, [role="region"][tabindex]'),
        )
        .map((table) => table.querySelector('caption')?.textContent?.trim() || 'uncaptioned table'),
      links: [...main.querySelectorAll('a[href]')].map((node) => ({
        accessibleName:
          node.getAttribute('aria-label')?.trim() ||
          node.getAttribute('title')?.trim() ||
          node.textContent?.trim() ||
          '',
        href: node.getAttribute('href'),
        text: node.textContent?.trim() ?? '',
      })),
    }));
    assert.equal(
      record.links.some((link) => link.href === '#'),
      false,
      `${route}: placeholder link`,
    );
    assert.equal(
      record.buttons.some((button) => !button.accessibleName),
      false,
      `${route}: button without an accessible name`,
    );
    assert.equal(
      record.links.some((link) => !link.accessibleName),
      false,
      `${route}: link without an accessible name`,
    );
    assert.equal(
      record.forms.some((form) => form.submitControls === 0),
      false,
      `${route}: form without a submit control`,
    );
    assert.deepEqual(
      record.controlsWithoutLabels,
      [],
      `${route}: form controls without programmatic labels`,
    );
    assert.deepEqual(
      record.tablesWithoutScrollContainer,
      [],
      `${route}: table without a responsive scroll container`,
    );
    assert.equal(
      record.links.some(
        (link) =>
          link.href?.startsWith('javascript:') ||
          link.href?.startsWith('data:') ||
          link.href?.startsWith('vbscript:') ||
          link.href?.startsWith('//'),
      ),
      false,
      `${route}: unsafe or protocol-relative link`,
    );
    results.pages.push({ pass: true, route, ...record });
    console.log(
      `PAGE ${route}: OK (${record.buttons.length} buttons, ${record.links.length} links, ${record.forms.length} forms)`,
    );
  }
  await page.goto(`${origin}/partner`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
  for (const removed of ['/partner/pms', '/partner/housekeeping', '/partner/channels']) {
    const response = await context.request.get(origin + removed, { maxRedirects: 0 });
    assert.equal(response.status(), 404, removed + ': extracted PMS page must stay unavailable');
  }
  for (const removed of [
    '/api/v1/partner/direct-bookings',
    '/api/v1/partner/channels',
    '/api/v1/partner/booking-addons',
  ]) {
    const response = await context.request.post(origin + removed, {
      headers: { Origin: origin },
      data: {},
    });
    assert.equal(response.status(), 404, removed + ': extracted mutation must stay unavailable');
  }
  const sidebarLinks = await page
    .locator('#workspace-navigation a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  const duplicates = sidebarLinks.filter((href, index) => sidebarLinks.indexOf(href) !== index);
  assert.deepEqual(
    duplicates,
    [],
    `Duplicate OTA supplier sidebar destinations: ${duplicates.join(', ')}`,
  );

  const internalHrefs = [
    ...new Set(
      results.pages.flatMap((entry) =>
        entry.links
          .map((link) => link.href)
          .filter(
            (href) =>
              typeof href === 'string' &&
              href.startsWith('/partner') &&
              !href.includes('[object Object]'),
          ),
      ),
    ),
  ].toSorted();
  for (const href of internalHrefs) {
    const response = await context.request.get(`${origin}${href}`, { maxRedirects: 0 });
    assert.ok(
      response.status() >= 200 && response.status() < 400,
      `${href}: linked destination returned HTTP ${response.status()}`,
    );
    results.internalLinks.push({ href, status: response.status() });
  }

  const mobilePage = await context.newPage();
  await mobilePage.setViewportSize({ height: 844, width: 390 });
  for (const route of routes) {
    const response = await mobilePage.goto(`${origin}${route}`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    assert.equal(response.status(), 200, `${route}: mobile HTTP ${response.status()}`);
    await mobilePage.locator('h1').first().waitFor({ state: 'visible', timeout: 10_000 });
    await mobilePage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    let layout;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        layout = await mobilePage.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        break;
      } catch (error) {
        if (!String(error).includes('Execution context was destroyed') || attempt === 2)
          throw error;
        await mobilePage.waitForLoadState('domcontentloaded', { timeout: 10_000 });
        await mobilePage.locator('h1').first().waitFor({ state: 'visible', timeout: 10_000 });
      }
    }
    assert.ok(layout, `${route}: mobile layout could not be measured`);
    assert.ok(
      layout.scrollWidth <= layout.clientWidth + 2,
      `${route}: mobile page overflows viewport (${layout.scrollWidth}px > ${layout.clientWidth}px)`,
    );
    results.responsivePages.push({ pass: true, route, ...layout });
  }
  await mobilePage.close();
  assert.equal(results.errors.length, 0, JSON.stringify(results.errors));
  results.completedAt = new Date().toISOString();
  results.summary = {
    failed: 0,
    internalLinksChecked: results.internalLinks.length,
    mobilePagesChecked: results.responsivePages.length,
    passed: results.pages.length,
    total: routes.length,
  };
  fs.writeFileSync(
    '.gh-task-cache/partner-ota-browser-audit.json',
    JSON.stringify(results, null, 2),
  );
  console.log(`Partner OTA browser audit passed: ${routes.length}/${routes.length} pages.`);
} finally {
  await browser.close();
}
