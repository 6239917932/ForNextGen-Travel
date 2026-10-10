import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('production process contract gates web startup and keeps jobs one shot', () => {
  const compose = read('compose.production-contract.yaml');

  assert.match(compose, /command: \['npm', 'run', 'db:deploy:postgresql'\]/);
  assert.match(compose, /condition: service_completed_successfully/);
  assert.match(compose, /notification-delivery:[\s\S]*profiles: \['scheduled-jobs'\]/);
  assert.match(compose, /notification-delivery:[\s\S]*target: worker/);
  assert.match(compose, /notification-delivery:[\s\S]*restart: 'no'/);
  assert.match(compose, /integration-outbox-delivery:[\s\S]*profiles: \['scheduled-jobs'\]/);
  assert.match(
    compose,
    /integration-outbox-delivery:[\s\S]*command: \['npm', 'run', 'worker:integration-outbox'\]/,
  );
  assert.match(compose, /integration-outbox-delivery:[\s\S]*restart: 'no'/);
  assert.match(compose, /safe-maintenance:[\s\S]*profiles: \['scheduled-jobs'\]/);
  assert.match(compose, /safe-maintenance:[\s\S]*command: \['npm', 'run', 'worker:maintenance'\]/);
  assert.match(compose, /safe-maintenance:[\s\S]*restart: 'no'/);
  assert.match(compose, /search-projection-maintenance:[\s\S]*profiles: \['scheduled-jobs'\]/);
  assert.match(
    compose,
    /search-projection-maintenance:[\s\S]*command: \['npm', 'run', 'worker:search-projections'\]/,
  );
  assert.match(compose, /search-projection-maintenance:[\s\S]*restart: 'no'/);
  assert.doesNotMatch(compose, /DATABASE_URL:\s*file:/);
});

test('production workloads are hardened and receive secrets only by reference', () => {
  const compose = read('compose.production-contract.yaml');

  assert.equal((compose.match(/cap_drop:/g) ?? []).length, 6);
  assert.equal((compose.match(/read_only: true/g) ?? []).length, 6);
  assert.equal((compose.match(/no-new-privileges:true/g) ?? []).length, 6);
  assert.match(compose, /DATABASE_URL: \$\{DATABASE_URL:\?/);
  assert.match(compose, /DIRECT_DATABASE_URL: \$\{DIRECT_DATABASE_URL:\?/);
  assert.match(compose, /RELEASE_SHA: \$\{RELEASE_SHA:\?/);
  assert.match(compose, /AUTOPILOT_WORKER_SECRET: \$\{AUTOPILOT_WORKER_SECRET:\?/);
  assert.match(
    compose,
    /INTEGRATION_OUTBOX_WORKER_SECRET: \$\{INTEGRATION_OUTBOX_WORKER_SECRET:\?/,
  );
  assert.doesNotMatch(compose, /(?:gho_|sk_live_|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i);
});

test('web image fails closed when no database URL is injected', () => {
  const dockerfile = read('Dockerfile');
  const startup = read('scripts/start-production.mjs');

  assert.doesNotMatch(dockerfile, /ENV\s+DATABASE_URL\s*=\s*file:/i);
  assert.match(dockerfile, /FROM operations AS worker/);
  assert.match(dockerfile, /CMD \["npm", "run", "worker:notifications"\]/);
  assert.match(dockerfile, /CMD \["node", "scripts\/start-production\.mjs"\]/);
  assert.match(startup, /db:deploy:postgresql/);
  assert.match(startup, /verify-live-postgresql-schema\.mjs/);
  assert.ok(
    startup.indexOf('db:deploy:postgresql') < startup.indexOf('verify-live-postgresql-schema.mjs'),
  );
  assert.match(startup, /existsSync\('server\.js'\)/);
  assert.match(
    startup,
    /standalone \? \['server\.js'\] : \['node_modules\/next\/dist\/bin\/next', 'start'\]/,
  );
  assert.match(startup, /DIRECT_DATABASE_URL = environment\.DATABASE_URL/);
});
