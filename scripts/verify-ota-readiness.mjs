import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '..', 'outputs', 'ota-offline-readiness');
// Some existing tools load dotenv themselves. Refuse real environment files so
// offline checks cannot pick up deployment credentials through that path.
if (fs.readdirSync(root).some((name) => /^\.env(?:\.|$)/.test(name) && name !== '.env.example')) {
  throw new Error('Run offline readiness in a checkout without real environment files.');
}
// Do not inherit database, supplier, payment or account credentials.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(
      key,
    ),
  ),
);
const checks = [
  [
    'domain',
    [
      '--experimental-strip-types',
      '--test',
      ...fs
        .readdirSync(path.join(root, 'tests'))
        .filter((name) => name.endsWith('.test.mts'))
        .sort()
        .map((name) => `tests/${name}`),
    ],
  ],
  ['static-links', ['scripts/verify-static-internal-routes.mjs']],
  ['api-contract', ['--experimental-strip-types', 'scripts/verify-api-v1-contract.mjs']],
  ['migrations', ['scripts/verify-migrations.mjs']],
  ['postgresql-contract', ['scripts/sync-postgresql-contract.mjs', '--check']],
  ['deployment-contract', ['scripts/verify-deployment-contract.mjs']],
  ['launch-register', ['--experimental-strip-types', 'scripts/verify-launch-readiness.mjs']],
];

fs.mkdirSync(output, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  scope: 'Offline source checks and temporary sample migration database only',
  productionReady: false,
  productionVerification: 'NOT_RUN',
  blockersDocument: 'docs/OTA_RELEASE_STATUS_2026-10-10.txt',
  checks: [],
};
for (const [name, args] of checks) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const passed = result.status === 0 && !result.error;
  fs.writeFileSync(
    path.join(output, `${name}.log`),
    `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}\n` : ''}`,
  );
  report.checks.push({
    name,
    passed,
    exitCode: result.status,
    durationMs: Date.now() - started,
    log: `${name}.log`,
  });
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`);
}
report.localChecksPassed = report.checks.every((check) => check.passed);
fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Evidence: ${path.join(output, 'report.json')}`);
console.log('Production readiness is not established by these offline checks.');
if (!report.localChecksPassed) process.exitCode = 1;
