import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// This rehearsal is confined to the disposable PostgreSQL GitHub job service.
const container = process.env.OTA_CI_POSTGRES_CONTAINER ?? '';
const expectedUrl =
  'postgresql://postgres:postgres@127.0.0.1:5432/mandyal_ci?schema=public&sslmode=disable';
assert.ok(
  process.env.GITHUB_ACTIONS === 'true' &&
    process.env.CI === 'true' &&
    /^[a-f0-9]{64}$/.test(container) &&
    process.env.DATABASE_URL === expectedUrl &&
    process.env.DIRECT_DATABASE_URL === expectedUrl,
  'Recovery rehearsal requires the isolated GitHub PostgreSQL service',
);

function docker(args, input) {
  const result = spawnSync('docker', ['exec', '-i', container, ...args], {
    input,
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `CI PostgreSQL command failed: ${result.error?.message ?? result.stderr.toString()}`,
    );
  }
  return result.stdout;
}

function sql(database, query) {
  return docker([
    'psql',
    '-X',
    '--username=postgres',
    `--dbname=${database}`,
    '--set=ON_ERROR_STOP=1',
    '--tuples-only',
    '--no-align',
    '--command',
    query,
  ])
    .toString()
    .trim();
}

sql(
  'mandyal_ci',
  `CREATE SCHEMA ota_recovery_probe;
  CREATE TABLE ota_recovery_probe.records (id integer PRIMARY KEY, amount numeric(12,2), note text);
  INSERT INTO ota_recovery_probe.records VALUES
    (1, 1234.56, 'Synthetic OTA recovery fixture'), (2, 0.01, 'Unicode recovery: हिमाचल');`,
);

const dump = docker(['pg_dump', '--username=postgres', '--dbname=mandyal_ci', '--format=custom']);
const checksum = createHash('sha256').update(dump).digest('hex');
// createdb refuses an existing target; never overwrite or drop a database.
docker(['createdb', '--username=postgres', 'mandyal_restore_ci']);
docker(
  [
    'pg_restore',
    '--username=postgres',
    '--dbname=mandyal_restore_ci',
    '--exit-on-error',
    '--single-transaction',
  ],
  dump,
);

const schemaQuery = `SELECT COALESCE(json_agg(row_to_json(c) ORDER BY table_schema, table_name, ordinal_position), '[]')
  FROM (SELECT table_schema, table_name, column_name, ordinal_position, data_type,
    is_nullable, column_default FROM information_schema.columns
    WHERE table_schema IN ('public', 'ota_recovery_probe')) c`;
assert.equal(sql('mandyal_restore_ci', schemaQuery), sql('mandyal_ci', schemaQuery));
const tables = JSON.parse(
  sql(
    'mandyal_ci',
    `SELECT json_agg(tablename ORDER BY tablename)
  FROM pg_tables WHERE schemaname='public'`,
  ),
);
const rowCounts = {};
for (const table of tables) {
  const identifier = '"' + table.replaceAll('"', '""') + '"';
  const query = `SELECT COUNT(*) FROM public.${identifier}`;
  const source = sql('mandyal_ci', query);
  assert.equal(sql('mandyal_restore_ci', query), source, `Restored row count: ${table}`);
  rowCounts[table] = Number(source);
}
for (const query of [
  'SELECT json_agg(r ORDER BY id) FROM ota_recovery_probe.records r',
  'SELECT json_agg(r ORDER BY id) FROM public."_prisma_migrations" r',
]) {
  assert.equal(sql('mandyal_restore_ci', query), sql('mandyal_ci', query));
}
assert.equal(createHash('sha256').update(dump).digest('hex'), checksum);
await mkdir('.gh-task-cache', { recursive: true });
await writeFile(
  '.gh-task-cache/postgresql-recovery.json',
  JSON.stringify(
    {
      passed: true,
      scope: 'disposable CI service; synthetic data only',
      backupSha256: checksum,
      backupBytes: dump.length,
      publicTables: tables.length,
      rowCounts,
      schemaMatched: true,
      migrationHistoryMatched: true,
      syntheticRowsMatched: true,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `PostgreSQL backup/restore passed for ${tables.length} public tables and synthetic recovery rows.`,
);
