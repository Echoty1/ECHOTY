// src/components/pages/Chat/GroupInfo.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { ROLES, ROLE_LABELS, isAtLeast } from '../../../utils/groupRoles';
import { hapticLight, hapticSuccess, hapticError, hapticDouble } from '../../../utils/haptics';
import Avatar from '../../common/Avatar';
import Toast from '../../Toast/Toast';
import ConfirmModal from '../../common/ConfirmModal';
import AddMembersModal from './AddMembersModal';
import GroupInviteModal from './GroupInviteModal';
import './GroupInfo.css';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_DESC_LENGTH = 200;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

  // Editing state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState('');

  const [editingEmoji, setEditingEmoji] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Modals
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeInvites, setActiveInvites] = useState(0);

  // Member menu (single open at a time)
  const [openMemberMenuUid, setOpenMemberMenuUid] = useState(null);
  const memberMenuRef = useRef(null);

  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  const fileInputRef = useRef(null);
  const descInputRef = useRef(null);

  // ─── Live subscribe to group ──────────────────────────────
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

  // ─── Fetch member profiles ────────────────────────────────
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
          } catch (_) {}
        }
      }
      if (!cancelled) setMemberProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [group?.members, profiles]);

  // ─── Fetch pending request profiles ───────────────────────
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
        if (cached?.name) {
          map[uid] = cached;
        } else {
          try {
            const snap = await get(ref(db, `profiles/${uid}`));
            if (snap.exists()) map[uid] = snap.val();
          } catch (_) {}
        }
      }
      if (!cancelled) setPendingProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [group?.pendingRequests, profiles]);

  // ─── Invite count ─────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listGroupInvites(groupId);
        if (!cancelled) setActiveInvites(list.length);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [groupId, showInviteModal]);

  // ─── Close member menu on outside click ───────────────────
  useEffect(() => {
    if (!openMemberMenuUid) return;
    const onDocClick = (e) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) {
        setOpenMemberMenuUid(null);
      }
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('touchstart', onDocClick);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [openMemberMenuUid]);

  // ─── Derived role ─────────────────────────────────────────
  const myRole = useMemo(() => {
    if (!user?.uid || !group?.members) return ROLES.MEMBER;
    if (group.createdBy === user.uid && !group.members[user.uid]?.role) return ROLES.OWNER;
    return group.members[user.uid]?.role || ROLES.MEMBER;
  }, [user?.uid, group]);

  const isOwner = myRole === ROLES.OWNER || group?.createdBy === user?.uid;
  const isAdminPlus = isAtLeast(myRole, ROLES.ADMIN);

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

  // ─── Toast helpers ────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const closeConfirm = () => setConfirm((prev) => ({ ...prev, isOpen: false }));
  const openConfirm = (config) => setConfirm({ isOpen: true, ...config });

  // ─── Save name ────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === group.name) {
      setEditingName(false);
      setEditName(group.name || '');
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
      showToast(res.error || 'Failed to update name', 'error');
    }
  };

  // ─── Save description ─────────────────────────────────────
  const handleSaveDescription = async () => {
    const trimmed = editDescription.trim().slice(0, MAX_DESC_LENGTH);
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
      showToast(res.error || 'Failed to update description', 'error');
    }
  };

  const startEditingDescription = () => {
    if (!isAdminPlus) return;
    hapticLight();
    setEditDescription(group.description || '');
    setEditingDescription(true);
    setTimeout(() => descInputRef.current?.focus(), 80);
  };

  // ─── Change emoji ─────────────────────────────────────────
  const handleSelectEmoji = async (emoji) => {
    hapticLight();
    const res = await updateGroupInfo(groupId, user.uid, { emoji });
    if (res.ok) {
      hapticSuccess();
      setEditingEmoji(false);
      showToast('Emoji updated');
    } else {
      hapticError();
      showToast(res.error || 'Failed to update emoji', 'error');
    }
  };

  // ─── Upload avatar ────────────────────────────────────────
  const handleAvatarFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) {
      hapticError();
      showToast('Image must be under 5 MB', 'error');
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      hapticError();
      showToast('Only JPG, PNG, or WEBP images', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      const downloadUrl = data.secure_url;
      const saveRes = await updateGroupInfo(groupId, user.uid, { avatar: downloadUrl });
      if (saveRes.ok) {
        hapticSuccess();
        showToast('Group photo updated');
      } else {
        hapticError();
        showToast(saveRes.error || 'Failed to save photo', 'error');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      hapticError();
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    openConfirm({
      title: 'Remove group photo?',
      message: 'The group will fall back to using the emoji.',
      confirmText: 'Remove',
      onConfirm: async () => {
        closeConfirm();
        hapticLight();
        const res = await updateGroupInfo(groupId, user.uid, { avatar: null });
        if (res.ok) {
          hapticSuccess();
          showToast('Photo removed');
        } else {
          hapticError();
          showToast(res.error || 'Failed to remove photo', 'error');
        }
      },
    });
  };

  // ─── Member actions ───────────────────────────────────────
  const handlePromote = (uid, role) => {
    const m = memberProfiles[uid] || {};
    openConfirm({
      title: `Make ${ROLE_LABELS[role]}?`,
      message: `${m.name || 'This member'} will get ${ROLE_LABELS[role]} powers.`,
      confirmText: 'Confirm',
      onConfirm: async () => {
        closeConfirm();
        setOpenMemberMenuUid(null);
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
        setOpenMemberMenuUid(null);
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
      message: 'This will permanently delete the group and all its messages for everyone. This cannot be undone.',
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

  // ─── ADD MEMBERS HANDLER ───────────────────────────────────
  const handleAddMembers = async (uids) => {
    hapticLight();
    const res = await addGroupMembers(groupId, user.uid, uids);
    if (res.ok) {
      hapticSuccess();
      showToast(`Added ${res.added} member${res.added > 1 ? 's' : ''}`);
      setShowAddMembers(false);
    } else {
      hapticError();
      showToast(res.error || 'Failed to add members', 'error');
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

  // ─── Loading / not-found ──────────────────────────────────
  if (loading) {
    return (
      <div className="group-info-page">
        <div className="gi-loading">Loading group info…</div>
      </div>
    );
  }
  if (!group) {
    return (
      <div className="group-info-page">
        <div className="gi-top-bar">
          <button className="gi-back-btn" onClick={() => navigate(-1)} aria-label="Back">
            <i className="fas fa-arrow-left" />
          </button>
          <h1>Group Info</h1>
          <div style={{ width: 36 }} />
        </div>
        <div className="gi-loading">Group not found.</div>
      </div>
    );
  }

  const descLength = editDescription.length;
  const descCounterClass =
    descLength > MAX_DESC_LENGTH - 20
      ? 'danger'
      : descLength > MAX_DESC_LENGTH - 50
      ? 'warn'
      : '';

  return (
    <div className="group-info-page">
      {/* ─── Top bar ─────────────────────────────────────── */}
      <div className="gi-top-bar">
        <button className="gi-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <i className="fas fa-arrow-left" />
        </button>
        <h1>Group Info</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* ─── Hero ────────────────────────────────────────── */}
      <div className="gi-hero">
        <div className="gi-avatar-wrap">
          {group.avatar ? (
            <img
              src={group.avatar}
              alt={group.name || 'Group'}
              className={`gi-avatar-img${uploadingAvatar ? ' uploading' : ''}`}
              onClick={() => isAdminPlus && !uploadingAvatar && fileInputRef.current?.click()}
            />
          ) : (
            <button
              type="button"
              className="gi-emoji-btn"
              onClick={() => isAdminPlus && setEditingEmoji(true)}
              disabled={!isAdminPlus}
              aria-label="Change group emoji"
            >
              <span className="gi-emoji">{group.emoji || '👥'}</span>
            </button>
          )}

          {uploadingAvatar && <span className="gi-upload-ring" aria-hidden="true" />}

          {isAdminPlus && !uploadingAvatar && (
            <div className="gi-avatar-menu">
              <button
                type="button"
                className="gi-avatar-menu-btn"
                onClick={() => setEditingEmoji(true)}
                title="Change emoji"
                aria-label="Change emoji"
              >
                <i className="fas fa-smile" />
              </button>
              <button
                type="button"
                className="gi-avatar-menu-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload photo"
                aria-label="Upload photo"
                disabled={uploadingAvatar}
              >
                <i className="fas fa-image" />
              </button>
              {group.avatar && (
                <button
                  type="button"
                  className="gi-avatar-menu-btn danger"
                  onClick={handleRemoveAvatar}
                  title="Remove photo"
                  aria-label="Remove photo"
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
            const f = e.target.files?.[0];
            if (f) handleAvatarFile(f);
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
                  setEditName(group.name || '');
                }
              }}
            />
            <button className="gi-name-save" onClick={handleSaveName} aria-label="Save name">
              <i className="fas fa-check" />
            </button>
            <button
              className="gi-name-cancel"
              onClick={() => {
                setEditingName(false);
                setEditName(group.name || '');
              }}
              aria-label="Cancel"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        ) : (
          <div
            className={`gi-name${isAdminPlus ? ' editable' : ''}`}
            onClick={() => isAdminPlus && setEditingName(true)}
            role={isAdminPlus ? 'button' : undefined}
            tabIndex={isAdminPlus ? 0 : undefined}
          >
            <span>{group.name || 'Group'}</span>
            {isAdminPlus && <i className="fas fa-pencil-alt gi-name-pencil" />}
          </div>
        )}

        <div className="gi-meta">
          {memberUids.length} member{memberUids.length !== 1 ? 's' : ''}
          {isOwner && <span> · 👑 You own this group</span>}
        </div>
      </div>

      {/* ─── Description ─────────────────────────────────── */}
      <div className="gi-section">
        <div className="gi-section-header">
          <span>Description</span>
          {isAdminPlus && !editingDescription && (
            <button
              className="gi-edit-btn"
              onClick={startEditingDescription}
              aria-label={group.description ? 'Edit description' : 'Add description'}
            >
              <i className="fas fa-pen" /> {group.description ? 'Edit' : 'Add'}
            </button>
          )}
        </div>

        {editingDescription ? (
          <div className="gi-desc-edit">
            <textarea
              ref={descInputRef}
              className="gi-desc-textarea"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, MAX_DESC_LENGTH))}
              placeholder="What's this group about?"
              rows={3}
              maxLength={MAX_DESC_LENGTH}
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
            <div className={`gi-desc-counter ${descCounterClass}`}>
              {descLength}/{MAX_DESC_LENGTH}
            </div>
          </div>
        ) : group.description ? (
          <div className="gi-desc-text">{group.description}</div>
        ) : (
          <div
            className={`gi-desc-empty${isAdminPlus ? ' clickable' : ''}`}
            onClick={isAdminPlus ? startEditingDescription : undefined}
            role={isAdminPlus ? 'button' : undefined}
            tabIndex={isAdminPlus ? 0 : undefined}
          >
            {isAdminPlus ? 'Tap to add a description' : 'No description yet.'}
          </div>
        )}
      </div>

      {/* ─── Pending requests ────────────────────────────── */}
      {isAdminPlus && pendingUids.length > 0 && (
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
                      aria-label="Approve request"
                    >
                      <i className="fas fa-check" />
                    </button>
                    <button
                      className="gi-pending-btn reject"
                      onClick={() => handleReject(uid)}
                      title="Reject"
                      aria-label="Reject request"
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

      {/* ─── Members ─────────────────────────────────────── */}
      <div className="gi-section">
        <div className="gi-section-header">
          <span>Members ({memberUids.length})</span>
          {isAdminPlus && (
            <button
              className="gi-add-btn"
              onClick={() => {
                hapticLight();
                setShowAddMembers(true);
              }}
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
            const canActOnThis =
              isAdminPlus &&
              !isMe &&
              !(role === 'owner') &&
              !(role === 'admin' && !isOwner);

            return (
              <div key={uid} className="gi-member-row">
                <Avatar src={m.avatar} name={m.name || 'User'} size={46} />
                <div className="gi-member-info">
                  <div className="gi-member-name">
                    <span>{m.name || 'User'}</span>
                    {isMe && <span className="gi-you">(You)</span>}
                    {role === 'owner' && (
                      <span className="gi-role-badge owner" title="Owner">
                        👑 Owner
                      </span>
                    )}
                    {role === 'admin' && (
                      <span className="gi-role-badge admin" title="Admin">
                        🛡 Admin
                      </span>
                    )}
                    {role === 'moderator' && (
                      <span className="gi-role-badge moderator" title="Moderator">
                        Mod
                      </span>
                    )}
                  </div>
                  {m.username && <span className="gi-member-handle">@{m.username}</span>}
                </div>

                {canActOnThis && (
                  <button
                    className="gi-member-menu-btn"
                    onClick={() => {
                      hapticLight();
                      setOpenMemberMenuUid(openMemberMenuUid === uid ? null : uid);
                    }}
                    aria-label="Member options"
                  >
                    <i className="fas fa-ellipsis-v" />
                  </button>
                )}

                {canActOnThis && openMemberMenuUid === uid && (
                  <div
                    ref={memberMenuRef}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      marginTop: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      minWidth: '180px',
                      zIndex: 20,
                      overflow: 'hidden',
                    }}
                  >
                    {role === 'member' && (
                      <button
                        className="gi-action-btn"
                        onClick={() => handlePromote(uid, 'admin')}
                        style={{ padding: '12px 14px', fontSize: '13px' }}
                      >
                        <i className="fas fa-shield-alt" />
                        <span>Make Admin</span>
                      </button>
                    )}
                    {role === 'admin' && isOwner && (
                      <button
                        className="gi-action-btn"
                        onClick={() => handlePromote(uid, 'member')}
                        style={{ padding: '12px 14px', fontSize: '13px' }}
                      >
                        <i className="fas fa-user" />
                        <span>Demote to Member</span>
                      </button>
                    )}
                    {isOwner && role === 'admin' && (
                      <button
                        className="gi-action-btn"
                        onClick={() => handlePromote(uid, 'owner')}
                        style={{ padding: '12px 14px', fontSize: '13px' }}
                      >
                        <i className="fas fa-crown" />
                        <span>Transfer Ownership</span>
                      </button>
                    )}
                    <button
                      className="gi-action-btn danger"
                      onClick={() => handleRemoveMember(uid)}
                      style={{ padding: '12px 14px', fontSize: '13px' }}
                    >
                      <i className="fas fa-user-minus" />
                      <span>Remove from group</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Invite links (admin only) ───────────────────── */}
      {isAdminPlus && (
        <div className="gi-section">
          <div className="gi-section-header">
            <span>Invite Links</span>
          </div>
          <button
            className="gi-invite-action"
            onClick={() => {
              hapticLight();
              setShowInviteModal(true);
            }}
          >
            <i className="fas fa-link" />
            <div className="gi-invite-action-info">
              <strong>Manage invite links</strong>
              <span>
                {activeInvites} active link{activeInvites !== 1 ? 's' : ''}
              </span>
            </div>
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}

      {/* ─── Actions ─────────────────────────────────────── */}
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

      {/* ─── Emoji picker sheet ──────────────────────────── */}
      {editingEmoji && (
        <div
          className="gi-emoji-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingEmoji(false);
          }}
        >
          <div className="gi-emoji-sheet">
            <div className="gi-emoji-sheet-handle" />
            <h3>Choose an emoji</h3>
            <div className="gi-emoji-grid">
              {GROUP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`gi-emoji-option${group.emoji === emoji ? ' selected' : ''}`}
                  onClick={() => handleSelectEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────── */}
      {showAddMembers && (
        <AddMembersModal
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

export default GroupInfo;// src/components/pages/Chat/GroupInfo.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_DESC_LENGTH = 200;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

  // Editing state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState('');

  const [editingEmoji, setEditingEmoji] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Modals
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeInvites, setActiveInvites] = useState(0);

  // Member menu (single open at a time)
  const [openMemberMenuUid, setOpenMemberMenuUid] = useState(null);
  const memberMenuRef = useRef(null);

  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  const fileInputRef = useRef(null);
  const descInputRef = useRef(null);

  // ─── Live subscribe to group ──────────────────────────────
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

  // ─── Fetch member profiles ────────────────────────────────
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
          } catch (_) {}
        }
      }
      if (!cancelled) setMemberProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [group?.members, profiles]);

  // ─── Fetch pending request profiles ───────────────────────
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
        if (cached?.name) {
          map[uid] = cached;
        } else {
          try {
            const snap = await get(ref(db, `profiles/${uid}`));
            if (snap.exists()) map[uid] = snap.val();
          } catch (_) {}
        }
      }
      if (!cancelled) setPendingProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [group?.pendingRequests, profiles]);

  // ─── Invite count ─────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listGroupInvites(groupId);
        if (!cancelled) setActiveInvites(list.length);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [groupId, showInviteModal]);

  // ─── Close member menu on outside click ───────────────────
  useEffect(() => {
    if (!openMemberMenuUid) return;
    const onDocClick = (e) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) {
        setOpenMemberMenuUid(null);
      }
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('touchstart', onDocClick);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [openMemberMenuUid]);

  // ─── Derived role ─────────────────────────────────────────
  const myRole = useMemo(() => {
    if (!user?.uid || !group?.members) return ROLES.MEMBER;
    if (group.createdBy === user.uid && !group.members[user.uid]?.role) return ROLES.OWNER;
    return group.members[user.uid]?.role || ROLES.MEMBER;
  }, [user?.uid, group]);

  const isOwner = myRole === ROLES.OWNER || group?.createdBy === user?.uid;
  const isAdminPlus = isAtLeast(myRole, ROLES.ADMIN);

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

  // ─── Toast helpers ────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const closeConfirm = () => setConfirm((prev) => ({ ...prev, isOpen: false }));
  const openConfirm = (config) => setConfirm({ isOpen: true, ...config });

  // ─── Save name ────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === group.name) {
      setEditingName(false);
      setEditName(group.name || '');
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
      showToast(res.error || 'Failed to update name', 'error');
    }
  };

  // ─── Save description ─────────────────────────────────────
  const handleSaveDescription = async () => {
    const trimmed = editDescription.trim().slice(0, MAX_DESC_LENGTH);
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
      showToast(res.error || 'Failed to update description', 'error');
    }
  };

  const startEditingDescription = () => {
    if (!isAdminPlus) return;
    hapticLight();
    setEditDescription(group.description || '');
    setEditingDescription(true);
    setTimeout(() => descInputRef.current?.focus(), 80);
  };

  // ─── Change emoji ─────────────────────────────────────────
  const handleSelectEmoji = async (emoji) => {
    hapticLight();
    const res = await updateGroupInfo(groupId, user.uid, { emoji });
    if (res.ok) {
      hapticSuccess();
      setEditingEmoji(false);
      showToast('Emoji updated');
    } else {
      hapticError();
      showToast(res.error || 'Failed to update emoji', 'error');
    }
  };

  // ─── Upload avatar ────────────────────────────────────────
  const handleAvatarFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) {
      hapticError();
      showToast('Image must be under 5 MB', 'error');
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      hapticError();
      showToast('Only JPG, PNG, or WEBP images', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      const downloadUrl = data.secure_url;
      const saveRes = await updateGroupInfo(groupId, user.uid, { avatar: downloadUrl });
      if (saveRes.ok) {
        hapticSuccess();
        showToast('Group photo updated');
      } else {
        hapticError();
        showToast(saveRes.error || 'Failed to save photo', 'error');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      hapticError();
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    openConfirm({
      title: 'Remove group photo?',
      message: 'The group will fall back to using the emoji.',
      confirmText: 'Remove',
      onConfirm: async () => {
        closeConfirm();
        hapticLight();
        const res = await updateGroupInfo(groupId, user.uid, { avatar: null });
        if (res.ok) {
          hapticSuccess();
          showToast('Photo removed');
        } else {
          hapticError();
          showToast(res.error || 'Failed to remove photo', 'error');
        }
      },
    });
  };

  // ─── Member actions ───────────────────────────────────────
  const handlePromote = (uid, role) => {
    const m = memberProfiles[uid] || {};
    openConfirm({
      title: `Make ${ROLE_LABELS[role]}?`,
      message: `${m.name || 'This member'} will get ${ROLE_LABELS[role]} powers.`,
      confirmText: 'Confirm',
      onConfirm: async () => {
        closeConfirm();
        setOpenMemberMenuUid(null);
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
        setOpenMemberMenuUid(null);
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
      message: 'This will permanently delete the group and all its messages for everyone. This cannot be undone.',
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

  // ─── Loading / not-found ──────────────────────────────────
  if (loading) {
    return (
      <div className="group-info-page">
        <div className="gi-loading">Loading group info…</div>
      </div>
    );
  }
  if (!group) {
    return (
      <div className="group-info-page">
        <div className="gi-top-bar">
          <button className="gi-back-btn" onClick={() => navigate(-1)} aria-label="Back">
            <i className="fas fa-arrow-left" />
          </button>
          <h1>Group Info</h1>
          <div style={{ width: 36 }} />
        </div>
        <div className="gi-loading">Group not found.</div>
      </div>
    );
  }

  const descLength = editDescription.length;
  const descCounterClass =
    descLength > MAX_DESC_LENGTH - 20
      ? 'danger'
      : descLength > MAX_DESC_LENGTH - 50
      ? 'warn'
      : '';

  return (
    <div className="group-info-page">
      {/* ─── Top bar ─────────────────────────────────────── */}
      <div className="gi-top-bar">
        <button className="gi-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <i className="fas fa-arrow-left" />
        </button>
        <h1>Group Info</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* ─── Hero ────────────────────────────────────────── */}
      <div className="gi-hero">
        <div className="gi-avatar-wrap">
          {group.avatar ? (
            <img
              src={group.avatar}
              alt={group.name || 'Group'}
              className={`gi-avatar-img${uploadingAvatar ? ' uploading' : ''}`}
              onClick={() => isAdminPlus && !uploadingAvatar && fileInputRef.current?.click()}
            />
          ) : (
            <button
              type="button"
              className="gi-emoji-btn"
              onClick={() => isAdminPlus && setEditingEmoji(true)}
              disabled={!isAdminPlus}
              aria-label="Change group emoji"
            >
              <span className="gi-emoji">{group.emoji || '👥'}</span>
            </button>
          )}

          {uploadingAvatar && <span className="gi-upload-ring" aria-hidden="true" />}

          {isAdminPlus && !uploadingAvatar && (
            <div className="gi-avatar-menu">
              <button
                type="button"
                className="gi-avatar-menu-btn"
                onClick={() => setEditingEmoji(true)}
                title="Change emoji"
                aria-label="Change emoji"
              >
                <i className="fas fa-smile" />
              </button>
              <button
                type="button"
                className="gi-avatar-menu-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload photo"
                aria-label="Upload photo"
                disabled={uploadingAvatar}
              >
                <i className="fas fa-image" />
              </button>
              {group.avatar && (
                <button
                  type="button"
                  className="gi-avatar-menu-btn danger"
                  onClick={handleRemoveAvatar}
                  title="Remove photo"
                  aria-label="Remove photo"
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
            const f = e.target.files?.[0];
            if (f) handleAvatarFile(f);
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
                  setEditName(group.name || '');
                }
              }}
            />
            <button className="gi-name-save" onClick={handleSaveName} aria-label="Save name">
              <i className="fas fa-check" />
            </button>
            <button
              className="gi-name-cancel"
              onClick={() => {
                setEditingName(false);
                setEditName(group.name || '');
              }}
              aria-label="Cancel"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        ) : (
          <div
            className={`gi-name${isAdminPlus ? ' editable' : ''}`}
            onClick={() => isAdminPlus && setEditingName(true)}
            role={isAdminPlus ? 'button' : undefined}
            tabIndex={isAdminPlus ? 0 : undefined}
          >
            <span>{group.name || 'Group'}</span>
            {isAdminPlus && <i className="fas fa-pencil-alt gi-name-pencil" />}
          </div>
        )}

        <div className="gi-meta">
          {memberUids.length} member{memberUids.length !== 1 ? 's' : ''}
          {isOwner && <span> · 👑 You own this group</span>}
        </div>
      </div>

      {/* ─── Description ─────────────────────────────────── */}
      <div className="gi-section">
        <div className="gi-section-header">
          <span>Description</span>
          {isAdminPlus && !editingDescription && (
            <button
              className="gi-edit-btn"
              onClick={startEditingDescription}
              aria-label={group.description ? 'Edit description' : 'Add description'}
            >
              <i className="fas fa-pen" /> {group.description ? 'Edit' : 'Add'}
            </button>
          )}
        </div>

        {editingDescription ? (
          <div className="gi-desc-edit">
            <textarea
              ref={descInputRef}
              className="gi-desc-textarea"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, MAX_DESC_LENGTH))}
              placeholder="What's this group about?"
              rows={3}
              maxLength={MAX_DESC_LENGTH}
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
            <div className={`gi-desc-counter ${descCounterClass}`}>
              {descLength}/{MAX_DESC_LENGTH}
            </div>
          </div>
        ) : group.description ? (
          <div className="gi-desc-text">{group.description}</div>
        ) : (
          <div
            className={`gi-desc-empty${isAdminPlus ? ' clickable' : ''}`}
            onClick={isAdminPlus ? startEditingDescription : undefined}
            role={isAdminPlus ? 'button' : undefined}
            tabIndex={isAdminPlus ? 0 : undefined}
          >
            {isAdminPlus ? 'Tap to add a description' : 'No description yet.'}
          </div>
        )}
      </div>

      {/* ─── Pending requests ────────────────────────────── */}
      {isAdminPlus && pendingUids.length > 0 && (
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
                      aria-label="Approve request"
                    >
                      <i className="fas fa-check" />
                    </button>
                    <button
                      className="gi-pending-btn reject"
                      onClick={() => handleReject(uid)}
                      title="Reject"
                      aria-label="Reject request"
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

      {/* ─── Members ─────────────────────────────────────── */}
      <div className="gi-section">
        <div className="gi-section-header">
          <span>Members ({memberUids.length})</span>
          {isAdminPlus && (
            <button
              className="gi-add-btn"
              onClick={() => {
                hapticLight();
                setShowAddMembers(true);
              }}
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
            const canActOnThis =
              isAdminPlus &&
              !isMe &&
              !(role === 'owner') &&
              !(role === 'admin' && !isOwner);

            return (
              <div key={uid} className="gi-member-row">
                <Avatar src={m.avatar} name={m.name || 'User'} size={46} />
                <div className="gi-member-info">
                  <div className="gi-member-name">
                    <span>{m.name || 'User'}</span>
                    {isMe && <span className="gi-you">(You)</span>}
                    {role === 'owner' && (
                      <span className="gi-role-badge owner" title="Owner">
                        👑 Owner
                      </span>
                    )}
                    {role === 'admin' && (
                      <span className="gi-role-badge admin" title="Admin">
                        🛡 Admin
                      </span>
                    )}
                    {role === 'moderator' && (
                      <span className="gi-role-badge moderator" title="Moderator">
                        Mod
                      </span>
                    )}
                  </div>
                  {m.username && <span className="gi-member-handle">@{m.username}</span>}
                </div>

                {canActOnThis && (
                  <button
                    className="gi-member-menu-btn"
                    onClick={() => {
                      hapticLight();
                      setOpenMemberMenuUid(openMemberMenuUid === uid ? null : uid);
                    }}
                    aria-label="Member options"
                  >
                    <i className="fas fa-ellipsis-v" />
                  </button>
                )}

                {canActOnThis && openMemberMenuUid === uid && (
                  <div
                    ref={memberMenuRef}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      marginTop: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      minWidth: '180px',
                      zIndex: 20,
                      overflow: 'hidden',
                    }}
                  >
                    {role === 'member' && (
                      <button
                        className="gi-action-btn"
                        onClick={() => handlePromote(uid, 'admin')}
                        style={{ padding: '12px 14px', fontSize: '13px' }}
                      >
                        <i className="fas fa-shield-alt" />
                        <span>Make Admin</span>
                      </button>
                    )}
                    {role === 'admin' && isOwner && (
                      <button
                        className="gi-action-btn"
                        onClick={() => handlePromote(uid, 'member')}
                        style={{ padding: '12px 14px', fontSize: '13px' }}
                      >
                        <i className="fas fa-user" />
                        <span>Demote to Member</span>
                      </button>
                    )}
                    {isOwner && role === 'admin' && (
                      <button
                        className="gi-action-btn"
                        onClick={() => handlePromote(uid, 'owner')}
                        style={{ padding: '12px 14px', fontSize: '13px' }}
                      >
                        <i className="fas fa-crown" />
                        <span>Transfer Ownership</span>
                      </button>
                    )}
                    <button
                      className="gi-action-btn danger"
                      onClick={() => handleRemoveMember(uid)}
                      style={{ padding: '12px 14px', fontSize: '13px' }}
                    >
                      <i className="fas fa-user-minus" />
                      <span>Remove from group</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Invite links (admin only) ───────────────────── */}
      {isAdminPlus && (
        <div className="gi-section">
          <div className="gi-section-header">
            <span>Invite Links</span>
          </div>
          <button
            className="gi-invite-action"
            onClick={() => {
              hapticLight();
              setShowInviteModal(true);
            }}
          >
            <i className="fas fa-link" />
            <div className="gi-invite-action-info">
              <strong>Manage invite links</strong>
              <span>
                {activeInvites} active link{activeInvites !== 1 ? 's' : ''}
              </span>
            </div>
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}

      {/* ─── Actions ─────────────────────────────────────── */}
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

      {/* ─── Emoji picker sheet ──────────────────────────── */}
      {editingEmoji && (
        <div
          className="gi-emoji-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingEmoji(false);
          }}
        >
          <div className="gi-emoji-sheet">
            <div className="gi-emoji-sheet-handle" />
            <h3>Choose an emoji</h3>
            <div className="gi-emoji-grid">
              {GROUP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`gi-emoji-option${group.emoji === emoji ? ' selected' : ''}`}
                  onClick={() => handleSelectEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────── */}
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
