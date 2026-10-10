import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Fixed independent preview target. Never load dotenv or accept a database URL.
if ((await readdir(root)).some((name) => /^\.env(?:\.|$)/.test(name) && name !== '.env.example'))
  throw new Error('Run preview recovery without real environment files.');
const source = path.join(root, 'prisma', 'ota-preview-independent.db');
const run = path.join(root, '..', 'outputs', 'ota-preview-recovery', randomUUID());
const backup = path.join(run, 'snapshot.db');
const restored = path.join(run, 'restored.db');
const checksumPath = `${backup}.sha256`;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const verifyChecksum = (bytes, expected) => {
  if (!/^[a-f0-9]{64}$/.test(expected) || digest(bytes) !== expected)
    throw new Error('Checksum mismatch; restore refused.');
};
const quoteIdentifier = (name) => `"${name.replaceAll('"', '""')}"`;
function inspect(database) {
  assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
  assert.equal(database.pragma('foreign_key_check').length, 0);
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  const counts = Object.fromEntries(
    tables.map(({ name }) => [
      name,
      database.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(name)}`).get().count,
    ]),
  );
  for (const name of [
    'User',
    'Booking',
    'PaymentTransaction',
    'RefundRequest',
    '_prisma_migrations',
  ])
    assert.ok(Object.hasOwn(counts, name), `Missing required table: ${name}`);
  assert.ok(counts._prisma_migrations > 0, 'Preview must have applied migrations.');
  return counts;
}

await mkdir(run, { recursive: true });
const database = new Database(source, { readonly: true, fileMustExist: true });
let sourceCounts;
try {
  sourceCounts = inspect(database);
  await database.backup(backup);
  assert.deepEqual(
    inspect(database),
    sourceCounts,
    'Preview changed during backup; rerun when idle.',
  );
} finally {
  database.close();
}
const bytes = await readFile(backup);
const checksum = digest(bytes);
await writeFile(checksumPath, `${checksum}\n`, { flag: 'wx' });
const expected = (await readFile(checksumPath, 'utf8')).trim();
// Negative rehearsal: damaged bytes must be rejected before any restore write.
const damaged = Buffer.from(bytes);
damaged[0] ^= 1;
assert.throws(() => verifyChecksum(damaged, expected), /restore refused/);
verifyChecksum(bytes, expected);
await copyFile(backup, restored);
verifyChecksum(await readFile(restored), expected);
const restoredDatabase = new Database(restored, { fileMustExist: true });
try {
  assert.deepEqual(inspect(restoredDatabase), sourceCounts);
  // Exercise a write on the restored copy and roll it back; no source mutation.
  restoredDatabase.exec('BEGIN');
  try {
    restoredDatabase.exec('CREATE TABLE "_ota_recovery_probe" (value TEXT NOT NULL)');
    restoredDatabase
      .prepare('INSERT INTO "_ota_recovery_probe" VALUES (?)')
      .run('local-recovery-check');
    assert.equal(
      restoredDatabase.prepare('SELECT value FROM "_ota_recovery_probe"').get().value,
      'local-recovery-check',
    );
  } finally {
    restoredDatabase.exec('ROLLBACK');
  }
  assert.deepEqual(inspect(restoredDatabase), sourceCounts);
} finally {
  restoredDatabase.close();
}
verifyChecksum(await readFile(restored), expected);
const report = {
  checkedAt: new Date().toISOString(),
  scope: 'Independent local SQLite preview only; not production PostgreSQL recovery',
  passed: true,
  sourceOpenedReadOnly: true,
  checksum,
  corruptedBytesRejected: true,
  restoredWriteAndRollbackPassed: true,
  tableCount: Object.keys(sourceCounts).length,
  rowCounts: sourceCounts,
  productionRecoveryVerified: false,
  retainedFiles: ['snapshot.db', 'snapshot.db.sha256', 'restored.db'],
};
await writeFile(path.join(run, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  `Preview recovery passed: ${Object.keys(sourceCounts).length} tables; checksums, row counts, integrity, foreign keys and write rollback verified.`,
);
console.log(`Evidence retained: ${path.join(run, 'report.json')}`);
console.log(
  'Source database opened read-only. No live credentials, providers, retention deletion or production recovery claim.',
);
