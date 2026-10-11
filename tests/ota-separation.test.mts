import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { isRemovedPmsApiPath } from '../lib/ota/removedApiRoutes.ts';
const root = process.cwd();
const exists = (p: string) => fs.existsSync(path.join(root, p));
test('removed API matcher excludes operational actions without blocking OTA booking exports', () => {
  for (const p of [
    '/api/v1/partner/direct-bookings',
    '/api/v1/partner/bookings/ABC/folio-entries',
    '/api/v1/partner/properties/P/rooms/R/physical-rooms',
    '/api/v1/guest/orders',
    '/api/v1/partner/channels',
  ])
    assert.equal(isRemovedPmsApiPath(p), true, p);
  for (const p of [
    '/api/v1/partner/bookings',
    '/api/v1/partner/bookings/export',
    '/api/v1/partner/inventory',
    '/api/v1/partner/properties',
    '/api/v1/partner/channels-extra',
  ])
    assert.equal(isRemovedPmsApiPath(p), false, p);
});
test('PMS screens and operational mutation endpoints are absent', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'lib/ota/extraction.json'), 'utf8'));
  for (const directory of manifest.excluded) assert.equal(exists(directory), false, directory);
  for (const directory of [
    'app/partner/channels',
    'app/api/v1/partner/channels',
    'app/api/v1/partner/booking-addons',
  ])
    assert.equal(exists(directory), false, directory);
});
test('OTA booking, payment, supply and customer routes remain', () => {
  for (const directory of [
    'app',
    'app/hotels',
    'app/partner/properties',
    'app/partner/inventory',
    'app/partner/bookings',
    'app/manage-booking',
    'app/api/v1/partner/bookings',
  ])
    assert.equal(exists(directory), true, directory);
  const routes = fs.readdirSync(path.join(root, 'app/api/v1'));
  assert.ok(routes.length > 0);
});
test('supplier navigation and public pricing contain no PMS offer', () => {
  const layout = fs.readFileSync(path.join(root, 'app/partner/layout.tsx'), 'utf8');
  assert.ok(!layout.includes('/partner/pms'));
  assert.ok(!layout.includes('/partner/housekeeping'));
  const pricing = fs.readFileSync(path.join(root, 'app/pricing/page.tsx'), 'utf8');
  assert.ok(!pricing.includes('PMS'));
  const session = fs.readFileSync(path.join(root, 'lib/auth/session.ts'), 'utf8');
  assert.ok(session.includes('fornextgen_travel_session'));
});
