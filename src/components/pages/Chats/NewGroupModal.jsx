// src/components/pages/Chats/NewGroupModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useGroupActions } from '../../../hooks/useGroups';
import { GROUP_EMOJIS, validateGroupName } from '../../../utils/groupId';
import { hapticLight, hapticSuccess, hapticError } from '../../../utils/haptics';
import { searchProfiles } from '../../../services/searchService';
import Avatar from '../../common/Avatar';
import './NewGroupModal.css';

const NewGroupModal = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const { create, loading: creating, error } = useGroupActions(user?.uid);

  const [step, setStep] = useState('members'); // 'members' | 'details'
  const [selectedUsers, setSelectedUsers] = useState([]); // Array of { id, name, avatar, username }
  const [groupName, setGroupName] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('👥');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [localError, setLocalError] = useState(null);
  const nameInputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('members');
      setSelectedUsers([]);
      setGroupName('');
      setGroupEmoji('👥');
      setSearchQuery('');
      setSearchResults([]);
      setLocalError(null);
    }
  }, [isOpen]);

  // Global Search Effect
  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    
    const delayDebounceFn = setTimeout(async () => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const res = await searchProfiles(trimmed, user.uid, 20);
        const raw = Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
        
        // Filter out users already selected
        const filtered = raw.filter((u) => !selectedUsers.find((m) => m.id === u.id));
        setSearchResults(filtered);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedUsers, user?.uid, isOpen]);

  const toggleUser = (profile) => {
    hapticLight();
    if (selectedUsers.find((u) => u.id === profile.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== profile.id));
    } else {
      setSelectedUsers([...selectedUsers, profile]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const goToDetails = () => {
    if (selectedUsers.length < 1) {
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
    
    const memberIds = selectedUsers.map(u => u.id);
    const result = await create(validation.normalized, groupEmoji, memberIds);
    
    if (result.ok) {
      hapticSuccess();
      onCreated?.(result.groupId);
      onClose?.();
    } else {
      hapticError();
      setLocalError(result.error || 'Failed to create group');
    }
  };

  if (!isOpen) return null;

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

            {selectedUsers.length > 0 && (
              <div className="new-group-selected-strip">
                {selectedUsers.slice(0, 10).map((u) => (
                  <div key={u.id} className="new-group-selected-chip" onClick={() => toggleUser(u)}>
                    <Avatar src={u.avatar} name={u.name} size={32} />
                    <button className="chip-remove" aria-label={`Remove ${u.name}`}>×</button>
                  </div>
                ))}
                <span className="new-group-selected-count">{selectedUsers.length} selected</span>
              </div>
            )}

            <div className="new-group-search-wrapper">
              <i className="fas fa-search" />
              <input
                type="text"
                className="new-group-search"
                placeholder="Search anyone on ECHO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="new-group-friends-list">
              {isSearching ? (
                <div className="new-group-empty">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="new-group-empty">
                  <div className="new-group-empty-icon">🔍</div>
                  <p>{searchQuery ? 'No matches' : 'Search by name or username'}</p>
                  <span>{searchQuery ? 'Try a different name' : 'Type at least 2 characters to start'}</span>
                </div>
              ) : (
                searchResults.map((profile) => {
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      className="new-group-friend"
                      onClick={() => toggleUser(profile)}
                    >
                      <Avatar src={profile.avatar} name={profile.name} size={46} />
                      <div className="new-group-friend-info">
                        <strong>{profile.name || 'User'}</strong>
                        {profile.username && <span>@{profile.username}</span>}
                      </div>
                      <div className="new-group-check">
                        <i className="fas fa-plus" style={{ color: '#6C3CE1' }} />
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
                disabled={selectedUsers.length < 1}
              >
                Next {selectedUsers.length > 0 && `(${selectedUsers.length})`}
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
                  {selectedUsers.length + 1} member{selectedUsers.length + 1 !== 1 ? 's' : ''}
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
