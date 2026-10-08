// src/components/pages/Chat/AddMembersModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { listenToMyEchowers } from '../../../services/echowerService';
import { hapticLight } from '../../../utils/haptics';
import Avatar from '../../common/Avatar';
import './AddMembersModal.css';

const AddMembersModal = ({ groupId, currentMembers, onClose, onAdd }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const currentSet = useMemo(() => new Set(currentMembers || []), [currentMembers]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    setLoading(true);

    const unsub = listenToMyEchowers(user.uid, async (uids) => {
      if (cancelled) return;
      const eligible = (uids || []).filter(
        (uid) => uid && uid !== user.uid && !currentSet.has(uid) && uid !== 'echo_ai_assistant'
      );
      // Fetch profiles
      const profiles = await Promise.all(
        eligible.map(async (uid) => {
          try {
            const snap = await get(ref(db, `profiles/${uid}`));
            const p = snap.exists() ? snap.val() : {};
            return {
              uid,
              name: p.name || p.displayName || 'User',
              avatar: p.avatar || '',
              bio: p.bio || '',
              username: p.username || '',
            };
          } catch {
            return { uid, name: 'User', avatar: '', bio: '', username: '' };
          }
        })
      );
      if (!cancelled) {
        setFriends(profiles);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      try { unsub(); } catch {}
    };
  }, [user?.uid, currentSet]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.username || '').toLowerCase().includes(q)
    );
  }, [friends, search]);

  const toggle = (uid) => {
    hapticLight();
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0 || adding) return;
    setAdding(true);
    try {
      await onAdd(Array.from(selected));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="am-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="am-sheet">
        <div className="am-handle" />

        <div className="am-header">
          <h2>Add members</h2>
          <button className="am-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="am-search-wrap">
          <i className="fas fa-search" />
          <input
            type="text"
            className="am-search"
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="am-list">
          {loading ? (
            <div className="am-empty">Loading friends...</div>
          ) : filtered.length === 0 ? (
            <div className="am-empty">
              <div className="am-empty-icon">👥</div>
              <p>{search ? 'No matches' : 'No more friends to add'}</p>
              <span>
                {search
                  ? 'Try a different name'
                  : 'Follow people to add them to this group'}
              </span>
            </div>
          ) : (
            filtered.map((f) => {
              const isSel = selected.has(f.uid);
              return (
                <button
                  key={f.uid}
                  type="button"
                  className={`am-friend ${isSel ? 'selected' : ''}`}
                  onClick={() => toggle(f.uid)}
                >
                  <Avatar src={f.avatar} name={f.name} size={44} />
                  <div className="am-friend-info">
                    <strong>{f.name}</strong>
                    {f.username && <span>@{f.username}</span>}
                  </div>
                  <div className={`am-check ${isSel ? 'checked' : ''}`}>
                    {isSel && (
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path
                          d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                          fill="currentColor"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="am-actions">
          <button className="am-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="am-btn primary"
            onClick={handleAdd}
            disabled={selected.size === 0 || adding}
          >
            {adding
              ? 'Adding...'
              : `Add${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMembersModal;
