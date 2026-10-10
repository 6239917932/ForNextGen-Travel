import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const galleryImages = Array.from(
  { length: 16 },
  (_, index) => `bir-billing-${String(index + 1).padStart(2, '0')}.jpg`,
);

test('homepage moves every supplied Bir Billing photograph into the travel gallery', async () => {
  const gallery = await readFile(
    new URL('../components/home/HomeTravelGallery.tsx', import.meta.url),
    'utf8',
  );

  for (const image of galleryImages) {
    assert.match(gallery, new RegExp(image));
    assert.ok(
      (await stat(new URL(`../public/home/hero/${image}`, import.meta.url))).size > 0,
      `${image} must be a non-empty image asset`,
    );
  }

  assert.equal(gallery.match(/\['bir-billing-/g)?.length, galleryImages.length);
  assert.match(gallery, /Bir Billing paragliding/);
  assert.match(gallery, /From Billing&apos;s mountain launch site to Bir&apos;s landing fields/);
  assert.match(gallery, /window\.setInterval/);
  assert.match(gallery, /prefers-reduced-motion: reduce/);
  assert.match(gallery, /Pause automatic gallery/);
  assert.match(gallery, /Show next Bir Billing photograph/);
});

test('homepage hero provides a focused hotel-first booking widget', async () => {
  const [page, widget, styles, visualSystem] = await Promise.all([
    readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/home/HomeBookingWidget.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../styles/home.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/mandyal-visual-system.css', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /home-search-hero__image/);
  assert.match(page, /mandyal-travel-hero-v2\.png/);
  assert.match(page, /home-search-hero__shade/);
  assert.match(page, /<HomeBookingWidget \/>/);
  assert.match(page, /travel-story__image/);
  assert.match(page, /A change of scenery\. A better way to stay\./);
  assert.match(page, /Discover mountain stays, plan your days and keep every booking in one place/);
  assert.match(page, /className="home-search-hero__quick-links"/);
  assert.match(page, /Plan a hotel trip/);
  assert.match(page, /List your hotel/);
  assert.doesNotMatch(page, /supplier integrations are verified/);
  assert.doesNotMatch(page, /<HomeHeroSlider \/>/);
  assert.match(page, /Choose your travel journey/);

  assert.match(widget, /useState<BookingProduct>\('hotels'\)/);
  assert.match(widget, /role="tablist"/);
  assert.match(widget, /role="tabpanel"/);
  for (const route of ['/hotels', '/flights', '/buses', '/cars']) {
    assert.match(widget, new RegExp(`href: '${route}'`));
  }
  assert.match(widget, /Coming soon/);

  assert.match(styles, /\.home-search-hero\s*\{/);
  assert.match(styles, /\.home-booking-widget\s*\{/);
  assert.match(styles, /\.home-gallery__rail\s*\{[\s\S]*?overflow-x:\s*auto;/);
  assert.match(visualSystem, /body\s*\{[\s\S]*?zoom:\s*0\.9;/);
  assert.match(visualSystem, /\.home-search-hero__image\s*\{[\s\S]*?object-fit:\s*cover/);
  assert.match(visualSystem, /\.home-search-hero__shade\s*\{[\s\S]*?linear-gradient/);
  assert.match(visualSystem, /\.home-search-hero__quick-links\s*\{/);
  assert.match(visualSystem, /\.home-booking-widget__benefits\s*\{[\s\S]*?repeat\(4/);
});
