// src/components/pages/Chat/GroupInfo.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get, onValue, update, remove } from 'firebase/database';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { chatIdToGroupId } from '../../../utils/groupId';
import {
  removeGroupMember,
  leaveGroup,
  updateGroupInfo,
  setMemberRole,
  deleteGroup,
  addGroupMembers,
} from '../../../services/groupService';
import { GROUP_EMOJIS } from '../../../utils/groupId';
import { hapticLight, hapticSuccess, hapticError, hapticDouble } from '../../../utils/haptics';
import Avatar from '../../common/Avatar';
import Toast from '../../Toast/Toast';
import ConfirmModal from '../../common/ConfirmModal';
import AddMembersModal from './AddMembersModal';
import './GroupInfo.css';

const GroupInfo = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();

  const groupId = chatIdToGroupId(chatId);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingEmoji, setEditingEmoji] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  // Live subscribe to group
  useEffect(() => {
    if (!groupId) return;
    const groupRef = ref(db, `groups/${groupId}`);
    const unsub = onValue(groupRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setGroup({ id: groupId, ...data });
        setEditName(data.name || '');
      } else {
        setGroup(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [groupId]);

  // Fetch member profiles
  useEffect(() => {
    if (!group?.members) return;
    const uids = Object.keys(group.members);
    let cancelled = false;
    (async () => {
      const map = {};
      for (const uid of uids) {
        const cached = profiles[uid];
        if (cached?.name) {
          map[uid] = cached;
        } else {
          try {
            const snap = await get(ref(db, `profiles/${uid}`));
            if (snap.exists()) map[uid] = snap.val();
          } catch {}
        }
      }
      if (!cancelled) setMemberProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [group?.members, profiles]);

  const isAdmin = useMemo(() => {
    if (!user?.uid || !group?.members) return false;
    return group.members[user.uid]?.role === 'admin';
  }, [user?.uid, group?.members]);

  const isCreator = group?.createdBy === user?.uid;

  const memberUids = useMemo(() => {
    if (!group?.members) return [];
    // Admins first, then by joinedAt
    return Object.keys(group.members).sort((a, b) => {
      const aRole = group.members[a]?.role === 'admin' ? 0 : 1;
      const bRole = group.members[b]?.role === 'admin' ? 0 : 1;
      if (aRole !== bRole) return aRole - bRole;
      return (group.members[a]?.joinedAt || 0) - (group.members[b]?.joinedAt || 0);
    });
  }, [group?.members]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const closeConfirm = () => setConfirm((prev) => ({ ...prev, isOpen: false }));

  const openConfirm = (config) => setConfirm({ isOpen: true, ...config });

  // ─── Save group name ───
  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) { hapticError(); return; }
    if (trimmed === group.name) { setEditingName(false); return; }
    hapticLight();
    const res = await updateGroupInfo(groupId, user.uid, { name: trimmed });
    if (res.ok) {
      hapticSuccess();
      setEditingName(false);
      showToast('Group name updated');
    } else {
      hapticError();
      showToast(res.error || 'Failed to update', 'error');
    }
  };

  // ─── Change group emoji ───
  const handleSelectEmoji = async (emoji) => {
    hapticLight();
    const res = await updateGroupInfo(groupId, user.uid, { emoji });
    if (res.ok) {
      hapticSuccess();
      setEditingEmoji(false);
      showToast('Group emoji updated');
    } else {
      hapticError();
      showToast(res.error || 'Failed to update', 'error');
    }
  };

  // ─── Promote member ───
  const handlePromote = (uid) => {
    const m = memberProfiles[uid] || {};
    openConfirm({
      title: 'Make admin?',
      message: `Give ${m.name || 'this member'} admin powers. Admins can add/remove members and edit group info.`,
      confirmText: 'Make admin',
      onConfirm: async () => {
        closeConfirm();
        hapticLight();
        const res = await setMemberRole(groupId, user.uid, uid, 'admin');
        if (res.ok) {
          hapticSuccess();
          showToast('Member promoted');
        } else {
          hapticError();
          showToast(res.error || 'Failed', 'error');
        }
      },
    });
  };

  // ─── Demote admin ───
  const handleDemote = (uid) => {
    const m = memberProfiles[uid] || {};
    openConfirm({
      title: 'Remove admin?',
      message: `Remove admin powers from ${m.name || 'this member'}?`,
      confirmText: 'Remove admin',
      onConfirm: async () => {
        closeConfirm();
        hapticLight();
        const res = await setMemberRole(groupId, user.uid, uid, 'member');
        if (res.ok) {
          hapticSuccess();
          showToast('Admin removed');
        } else {
          hapticError();
          showToast(res.error || 'Failed', 'error');
        }
      },
    });
  };

  // ─── Remove member ───
  const handleRemoveMember = (uid) => {
    const m = memberProfiles[uid] || {};
    openConfirm({
      title: 'Remove member?',
      message: `Remove ${m.name || 'this member'} from the group?`,
      confirmText: 'Remove',
      onConfirm: async () => {
        closeConfirm();
        hapticLight();
        const res = await removeGroupMember(groupId, user.uid, uid);
        if (res.ok) {
          hapticSuccess();
          showToast('Member removed');
        } else {
          hapticError();
          showToast(res.error || 'Failed', 'error');
        }
      },
    });
  };

  // ─── Leave group ───
  const handleLeave = () => {
    if (isCreator) {
      showToast('You created this group — delete it instead', 'error');
      hapticError();
      return;
    }
    openConfirm({
      title: 'Leave group?',
      message: 'You will stop receiving messages from this group.',
      confirmText: 'Leave',
      onConfirm: async () => {
        closeConfirm();
        hapticLight();
        const res = await leaveGroup(groupId, user.uid);
        if (res.ok) {
          hapticSuccess();
          navigate('/chats');
        } else {
          hapticError();
          showToast(res.error || 'Failed', 'error');
        }
      },
    });
  };

  // ─── Delete group ───
  const handleDelete = () => {
    openConfirm({
      title: 'Delete group?',
      message: 'This will permanently delete the group and all its messages for everyone. This cannot be undone.',
      confirmText: 'Delete group',
      onConfirm: async () => {
        closeConfirm();
        hapticDouble();
        const res = await deleteGroup(groupId, user.uid);
        if (res.ok) {
          hapticSuccess();
          navigate('/chats');
        } else {
          hapticError();
          showToast(res.error || 'Failed', 'error');
        }
      },
    });
  };

  // ─── Add members callback ───
  const handleAddMembers = async (uids) => {
    hapticLight();
    const res = await addGroupMembers(groupId, user.uid, uids);
    if (res.ok) {
      hapticSuccess();
      showToast(`Added ${res.added} member${res.added > 1 ? 's' : ''}`);
      setShowAddMembers(false);
    } else {
      hapticError();
      showToast(res.error || 'Failed to add', 'error');
    }
  };

  if (loading) {
    return (
      <div className="group-info-page">
        <div className="gi-loading">Loading group...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="group-info-page">
        <div className="gi-loading">Group not found.</div>
      </div>
    );
  }

  return (
    <div className="group-info-page">
      {/* Header */}
      <div className="gi-top-bar">
        <button className="gi-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <i className="fas fa-arrow-left" />
        </button>
        <h1>Group Info</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* Hero: emoji + name */}
      <div className="gi-hero">
        <button
          type="button"
          className="gi-emoji-btn"
          onClick={() => isAdmin && setEditingEmoji(true)}
          disabled={!isAdmin}
          title={isAdmin ? 'Change emoji' : ''}
        >
          <span className="gi-emoji">{group.emoji || '👥'}</span>
          {isAdmin && <span className="gi-emoji-edit"><i className="fas fa-pencil-alt" /></span>}
        </button>

        {editingName ? (
          <div className="gi-name-edit">
            <input
              type="text"
              className="gi-name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value.slice(0, 40))}
              maxLength={40}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditingName(false);
                  setEditName(group.name);
                }
              }}
            />
            <button className="gi-name-save" onClick={handleSaveName}>
              <i className="fas fa-check" />
            </button>
            <button
              className="gi-name-cancel"
              onClick={() => {
                setEditingName(false);
                setEditName(group.name);
              }}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        ) : (
          <div
            className={`gi-name ${isAdmin ? 'editable' : ''}`}
            onClick={() => isAdmin && setEditingName(true)}
          >
            <span>{group.name || 'Group'}</span>
            {isAdmin && <i className="fas fa-pencil-alt gi-name-pencil" />}
          </div>
        )}

        <div className="gi-meta">
          {memberUids.length} member{memberUids.length !== 1 ? 's' : ''}
          {group.createdAt && (
            <> · Created {new Date(group.createdAt).toLocaleDateString()}</>
          )}
        </div>
      </div>

      {/* Members list */}
      <div className="gi-section">
        <div className="gi-section-header">
          <span>Members</span>
          {isAdmin && (
            <button
              className="gi-add-btn"
              onClick={() => { hapticLight(); setShowAddMembers(true); }}
            >
              <i className="fas fa-user-plus" /> Add
            </button>
          )}
        </div>

        <div className="gi-member-list">
          {memberUids.map((uid) => {
            const m = memberProfiles[uid] || {};
            const memberRole = group.members[uid]?.role || 'member';
            const isMe = uid === user?.uid;
            const isThisAdmin = memberRole === 'admin';

            return (
              <div key={uid} className="gi-member-row">
                <Avatar src={m.avatar} name={m.name || 'User'} size={46} />
                <div className="gi-member-info">
                  <div className="gi-member-name">
                    {m.name || 'User'}
                    {isMe && <span className="gi-you"> (You)</span>}
                    {isThisAdmin && <span className="gi-admin-badge">Admin</span>}
                  </div>
                  {m.username && <span className="gi-member-handle">@{m.username}</span>}
                </div>

                {isAdmin && !isMe && (
                  <button
                    className="gi-member-menu-btn"
                    onClick={() => {
                      hapticLight();
                      if (isThisAdmin) {
                        handleDemote(uid);
                      } else {
                        // Show a mini menu via confirm modal
                        openConfirm({
                          title: m.name || 'Member',
                          message: 'What would you like to do?',
                          confirmText: 'Promote',
                          cancelText: 'Close',
                          onConfirm: () => {
                            closeConfirm();
                            handlePromote(uid);
                          },
                          extraAction: {
                            text: 'Remove',
                            onClick: () => {
                              closeConfirm();
                              handleRemoveMember(uid);
                            },
                          },
                        });
                      }
                    }}
                    aria-label="Member options"
                  >
                    <i className="fas fa-ellipsis-v" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="gi-section">
        <div className="gi-actions">
          <button className="gi-action-btn warn" onClick={handleLeave}>
            <i className="fas fa-sign-out-alt" />
            <span>Leave group</span>
          </button>

          {isCreator && (
            <button className="gi-action-btn danger" onClick={handleDelete}>
              <i className="fas fa-trash" />
              <span>Delete group</span>
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {editingEmoji && (
        <div
          className="gi-emoji-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingEmoji(false); }}
        >
          <div className="gi-emoji-sheet">
            <div className="gi-emoji-sheet-handle" />
            <h3>Choose emoji</h3>
            <div className="gi-emoji-grid">
              {GROUP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`gi-emoji-option ${group.emoji === emoji ? 'selected' : ''}`}
                  onClick={() => handleSelectEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAddMembers && (
        <AddMembersModal
          groupId={groupId}
          currentMembers={memberUids}
          onClose={() => setShowAddMembers(false)}
          onAdd={handleAddMembers}
        />
      )}

      <ConfirmModal
        isOpen={confirm.isOpen}
        onClose={closeConfirm}
        onConfirm={confirm.onConfirm}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.confirmText}
        cancelText={confirm.cancelText}
      />

      {confirm.extraAction && confirm.isOpen && (
        <button
          className="gi-extra-action-btn"
          onClick={confirm.extraAction.onClick}
        >
          {confirm.extraAction.text}
        </button>
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default GroupInfo;
