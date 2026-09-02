import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStore } from '../server/store.js';
import { publicLead } from '../server/leads.js';

test('email lists and public-style upsert keep marketing accept true only', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'asoldi-leads-'));
  const store = createStore(root);
  const list = store.ensureDefaultList();
  assert.equal(list.slug, 'website-forms');
  const created = store.upsertLead({
    listId: list.id,
    name: 'Kari',
    email: 'kari@example.com',
    sms: '999',
    whatsapp: '999',
    language: 'nb',
    marketingAccept: false,
  });
  assert.equal(created.ok, true);
  assert.equal(publicLead(created.lead).marketingAccept, '');
  const accepted = store.upsertLead({
    listId: list.id,
    email: 'kari@example.com',
    marketingAccept: true,
  });
  assert.equal(accepted.lead.marketingAccept, true);
  assert.equal(publicLead(accepted.lead).marketingAccept, true);
  assert.equal(store.queryLeads({ listId: list.id, email: 'kari' }).length, 1);
  rmSync(root, { recursive: true, force: true });
});
