import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing.`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) failures.push(message);
}

const nextConfig = read('next.config.ts');
const dockerfile = read('Dockerfile');
const dockerignore = read('.dockerignore');
const compose = read('compose.portable-preview.yaml');
const productionCompose = read('compose.production-contract.yaml');
const deploymentGuide = read('docs/PORTABLE_DEPLOYMENT.md');
const productionDataGuide = read('docs/PRODUCTION_DATA_PLATFORM.md');
const productionRunbook = read('docs/PRODUCTION_RUNTIME_RUNBOOK.md');
const projectStatus = read('PROJECT_STATUS.md');
const postgresqlBaseline = read(
  'prisma/postgresql/migrations/00000000000000_baseline/migration.sql',
);
const schema = read('prisma/schema.prisma');
const packageJson = read('package.json');
const databaseRuntime = read('lib/database/runtime.ts');
const cutoverVerifier = read('scripts/rehearse-postgresql-cutover.mjs');
const releaseVerifier = read('scripts/verify-release-env.mjs');

for (const pattern of ['*.db*', '*.sqlite*', '*.pem', '*.key', '*.p12', '*.pfx']) {
  if (!dockerignore.split(/\r?\n/).some((line) => line.trim() === pattern))
    failures.push(
      `Container context must exclude database sidecars and private credentials: ${pattern}`,
    );
}

requireText(
  nextConfig,
  "process.env.NEXT_OUTPUT_MODE === 'standalone'",
  'Next.js must support the isolated standalone container output mode.',
);
requireText(
  dockerfile,
  'FROM node:22-bookworm-slim',
  'The container must use the approved Node 22 base.',
);
requireText(dockerfile, 'USER nextjs', 'The web container must run as a non-root user.');
requireText(dockerfile, 'HEALTHCHECK', 'The web container must define a readiness health check.');
requireText(
  dockerfile,
  'ENV NEXT_OUTPUT_MODE=standalone',
  'The container builder must enable standalone output.',
);
requireText(
  dockerfile,
  'CMD ["node", "scripts/start-production.mjs"]',
  'The web container must gate standalone startup on database migrations.',
);
requireText(
  dockerfile,
  'FROM operations AS worker',
  'The container must expose a release-matched scheduled worker target.',
);
if (/ENV\s+DATABASE_URL\s*=\s*file:/i.test(dockerfile)) {
  failures.push('The production-capable web image must not default to a SQLite database URL.');
}
requireText(dockerignore, '.env.*', 'Container context must exclude environment files.');
requireText(dockerignore, '*.db', 'Container context must exclude local database files.');
requireText(dockerignore, 'backups', 'Container context must exclude database backups.');
requireText(
  compose,
  'condition: service_completed_successfully',
  'Portable preview must complete migrations before starting the portal.',
);
requireText(
  productionCompose,
  "command: ['npm', 'run', 'db:deploy:postgresql']",
  'Production migrations must use the native PostgreSQL migration history.',
);
requireText(
  productionCompose,
  'condition: service_completed_successfully',
  'Production web startup must be gated on successful migrations.',
);
requireText(
  productionCompose,
  'target: worker',
  'Production runtime contract must include the release-matched worker image.',
);
requireText(
  productionCompose,
  "profiles: ['scheduled-jobs']",
  'The one-shot workers must remain scheduler-owned.',
);
requireText(
  productionCompose,
  "command: ['npm', 'run', 'worker:integration-outbox']",
  'Production must expose the authenticated integration-outbox worker.',
);
requireText(
  productionCompose,
  "restart: 'no'",
  'One-shot production workloads must not restart without scheduler policy.',
);
requireText(
  productionCompose,
  'read_only: true',
  'Production workloads must use a read-only root filesystem.',
);
requireText(
  productionCompose,
  'no-new-privileges:true',
  'Production workloads must prevent privilege escalation.',
);
requireText(
  productionCompose,
  'RELEASE_SHA:',
  'Production workloads must identify their immutable release.',
);
requireText(
  productionRunbook,
  'does not choose or enable either provider',
  'Runtime documentation must preserve the external payment-provider approval gate.',
);
requireText(
  productionRunbook,
  'Live deployment remains blocked',
  'Runtime documentation must state the external live-release blockers.',
);
requireText(compose, 'cap_drop:', 'Portable preview must drop Linux capabilities.');
requireText(
  compose,
  'no-new-privileges:true',
  'Portable preview must prevent privilege escalation.',
);
requireText(
  deploymentGuide,
  'not a production database architecture',
  'Deployment documentation must state that the SQLite preview is not production architecture.',
);
const postgresqlTableCount = (postgresqlBaseline.match(/^CREATE TABLE /gm) ?? []).length;
if (postgresqlTableCount === 0) {
  failures.push('The PostgreSQL baseline must contain at least one table.');
} else {
  const tableCountLabel = `${postgresqlTableCount}-table`;
  requireText(
    deploymentGuide,
    tableCountLabel,
    'Portable deployment documentation must report the current PostgreSQL table count.',
  );
  requireText(
    productionDataGuide,
    tableCountLabel,
    'Production data documentation must report the current PostgreSQL table count.',
  );
  requireText(
    projectStatus,
    tableCountLabel,
    'Project status must report the current PostgreSQL table count.',
  );
}
requireText(
  schema,
  'provider = "sqlite"',
  'The verifier must be updated when the Prisma provider changes.',
);
requireText(
  packageJson,
  '"@prisma/adapter-pg"',
  'Production dependencies must include the PostgreSQL driver adapter.',
);
requireText(
  databaseRuntime,
  'validatePostgreSqlRuntimeUrl',
  'The database runtime must validate PostgreSQL before constructing its client.',
);
requireText(
  cutoverVerifier,
  'compareDatabaseSnapshots',
  'The deployment contract must include deterministic cutover reconciliation.',
);
requireText(
  releaseVerifier,
  'validateProductionDatabaseContract',
  'Production preflight must verify the managed PostgreSQL contract.',
);
requireText(
  releaseVerifier,
  'INTEGRATION_OUTBOX_WORKER_SECRET',
  'Production preflight must require the integration worker identity.',
);
requireText(
  releaseVerifier,
  'INTEGRATION_OUTBOX_ALLOWED_HOSTS',
  'Production preflight must verify the approved integration provider boundary.',
);

if (/COPY\s+.*\.env/im.test(dockerfile)) {
  failures.push('Dockerfile must never copy an environment file explicitly.');
}

if (/gho_[a-z0-9]+|sk_live_[a-z0-9]+/i.test(`${dockerfile}\n${compose}\n${productionCompose}`)) {
  failures.push('Deployment files appear to contain a live credential.');
}

if (failures.length) {
  console.error('Deployment contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    'Deployment contract verified. Railway production startup, PostgreSQL, and portable workload controls are ready.',
  );
}
