const RANKS = ['admin', 'employee', 'writer', 'member'];
const STAFF_RANKS = ['employee', 'writer', 'member'];

export function normalizeRank(value, fallback = 'employee') {
  const rank = String(value || '').trim().toLowerCase();
  if (RANKS.includes(rank)) return rank;
  return STAFF_RANKS.includes(fallback) ? fallback : 'employee';
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name || '',
    email: user.email || '',
    avatarUrl: user.avatarUrl || '',
    rank: normalizeRank(user.rank),
    createdAt: user.createdAt,
  };
}

export function canAccessTab(rank, tab) {
  const resolved = normalizeRank(rank, 'member');
  if (resolved === 'admin') return true;
  if (resolved === 'member') return false;
  if (resolved === 'writer') return tab === 'blog';
  return tab !== 'delete-users';
}

export function canDeleteUsers(rank) {
  return normalizeRank(rank, 'member') === 'admin';
}

export { RANKS, STAFF_RANKS };
