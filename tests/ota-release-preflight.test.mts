import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('incomplete OTA release fails before migration, database connection or administrator provisioning', () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE)$/i.test(
        key,
      ),
    ),
  );
  const result = spawnSync(process.execPath, ['scripts/start-production.mjs'], {
    cwd: process.cwd(),
    env: {
      ...env,
      NODE_ENV: 'production',
      PUBLIC_APP_ORIGIN: 'https://ota-staging.example.invalid',
      FIXTURE_INVENTORY_ENABLED: 'false',
    },
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Release environment verification failed:/);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /Prisma schema loaded|Loaded Prisma config|SOLE_PLATFORM_ADMIN_DATABASE_REQUIRED/,
  );
});
