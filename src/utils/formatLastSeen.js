// src/utils/formatLastSeen.js

/**
 * Formats a presence object into a WhatsApp/Snapchat-style label.
 *
 * Input shape (from useUserPresence / presencePublic/{uid}):
 *   null
 *   { online: true,  lastSeen: <ms> }
 *   { online: true,  lastSeen: null, hidden: true }    ← user chose "Nobody"
 *   { online: false, lastSeen: <ms> }
 *   { online: false, lastSeen: <ms>, hidden: true }
 *
 * Returns:
 *   'Online'
 *   'Last seen just now'
 *   'Last seen 5m ago'
 *   'Last seen 2h ago'
 *   'Last seen today at 3:45 PM'
 *   'Last seen yesterday at 3:45 PM'
 *   'Last seen Sep 12'
 *   'Last seen 9/12/2025'
 *   'Offline'
 */
export const formatLastSeen = (presence) => {
  if (!presence) return 'Offline';

  // User chose "Nobody" for last-seen privacy → pretend they're offline.
  if (presence.hidden) return 'Offline';

  if (presence.online) return 'Online';

  const ts = Number(presence.lastSeen) || 0;
  if (!ts) return 'Offline';

  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);

  if (sec < 60) return 'Last seen just now';

  const min = Math.floor(sec / 60);
  if (min < 60) return `Last seen ${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `Last seen ${hr}h ago`;

  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  if (sameDay(d, today)) {
    return `Last seen today at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (sameDay(d, yesterday)) {
    return `Last seen yesterday at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (d.getFullYear() === today.getFullYear()) {
    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }
  return `Last seen ${d.toLocaleDateString()}`;
};

/**
 * Short version for tight spaces (chat list rows, navbar subtitle).
 * Skips the "Last seen" prefix — returns only the relative fragment.
 */
export const formatLastSeenShort = (presence) => {
  const full = formatLastSeen(presence);
  if (full === 'Online' || full === 'Offline') return full;
  return full.replace(/^Last seen\s+/, '');
};
