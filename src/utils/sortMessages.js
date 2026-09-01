// src/utils/sortMessages.js
// Oldest first so new messages always land at the bottom.
export function msgTime(m) {
  if (!m) return 0;
  const raw = m.timestamp ?? m.createdAt ?? m.sentAt ?? m.clientTs ?? m.time;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.toMillis === 'function') return raw.toMillis();
    if (typeof raw.toDate === 'function') return raw.toDate().getTime();
    if (typeof raw.seconds === 'number') return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
  }
  const id = String(m.id || m.key || '');
  if (id.charAt(0) === '-') return 0;
  return 0;
}

export function sortMessages(list) {
  return (list || []).slice().sort((a, b) => {
    const d = msgTime(a) - msgTime(b);
    if (d !== 0) return d;
    const ia = String(a.id || a.key || '');
    const ib = String(b.id || b.key || '');
    if (ia.charAt(0) === '-' && ib.charAt(0) === '-' && ia !== ib) {
      return ia < ib ? -1 : 1;
    }
    return ia.localeCompare(ib);
  });
}
