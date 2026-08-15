import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import { normalizeCategory, normalizeProduct } from './catalog.js';

const SALT_ROUNDS = 12;

export function createStore(dataPath) {
  const dir = join(dataPath, 'cms');
  const USERS_PATH = join(dir, 'users.json');
  const ADMIN_PATH = join(dir, 'admin.json');
  const PRODUCTS_PATH = join(dir, 'products.json');
  const CATEGORIES_PATH = join(dir, 'categories.json');

  function ensureDir() {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  function readJson(path, fallback) {
    ensureDir();
    if (!existsSync(path)) return fallback;
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return fallback;
    }
  }

  function writeJson(path, value) {
    ensureDir();
    writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
  }

  function readUsers() {
    return readJson(USERS_PATH, []);
  }

  function writeUsers(users) {
    writeJson(USERS_PATH, users);
  }

  function readAdmin() {
    return readJson(ADMIN_PATH, null);
  }

  function writeAdmin(admin) {
    writeJson(ADMIN_PATH, admin);
  }

  function migrateProducts(raw) {
    const rows = Array.isArray(raw) ? raw : [];
    const migrated = [];
    let changed = false;
    for (const row of rows) {
      const product = normalizeProduct(row);
      if (!product || !product.id) {
        changed = true;
        continue;
      }
      migrated.push(product);
      if (
        product.categoryId !== (row.categoryId || '') ||
        product.allergens !== (row.allergens || '') ||
        product.subtitle !== (row.subtitle || '') ||
        JSON.stringify(product.bullets) !== JSON.stringify(Array.isArray(row.bullets) ? row.bullets : []) ||
        product.cta !== (row.cta || '') ||
        product.updatedAt !== row.updatedAt
      ) {
        changed = true;
      }
    }
    return { products: migrated, changed };
  }

  function readProducts() {
    const { products, changed } = migrateProducts(readJson(PRODUCTS_PATH, []));
    if (changed) writeJson(PRODUCTS_PATH, products);
    return products;
  }

  function writeProducts(products) {
    writeJson(PRODUCTS_PATH, products.map((row) => normalizeProduct(row)).filter(Boolean));
  }

  function migrateCategories(raw) {
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map((row) => normalizeCategory(row)).filter((row) => row && row.id);
  }

  function readCategories() {
    const categories = migrateCategories(readJson(CATEGORIES_PATH, []));
    return categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  function writeCategories(categories) {
    writeJson(CATEGORIES_PATH, categories.map((row) => normalizeCategory(row)).filter(Boolean));
  }

  function nextId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    async hashPassword(plain) {
      return bcrypt.hash(plain, SALT_ROUNDS);
    },
    async verifyPassword(plain, hash) {
      return bcrypt.compare(plain, hash);
    },
    async getAdmin() {
      return readAdmin();
    },
    async setAdminCredentials(username, password) {
      const hash = await this.hashPassword(password);
      writeAdmin({ username, passwordHash: hash });
    },
    async verifyAdmin(username, password) {
      const admin = readAdmin();
      if (!admin || admin.username !== username) return false;
      return this.verifyPassword(password, admin.passwordHash);
    },
    getAllUsers() {
      return readUsers();
    },
    getUserByUsername(username) {
      return readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
    },
    async createUser(username, password) {
      const users = readUsers();
      if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        return { ok: false, error: 'Username already exists' };
      }
      const id = String(Date.now());
      const passwordHash = await this.hashPassword(password);
      users.push({ id, username, passwordHash, createdAt: new Date().toISOString() });
      writeUsers(users);
      return { ok: true, user: { id, username, createdAt: users[users.length - 1].createdAt } };
    },
    async updateUserPassword(id, newPassword) {
      const users = readUsers();
      const i = users.findIndex((u) => u.id === id);
      if (i === -1) return { ok: false, error: 'User not found' };
      users[i].passwordHash = await this.hashPassword(newPassword);
      writeUsers(users);
      return { ok: true };
    },
    async updateUserUsername(id, newUsername) {
      const users = readUsers();
      const i = users.findIndex((u) => u.id === id);
      if (i === -1) return { ok: false, error: 'User not found' };
      if (users.some((u) => u.username.toLowerCase() === newUsername.toLowerCase() && u.id !== id)) {
        return { ok: false, error: 'Username already exists' };
      }
      users[i].username = newUsername;
      writeUsers(users);
      return { ok: true };
    },
    async deleteUser(id) {
      const users = readUsers();
      const filtered = users.filter((u) => u.id !== id);
      if (filtered.length === users.length) return { ok: false, error: 'User not found' };
      writeUsers(filtered);
      return { ok: true };
    },
    async verifyEmployee(username, password) {
      const user = this.getUserByUsername(username);
      if (!user) return { ok: false };
      const valid = await this.verifyPassword(password, user.passwordHash);
      return valid ? { ok: true, user: { id: user.id, username: user.username } } : { ok: false };
    },
    getAllCategories() {
      return readCategories();
    },
    getCategoryById(id) {
      return readCategories().find((category) => category.id === id) || null;
    },
    createCategory({ name, sortOrder }) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return { ok: false, error: 'Category name is required' };
      const categories = readCategories();
      if (categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Category already exists' };
      }
      const now = new Date().toISOString();
      const maxSort = categories.reduce((max, category) => Math.max(max, category.sortOrder || 0), -1);
      const category = normalizeCategory({
        id: nextId(),
        name: trimmed,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : maxSort + 1,
        createdAt: now,
        updatedAt: now,
      });
      categories.push(category);
      writeCategories(categories);
      return { ok: true, category };
    },
    updateCategory(id, { name, sortOrder }) {
      const categories = readCategories();
      const i = categories.findIndex((category) => category.id === id);
      if (i === -1) return { ok: false, error: 'Category not found' };
      if (name !== undefined) {
        const trimmed = String(name || '').trim();
        if (!trimmed) return { ok: false, error: 'Category name is required' };
        if (categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase() && category.id !== id)) {
          return { ok: false, error: 'Category already exists' };
        }
        categories[i].name = trimmed;
      }
      if (sortOrder !== undefined) {
        categories[i].sortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : categories[i].sortOrder;
      }
      categories[i].updatedAt = new Date().toISOString();
      writeCategories(categories);
      return { ok: true, category: categories[i] };
    },
    deleteCategory(id) {
      const categories = readCategories();
      const filtered = categories.filter((category) => category.id !== id);
      if (filtered.length === categories.length) return { ok: false, error: 'Category not found' };
      writeCategories(filtered);
      const products = readProducts();
      let changed = false;
      for (const product of products) {
        if (product.categoryId === id) {
          product.categoryId = '';
          product.updatedAt = new Date().toISOString();
          changed = true;
        }
      }
      if (changed) writeProducts(products);
      return { ok: true };
    },
    getAllProducts() {
      return readProducts().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    },
    getProductById(id) {
      return readProducts().find((p) => p.id === id) || null;
    },
    createProduct(input) {
      const name = String(input?.name || '').trim();
      if (!name) return { ok: false, error: 'Product name is required' };
      const products = readProducts();
      const now = new Date().toISOString();
      const maxSort = products.reduce((max, product) => Math.max(max, product.sortOrder || 0), -1);
      const product = normalizeProduct({
        ...input,
        id: nextId(),
        name,
        sortOrder: input?.sortOrder !== undefined ? input.sortOrder : maxSort + 1,
        createdAt: now,
        updatedAt: now,
      });
      products.push(product);
      writeProducts(products);
      return { ok: true, product };
    },
    updateProduct(id, input) {
      const products = readProducts();
      const i = products.findIndex((p) => p.id === id);
      if (i === -1) return { ok: false, error: 'Product not found' };
      const current = products[i];
      const next = normalizeProduct({
        ...current,
        ...input,
        id: current.id,
        name: input?.name !== undefined ? input.name : current.name,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (!String(next.name || '').trim()) return { ok: false, error: 'Product name is required' };
      products[i] = next;
      writeProducts(products);
      return { ok: true, product: products[i] };
    },
    deleteProduct(id) {
      const products = readProducts();
      const filtered = products.filter((p) => p.id !== id);
      if (filtered.length === products.length) return { ok: false, error: 'Product not found' };
      writeProducts(filtered);
      return { ok: true };
    },
  };
}
