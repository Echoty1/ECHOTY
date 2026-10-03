// src/utils/formatLastSeen.js
export const formatLastSeen = (presence) => {
  if (!presence) return 'Offline';
  if (presence.online) return 'Online';
  const ts = Number(presence.lastSeen) || 0;
  if (!ts) return 'Offline';

  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Last seen just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `Last seen ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Last seen ${hr}h ago`;

  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
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
