export function slugifyListName(name = '') {
  const slug = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'list';
}

export function normalizeList(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  const name = String(raw.name || '').trim();
  return {
    id: String(raw.id || ''),
    name,
    slug: String(raw.slug || slugifyListName(name)),
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

export function normalizeLead(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const createdAt = raw.createdAt || raw.signupAt || new Date().toISOString();
  const marketingAccept = raw.marketingAccept === true || raw.marketingAccept === 'true' || raw.marketingAccept === '1';
  return {
    id: String(raw.id || ''),
    listId: String(raw.listId || '').trim(),
    name: String(raw.name || raw.fullName || '').trim(),
    email: String(raw.email || '').trim().toLowerCase(),
    sms: String(raw.sms || raw.phone || '').trim(),
    whatsapp: String(raw.whatsapp || '').trim(),
    language: String(raw.language || raw.lang || '').trim(),
    signupAt: String(raw.signupAt || createdAt),
    marketingAccept: marketingAccept ? true : false,
    marketingAcceptAt: marketingAccept ? String(raw.marketingAcceptAt || createdAt) : '',
    source: String(raw.source || '').trim(),
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

export function filterLeads(leads, query = {}) {
  const rows = Array.isArray(leads) ? leads : [];
  const listId = String(query.listId || '').trim();
  const email = String(query.email || '').trim().toLowerCase();
  const name = String(query.name || '').trim().toLowerCase();
  const language = String(query.language || '').trim().toLowerCase();
  const accept = String(query.marketingAccept || '').trim().toLowerCase();
  return rows.filter((lead) => {
    if (listId && lead.listId !== listId) return false;
    if (email && !String(lead.email || '').includes(email)) return false;
    if (name && !String(lead.name || '').toLowerCase().includes(name)) return false;
    if (language && String(lead.language || '').toLowerCase() !== language) return false;
    if (accept === 'true' && lead.marketingAccept !== true) return false;
    if (accept === 'false' && lead.marketingAccept !== false) return false;
    return true;
  });
}

export function publicLead(lead) {
  if (!lead) return null;
  return {
    id: lead.id,
    listId: lead.listId,
    name: lead.name,
    email: lead.email,
    sms: lead.sms,
    whatsapp: lead.whatsapp,
    language: lead.language,
    signupAt: lead.signupAt,
    marketingAccept: lead.marketingAccept ? true : '',
    marketingAcceptAt: lead.marketingAcceptAt,
    source: lead.source,
  };
}
