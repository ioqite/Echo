#!/usr/bin/env node
// prepare-wrangler.js
// Reads ECHO_DB_ID from environment (or .dev.vars) and writes a ready-to-deploy
// wrangler.toml by replacing the database_id placeholder.
//
// Usage:
//   ECHO_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx node scripts/prepare-wrangler.js
//   # or
//   node scripts/prepare-wrangler.js   # reads from .dev.vars if present

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const TOML_PATH = path.join(root, 'wrangler.toml');
const DEV_VARS_PATH = path.join(root, '.dev.vars');

function readDevVars() {
  if (!existsSync(DEV_VARS_PATH)) return null;
  const text = readFileSync(DEV_VARS_PATH, 'utf8');
  // .dev.vars is a simple KEY=VALUE file
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*ECHO_DB_ID\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/);
    if (m) return m[1] || m[2] || m[3];
  }
  return null;
}

function main() {
  let dbId = process.env.ECHO_DB_ID || readDevVars();
  if (!dbId || dbId === 'REPLACE_WITH_YOUR_DATABASE_ID') {
    console.error('ERROR: ECHO_DB_ID is not set.');
    console.error('Set it via environment variable, or add ECHO_DB_ID=... to .dev.vars');
    process.exit(1);
  }

  let toml = readFileSync(TOML_PATH, 'utf8');
  const replaced = toml.replace(
    /database_id\s*=\s*"REPLACE_WITH_YOUR_DATABASE_ID"/,
    `database_id = "${dbId}"`
  );
  if (replaced === toml) {
    console.error('ERROR: Could not find database_id placeholder in wrangler.toml');
    process.exit(1);
  }
  writeFileSync(TOML_PATH, replaced);
  console.log(`[OK] wrangler.toml updated with database_id=${dbId.slice(0, 8)}...`);
}

main();
