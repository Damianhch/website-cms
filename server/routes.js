import express from 'express';
import { createHmac } from 'crypto';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createStore } from './store.js';
import { resolveCmsDataPath } from './data-path.js';
import {
  DEFAULT_FEATURES,
  normalizeFeatures,
  publicCategory,
  publicProduct,
  resolveCatalogType,
} from './catalog.js';
import { filterOrders, summarizeOrders, rangeFromPreset } from './orders.js';
import { publicLead } from './leads.js';
import { isPostPublic, publicPost } from './blog.js';
import { canDeleteUsers, normalizeRank } from './ranks.js';
import { publicAnalyticsSnippet, verifyAnalyticsDns } from './analytics.js';
import { publicPayments } from './payments.js';

export { resolveCmsDataPath } from './data-path.js';
export { getAdminDistDir, mountCmsAdmin } from './admin-static.js';

const PACKAGE_VERSION = (() => {
  try {
    const packagePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return JSON.parse(readFileSync(packagePath, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

function fallbackConfig() {
  const devEcommerce = process.env.CMS_DEV_ECOMMERCE === '1';
  const publicUrl = String(process.env.CMS_PUBLIC_URL || '').trim();
  const domain = publicUrl.replace(/^https?:\/\//, '').split('/')[0];
  return {
    features: applyDevFlags({ ...DEFAULT_FEATURES }),
    name: 'Site',
    id: null,
    domain,
    ecommerceCatalogType: devEcommerce ? resolveCatalogType(process.env.CMS_DEV_CATALOG_TYPE || 'menu') : null,
    websitePlan: null,
    desiredCmsVersion: null,
    packageVersion: PACKAGE_VERSION,
  };
}

function applyDevFlags(features) {
  const next = { ...features };
  if (process.env.CMS_DEV_ECOMMERCE === '1') next.ecommerce = true;
  if (process.env.CMS_DEV_EMAIL === '1') next.emailMarketing = true;
  if (process.env.CMS_DEV_BLOG === '1') next.blog = true;
  if (process.env.CMS_DEV_ANALYTICS === '1') next.analytics = true;
  if (process.env.CMS_DEV_GENERAL === '1') next.general = true;
  return next;
}

function withPackageVersion(data) {
  return {
    ...fallbackConfig(),
    ...data,
    features: applyDevFlags(normalizeFeatures(data?.features || DEFAULT_FEATURES)),
    packageVersion: PACKAGE_VERSION,
  };
}

export default function createCmsRoutes({
  hubUrl,
  siteKey,
  dataPath,
  adminSecret = process.env.CMS_ADMIN_SECRET || process.env.ADMIN_SECRET || 'change-me',
} = {}) {
  const resolvedDataPath = resolveCmsDataPath({ dataPath, siteKey });
  const router = express.Router();
  const store = createStore(resolvedDataPath);

  const uploadsDir = resolve(resolvedDataPath, 'cms', 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${(file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_')}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  function signToken(payload) {
    const data = JSON.stringify(payload);
    const sig = createHmac('sha256', adminSecret).update(data).digest('hex');
    return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
  }

  function verifyToken(token) {
    try {
      const raw = JSON.parse(Buffer.from(token, 'base64url').toString());
      const expect = createHmac('sha256', adminSecret).update(raw.data).digest('hex');
      if (expect !== raw.sig) return null;
      return JSON.parse(raw.data);
    } catch {
      return null;
    }
  }

  async function ensureAdmin() {
    const admin = await store.getAdmin();
    if (admin) return;
    const username = process.env.CMS_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.CMS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'changeme';
    await store.setAdminCredentials(username, password);
  }

  function allow(...ranks) {
    return (req, res, next) => {
      const auth = req.headers.authorization;
      const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
      const payload = token ? verifyToken(token) : null;
      if (!payload) return res.status(401).json({ message: 'Unauthorized' });
      if (payload.role === 'admin') {
        req.actor = { role: 'admin', rank: 'admin', username: payload.username };
        req.admin = payload;
        return next();
      }
      if (payload.role === 'staff' || payload.role === 'employee') {
        const user = store.getUserById(payload.userId);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });
        const rank = normalizeRank(user.rank);
        req.actor = { role: 'staff', rank, userId: user.id, username: user.username, name: user.name };
        if (rank === 'admin' || ranks.includes(rank)) return next();
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.status(401).json({ message: 'Unauthorized' });
    };
  }

  const adminAuth = allow('employee');
  const blogAuth = allow('employee', 'writer');
  const anyAuth = allow('employee', 'writer', 'member');

  function attachCmsConfig(req, res, next) {
    fetchHubConfig()
      .then((config) => {
        req.cmsConfig = config;
        next();
      })
      .catch(next);
  }

  async function fetchHubConfig() {
    if (!siteKey || !hubUrl) return fallbackConfig();
    try {
      const base = hubUrl.replace(/\/$/, '');
      const r = await fetch(`${base}/api/hub/site-config?site_key=${encodeURIComponent(siteKey)}`);
      if (!r.ok) return fallbackConfig();
      const data = await r.json();
      const config = withPackageVersion(data);
      if (data?.pendingAdmin?.passwordHash) {
        store.applyAdminHash(data.pendingAdmin.username, data.pendingAdmin.passwordHash);
        config.adminSynced = true;
      }
      return config;
    } catch {
      return fallbackConfig();
    }
  }

  function sendHeartbeat(req, config) {
    if (!siteKey || !hubUrl) return;
    const base = hubUrl.replace(/\/$/, '');
    const host = req.get('host') || '';
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim() || 'https';
    const adminUrl = process.env.CMS_PUBLIC_URL
      ? `${process.env.CMS_PUBLIC_URL.replace(/\/$/, '')}/admin`
      : host
        ? `${proto}://${host}/admin`
        : '';
    fetch(`${base}/api/hub/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_key: siteKey,
        packageVersion: PACKAGE_VERSION,
        adminUrl,
        name: config?.name || '',
        adminApplied: config?.adminSynced === true,
      }),
    }).catch(() => {});
  }

  ensureAdmin();

  router.get('/config', async (req, res) => {
    const config = await fetchHubConfig();
    sendHeartbeat(req, config);
    res.json(config);
  });

  router.get('/catalog', async (req, res) => {
    const config = await fetchHubConfig();
    if (!config.features.ecommerce) {
      return res.status(404).json({ message: 'Ecommerce is not enabled' });
    }
    const catalogType = resolveCatalogType(config.ecommerceCatalogType);
    res.json({
      catalogType,
      name: config.name,
      categories: store.getAllCategories().map(publicCategory),
      products: store.getAllProducts().map(publicProduct),
    });
  });

  router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    const valid = await store.verifyAdmin(username, password);
    if (valid) {
      const token = signToken({ role: 'admin', username, rank: 'admin', at: Date.now() });
      return res.json({ token, rank: 'admin', username, name: username });
    }
    const staff = await store.verifyEmployee(username, password);
    if (!staff.ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const rank = normalizeRank(staff.user.rank);
    const token = signToken({ role: 'staff', userId: staff.user.id, username: staff.user.username, rank, at: Date.now() });
    return res.json({ token, rank, username: staff.user.username, name: staff.user.name || staff.user.username });
  });

  router.get('/admin/me', anyAuth, (req, res) => {
    res.json({
      username: req.actor.username,
      rank: req.actor.rank,
      role: req.actor.role,
      name: req.actor.name || req.actor.username,
    });
  });

  router.get('/admin/users', adminAuth, (_req, res) => {
    res.json(store.getPublicUsers());
  });

  router.post('/admin/users', adminAuth, async (req, res) => {
    const { username, password, rank, name, email, avatarUrl } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    const result = await store.createUser(username, password, { rank, name, email, avatarUrl });
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }
    res.status(201).json(result.user);
  });

  router.put('/admin/users/:id', adminAuth, async (req, res) => {
    const result = await store.updateUser(req.params.id, req.body || {});
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.json(result.user || { ok: true });
  });

  router.delete('/admin/users/:id', adminAuth, async (req, res) => {
    if (!canDeleteUsers(req.actor?.rank)) {
      return res.status(403).json({ message: 'Employees cannot delete users' });
    }
    const result = await store.deleteUser(req.params.id);
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json({ ok: true });
  });

  router.post('/admin/change-password', anyAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }
    if (req.actor.rank === 'admin') {
      const valid = await store.verifyAdmin(req.actor.username, currentPassword);
      if (!valid) return res.status(401).json({ message: 'Current password is wrong' });
      const admin = await store.getAdmin();
      if (!admin) return res.status(500).json({ message: 'Admin not found' });
      await store.setAdminCredentials(admin.username, newPassword);
      return res.json({ ok: true });
    }
    const user = store.getUserById(req.actor.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const valid = await store.verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Current password is wrong' });
    await store.updateUserPassword(user.id, newPassword);
    res.json({ ok: true });
  });

  router.post('/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    const result = await store.verifyEmployee(username, password);
    if (!result.ok) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const token = signToken({ role: 'employee', userId: result.user.id, at: Date.now() });
    res.json({ token, user: result.user });
  });

  router.use('/uploads', express.static(uploadsDir));

  router.post('/upload', blogAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = `${req.baseUrl}/uploads/${req.file.filename}`;
    res.json({ url });
  });

  router.get('/categories', adminAuth, (_req, res) => {
    res.json(store.getAllCategories());
  });

  router.post('/categories', adminAuth, (req, res) => {
    const result = store.createCategory(req.body || {});
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(201).json(result.category);
  });

  router.put('/categories/:id', adminAuth, (req, res) => {
    const result = store.updateCategory(req.params.id, req.body || {});
    if (!result.ok) return res.status(result.error === 'Category not found' ? 404 : 400).json({ message: result.error });
    res.json(result.category);
  });

  router.delete('/categories/:id', adminAuth, (req, res) => {
    const result = store.deleteCategory(req.params.id);
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json({ ok: true });
  });

  router.get('/products', adminAuth, attachCmsConfig, (_req, res) => {
    res.json(store.getAllProducts());
  });

  router.post('/products', adminAuth, attachCmsConfig, async (req, res) => {
    const config = req.cmsConfig || (await fetchHubConfig());
    const result = store.createProduct({
      ...(req.body || {}),
      defaultProductType: resolveCatalogType(config.ecommerceCatalogType),
      productType: req.body?.productType || resolveCatalogType(config.ecommerceCatalogType),
    });
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(201).json(result.product);
  });

  router.put('/products/:id', adminAuth, attachCmsConfig, (req, res) => {
    const result = store.updateProduct(req.params.id, req.body || {});
    if (!result.ok) return res.status(result.error === 'Product not found' ? 404 : 400).json({ message: result.error });
    res.json(result.product);
  });

  router.delete('/products/:id', adminAuth, attachCmsConfig, (req, res) => {
    const result = store.deleteProduct(req.params.id);
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json({ ok: true });
  });

  router.get('/settings', adminAuth, attachCmsConfig, async (req, res) => {
    const catalogType = resolveCatalogType(req.cmsConfig?.ecommerceCatalogType);
    const fallbackPreset = catalogType === 'tiers' ? 'service' : 'normal';
    res.json(store.getSettings(fallbackPreset));
  });

  router.put('/settings', adminAuth, attachCmsConfig, async (req, res) => {
    const catalogType = resolveCatalogType(req.cmsConfig?.ecommerceCatalogType);
    const fallbackPreset = catalogType === 'tiers' ? 'service' : 'normal';
    res.json(store.writeSettings(req.body || {}, fallbackPreset));
  });

  router.get('/orders', adminAuth, attachCmsConfig, (req, res) => {
    const filtered = filterOrders(store.getAllOrders(), req.query || {});
    res.json(filtered);
  });

  router.get('/orders/stats', adminAuth, attachCmsConfig, (req, res) => {
    const query = req.query || {};
    const rangeQuery = { ...query, range: query.range || 'month' };
    const filtered = filterOrders(store.getAllOrders(), rangeQuery);
    const window = rangeFromPreset(rangeQuery.range, rangeQuery.from, rangeQuery.to);
    res.json({
      ...summarizeOrders(filtered),
      range: rangeQuery.range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
    });
  });

  router.post('/orders', adminAuth, attachCmsConfig, (req, res) => {
    const result = store.createOrder(req.body || {});
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(201).json(result.order);
  });

  router.put('/orders/:id', adminAuth, attachCmsConfig, (req, res) => {
    const result = store.updateOrder(req.params.id, req.body || {});
    if (!result.ok) return res.status(result.error === 'Order not found' ? 404 : 400).json({ message: result.error });
    res.json(result.order);
  });

  router.options('/leads', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.status(204).end();
  });

  router.post('/leads', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const body = req.body || {};
    const list =
      store.getListById(body.listId) ||
      store.getListBySlug(body.listSlug || body.list || body.source) ||
      store.ensureDefaultList();
    const result = store.upsertLead({
      ...body,
      listId: list.id,
      source: body.source || body.listSlug || list.slug,
    });
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(result.created ? 201 : 200).json({ ok: true, id: result.lead.id, listId: list.id, listSlug: list.slug });
  });

  router.get('/lists', adminAuth, (_req, res) => {
    store.ensureDefaultList();
    const lists = store.getAllLists().map((list) => ({
      ...list,
      count: store.queryLeads({ listId: list.id }).length,
    }));
    res.json(lists);
  });

  router.post('/lists', adminAuth, (req, res) => {
    const result = store.createList(req.body || {});
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(201).json(result.list);
  });

  router.get('/leads', adminAuth, (req, res) => {
    res.json(store.queryLeads(req.query || {}).map(publicLead));
  });

  router.get('/posts', async (req, res) => {
    const config = await fetchHubConfig();
    if (!config.features.blog) {
      return res.status(404).json({ message: 'Blog is not enabled' });
    }
    const posts = store.getAllPosts().filter((post) => isPostPublic(post)).map(publicPost);
    res.json(posts);
  });

  router.get('/posts/:slug', async (req, res) => {
    const config = await fetchHubConfig();
    if (!config.features.blog) {
      return res.status(404).json({ message: 'Blog is not enabled' });
    }
    const post = store.getPostBySlug(req.params.slug);
    if (!post || !isPostPublic(post)) return res.status(404).json({ message: 'Post not found' });
    res.json(publicPost(post));
  });

  router.get('/admin/posts', blogAuth, (_req, res) => {
    res.json(store.getAllPosts());
  });

  router.post('/admin/posts', blogAuth, (req, res) => {
    const result = store.createPost(req.body || {}, req.actor);
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(201).json(result.post);
  });

  router.put('/admin/posts/:id', blogAuth, (req, res) => {
    const result = store.updatePost(req.params.id, req.body || {}, req.actor);
    if (!result.ok) return res.status(result.error === 'Post not found' ? 404 : 400).json({ message: result.error });
    res.json(result.post);
  });

  router.delete('/admin/posts/:id', blogAuth, (req, res) => {
    const result = store.deletePost(req.params.id);
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json({ ok: true });
  });

  router.get('/analytics', adminAuth, async (req, res) => {
    const config = req.cmsConfig || (await fetchHubConfig());
    const settings = store.getAnalytics({
      domain: config.domain || '',
      measurementId: process.env.GA4_MEASUREMENT_ID || '',
      propertyId: process.env.GA4_PROPERTY_ID || '',
    });
    res.json({
      ...settings,
      snippet: publicAnalyticsSnippet(settings),
      dnsRecord: `${settings.dnsTxtName}.${settings.domain || '<domain>'} TXT ${settings.dnsTxtValue}`,
    });
  });

  router.put('/analytics', adminAuth, attachCmsConfig, async (req, res) => {
    const config = req.cmsConfig || (await fetchHubConfig());
    const settings = store.writeAnalytics(req.body || {}, {
      domain: req.body?.domain || config.domain || '',
    });
    res.json(settings);
  });

  router.post('/analytics/verify', adminAuth, attachCmsConfig, async (req, res) => {
    const config = req.cmsConfig || (await fetchHubConfig());
    const current = store.getAnalytics({ domain: config.domain || '' });
    const verified = await verifyAnalyticsDns(current);
    store.writeAnalytics(verified);
    res.json(verified);
  });

  router.get('/analytics/public', async (_req, res) => {
    const settings = store.getAnalytics();
    res.json(publicAnalyticsSnippet(settings));
  });

  router.get('/payments', adminAuth, (_req, res) => {
    res.json(publicPayments(store.getPayments()));
  });

  router.put('/payments', adminAuth, (req, res) => {
    const next = store.writePayments(req.body || {});
    res.json(publicPayments(next));
  });

  return router;
}
