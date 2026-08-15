import express from 'express';
import { createHmac } from 'crypto';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createStore } from './store.js';
import {
  DEFAULT_FEATURES,
  normalizeFeatures,
  publicCategory,
  publicProduct,
  resolveCatalogType,
} from './catalog.js';

const PACKAGE_VERSION = (() => {
  try {
    const packagePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return JSON.parse(readFileSync(packagePath, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

function fallbackConfig() {
  return {
    features: { ...DEFAULT_FEATURES },
    name: 'Site',
    id: null,
    ecommerceCatalogType: null,
    websitePlan: null,
    desiredCmsVersion: null,
    packageVersion: PACKAGE_VERSION,
  };
}

function withPackageVersion(data) {
  return {
    ...fallbackConfig(),
    ...data,
    features: normalizeFeatures(data?.features || DEFAULT_FEATURES),
    packageVersion: PACKAGE_VERSION,
  };
}

export default function createCmsRoutes({
  hubUrl,
  siteKey,
  dataPath = './data',
  adminSecret = process.env.CMS_ADMIN_SECRET || process.env.ADMIN_SECRET || 'change-me',
} = {}) {
  const router = express.Router();
  const store = createStore(dataPath);

  const uploadsDir = resolve(dataPath, 'cms', 'uploads');
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

  function adminAuth(req, res, next) {
    const auth = req.headers.authorization;
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const payload = token ? verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.admin = payload;
    next();
  }

  async function fetchHubConfig() {
    if (!siteKey || !hubUrl) return fallbackConfig();
    try {
      const base = hubUrl.replace(/\/$/, '');
      const r = await fetch(`${base}/api/hub/site-config?site_key=${encodeURIComponent(siteKey)}`);
      if (!r.ok) return fallbackConfig();
      const data = await r.json();
      return withPackageVersion(data);
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
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = signToken({ role: 'admin', username, at: Date.now() });
    res.json({ token });
  });

  router.get('/admin/users', adminAuth, async (req, res) => {
    const users = store.getAllUsers();
    res.json(users.map(({ id, username, createdAt }) => ({ id, username, createdAt })));
  });

  router.post('/admin/users', adminAuth, async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    const result = await store.createUser(username, password);
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }
    res.status(201).json(result.user);
  });

  router.put('/admin/users/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body || {};
    if (username !== undefined) {
      const result = await store.updateUserUsername(id, username);
      if (!result.ok) return res.status(400).json({ message: result.error });
    }
    if (password !== undefined && password !== '') {
      const result = await store.updateUserPassword(id, password);
      if (!result.ok) return res.status(400).json({ message: result.error });
    }
    res.json({ ok: true });
  });

  router.delete('/admin/users/:id', adminAuth, async (req, res) => {
    const result = await store.deleteUser(req.params.id);
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json({ ok: true });
  });

  router.post('/admin/change-password', adminAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }
    const valid = await store.verifyAdmin(req.admin.username, currentPassword);
    if (!valid) return res.status(401).json({ message: 'Current password is wrong' });
    const admin = await store.getAdmin();
    if (!admin) return res.status(500).json({ message: 'Admin not found' });
    await store.setAdminCredentials(admin.username, newPassword);
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

  router.post('/upload', adminAuth, upload.single('file'), (req, res) => {
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

  router.get('/products', adminAuth, (_req, res) => {
    res.json(store.getAllProducts());
  });

  router.post('/products', adminAuth, (req, res) => {
    const result = store.createProduct(req.body || {});
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(201).json(result.product);
  });

  router.put('/products/:id', adminAuth, (req, res) => {
    const result = store.updateProduct(req.params.id, req.body || {});
    if (!result.ok) return res.status(result.error === 'Product not found' ? 404 : 400).json({ message: result.error });
    res.json(result.product);
  });

  router.delete('/products/:id', adminAuth, (req, res) => {
    const result = store.deleteProduct(req.params.id);
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json({ ok: true });
  });

  return router;
}
