import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyCmsData, resolveCmsDataPath, sanitizeDataKey } from '../server/data-path.js';

test('sanitizeDataKey strips unsafe path segments', () => {
  assert.equal(sanitizeDataKey('../etc/passwd'), 'etc-passwd');
  assert.equal(sanitizeDataKey('23e7717918f184f00bcc37ab3508995e'), '23e7717918f184f00bcc37ab3508995e');
  assert.equal(sanitizeDataKey(''), 'default');
});

test('migrateLegacyCmsData copies ./data/cms once into the dest folder', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cms-legacy-'));
  const dest = mkdtempSync(join(tmpdir(), 'cms-dest-'));
  mkdirSync(join(cwd, 'data', 'cms'), { recursive: true });
  writeFileSync(join(cwd, 'data', 'cms', 'users.json'), JSON.stringify([{ id: 'u1' }]), 'utf8');

  const first = migrateLegacyCmsData(dest, { cwd });
  assert.equal(first.migrated, true);
  assert.deepEqual(JSON.parse(readFileSync(join(dest, 'cms', 'users.json'), 'utf8')), [{ id: 'u1' }]);

  writeFileSync(join(cwd, 'data', 'cms', 'users.json'), JSON.stringify([{ id: 'u2' }]), 'utf8');
  const second = migrateLegacyCmsData(dest, { cwd });
  assert.equal(second.migrated, false);
  assert.equal(second.reason, 'dest-exists');
  assert.deepEqual(JSON.parse(readFileSync(join(dest, 'cms', 'users.json'), 'utf8')), [{ id: 'u1' }]);

  rmSync(cwd, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('resolveCmsDataPath prefers CMS_DATA_PATH then homedir per site key', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cms-resolve-'));
  const explicit = join(cwd, 'custom-data');
  const prev = process.env.CMS_DATA_PATH;
  process.env.CMS_DATA_PATH = explicit;
  try {
    const resolved = resolveCmsDataPath({ siteKey: 'abc', cwd });
    assert.equal(resolved, explicit);
  } finally {
    if (prev === undefined) delete process.env.CMS_DATA_PATH;
    else process.env.CMS_DATA_PATH = prev;
  }

  const homePath = resolveCmsDataPath({ siteKey: 'site-key-1', cwd });
  assert.equal(homePath, join(homedir(), '.asoldi-cms-data', 'site-key-1'));
  rmSync(cwd, { recursive: true, force: true });
});
