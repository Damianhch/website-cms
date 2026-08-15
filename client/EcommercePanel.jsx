import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API = '/api/cms';

function emptyProductForm() {
  return {
    name: '',
    price: '',
    description: '',
    imageUrl: '',
    categoryId: '',
    allergens: '',
    subtitle: '',
    bulletsText: '',
    cta: '',
  };
}

function formFromProduct(product) {
  return {
    name: product?.name || '',
    price: product?.price == null ? '' : String(product.price),
    description: product?.description || '',
    imageUrl: product?.imageUrl || '',
    categoryId: product?.categoryId || '',
    allergens: product?.allergens || '',
    subtitle: product?.subtitle || '',
    bulletsText: Array.isArray(product?.bullets) ? product.bullets.join('\n') : '',
    cta: product?.cta || '',
  };
}

function payloadFromForm(form) {
  return {
    name: form.name.trim(),
    price: form.price,
    description: form.description.trim(),
    imageUrl: form.imageUrl || '',
    categoryId: form.categoryId || '',
    allergens: form.allergens.trim(),
    subtitle: form.subtitle.trim(),
    bullets: form.bulletsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    cta: form.cta.trim(),
  };
}

function formatPrice(price) {
  if (price == null || price === '') return '—';
  if (typeof price === 'number') return Number.isInteger(price) ? String(price) : price.toFixed(2);
  return String(price);
}

function catalogLabel(catalogType) {
  if (catalogType === 'menu') return 'Menu';
  if (catalogType === 'tiers') return 'Tiers';
  return 'Products';
}

function ImageDropzone({ imageUrl, uploading, onUpload, onClear, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">Image</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
        className="hidden"
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer?.files?.[0];
          if (file && !disabled) onUpload(file);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-[#FF5B00] bg-[#FF5B00]/10' : 'border-white/20 hover:border-white/40 bg-[#1a1a1a]/50'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {uploading ? (
          <p className="text-gray-400">Uploading…</p>
        ) : imageUrl ? (
          <div className="flex items-center justify-center gap-3">
            <img src={imageUrl} alt="" className="w-20 h-20 object-cover rounded" />
            <div className="text-left">
              <p className="text-white text-sm">Image added</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-xs text-[#FF5B00] hover:underline mt-1"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm">Drag image here or click to browse</p>
            <p className="text-gray-500 text-xs mt-1">PNG, JPG, WebP, etc.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function EcommercePanel({ catalogType, authHeaders, loading, setLoading }) {
  const usesCategories = catalogType === 'menu' || catalogType === 'normal';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState(emptyProductForm());
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState('all');

  const fetchProducts = useCallback(async () => {
    const res = await fetch(`${API}/products`, { headers: authHeaders() });
    if (!res.ok) return;
    setProducts(await res.json());
  }, [authHeaders]);

  const fetchCategories = useCallback(async () => {
    if (!usesCategories) {
      setCategories([]);
      return;
    }
    const res = await fetch(`${API}/categories`, { headers: authHeaders() });
    if (!res.ok) return;
    setCategories(await res.json());
  }, [authHeaders, usesCategories]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const categoryNameById = useMemo(() => {
    const map = new Map(categories.map((category) => [category.id, category.name]));
    return map;
  }, [categories]);

  const visibleProducts = useMemo(() => {
    if (!usesCategories || filterCategoryId === 'all') return products;
    if (filterCategoryId === 'uncategorized') return products.filter((product) => !product.categoryId);
    return products.filter((product) => product.categoryId === filterCategoryId);
  }, [products, usesCategories, filterCategoryId]);

  const uploadImageFile = async (file, applyUrl) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Upload failed');
        return;
      }
      applyUrl(data.url || '');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = payloadFromForm(productForm);
    if (!payload.name) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/products`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to create product');
        return;
      }
      setProductForm(emptyProductForm());
      await fetchProducts();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (id) => {
    const payload = payloadFromForm(editForm);
    if (!payload.name) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/products/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Update failed');
        return;
      }
      setEditingProductId(null);
      setEditForm(emptyProductForm());
      await fetchProducts();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Delete failed');
        return;
      }
      if (editingProductId === id) {
        setEditingProductId(null);
        setEditForm(emptyProductForm());
      }
      await fetchProducts();
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/categories`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Failed to create category');
        return;
      }
      setCategoryName('');
      await fetchCategories();
    } finally {
      setLoading(false);
    }
  };

  const handleRenameCategory = async (id) => {
    const name = editingCategoryName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/categories/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Failed to rename category');
        return;
      }
      setEditingCategoryId(null);
      setEditingCategoryName('');
      await fetchCategories();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Delete this category? Products in it stay, but become uncategorized.')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/categories/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Delete failed');
        return;
      }
      if (filterCategoryId === id) setFilterCategoryId('all');
      await Promise.all([fetchCategories(), fetchProducts()]);
    } finally {
      setLoading(false);
    }
  };

  const renderTypeFields = (form, setForm) => (
    <>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          placeholder={catalogType === 'tiers' ? 'Plan name' : 'Product name'}
          className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Price</label>
        <input
          type="text"
          value={form.price}
          onChange={(e) => setForm((current) => ({ ...current, price: e.target.value }))}
          placeholder={catalogType === 'tiers' ? 'e.g. 1499,-/mnd' : 'e.g. 109,-'}
          className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
        />
      </div>
      {usesCategories && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {catalogType === 'normal' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Subtitle</label>
          <input
            type="text"
            value={form.subtitle}
            onChange={(e) => setForm((current) => ({ ...current, subtitle: e.target.value }))}
            placeholder="Short line under the name"
            className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
          />
        </div>
      )}
      {catalogType !== 'tiers' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            placeholder="Optional description"
            rows={3}
            className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
          />
        </div>
      )}
      {catalogType === 'menu' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Allergens</label>
          <input
            type="text"
            value={form.allergens}
            onChange={(e) => setForm((current) => ({ ...current, allergens: e.target.value }))}
            placeholder="e.g. Gluten, milk, sesame"
            className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
          />
        </div>
      )}
      {catalogType === 'tiers' && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Included features (one per line)</label>
            <textarea
              value={form.bulletsText}
              onChange={(e) => setForm((current) => ({ ...current, bulletsText: e.target.value }))}
              placeholder={'One core offer\nBasic email support'}
              rows={4}
              className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">CTA</label>
            <input
              type="text"
              value={form.cta}
              onChange={(e) => setForm((current) => ({ ...current, cta: e.target.value }))}
              placeholder="e.g. Contact us"
              className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
            />
          </div>
        </>
      )}
      <ImageDropzone
        imageUrl={form.imageUrl}
        uploading={imageUploading}
        disabled={loading}
        onUpload={(file) => uploadImageFile(file, (url) => setForm((current) => ({ ...current, imageUrl: url })))}
        onClear={() => setForm((current) => ({ ...current, imageUrl: '' }))}
      />
    </>
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-2">Ecommerce</h1>
      <p className="text-gray-400 text-sm mb-6">
        Catalog type: <span className="text-white">{catalogLabel(catalogType)}</span>. Add and edit items here. The public site can read them from{' '}
        <code className="text-gray-300">GET /api/cms/catalog</code>.
      </p>

      {usesCategories && (
        <div className="rounded-xl bg-[#2a2a2a] border border-white/10 p-6 mb-8">
          <h2 className="text-lg font-medium text-white mb-4">Categories</h2>
          <form onSubmit={handleAddCategory} className="flex flex-wrap gap-3 items-end mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">New category</label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={catalogType === 'menu' ? 'e.g. Nigiri' : 'e.g. Featured'}
                className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500 w-56"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !categoryName.trim()}
              className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200] disabled:opacity-50"
            >
              Add category
            </button>
          </form>
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-3 text-sm">
                {editingCategoryId === category.id ? (
                  <>
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="px-2 py-1 rounded bg-[#1a1a1a] border border-white/20 text-white w-48"
                    />
                    <button type="button" onClick={() => handleRenameCategory(category.id)} className="text-[#FF5B00] hover:underline">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(null);
                        setEditingCategoryName('');
                      }}
                      className="text-gray-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-white">{category.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setEditingCategoryName(category.name);
                      }}
                      className="text-xs text-[#FF5B00] hover:underline"
                    >
                      Rename
                    </button>
                    <button type="button" onClick={() => handleDeleteCategory(category.id)} className="text-xs text-red-400 hover:underline">
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && <p className="text-gray-400 text-sm">No categories yet.</p>}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-[#2a2a2a] border border-white/10 p-6 mb-8">
        <h2 className="text-lg font-medium text-white mb-4">Add {catalogType === 'tiers' ? 'plan' : 'product'}</h2>
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {renderTypeFields(productForm, setProductForm)}
          <button
            type="submit"
            disabled={loading || !productForm.name.trim()}
            className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200] disabled:opacity-50"
          >
            Add {catalogType === 'tiers' ? 'plan' : 'product'}
          </button>
        </form>
      </div>

      {usesCategories && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'all', name: 'All' },
            ...categories,
            { id: 'uncategorized', name: 'Uncategorized' },
          ].map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setFilterCategoryId(category.id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filterCategoryId === category.id ? 'bg-[#FF5B00] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-[#2a2a2a] border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-gray-400 font-medium">{catalogType === 'tiers' ? 'Plan' : 'Product'}</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Price</th>
              {usesCategories && <th className="px-4 py-3 text-gray-400 font-medium">Category</th>}
              <th className="px-4 py-3 text-gray-400 font-medium">Image</th>
              <th className="px-4 py-3 text-gray-400 font-medium w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => (
              <React.Fragment key={product.id}>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">
                    <div>{product.name}</div>
                    {product.subtitle && <div className="text-gray-400 text-sm mt-0.5">{product.subtitle}</div>}
                    {product.description && catalogType !== 'tiers' && (
                      <div className="text-gray-400 text-sm mt-0.5">{product.description}</div>
                    )}
                    {catalogType === 'menu' && product.allergens && (
                      <div className="text-gray-500 text-xs mt-1">Allergens: {product.allergens}</div>
                    )}
                    {catalogType === 'tiers' && product.bullets?.length > 0 && (
                      <ul className="text-gray-400 text-sm mt-1 list-disc list-inside">
                        {product.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {catalogType === 'tiers' && product.cta && <div className="text-gray-500 text-xs mt-1">CTA: {product.cta}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatPrice(product.price)}</td>
                  {usesCategories && (
                    <td className="px-4 py-3 text-gray-400">{categoryNameById.get(product.categoryId) || '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <span className="text-gray-500 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingProductId === product.id ? (
                      <button type="button" onClick={() => setEditingProductId(null)} className="text-xs text-gray-400">
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProductId(product.id);
                            setEditForm(formFromProduct(product));
                          }}
                          className="text-xs text-[#FF5B00] hover:underline mr-2"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteProduct(product.id)} className="text-xs text-red-400 hover:underline">
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                {editingProductId === product.id && (
                  <tr className="border-b border-white/5 bg-black/20">
                    <td colSpan={usesCategories ? 5 : 4} className="px-4 py-4">
                      <div className="space-y-4">
                        {renderTypeFields(editForm, setEditForm)}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateProduct(product.id)}
                            disabled={loading || !editForm.name.trim()}
                            className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProductId(null);
                              setEditForm(emptyProductForm());
                            }}
                            className="px-4 py-2 rounded-lg bg-white/10 text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {visibleProducts.length === 0 && (
          <p className="px-4 py-8 text-gray-400 text-center">No {catalogType === 'tiers' ? 'plans' : 'products'} yet.</p>
        )}
      </div>
    </div>
  );
}
