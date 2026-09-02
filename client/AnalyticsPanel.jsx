import React, { useCallback, useEffect, useState } from 'react';

const API = '/api/cms';

export function AnalyticsPanel({ authHeaders, loading, setLoading }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`${API}/analytics`, { headers: authHeaders() });
    if (!res.ok) return;
    setSettings(await res.json());
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/analytics`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurementId: settings.measurementId,
          propertyId: settings.propertyId,
          domain: settings.domain,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Could not save');
        return;
      }
      setSettings((current) => ({ ...current, ...data }));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/analytics/verify`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Verify failed');
        return;
      }
      setSettings((current) => ({ ...current, ...data }));
    } finally {
      setLoading(false);
    }
  };

  if (!settings) return <p className="text-gray-400">Loading analytics…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Analytics</h1>
      <p className="text-gray-400 text-sm mb-6">
        Google Analytics 4 is owned by Asoldi. Clients do not log in to Google. We verify the domain with a DNS TXT record, then the site can load the measurement id.
      </p>
      <form onSubmit={save} className="rounded-xl bg-[#2a2a2a] border border-white/10 p-6 space-y-4">
        <label className="block text-sm text-gray-400">
          Domain
          <input value={settings.domain || ''} onChange={(e) => setSettings((s) => ({ ...s, domain: e.target.value }))} className="mt-1 w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" placeholder="mongsushi.no" />
        </label>
        <label className="block text-sm text-gray-400">
          GA4 measurement ID
          <input value={settings.measurementId || ''} onChange={(e) => setSettings((s) => ({ ...s, measurementId: e.target.value }))} className="mt-1 w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" placeholder="G-XXXXXXXX" />
        </label>
        <label className="block text-sm text-gray-400">
          GA4 property ID (Asoldi)
          <input value={settings.propertyId || ''} onChange={(e) => setSettings((s) => ({ ...s, propertyId: e.target.value }))} className="mt-1 w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" />
        </label>
        <div className="rounded-lg bg-black/30 p-3 text-sm text-gray-300">
          <p className="text-white font-medium mb-1">Create this DNS TXT record</p>
          <code className="break-all">{settings.dnsRecord || `${settings.dnsTxtName}.${settings.domain || '<domain>'} TXT ${settings.dnsTxtValue}`}</code>
        </div>
        <p className="text-sm text-gray-400">
          Status: {settings.verified ? `Verified ${settings.verifiedAt ? new Date(settings.verifiedAt).toLocaleString() : ''}` : 'Not verified'}
        </p>
        {settings.lastError && <p className="text-red-400 text-sm">{settings.lastError}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50">Save</button>
          <button type="button" onClick={verify} disabled={loading} className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-50">Check DNS</button>
        </div>
      </form>
    </div>
  );
}
