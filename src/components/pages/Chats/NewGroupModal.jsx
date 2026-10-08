// src/components/pages/Chats/NewGroupModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { useGroupActions } from '../../../hooks/useGroups';
import { listenToMyEchowers } from '../../../services/echowerService';
import { GROUP_EMOJIS, validateGroupName } from '../../../utils/groupId';
import { hapticLight, hapticSuccess, hapticError } from '../../../utils/haptics';
import Avatar from '../../common/Avatar';
import './NewGroupModal.css';

const NewGroupModal = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  const { create, loading: creating, error } = useGroupActions(user?.uid);

  const [step, setStep] = useState('members'); // 'members' | 'details'
  const [selectedUids, setSelectedUids] = useState(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('👥');
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [search, setSearch] = useState('');
  const [localError, setLocalError] = useState(null);
  const nameInputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('members');
      setSelectedUids(new Set());
      setGroupName('');
      setGroupEmoji('👥');
      setSearch('');
      setLocalError(null);
    }
  }, [isOpen]);

  // Load followers as potential members
  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    let cancelled = false;

    setLoadingFriends(true);
    const unsub = listenToMyEchowers(user.uid, async (uids) => {
      if (cancelled) return;
      const list = (uids || []).filter((uid) => uid && uid !== user.uid && uid !== 'echo_ai_assistant');

      // Hydrate profiles
      const hydrated = await Promise.all(
        list.map(async (uid) => {
          let profile = profiles[uid];
          if (!profile?.name) {
            try { await fetchProfile(uid); } catch {}
            profile = profiles[uid];
          }
          return {
            uid,
            name: profile?.name || 'User',
            avatar: profile?.avatar || '',
            bio: profile?.bio || '',
            username: profile?.username || '',
          };
        })
      );

      if (!cancelled) {
        setFriends(hydrated);
        setLoadingFriends(false);
      }
    });

    return () => {
      cancelled = true;
      try { unsub(); } catch {}
    };
  }, [isOpen, user?.uid, profiles, fetchProfile]);

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const uname = (f.username || '').toLowerCase();
      return name.includes(q) || uname.includes(q);
    });
  }, [friends, search]);

  if (!isOpen) return null;

  const toggleMember = (uid) => {
    hapticLight();
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const goToDetails = () => {
    if (selectedUids.size < 1) {
      setLocalError('Pick at least 1 other member');
      hapticError();
      return;
    }
    hapticLight();
    setLocalError(null);
    setStep('details');
    setTimeout(() => nameInputRef.current?.focus(), 150);
  };

  const goBack = () => {
    hapticLight();
    setStep('members');
    setLocalError(null);
  };

  const handleCreate = async () => {
    const validation = validateGroupName(groupName);
    if (!validation.valid) {
      setLocalError(validation.error);
      hapticError();
      return;
    }
    hapticLight();
    const result = await create(validation.normalized, groupEmoji, Array.from(selectedUids));
    if (result.ok) {
      hapticSuccess();
      onCreated?.(result.groupId);
      onClose?.();
    } else {
      hapticError();
      setLocalError(result.error || 'Failed to create group');
    }
  };

  const selectedFriends = Array.from(selectedUids)
    .map((uid) => friends.find((f) => f.uid === uid))
    .filter(Boolean);

  return (
    <div className="new-group-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="new-group-sheet">
        <div className="new-group-handle" />

        {step === 'members' && (
          <>
            <div className="new-group-header">
              <h2>New Group</h2>
              <button className="new-group-close" onClick={onClose} aria-label="Close">
                <i className="fas fa-times" />
              </button>
            </div>

            {selectedUids.size > 0 && (
              <div className="new-group-selected-strip">
                {selectedFriends.slice(0, 10).map((f) => (
                  <div key={f.uid} className="new-group-selected-chip" onClick={() => toggleMember(f.uid)}>
                    <Avatar src={f.avatar} name={f.name} size={32} />
                    <button className="chip-remove" aria-label={`Remove ${f.name}`}>×</button>
                  </div>
                ))}
                <span className="new-group-selected-count">{selectedUids.size} selected</span>
              </div>
            )}

            <div className="new-group-search-wrapper">
              <i className="fas fa-search" />
              <input
                type="text"
                className="new-group-search"
                placeholder="Search friends..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="new-group-friends-list">
              {loadingFriends ? (
                <div className="new-group-empty">Loading friends...</div>
              ) : filteredFriends.length === 0 ? (
                <div className="new-group-empty">
                  <div className="new-group-empty-icon">👥</div>
                  <p>{search ? 'No matches' : 'No friends yet'}</p>
                  <span>{search ? 'Try a different name' : 'Follow people to add them to a group'}</span>
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedUids.has(friend.uid);
                  return (
                    <button
                      key={friend.uid}
                      type="button"
                      className={`new-group-friend ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleMember(friend.uid)}
                    >
                      <Avatar src={friend.avatar} name={friend.name} size={46} />
                      <div className="new-group-friend-info">
                        <strong>{friend.name}</strong>
                        {friend.username && <span>@{friend.username}</span>}
                      </div>
                      <div className={`new-group-check ${isSelected ? 'checked' : ''}`}>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {(localError || error) && (
              <div className="new-group-error">{localError || error}</div>
            )}

            <div className="new-group-actions">
              <button className="new-group-btn cancel" onClick={onClose}>Cancel</button>
              <button
                className="new-group-btn primary"
                onClick={goToDetails}
                disabled={selectedUids.size < 1}
              >
                Next {selectedUids.size > 0 && `(${selectedUids.size})`}
              </button>
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <div className="new-group-header">
              <button className="new-group-back" onClick={goBack} aria-label="Back">
                <i className="fas fa-arrow-left" />
              </button>
              <h2>Group Details</h2>
              <button className="new-group-close" onClick={onClose} aria-label="Close">
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="new-group-preview">
              <div className="new-group-preview-emoji">{groupEmoji}</div>
              <div className="new-group-preview-info">
                <span className="new-group-preview-name">{groupName || 'Untitled Group'}</span>
                <span className="new-group-preview-count">
                  {selectedUids.size + 1} member{selectedUids.size + 1 !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <label className="new-group-label">Group name</label>
            <input
              ref={nameInputRef}
              type="text"
              className="new-group-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, 40))}
              placeholder="e.g. Weekend Squad"
              maxLength={40}
            />
            <div className="new-group-counter">{groupName.length}/40</div>

            <label className="new-group-label">Group emoji</label>
            <div className="new-group-emojis">
              {GROUP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`new-group-emoji ${groupEmoji === emoji ? 'selected' : ''}`}
                  onClick={() => { hapticLight(); setGroupEmoji(emoji); }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {(localError || error) && (
              <div className="new-group-error">{localError || error}</div>
            )}

            <div className="new-group-actions">
              <button className="new-group-btn cancel" onClick={goBack}>Back</button>
              <button
                className="new-group-btn primary"
                onClick={handleCreate}
                disabled={creating || groupName.trim().length < 1}
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewGroupModal;
