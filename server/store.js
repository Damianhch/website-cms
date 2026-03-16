import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export function createStore(dataPath) {
  const dir = join(dataPath, 'cms');
  const USERS_PATH = join(dir, 'users.json');
  const ADMIN_PATH = join(dir, 'admin.json');
  const PRODUCTS_PATH = join(dir, 'products.json');

  function ensureDir() {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  function readUsers() {
    ensureDir();
    if (!existsSync(USERS_PATH)) return [];
    try {
      return JSON.parse(readFileSync(USERS_PATH, 'utf8'));
    } catch {
      return [];
    }
  }

  function writeUsers(users) {
    ensureDir();
    writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
  }

  function readAdmin() {
    ensureDir();
    if (!existsSync(ADMIN_PATH)) return null;
    try {
      return JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
    } catch {
      return null;
    }
  }

  function writeAdmin(admin) {
    ensureDir();
    writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2), 'utf8');
  }

  function readProducts() {
    ensureDir();
    if (!existsSync(PRODUCTS_PATH)) return [];
    try {
      return JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
    } catch {
      return [];
    }
  }

  function writeProducts(products) {
    ensureDir();
    writeFileSync(PRODUCTS_PATH, JSON.stringify(products, null, 2), 'utf8');
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
    getAllProducts() {
      return readProducts();
    },
    getProductById(id) {
      return readProducts().find((p) => p.id === id) || null;
    },
    createProduct({ name, price, description, imageUrl }) {
      const products = readProducts();
      const id = String(Date.now());
      const product = {
        id,
        name: name || '',
        price: price ?? 0,
        description: description || '',
        imageUrl: imageUrl || '',
        createdAt: new Date().toISOString(),
      };
      products.push(product);
      writeProducts(products);
      return { ok: true, product };
    },
    updateProduct(id, { name, price, description, imageUrl }) {
      const products = readProducts();
      const i = products.findIndex((p) => p.id === id);
      if (i === -1) return { ok: false, error: 'Product not found' };
      if (name !== undefined) products[i].name = name;
      if (price !== undefined) products[i].price = price;
      if (description !== undefined) products[i].description = description;
      if (imageUrl !== undefined) products[i].imageUrl = imageUrl;
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
