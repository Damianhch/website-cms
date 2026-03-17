/**
 * @asoldi/client-cms – Client CMS UI. Use: <Route path="/admin" element={<ClientCMS />} />
 * Server must mount createCmsRoutes at /api/cms (see README).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, LogOut, LayoutDashboard, BarChart3, ShoppingBag } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const API = '/api/cms';

function getToken() {
  return localStorage.getItem('adminToken');
}

function setToken(t) {
  localStorage.setItem('adminToken', t);
}

function clearToken() {
  localStorage.removeItem('adminToken');
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const DEFAULT_FEATURES = { users: true, analytics: false, ecommerce: false };

export function ClientCMS() {
  const [loggedIn, setLoggedIn] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState('users');
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [siteName, setSiteName] = useState('');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [productForm, setProductForm] = useState({ name: '', price: '', imageUrl: '' });
  const [imageUploading, setImageUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API}/admin/users`, { headers: authHeaders() });
    if (res.status === 401) {
      clearToken();
      setLoggedIn(false);
      return;
    }
    if (!res.ok) return;
    setUsers(await res.json());
  }, []);

  const fetchProducts = useCallback(async () => {
    const res = await fetch(`${API}/products`, { headers: authHeaders() });
    if (res.status === 401) return;
    if (!res.ok) return;
    setProducts(await res.json());
  }, []);

  useEffect(() => {
    fetch(`${API}/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.features) setFeatures(data.features);
        if (data?.name) setSiteName(data.name);
      })
      .catch(() => setFeatures(DEFAULT_FEATURES));
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoggedIn(false);
      return;
    }
    Promise.all([fetchUsers(), features.ecommerce ? fetchProducts() : Promise.resolve()]).then(() => setLoggedIn(true)).catch(() => setLoggedIn(false));
  }, [fetchUsers, fetchProducts, features.ecommerce]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data.message || 'Invalid credentials');
        return;
      }
      setToken(data.token);
      setLoggedIn(true);
      fetchUsers();
      if (features.ecommerce) fetchProducts();
    } catch {
      setLoginError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.password) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Failed to create user');
        return;
      }
      setUserForm({ username: '', password: '' });
      fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (id, newUsername, newPassword) => {
    setLoading(true);
    try {
      const body = {};
      if (newUsername !== undefined) body.username = newUsername;
      if (newPassword !== undefined && newPassword !== '') body.password = newPassword;
      const res = await fetch(`${API}/admin/users/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Update failed');
        return;
      }
      setEditingId(null);
      setEditPassword('');
      fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Delete this user? They will no longer be able to log in.')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Delete failed');
        return;
      }
      fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
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
      setProductForm((f) => ({ ...f, imageUrl: data.url || '' }));
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const name = productForm.name.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/products`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          price: Number(productForm.price) || 0,
          description: '',
          imageUrl: productForm.imageUrl || '',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to create product');
        return;
      }
      setProductForm({ name: '', price: '', imageUrl: '' });
      fetchProducts();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (id, updates) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/products/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Update failed');
        return;
      }
      setEditingProductId(null);
      fetchProducts();
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
      fetchProducts();
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordError('');
    const res = await fetch(`${API}/admin/change-password`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setChangePasswordError(data.message || 'Failed');
      return;
    }
    setChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
  };

  if (loggedIn === null) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <>
        <Helmet><title>Admin</title><meta name="robots" content="noindex,nofollow" /></Helmet>
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] border border-white/10 p-8">
            <h1 className="text-xl font-bold text-white mb-6">Admin</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
                required
              />
              {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-medium text-white bg-[#FF5B00] hover:bg-[#e55200] disabled:opacity-50"
              >
                {loading ? 'Logging in…' : 'Log in'}
              </button>
            </form>
            <p className="mt-4 text-center">
              <Link to="/" className="text-sm text-gray-400 hover:text-white">← Back to site</Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Admin</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="min-h-screen bg-[#1e1e1e] flex">
        <aside className="w-56 bg-[#23282d] text-white flex flex-col fixed inset-y-0 left-0">
          <div className="p-4 border-b border-white/10">
            <Link to="/" className="text-lg font-semibold text-white">{siteName || 'Admin'}</Link>
            <p className="text-xs text-gray-400 mt-1">Client CMS</p>
          </div>
          <nav className="flex-1 p-2">
            {features.users !== false && (
              <button
                type="button"
                onClick={() => setTab('users')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${tab === 'users' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'}`}
              >
                <Users size={18} /> Users
              </button>
            )}
            {features.analytics && (
              <button
                type="button"
                onClick={() => setTab('analytics')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${tab === 'analytics' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'}`}
              >
                <BarChart3 size={18} /> Analytics
              </button>
            )}
            {features.ecommerce && (
              <button
                type="button"
                onClick={() => setTab('ecommerce')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${tab === 'ecommerce' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'}`}
              >
                <ShoppingBag size={18} /> Ecommerce
              </button>
            )}
            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium text-gray-400 opacity-70">
              <LayoutDashboard size={18} /> Dashboard (soon)
            </div>
          </nav>
          <div className="p-2 border-t border-white/10 space-y-1">
            <button type="button" onClick={() => setChangePasswordOpen(true)} className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white">Change my password</button>
            <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white">
              <LogOut size={18} /> Log out
            </button>
          </div>
        </aside>
        <main className="flex-1 ml-56 p-8">
          {tab === 'analytics' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>
              <p className="text-gray-400">Connect Google Analytics or Business Profile. Coming soon.</p>
            </div>
          )}
          {tab === 'ecommerce' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-6">Ecommerce</h1>
              <p className="text-gray-400 text-sm mb-6">Add products: name, price, and image. Only visible when Ecommerce is enabled for this site in the hub.</p>
              <div className="rounded-xl bg-[#2a2a2a] border border-white/10 p-6 mb-8">
                <h2 className="text-lg font-medium text-white mb-4">Add product</h2>
                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Product name"
                      className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="0"
                      className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={imageUploading}
                      className="w-full text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#FF5B00] file:text-white file:font-medium file:cursor-pointer"
                    />
                    {imageUploading && <p className="text-gray-500 text-sm mt-1">Uploading…</p>}
                    {productForm.imageUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={productForm.imageUrl} alt="" className="w-16 h-16 object-cover rounded" />
                        <button type="button" onClick={() => setProductForm((f) => ({ ...f, imageUrl: '' }))} className="text-xs text-gray-400 hover:text-white">Remove</button>
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={loading || !productForm.name.trim()} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200] disabled:opacity-50">Add product</button>
                </form>
              </div>
              <div className="rounded-xl bg-[#2a2a2a] border border-white/10 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-gray-400 font-medium">Product</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Price</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Image</th>
                      <th className="px-4 py-3 text-gray-400 font-medium w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-4 py-3 text-white">
                          <div>{p.name}</div>
                          {p.description && <div className="text-gray-400 text-sm mt-0.5">{p.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{p.price != null ? Number(p.price).toFixed(2) : '—'}</td>
                        <td className="px-4 py-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <span className="text-gray-500 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingProductId === p.id ? (
                            <button type="button" onClick={() => setEditingProductId(null)} className="text-xs text-gray-400">Cancel</button>
                          ) : (
                            <>
                              <button type="button" onClick={() => setEditingProductId(p.id)} className="text-xs text-[#FF5B00] hover:underline mr-2">Edit</button>
                              <button type="button" onClick={() => handleDeleteProduct(p.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length === 0 && <p className="px-4 py-8 text-gray-400 text-center">No products yet.</p>}
              </div>
            </div>
          )}
          {tab === 'users' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-6">Users</h1>
              <p className="text-gray-400 text-sm mb-6">Staff logins for this site. Passwords are encrypted.</p>
              <div className="rounded-xl bg-[#2a2a2a] border border-white/10 p-6 mb-8">
                <h2 className="text-lg font-medium text-white mb-4">Add user</h2>
                <form onSubmit={handleAddUser} className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Username</label>
                    <input type="text" value={userForm.username} onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))} placeholder="username" className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500 w-56" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Password</label>
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} placeholder="New password" className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500 w-48" />
                  </div>
                  <button type="submit" disabled={loading || !userForm.username.trim() || !userForm.password} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200] disabled:opacity-50">Add user</button>
                </form>
              </div>
              <div className="rounded-xl bg-[#2a2a2a] border border-white/10 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-gray-400 font-medium">Username</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Created</th>
                      <th className="px-4 py-3 text-gray-400 font-medium w-48">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-white/5">
                        <td className="px-4 py-3 text-white">
                          {editingId === u.id ? (
                            <input
                              type="text"
                              defaultValue={u.username}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v && v !== u.username) handleUpdateUser(u.id, v);
                                setEditingId(null);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                              className="px-2 py-1 rounded bg-[#1a1a1a] border border-white/20 text-white w-48"
                            />
                          ) : (
                            <span onClick={() => setEditingId(u.id)} className="cursor-pointer hover:underline">{u.username}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {editingId === u.id ? (
                              <>
                                <input type="password" placeholder="New password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="px-2 py-1 rounded bg-[#1a1a1a] border border-white/20 text-white w-32 text-sm" />
                                <button type="button" onClick={() => editPassword && handleUpdateUser(u.id, null, editPassword)} className="text-xs px-2 py-1 rounded bg-[#FF5B00] text-white">Set password</button>
                                <button type="button" onClick={() => { setEditingId(null); setEditPassword(''); }} className="text-gray-400 hover:text-white text-xs">Cancel</button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => setEditingId(u.id)} className="text-xs text-[#FF5B00] hover:underline">Edit</button>
                                <button type="button" onClick={() => handleDeleteUser(u.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <p className="px-4 py-8 text-gray-400 text-center">No users yet.</p>}
              </div>
            </div>
          )}
        </main>
      </div>
      {changePasswordOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-white mb-4">Change my password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" required />
              <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" required />
              {changePasswordError && <p className="text-red-400 text-sm">{changePasswordError}</p>}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium">Save</button>
                <button type="button" onClick={() => { setChangePasswordOpen(false); setChangePasswordError(''); setCurrentPassword(''); setNewPassword(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
