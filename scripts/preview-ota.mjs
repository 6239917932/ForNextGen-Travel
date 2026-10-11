import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
const root = process.cwd();
const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(
        key,
      ),
    ),
  ),
  NODE_ENV: 'development',
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_URL: 'file:./prisma/ota-preview-independent.db',
  PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3049',
  FIXTURE_INVENTORY_ENABLED: 'true',
  // Ephemeral local-only token key enables sample booking; never written to disk.
  BOOKING_TOKEN_SECRET: randomBytes(32).toString('hex'),
  PAYMENT_GATEWAY_MODE: 'sandbox',
};
// Only OS process settings are inherited; provider and live database credentials are excluded.
if (fs.readdirSync(root).some((name) => /^\.env(?:\.|$)/.test(name) && name !== '.env.example'))
  throw Error('Remove environment files before running the isolated preview.');
const migration = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
  { cwd: root, env, stdio: 'inherit' },
);
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);
// Prepare preview route folders serially as well; the Windows filesystem can
// reject simultaneous mkdir calls for generated routes, including virtual 404s.
if (process.platform === 'win32') {
  const generatedRoot = path.join(root, '.next', 'dev');
  const targets = ['server/app', 'static/chunks/app', 'types/app'];
  const prepare = (relative) => {
    for (const target of targets)
      fs.mkdirSync(path.join(generatedRoot, target, relative), { recursive: true });
    for (const entry of fs.readdirSync(path.join(root, 'app', relative), { withFileTypes: true })) {
      if (entry.isDirectory()) prepare(path.join(relative, entry.name));
    }
  };
  prepare('');
  for (const target of targets)
    fs.mkdirSync(path.join(generatedRoot, target, '_not-found'), { recursive: true });
}
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3049',
  ],
  { cwd: root, env, stdio: 'inherit' },
);
server.on('exit', (code) => process.exit(code ?? 0));
