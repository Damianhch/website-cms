import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStore } from '../server/store.js';
import { isPostPublic, normalizePost } from '../server/blog.js';
import { verifyAnalyticsDns, publicAnalyticsSnippet } from '../server/analytics.js';
import { publicPayments } from '../server/payments.js';

test('blog posts schedule then become public without losing author', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'asoldi-blog-'));
  const store = createStore(root);
  const created = store.createPost(
    {
      title: 'Lunch special',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
      blocks: [{ type: 'text', text: 'Nigiri today' }],
    },
    { id: 'u1', username: 'writer' }
  );
  assert.equal(created.ok, true);
  assert.equal(created.post.authorName, 'writer');
  const listed = store.getAllPosts();
  assert.equal(listed[0].status, 'published');
  assert.equal(isPostPublic(listed[0]), true);
  rmSync(root, { recursive: true, force: true });
});

test('draft posts stay private', () => {
  const post = normalizePost({ id: '1', title: 'Hidden', status: 'draft', blocks: [] });
  assert.equal(isPostPublic(post), false);
});

test('analytics DNS verify uses the injected lookup', async () => {
  const settings = {
    domain: 'mongsushi.no',
    dnsTxtName: '_asoldi-analytics',
    dnsTxtValue: 'asoldi-site=abc',
    measurementId: 'G-TEST',
    verified: false,
  };
  const ok = await verifyAnalyticsDns(settings, async () => [['asoldi-site=abc']]);
  assert.equal(ok.verified, true);
  assert.equal(publicAnalyticsSnippet(ok).enabled, true);
  const missing = await verifyAnalyticsDns(settings, async () => [['other']]);
  assert.equal(missing.verified, false);
});

test('payments public payload stays disconnected without platform keys', () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_CONNECT_CLIENT_ID;
  const payload = publicPayments({
    stripe: { enabled: true, connected: false, accountId: '' },
    paypal: { enabled: false },
  });
  assert.equal(payload.stripe.platformReady, false);
  assert.match(payload.stripe.setupHint, /STRIPE_SECRET_KEY/);
  assert.equal(payload.paypal.platformReady, false);
});
