import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('empty Hotel and Car workspaces provide a direct inventory setup action', async () => {
  const page = await readFile(new URL('../app/partner/page.tsx', import.meta.url), 'utf8');

  assert.match(page, /No inventory has been added\./);
  assert.match(page, /href="\/partner\/properties">\s*Create the first property/);
  assert.match(page, /access\.partnerType === 'CAR'\) redirect\('\/partner\/fleet'\)/);
});

test('fleet mutations recover from network failures and retain stable form references', async () => {
  const manager = await readFile(
    new URL('../components/partner/PartnerFleetManager.tsx', import.meta.url),
    'utf8',
  );

  for (const message of [
    'The fleet service could not be reached.',
    'The fleet calendar service could not be reached.',
    'The maintenance service could not be reached.',
  ]) {
    assert.match(manager, new RegExp(message.replaceAll('.', '\\.')));
  }
  assert.match(manager, /const formElement = event\.currentTarget;/);
  assert.equal((manager.match(/finally \{\s*setBusy\(false\);/g) ?? []).length, 5);
  assert.doesNotMatch(manager, /event\.currentTarget\.reset\(\)/);
  assert.match(manager, /Customer visibility still requires approval and publication/);
  assert.doesNotMatch(manager, /restored to customer search/);
});
