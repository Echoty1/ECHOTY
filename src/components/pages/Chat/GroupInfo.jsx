// src/components/pages/Chat/GroupInfo.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get, onValue, update, remove } from 'firebase/database';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { chatIdToGroupId, GROUP_EMOJIS } from '../../../utils/groupId';
import {
  removeGroupMember,
  leaveGroup,
  updateGroupInfo,
  setMemberRole,
  deleteGroup,
  addGroupMembers,
} from '../../../services/groupService';
import { listGroupInvites } from '../../../services/groupInviteService';
import { ROLES, ROLE_COLORS, ROLE_LABELS, isAtLeast, can } from '../../../utils/groupRoles';
import { hapticLight, hapticSuccess, hapticError, hapticDouble } from '../../../utils/haptics';
import Avatar from '../../common/Avatar';
import Toast from '../../Toast/Toast';
import ConfirmModal from '../../common/ConfirmModal';
import AddMembersModal from './AddMembersModal';
import GroupInviteModal from './GroupInviteModal';
import './GroupInfo.css';

const GroupInfo = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profiles } = useProfile();

  const groupId = chatIdToGroupId(chatId);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [pendingProfiles, setPendingProfiles] = useState({});
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingEmoji, setEditingEmoji] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeInvites, setActiveInvites] = useState(0);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
    extraAction: null,
  });

  const fileInputRef = React.useRef(null);

  // Live subscribe to group
  useEffect(() => {
    if (!groupId) return;
    const groupRef = ref(db, `groups/${groupId}`);
    const unsub = onValue(groupRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setGroup({ id: groupId, ...data });
        setEditName(data.name || '');
        setEditDescription(data.description || '');
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
        if (cached?.name) map[uid] = cached;
        else {
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

  // Fetch pending request profiles
  useEffect(() => {
    if (!group?.pendingRequests) {
      setPendingProfiles({});
      return;
    }
    const uids = Object.keys(group.pendingRequests);
    let cancelled = false;
    (async () => {
      const map = {};
      for (const uid of uids) {
        const cached = profiles[uid];
        if (cached?.name) map[uid] = cached;
        else {
          try {
            const snap = await get(ref(db, `profiles/${uid}`));
            if (snap.exists()) map[uid] = snap.val();
          } catch {}
        }
      }
      if (!cancelled) setPendingProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [group?.pendingRequests, profiles]);

  // Fetch invite count
  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const list = await listGroupInvites(groupId);
      setActiveInvites(list.length);
    })();
  }, [groupId, showInviteModal]);

  const myRole = useMemo(() => {
    if (!user?.uid || !group?.members) return ROLES.MEMBER;
    return group.members[user.uid]?.role || ROLES.MEMBER;
  }, [user?.uid, group?.members]);

  const isOwner = myRole === ROLES.OWNER || group?.createdBy === user?.uid;

  const memberUids = useMemo(() => {
    if (!group?.members) return [];
    const order = { owner: 0, admin: 1, moderator: 2, member: 3 };
    return Object.keys(group.members).sort((a, b) => {
      const aRole = group.members[a]?.role || 'member';
      const bRole = group.members[b]?.role || 'member';
      if (order[aRole] !== order[bRole]) return order[aRole] - order[bRole];
      return (group.members[a]?.joinedAt || 0) - (group.members[b]?.joinedAt || 0);
    });
  }, [group?.members]);

  const pendingUids = useMemo(() => {
    if (!group?.pendingRequests) return [];
    return Object.keys(group.pendingRequests);
  }, [group?.pendingRequests]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const closeConfirm = () => setConfirm((prev) => ({ ...prev, isOpen: false }));
  const openConfirm = (config) => setConfirm({ isOpen: true, ...config });

  // ─── Save name ───
  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === group.name) {
      setEditingName(false);
      return;
    }
    hapticLight();
    const res = await updateGroupInfo(groupId, user.uid, { name: trimmed });
    if (res.ok) {
      hapticSuccess();
      setEditingName(false);
      showToast('Group name updated');
    } else {
      hapticError();
      showToast(res.error || 'Failed', 'error');
    }
  };

  // ─── Save description ───
  const handleSaveDescription = async () => {
    const trimmed = editDescription.trim();
    if (trimmed === (group.description || '')) {
      setEditingDescription(false);
      return;
    }
    hapticLight();
    const res = await updateGroupInfo(groupId, user.uid, { description: trimmed });
    if (res.ok) {
      hapticSuccess();
      setEditingDescription(false);
      showToast('Description updated');
    } else {
      hapticError();
      showToast(res.error || 'Failed', 'error');
    }
  };

  // ─── Change emoji ───
  const handleSelectEmoji = async (emoji) => {
    hapticLight();
    const res = await updateGroupInfo(groupId, user.uid, { emoji });
    if (res.ok) {
      hapticSuccess();
      setEditingEmoji(false);
      showToast('Emoji updated');
    } else {
      hapticError();
      showToast(res.error || 'Failed', 'error');
    }
  };

  // ─── Upload custom avatar ───
  const handleAvatarFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      hapticError();
      showToast('Image must be under 5 MB', 'error');
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      hapticError();
      showToast('Only JPG, PNG, or WEBP', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'echo_uploads');

      const res = await fetch(
        'https://api.cloudinary.com/v1_1/rjlscgan/upload',
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      const downloadUrl = data.secure_url;
      const res2 = await updateGroupInfo(groupId, user.uid, { avatar: downloadUrl });
      if (res2.ok) {
        hapticSuccess();
        showToast('Group avatar updated');
      } else {
        hapticError();
        showToast(res2.error || 'Failed', 'error');
      }
    } catch (err) {
      console.error(err);
      hapticError();
      showToast('Upload failed', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ─── Promote / demote ───
  const handlePromote = (uid, role) => {
    const m = memberProfiles[uid] || {};
    openConfirm({
      title: `Make ${ROLE_LABELS[role]}?`,
      message: `Give ${m.name || 'this member'} ${ROLE_LABELS[role]} powers.`,
      confirmText: 'Confirm',
      onConfirm: async () => {
        closeConfirm();
        hapticLight();
        const res = await setMemberRole(groupId, user.uid, uid, role);
        if (res.ok) {
          hapticSuccess();
          showToast(`${ROLE_LABELS[role]} role assigned`);
        } else {
          hapticError();
          showToast(res.error || 'Failed', 'error');
        }
      },
    });
  };

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

  const handleLeave = () => {
    if (isOwner) {
      hapticError();
      showToast('You own this group — delete it instead', 'error');
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

  const handleDelete = () => {
    openConfirm({
      title: 'Delete group?',
      message: 'This will permanently delete the group and all its messages for everyone.',
      confirmText: 'Delete',
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

  const handleAddMembers = async (uids) => {
    hapticLight();
    const res = await addGroupMembers(groupId, user.uid, uids);
    if (res.ok) {
      hapticSuccess();
      showToast(`Added ${res.added} member${res.added > 1 ? 's' : ''}`);
      setShowAddMembers(false);
    } else {
      hapticError();
      showToast(res.error || 'Failed', 'error');
    }
  };

  const handleApprove = async (uid) => {
    hapticLight();
    const { approvePendingRequest } = await import('../../../services/groupInviteService');
    const res = await approvePendingRequest(groupId, user.uid, uid);
    if (res.ok) {
      hapticSuccess();
      showToast('Request approved');
    } else {
      hapticError();
      showToast(res.error || 'Failed', 'error');
    }
  };

  const handleReject = async (uid) => {
    hapticLight();
    const { rejectPendingRequest } = await import('../../../services/groupInviteService');
    const res = await rejectPendingRequest(groupId, user.uid, uid);
    if (res.ok) {
      hapticSuccess();
      showToast('Request rejected');
    } else {
      hapticError();
      showToast(res.error || 'Failed', 'error');
    }
  };

  if (loading) {
    return <div className="group-info-page"><div className="gi-loading">Loading...</div></div>;
  }
  if (!group) {
    return <div className="group-info-page"><div className="gi-loading">Group not found.</div></div>;
  }

  return (
    <div className="group-info-page">
      <div className="gi-top-bar">
        <button className="gi-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <i className="fas fa-arrow-left" />
        </button>
        <h1>Group Info</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* Hero */}
      <div className="gi-hero">
        <div className="gi-avatar-wrap">
          {group.avatar ? (
            <img
              src={group.avatar}
              alt={group.name}
              className="gi-avatar-img"
              onClick={() => isAtLeast(myRole, ROLES.ADMIN) && fileInputRef.current?.click()}
            />
          ) : (
            <button
              type="button"
              className="gi-emoji-btn"
              onClick={() => isAtLeast(myRole, ROLES.ADMIN) && setEditingEmoji(true)}
              disabled={!isAtLeast(myRole, ROLES.ADMIN)}
            >
              <span className="gi-emoji">{group.emoji || '👥'}</span>
            </button>
          )}

          {isAtLeast(myRole, ROLES.ADMIN) && (
            <div className="gi-avatar-menu">
              <button
                className="gi-avatar-menu-btn"
                onClick={() => setEditingEmoji(true)}
                title="Change emoji"
              >
                <i className="fas fa-smile" />
              </button>
              <button
                className="gi-avatar-menu-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
                disabled={uploadingAvatar}
              >
                <i className={`fas ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-image'}`} />
              </button>
              {group.avatar && (
                <button
                  className="gi-avatar-menu-btn danger"
                  onClick={async () => {
                    hapticLight();
                    const res = await updateGroupInfo(groupId, user.uid, { avatar: null });
                    if (res.ok) {
                      hapticSuccess();
                      showToast('Avatar removed');
                    }
                  }}
                  title="Remove image"
                >
                  <i className="fas fa-trash" />
                </button>
              )}
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleAvatarFile(e.target.files[0]);
            e.target.value = '';
          }}
        />

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
            className={`gi-name ${isAtLeast(myRole, ROLES.ADMIN) ? 'editable' : ''}`}
            onClick={() => isAtLeast(myRole, ROLES.ADMIN) && setEditingName(true)}
          >
            <span>{group.name || 'Group'}</span>
            {isAtLeast(myRole, ROLES.ADMIN) && (
              <i className="fas fa-pencil-alt gi-name-pencil" />
            )}
          </div>
        )}

        <div className="gi-meta">
          {memberUids.length} member{memberUids.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Description */}
      <div className="gi-section">
        <div className="gi-section-header">
          <span>Description</span>
          {isAtLeast(myRole, ROLES.ADMIN) && !editingDescription && (
            <button
              className="gi-edit-btn"
              onClick={() => { hapticLight(); setEditingDescription(true); }}
            >
              <i className="fas fa-pen" /> {group.description ? 'Edit' : 'Add'}
            </button>
          )}
        </div>
        {editingDescription ? (
          <div className="gi-desc-edit">
            <textarea
              className="gi-desc-textarea"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, 500))}
              placeholder="What's this group about?"
              rows={3}
              maxLength={500}
              autoFocus
            />
            <div className="gi-desc-actions">
              <button
                className="gi-desc-cancel"
                onClick={() => {
                  setEditingDescription(false);
                  setEditDescription(group.description || '');
                }}
              >
                Cancel
              </button>
              <button className="gi-desc-save" onClick={handleSaveDescription}>
                Save
              </button>
            </div>
            <div className="gi-desc-counter">{editDescription.length}/500</div>
          </div>
        ) : group.description ? (
          <div className="gi-desc-text">{group.description}</div>
        ) : (
          <div className="gi-desc-empty">No description yet.</div>
        )}
      </div>

      {/* Pending requests */}
      {isAtLeast(myRole, ROLES.ADMIN) && pendingUids.length > 0 && (
        <div className="gi-section">
          <div className="gi-section-header">
            <span>Pending Requests ({pendingUids.length})</span>
          </div>
          <div className="gi-member-list">
            {pendingUids.map((uid) => {
              const m = pendingProfiles[uid] || {};
              return (
                <div key={uid} className="gi-member-row">
                  <Avatar src={m.avatar} name={m.name || 'User'} size={46} />
                  <div className="gi-member-info">
                    <div className="gi-member-name">{m.name || 'User'}</div>
                    {m.username && <span className="gi-member-handle">@{m.username}</span>}
                  </div>
                  <div className="gi-pending-actions">
                    <button
                      className="gi-pending-btn approve"
                      onClick={() => handleApprove(uid)}
                      title="Approve"
                    >
                      <i className="fas fa-check" />
                    </button>
                    <button
                      className="gi-pending-btn reject"
                      onClick={() => handleReject(uid)}
                      title="Reject"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="gi-section">
        <div className="gi-section-header">
          <span>Members ({memberUids.length})</span>
          {isAtLeast(myRole, ROLES.ADMIN) && (
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
            const role = group.members[uid]?.role || 'member';
            const isMe = uid === user?.uid;

            return (
              <div key={uid} className="gi-member-row">
                <Avatar src={m.avatar} name={m.name || 'User'} size={46} />
                <div className="gi-member-info">
                  <div className="gi-member-name">
                    {m.name || 'User'}
                    {isMe && <span className="gi-you"> (You)</span>}
                    {role !== 'member' && (
                      <span
                        className="gi-role-badge"
                        style={{
                          background: `${ROLE_COLORS[role]}22`,
                          color: ROLE_COLORS[role],
                          borderColor: `${ROLE_COLORS[role]}55`,
                        }}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </div>
                  {m.username && (
                    <span className="gi-member-handle">@{m.username}</span>
                  )}
                </div>

                {isAtLeast(myRole, ROLES.ADMIN) && !isMe && (
                  <button
                    className="gi-member-menu-btn"
                    onClick={() => {
                      hapticLight();
                      const options = [];
                      if (isAtLeast(myRole, ROLES.ADMIN)) {
                        if (role === 'member') options.push({ label: 'Make Moderator', role: 'moderator' });
                        if (role === 'moderator' || role === 'member') options.push({ label: 'Make Admin', role: 'admin' });
                        if (role === 'admin' || role === 'moderator') options.push({ label: 'Demote to Member', role: 'member' });
                      }
                      // Use confirm modal for simplicity
                      if (role !== 'member') {
                        handlePromote(uid, 'member');
                      } else {
                        handlePromote(uid, 'admin');
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

      {/* Invite links (admin only) */}
      {isAtLeast(myRole, ROLES.ADMIN) && (
        <div className="gi-section">
          <div className="gi-section-header">
            <span>Invite Links</span>
          </div>
          <button
            className="gi-invite-action"
            onClick={() => { hapticLight(); setShowInviteModal(true); }}
          >
            <i className="fas fa-link" />
            <div className="gi-invite-action-info">
              <strong>Manage invite links</strong>
              <span>{activeInvites} active link{activeInvites !== 1 ? 's' : ''}</span>
            </div>
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="gi-section">
        <div className="gi-actions">
          {!isOwner && (
            <button className="gi-action-btn warn" onClick={handleLeave}>
              <i className="fas fa-sign-out-alt" />
              <span>Leave group</span>
            </button>
          )}
          {isOwner && (
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

      {showInviteModal && (
        <GroupInviteModal
          groupId={groupId}
          onClose={() => setShowInviteModal(false)}
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
