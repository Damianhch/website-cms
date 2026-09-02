export const CATALOG_TYPES = ['menu', 'tiers', 'normal'];

export const DEFAULT_FEATURES = {
  users: true,
  analytics: false,
  ecommerce: false,
  blog: false,
  socialSync: false,
  emailMarketing: false,
  general: false,
};

export function normalizeFeatures(features) {
  return {
    users: features?.users !== false,
    analytics: !!features?.analytics,
    ecommerce: !!features?.ecommerce,
    blog: !!features?.blog,
    socialSync: !!features?.socialSync,
    emailMarketing: !!features?.emailMarketing,
    general: !!features?.general,
  };
}

export function normalizeCatalogType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'meny') return 'menu';
  if (raw === 'menu' || raw === 'tiers' || raw === 'normal') return raw;
  return null;
}

export function resolveCatalogType(value) {
  return normalizeCatalogType(value) || 'normal';
}

export function normalizeProductType(value, fallback = 'normal') {
  return normalizeCatalogType(value) || resolveCatalogType(fallback);
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

export function normalizeStringList(value) {
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

export function normalizeBullets(value) {
  return normalizeStringList(value);
}

export function normalizeExtraOptions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name, price: '' } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || '').trim();
      if (!name) return null;
      return { name, price: item.price == null || item.price === '' ? '' : String(item.price).trim() };
    })
    .filter(Boolean);
}

export function normalizeStockQty(value) {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '';
  return numeric;
}

export function normalizeProduct(raw, { defaultProductType = null } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  const included = normalizeStringList(raw.included?.length ? raw.included : raw.bullets);
  const soldOut = Boolean(raw.soldOut);
  const stockQty = soldOut ? 0 : normalizeStockQty(raw.stockQty);
  return {
    id: String(raw.id || ''),
    name: String(raw.name || raw.title || ''),
    price: normalizePrice(raw.price),
    comparePrice: String(raw.comparePrice || raw.comparisonPrice || '').trim(),
    contactInsteadOfPrice: Boolean(raw.contactInsteadOfPrice),
    description: String(raw.description || raw.desc || ''),
    imageUrl: String(raw.imageUrl || raw.image || ''),
    categoryId: raw.categoryId ? String(raw.categoryId) : '',
    allergens: String(raw.allergens || ''),
    subtitle: String(raw.subtitle || ''),
    included,
    bullets: included,
    extraTexts: normalizeStringList(raw.extraTexts),
    extraOptions: normalizeExtraOptions(raw.extraOptions),
    cta: String(raw.cta || ''),
    productType: normalizeCatalogType(raw.productType || raw.layout) || (defaultProductType ? resolveCatalogType(defaultProductType) : ''),
    stockQty,
    soldOut,
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
    comparePrice: product.comparePrice,
    contactInsteadOfPrice: product.contactInsteadOfPrice,
    description: product.description,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    allergens: product.allergens,
    subtitle: product.subtitle,
    included: product.included,
    bullets: product.bullets,
    extraTexts: product.extraTexts,
    extraOptions: product.extraOptions,
    cta: product.cta,
    productType: product.productType,
    stockQty: product.stockQty,
    soldOut: product.soldOut,
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
