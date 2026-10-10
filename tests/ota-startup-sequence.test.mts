import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';

const launcher = readFileSync('scripts/start-production.mjs', 'utf8');
const osEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE)$/i.test(
      key,
    ),
  ),
);
function rehearse(failure: string | undefined, standalone = false) {
  const directory = path.resolve('..', 'outputs', 'ota-startup-rehearsal', randomUUID());
  const trace = path.join(directory, 'trace.txt');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
  writeFileSync(trace, '');
  function save(relative: string, content: string) {
    const file = path.join(directory, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  save('scripts/start-production.mjs', launcher);
  const stages = [
    ['scripts/verify-release-env.mjs', 'preflight'],
    ['node_modules/prisma/build/index.js', 'migration'],
    ['scripts/verify-live-postgresql-schema.mjs', 'schema'],
    ['scripts/enforce-sole-platform-admin.mjs', 'administrator'],
    [standalone ? 'server.js' : 'node_modules/next/dist/bin/next', 'server'],
  ];
  for (const [relative, stage] of stages) {
    save(
      relative,
      `import {appendFileSync} from 'node:fs';
appendFileSync(process.env.REHEARSAL_TRACE, ${JSON.stringify(stage + '\n')});
${stage === 'migration' ? "if (process.argv.slice(2).join(' ') !== 'migrate deploy --config prisma.postgresql.config.ts') process.exit(99);" : ''}
${stage === 'server' && !standalone ? "if (process.argv[2] !== 'start') process.exit(99);" : ''}
process.exit(${stage === failure ? 17 : 0});`,
    );
  }
  const result = spawnSync(process.execPath, ['scripts/start-production.mjs'], {
    cwd: directory,
    env: {
      ...osEnvironment,
      NODE_ENV: 'production',
      PUBLIC_APP_ORIGIN: 'https://ota-rehearsal.example.invalid',
      REHEARSAL_TRACE: trace,
    },
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(result.error, undefined);
  return { status: result.status, trace: readFileSync(trace, 'utf8').trim().split('\n') };
}
for (const [index, stage] of ['preflight', 'migration', 'schema', 'administrator'].entries()) {
  test(`startup stops after failed ${stage} without running later stages`, () => {
    const result = rehearse(stage);
    assert.equal(result.status, 17);
    assert.deepEqual(
      result.trace,
      ['preflight', 'migration', 'schema', 'administrator'].slice(0, index + 1),
    );
  });
}
for (const standalone of [false, true]) {
  test(`startup reaches ${standalone ? 'standalone' : 'Next CLI'} server only after all gates pass`, () => {
    const result = rehearse(undefined, standalone);
    assert.equal(result.status, 0);
    assert.deepEqual(result.trace, ['preflight', 'migration', 'schema', 'administrator', 'server']);
  });
}
