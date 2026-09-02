import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizeProduct, publicProduct } from '../server/catalog.js';
import { filterOrders, normalizeOrder, summarizeOrders } from '../server/orders.js';
import { createStore } from '../server/store.js';

test('normalizeProduct maps WebSuite fields, stock toggle, and meny→menu', () => {
  const product = normalizeProduct({
    id: '1',
    title: 'Nigiri laks',
    price: '109,-',
    layout: 'meny',
    allergens: 'Fisk',
    extraOptions: [{ name: 'Ekstra wasabi', price: '10' }],
    extraTexts: ['Fersk daglig'],
    comparePrice: '129,-',
    contactInsteadOfPrice: false,
    soldOut: true,
    stockQty: 12,
  });
  assert.equal(product.name, 'Nigiri laks');
  assert.equal(product.productType, 'menu');
  assert.equal(product.soldOut, true);
  assert.equal(product.stockQty, 0);
  assert.equal(product.extraOptions[0].name, 'Ekstra wasabi');
  const published = publicProduct(product);
  assert.equal(published.soldOut, true);
  assert.equal(published.productType, 'menu');
});

test('existing thin products keep working without a stored product type', () => {
  const product = normalizeProduct({ id: '2', name: 'Old', price: 50, description: 'x' });
  assert.equal(product.productType, '');
  assert.equal(product.soldOut, false);
  assert.equal(product.stockQty, '');
  assert.deepEqual(product.included, []);
});

test('orders persist, reject incomplete rows, and never hard-delete', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'asoldi-cms-'));
  const store = createStore(root);
  const created = store.createOrder({
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    productId: 'p1',
    productName: 'Klipp',
    amount: 890,
    preset: 'service',
    bookingFrom: '2026-09-03T10:00:00.000Z',
    bookingTo: '2026-09-03T11:00:00.000Z',
    additionalServices: [{ name: 'Farge', checked: true }],
  });
  assert.equal(created.ok, true);
  assert.equal(store.getAllOrders().length, 1);
  const cancelled = store.updateOrder(created.order.id, { status: 'cancelled' });
  assert.equal(cancelled.order.status, 'cancelled');
  assert.equal(store.getAllOrders().length, 1);
  const missing = store.createOrder({ customerName: 'No product' });
  assert.equal(missing.ok, false);
  rmSync(root, { recursive: true, force: true });
});

test('order filters and stats cover name letter, email, amount, and range', () => {
  const now = Date.now();
  const orders = [
    normalizeOrder({
      id: 'a',
      customerName: 'Bjarne',
      customerEmail: 'bjarne@shop.no',
      productName: 'Kake',
      amount: 200,
      purchasedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    }),
    normalizeOrder({
      id: 'b',
      customerName: 'Ada',
      customerEmail: 'ada@shop.no',
      productName: 'Room',
      amount: 4000,
      preset: 'service',
      purchasedAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  ];
  const byLetter = filterOrders(orders, { letter: 'a' });
  assert.equal(byLetter.length, 1);
  assert.equal(byLetter[0].customerName, 'Ada');
  const byEmail = filterOrders(orders, { email: 'bjarne' });
  assert.equal(byEmail.length, 1);
  const byAmount = filterOrders(orders, { minAmount: 1000 });
  assert.equal(byAmount.length, 1);
  const week = filterOrders(orders, { range: 'week' });
  assert.equal(week.length, 1);
  const stats = summarizeOrders(week);
  assert.equal(stats.count, 1);
  assert.equal(stats.revenue, 200);
});
