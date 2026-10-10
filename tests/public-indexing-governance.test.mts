import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import nextConfig, { noIndexHeaderSources } from '../next.config.ts';

test('production responses do not advertise the application framework', () => {
  assert.equal(nextConfig.poweredByHeader, false);
});
import {
  absolutePublicUrl,
  buildPublicSitemapRecords,
  ROBOTS_DISALLOWED_PATHS,
} from '../lib/seo/publicIndexing.ts';
import { createPublicMetadata, PUBLIC_SITE_ORIGIN } from '../lib/seo/siteMetadata.ts';

const protectedPrefixes = [
  '/account',
  '/admin',
  '/agent',
  '/api',
  '/partner$',
  '/partner/',
  '/manage-booking',
  '/partners/apply',
  '/flights/booking',
  '/buses/booking',
  '/cars/booking',
] as const;

test('crawler rules fail closed for private and transactional surfaces', () => {
  const disallowedPaths: readonly string[] = ROBOTS_DISALLOWED_PATHS;
  for (const prefix of protectedPrefixes) {
    assert.ok(
      ROBOTS_DISALLOWED_PATHS.some((path) => path.startsWith(prefix) || prefix.startsWith(path)),
      `${prefix} must be disallowed`,
    );
  }

  assert.ok(!disallowedPaths.includes('/hotels'));
  assert.ok(!disallowedPaths.includes('/partners'));
  assert.ok(!disallowedPaths.includes('/business'));
});

test('sensitive responses receive a no-index header without suppressing public landing pages', async () => {
  const noIndexSources: readonly string[] = noIndexHeaderSources;
  const joined = noIndexSources.join('\n');
  for (const fragment of ['/account/', '/admin/', '/api/', '/partner/', '/manage-booking/']) {
    assert.match(joined, new RegExp(fragment.replaceAll('/', '\\/')));
  }

  assert.ok(!noIndexSources.includes('/hotels/:path*'));
  assert.ok(!noIndexSources.includes('/partners/:path*'));
  assert.ok(!noIndexSources.includes('/business/:path*'));

  const headers = (await nextConfig.headers?.()) as
    Array<{ headers: Array<{ key: string; value: string }>; source: string }> | undefined;
  assert.ok(headers);
  for (const source of noIndexHeaderSources) {
    const rule: { headers: Array<{ key: string; value: string }>; source: string } | undefined =
      headers.find((candidate) => candidate.source === source);
    assert.deepEqual(rule?.headers, [
      { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
    ]);
  }
});

test('public sitemap includes normalized public records only', () => {
  const updatedAt = new Date('2026-08-25T00:00:00.000Z');
  const records = buildPublicSitemapRecords({
    destinations: [
      { slug: 'shimla', updatedAt },
      { slug: '../private', updatedAt },
    ],
    hotelSlugs: ['z-hotel', 'a-hotel', 'a-hotel', '../admin'],
    legalPolicySlugs: ['terms', 'privacy'],
  });
  const paths = records.map((record) => record.path);

  assert.equal(paths.filter((path) => path === '/hotels/a-hotel').length, 1);
  assert.ok(paths.includes('/hotels/z-hotel'));
  assert.ok(paths.includes('/destinations/shimla'));
  assert.ok(paths.includes('/legal/privacy'));
  assert.ok(paths.includes('/legal/terms'));
  assert.ok(paths.includes('/about'));
  assert.ok(paths.includes('/contact'));
  assert.ok(paths.includes('/pricing'));
  assert.ok(!paths.includes('/flights'));
  assert.ok(!paths.includes('/buses'));
  assert.ok(!paths.includes('/partners/apply'));
  assert.ok(paths.every((path) => !path.includes('..')));
  assert.ok(paths.every((path) => !protectedPrefixes.some((prefix) => path.startsWith(prefix))));
  assert.equal(
    records.find((record) => record.path === '/destinations/shimla')?.lastModified,
    updatedAt,
  );
});

test('public metadata emits canonical and share data but keeps the preview unindexed', () => {
  const metadata = createPublicMetadata({
    description: 'A public description suitable for search results.',
    path: '/about',
    title: 'About our company',
  });

  assert.equal(PUBLIC_SITE_ORIGIN, 'https://www.mandyaltravels.com');
  assert.equal(metadata.alternates?.canonical, '/about');
  assert.equal(
    metadata.robots && typeof metadata.robots === 'object' ? metadata.robots.index : undefined,
    false,
  );
  assert.equal(metadata.openGraph?.url, '/about');
  assert.equal(metadata.openGraph?.siteName, 'Mandyal Travels');
  assert.equal(
    metadata.twitter && 'card' in metadata.twitter ? metadata.twitter.card : undefined,
    'summary_large_image',
  );
});

test('absolute sitemap URLs remain on the canonical portal origin', () => {
  assert.equal(
    absolutePublicUrl('https://www.mandyaltravels.com', '/hotels/example'),
    'https://www.mandyaltravels.com/hotels/example',
  );
  assert.throws(
    () => absolutePublicUrl('https://www.mandyaltravels.com', '//attacker.example/path'),
    /PUBLIC_SITEMAP_PATH_INVALID/,
  );
});

test('homepage presents one consistent official company identity to crawlers', () => {
  const homepageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const structuredDataSource = readFileSync(
    new URL('../components/seo/OrganizationStructuredData.tsx', import.meta.url),
    'utf8',
  );

  assert.match(homepageSource, /Official website of Mandyal Travels/);
  assert.match(homepageSource, /A change of scenery\. A better way to stay\./);
  assert.match(structuredDataSource, /'@type': 'WebPage'/);
  assert.match(structuredDataSource, /mainEntity: \{ '@id': organizationId \}/);
  assert.match(structuredDataSource, /propertyID: 'CIN'/);
  assert.match(structuredDataSource, /U49221HP2026PTC012778/);
  assert.match(structuredDataSource, /sameAs: \[siteConfig\.socialLinks\.facebook\]/);
});
