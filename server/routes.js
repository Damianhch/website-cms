import express from 'express';
import { createHmac } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import multer from 'multer';
import { createStore } from './store.js';

export default function createCmsRoutes({ hubUrl, siteKey, dataPath = './data', adminSecret = process.env.CMS_ADMIN_SECRET || process.env.ADMIN_SECRET || 'change-me' }) {
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

  ensureAdmin();

  router.get('/config', async (req, res) => {
    if (!siteKey || !hubUrl) {
      return res.json({ features: { users: true, analytics: false, ecommerce: false }, name: 'Site' });
    }
    try {
      const base = hubUrl.replace(/\/$/, '');
      const r = await fetch(`${base}/api/hub/site-config?site_key=${encodeURIComponent(siteKey)}`);
      if (!r.ok) {
        return res.json({ features: { users: true, analytics: false, ecommerce: false }, name: 'Site' });
      }
      const data = await r.json();
      res.json(data);
    } catch {
      res.json({ features: { users: true, analytics: false, ecommerce: false }, name: 'Site' });
    }
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

  router.get('/products', adminAuth, (req, res) => {
    res.json(store.getAllProducts());
  });

  router.post('/products', adminAuth, (req, res) => {
    const { name, price, description, imageUrl } = req.body || {};
    const result = store.createProduct({ name, price, description, imageUrl });
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.status(201).json(result.product);
  });

  router.put('/products/:id', adminAuth, (req, res) => {
    const result = store.updateProduct(req.params.id, req.body || {});
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json(result.product);
  });

  router.delete('/products/:id', adminAuth, (req, res) => {
    const result = store.deleteProduct(req.params.id);
    if (!result.ok) return res.status(404).json({ message: result.error });
    res.json({ ok: true });
  });

  return router;
}
