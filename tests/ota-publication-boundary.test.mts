import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isPublicIndexingEnabled } from '../lib/seo/indexingPolicy.ts';
import { siteConfig } from '../config/site.ts';
import nextConfig from '../next.config.ts';

test('indexing requires explicit production approval and never permits fixtures', () => {
  for (const env of [
    {},
    { NODE_ENV: 'development', PUBLIC_INDEXING_ENABLED: 'true' },
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', PUBLIC_INDEXING_ENABLED: 'true', FIXTURE_INVENTORY_ENABLED: 'true' },
  ]) {
    assert.equal(isPublicIndexingEnabled(env), false);
  }
  assert.equal(
    isPublicIndexingEnabled({
      NODE_ENV: 'production',
      PUBLIC_INDEXING_ENABLED: 'true',
      FIXTURE_INVENTORY_ENABLED: 'false',
    }),
    true,
  );
});

test('preview responses block indexing at the HTTP layer', async () => {
  const headers = await nextConfig.headers?.();
  assert.ok(
    headers
      ?.find((rule) => rule.source === '/:path*')
      ?.headers.some((header) => header.key === 'X-Robots-Tag' && header.value.includes('noindex')),
  );
});

test('Group directory links stay public navigation rather than shared credentials', () => {
  assert.equal(siteConfig.group.href, 'https://www.fornextgengroup.com');
  assert.equal(new URL(siteConfig.group.travelDirectoryHref).hash, '#travel');
  const footer = readFileSync('components/layout/SiteFooter.tsx', 'utf8');
  assert.match(footer, /siteConfig\.group\.href/);
  const layout = readFileSync('app/layout.tsx', 'utf8');
  assert.match(layout, /isFixtureInventoryEnabled\(\)/);
  assert.match(layout, /Sample hotel inventory/);
});
