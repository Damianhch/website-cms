import React, { useCallback, useEffect, useState } from 'react';

const API = '/api/cms';

function acceptLabel(value) {
  return value === true ? 'true' : '';
}

export function EmailMarketingPanel({ authHeaders, loading, setLoading }) {
  const [lists, setLists] = useState([]);
  const [leads, setLeads] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [newListName, setNewListName] = useState('');
  const [filters, setFilters] = useState({ email: '', name: '', language: '', marketingAccept: '' });
  const [endpointCopied, setEndpointCopied] = useState(false);

  const fetchLists = useCallback(async () => {
    const res = await fetch(`${API}/lists`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setLists(data);
    setSelectedList((current) => current || data[0]?.id || '');
  }, [authHeaders]);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedList) params.set('listId', selectedList);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const res = await fetch(`${API}/leads?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) return;
    setLeads(await res.json());
  }, [authHeaders, selectedList, filters]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleAddList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/lists`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Could not create list');
        return;
      }
      setNewListName('');
      await fetchLists();
      setSelectedList(data.id);
    } finally {
      setLoading(false);
    }
  };

  const selected = lists.find((list) => list.id === selectedList);
  const endpoint = selected
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/cms/leads`
    : '/api/cms/leads';

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-white mb-2">Email marketing</h1>
      <p className="text-gray-400 text-sm mb-6">
        Lists live on this client host. Point any Website Creator form or lead magnet at the endpoint below with{' '}
        <code className="text-gray-300">listSlug</code> or <code className="text-gray-300">listId</code>.
      </p>

      <div className="rounded-xl bg-[#2a2a2a] border border-white/10 p-4 mb-6">
        <div className="text-xs text-gray-400 mb-1">Form endpoint</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-white text-sm break-all">{endpoint}</code>
          <button
            type="button"
            className="text-xs text-[#FF5B00] hover:underline"
            onClick={async () => {
              await navigator.clipboard?.writeText(
                JSON.stringify(
                  {
                    listSlug: selected?.slug || 'website-forms',
                    name: '',
                    email: '',
                    sms: '',
                    whatsapp: '',
                    language: '',
                    marketingAccept: true,
                  },
                  null,
                  2
                )
              );
              setEndpointCopied(true);
            }}
          >
            {endpointCopied ? 'Copied POST body' : 'Copy POST example'}
          </button>
        </div>
        {selected && <p className="text-gray-500 text-xs mt-2">Use listSlug: {selected.slug}</p>}
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        <div>
          <h2 className="text-sm font-medium text-white mb-3">Lists</h2>
          <form onSubmit={handleAddList} className="mb-3">
            <input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="New list name"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white text-sm mb-2"
            />
            <button type="submit" disabled={loading || !newListName.trim()} className="w-full px-3 py-2 rounded-lg bg-[#FF5B00] text-white text-sm disabled:opacity-50">
              Add list
            </button>
          </form>
          <div className="space-y-1">
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedList(list.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  selectedList === list.id ? 'bg-[#FF5B00] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <div>{list.name}</div>
                <div className="text-xs opacity-70">
                  {list.slug} · {list.count || 0}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="grid md:grid-cols-4 gap-2 mb-4">
            <input placeholder="Name" value={filters.name} onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white text-sm" />
            <input placeholder="Email" value={filters.email} onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white text-sm" />
            <input placeholder="Language" value={filters.language} onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white text-sm" />
            <select value={filters.marketingAccept} onChange={(e) => setFilters((f) => ({ ...f, marketingAccept: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white text-sm">
              <option value="">Accept: any</option>
              <option value="true">true</option>
              <option value="false">not accepted</option>
            </select>
          </div>
          <div className="rounded-xl bg-[#2a2a2a] border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-gray-400">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">SMS</th>
                  <th className="px-3 py-2">WhatsApp</th>
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Signup</th>
                  <th className="px-3 py-2">Accept</th>
                  <th className="px-3 py-2">Accept time</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white">{lead.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-300">{lead.email}</td>
                    <td className="px-3 py-2 text-gray-400">{lead.sms || '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{lead.whatsapp || '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{lead.language || '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{lead.signupAt ? new Date(lead.signupAt).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-gray-300">{acceptLabel(lead.marketingAccept)}</td>
                    <td className="px-3 py-2 text-gray-400">{lead.marketingAcceptAt ? new Date(lead.marketingAcceptAt).toLocaleString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length === 0 && <p className="px-4 py-8 text-gray-400 text-center">No contacts in this list yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
