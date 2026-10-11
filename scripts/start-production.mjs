import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const environment = { ...process.env };

if (!environment.PUBLIC_APP_ORIGIN) {
  const publicHostname = environment.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (!publicHostname) {
    console.error('PUBLIC_APP_ORIGIN or RAILWAY_PUBLIC_DOMAIN is required.');
    process.exit(1);
  }
  environment.PUBLIC_APP_ORIGIN = `https://${publicHostname}`;
}

if (!environment.DIRECT_DATABASE_URL && environment.DATABASE_URL) {
  environment.DIRECT_DATABASE_URL = environment.DATABASE_URL;
}

// Reject an incomplete release before touching a database or provisioning users.
const preflight = spawnSync(process.execPath, ['scripts/verify-release-env.mjs'], {
  env: environment,
  stdio: 'inherit',
});
if (preflight.error) {
  console.error('Unable to verify the release environment.', preflight.error);
  process.exit(1);
}
if (preflight.status !== 0) process.exit(preflight.status ?? 1);

// Same CLI as db:deploy:postgresql, without Windows .cmd shell execution.
const migration = spawnSync(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--config',
    'prisma.postgresql.config.ts',
  ],
  {
    env: environment,
    stdio: 'inherit',
  },
);

if (migration.error) {
  console.error('Unable to start the PostgreSQL migration process.', migration.error);
  process.exit(1);
}
if (migration.status !== 0) process.exit(migration.status ?? 1);

const schemaVerification = spawnSync(
  process.execPath,
  ['scripts/verify-live-postgresql-schema.mjs'],
  {
    env: environment,
    stdio: 'inherit',
  },
);
if (schemaVerification.error) {
  console.error('Unable to start PostgreSQL schema verification.', schemaVerification.error);
  process.exit(1);
}
if (schemaVerification.status !== 0) process.exit(schemaVerification.status ?? 1);

const administratorProvisioning = spawnSync(
  process.execPath,
  ['scripts/enforce-sole-platform-admin.mjs'],
  {
    env: environment,
    stdio: 'inherit',
  },
);
if (administratorProvisioning.error) {
  console.error(
    'Unable to verify the sole platform administrator.',
    administratorProvisioning.error,
  );
  process.exit(1);
}
if (administratorProvisioning.status !== 0) {
  process.exit(administratorProvisioning.status ?? 1);
}

const standalone = existsSync('server.js');
const portal = spawn(
  process.execPath,
  standalone ? ['server.js'] : ['node_modules/next/dist/bin/next', 'start'],
  {
    env: environment,
    stdio: 'inherit',
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => portal.kill(signal));
}

portal.on('error', (error) => {
  console.error('Unable to start the portal process.', error);
  process.exit(1);
});
portal.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
