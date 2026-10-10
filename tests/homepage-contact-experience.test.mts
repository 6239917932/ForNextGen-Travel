import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { siteConfig } from '../config/site.ts';

test('public contact details are centralized and complete', () => {
  assert.equal(siteConfig.legalName, 'Mandyal Travels Services Private Limited');
  assert.equal(siteConfig.supportEmail, 'support@mandyaltravels.com');
  assert.equal(siteConfig.supportPhone.href, '+918069377940');
  assert.equal(
    siteConfig.socialLinks.facebook,
    'https://www.facebook.com/profile.php?id=61594331641440',
  );
  assert.match(siteConfig.supportPhone.href, /^\+\d{10,15}$/);
  assert.equal(siteConfig.officeLocations.length, 2);
  assert.deepEqual(
    siteConfig.officeLocations.map((office) => office.locality),
    ['Bir, District Kangra', 'Village Suja, P.O. Matroo, Tehsil Joginder Nagar'],
  );
  assert.deepEqual(siteConfig.registeredOffice.lines, [
    'C/O Kewal Singh',
    'Village Suja, P.O. Matroo, Tehsil Joginder Nagar',
    'District Mandi, Himachal Pradesh 175032, India',
  ]);
});

test('homepage and footer direct customers to the centralized contact experience', async () => {
  const [home, footer] = await Promise.all([
    readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/layout/SiteFooter.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(home, /href="\/contact"/);
  assert.match(home, /Contact our team/);
  assert.match(footer, /tel:\$\{siteConfig\.supportPhone\.href\}/);
  assert.match(footer, /Contact us and office locations/);
  assert.match(footer, /siteConfig\.supportPhone\.display/);
  assert.match(footer, /siteConfig\.legalName/);
  assert.match(footer, /siteConfig\.registeredOffice\.lines/);
  assert.match(footer, /siteConfig\.socialLinks\.facebook/);
  assert.match(footer, /Follow us on Facebook/);
});

test('contact page offers a persisted, protected public message flow', async () => {
  const [contact, form, route] = await Promise.all([
    readFile(new URL('../app/contact/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/contact/ContactInquiryForm.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/v1/contact-inquiries/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(contact, /siteConfig\.officeLocations\.map/);
  assert.match(contact, /mailto:\$\{siteConfig\.supportEmail\}/);
  assert.match(contact, /Please call before planning an in-person visit/);
  assert.match(contact, /Registered business identity/);
  assert.match(contact, /never send card details, passwords, or one-time/);
  assert.match(contact, /<ContactInquiryForm/);
  assert.match(form, /<form/);
  assert.match(form, /fetch\('\/api\/v1\/contact-inquiries'/);
  assert.match(route, /isTrustedPortalMutation\(request, resolvePublicPortalOrigin\(\)\)/);
  assert.match(route, /from '@\/lib\/api\/portalOrigin'/);
  assert.match(route, /from '@\/lib\/url\/publicOrigin'/);
  assert.match(route, /PUBLIC_CONTACT_CREATE/);
  assert.match(route, /prisma\.contactInquiry\.create/);
  assert.doesNotMatch(contact, /<main\b/i);
});
