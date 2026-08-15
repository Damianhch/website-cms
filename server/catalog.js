export const CATALOG_TYPES = ['menu', 'tiers', 'normal'];

export const DEFAULT_FEATURES = {
  users: true,
  analytics: false,
  ecommerce: false,
  blog: false,
  socialSync: false,
};

export function normalizeFeatures(features) {
  return {
    users: features?.users !== false,
    analytics: !!features?.analytics,
    ecommerce: !!features?.ecommerce,
    blog: !!features?.blog,
    socialSync: !!features?.socialSync,
  };
}

export function normalizeCatalogType(value) {
  if (value === 'menu' || value === 'tiers' || value === 'normal') return value;
  return null;
}

export function resolveCatalogType(value) {
  return normalizeCatalogType(value) || 'normal';
}

export function normalizePrice(price) {
  if (price == null || price === '') return 0;
  if (typeof price === 'number' && Number.isFinite(price)) return price;
  const asString = String(price).trim();
  if (!asString) return 0;
  const normalizedNumeric = asString.replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(normalizedNumeric)) {
    const numeric = Number(normalizedNumeric);
    if (Number.isFinite(numeric)) return numeric;
  }
  return asString;
}

export function normalizeBullets(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    price: normalizePrice(raw.price),
    description: String(raw.description || ''),
    imageUrl: String(raw.imageUrl || ''),
    categoryId: raw.categoryId ? String(raw.categoryId) : '',
    allergens: String(raw.allergens || ''),
    subtitle: String(raw.subtitle || ''),
    bullets: normalizeBullets(raw.bullets),
    cta: String(raw.cta || ''),
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 0,
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

export function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 0,
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

export function publicProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    description: product.description,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    allergens: product.allergens,
    subtitle: product.subtitle,
    bullets: product.bullets,
    cta: product.cta,
    sortOrder: product.sortOrder,
  };
}

export function publicCategory(category) {
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
  };
}
