// src/components/pages/Chat/GroupInviteModal.jsx
import React, { useState, useEffect } from 'react';
import {
  createInviteLink,
  listGroupInvites,
  revokeInvite,
} from '../../../services/groupInviteService';
import { useAuth } from '../../../hooks/useAuth';
import { hapticLight, hapticSuccess, hapticError } from '../../../utils/haptics';
import Toast from '../../Toast/Toast';
import ConfirmModal from '../../common/ConfirmModal';
import './GroupInviteModal.css';

const GroupInviteModal = ({ groupId, onClose }) => {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);
  const [maxUses, setMaxUses] = useState(100);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const refresh = async () => {
    setLoading(true);
    const list = await listGroupInvites(groupId);
    setInvites(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleCreate = async () => {
    if (!user?.uid || creating) return;
    hapticLight();
    setCreating(true);
    const res = await createInviteLink(groupId, user.uid, {
      expiresInDays: expiryDays,
      maxUses,
      requiresApproval: requireApproval,
    });
    setCreating(false);
    if (res.ok) {
      hapticSuccess();
      await refresh();
      showToast('Invite link created');
    } else {
      hapticError();
      showToast(res.error || 'Failed to create', 'error');
    }
  };

  const handleCopy = async (code) => {
    hapticLight();
    const url = `https://echoty.xyz/join/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      hapticSuccess();
      showToast('Link copied to clipboard');
    } catch {
      hapticError();
      showToast('Copy failed', 'error');
    }
  };

  const handleShare = async (code) => {
    hapticLight();
    const url = `https://echoty.xyz/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my ECHO group',
          text: 'You are invited to join my group on ECHO',
          url,
        });
      } catch {}
    } else {
      handleCopy(code);
    }
  };

  const handleRevoke = (code) => {
    setConfirm({
      isOpen: true,
      title: 'Revoke invite?',
      message: 'This link will stop working immediately.',
      onConfirm: async () => {
        setConfirm((p) => ({ ...p, isOpen: false }));
        hapticLight();
        const res = await revokeInvite(code, user.uid);
        if (res.ok) {
          hapticSuccess();
          await refresh();
          showToast('Invite revoked');
        } else {
          hapticError();
          showToast(res.error || 'Failed', 'error');
        }
      },
    });
  };

  const formatExpiry = (ts) => {
    if (!ts) return 'Never expires';
    const days = Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} days`;
  };

  return (
    <div className="gim-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="gim-sheet">
        <div className="gim-handle" />

        <div className="gim-header">
          <h2>Invite to Group</h2>
          <button className="gim-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Create new invite */}
        <div className="gim-create-card">
          <div className="gim-create-title">Create new invite link</div>

          <label className="gim-toggle-row">
            <span>Require admin approval</span>
            <button
              type="button"
              className={`gim-toggle ${requireApproval ? 'on' : ''}`}
              onClick={() => { hapticLight(); setRequireApproval(!requireApproval); }}
            >
              <span className="gim-toggle-thumb" />
            </button>
          </label>

          <div className="gim-selects">
            <label className="gim-select">
              <span>Expires</span>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
              >
                <option value={1}>In 1 day</option>
                <option value={7}>In 7 days</option>
                <option value={30}>In 30 days</option>
                <option value={0}>Never</option>
              </select>
            </label>

            <label className="gim-select">
              <span>Max uses</span>
              <select
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={1000}>1000</option>
              </select>
            </label>
          </div>

          <button
            className="gim-create-btn"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Generate Invite Link'}
          </button>
        </div>

        {/* Existing invites */}
        <div className="gim-existing">
          <div className="gim-existing-title">
            Active links ({invites.length})
          </div>

          {loading ? (
            <div className="gim-empty">Loading...</div>
          ) : invites.length === 0 ? (
            <div className="gim-empty">No invite links yet</div>
          ) : (
            invites.map((inv) => {
              const expired = inv.expiresAt && Date.now() > inv.expiresAt;
              const usedUp = inv.uses >= inv.maxUses;
              const invalid = expired || usedUp;

              return (
                <div key={inv.code} className={`gim-invite-row ${invalid ? 'invalid' : ''}`}>
                  <div className="gim-invite-info">
                    <div className="gim-invite-code">
                      echoty.xyz/join/{inv.code}
                    </div>
                    <div className="gim-invite-meta">
                      <span className={invalid ? 'invalid-tag' : ''}>
                        {expired ? 'Expired' : usedUp ? 'Used up' : formatExpiry(inv.expiresAt)}
                      </span>
                      <span>·</span>
                      <span>{inv.uses || 0}/{inv.maxUses} uses</span>
                    </div>
                  </div>
                  <div className="gim-invite-actions">
                    <button
                      className="gim-icon-btn"
                      onClick={() => handleCopy(inv.code)}
                      disabled={invalid}
                      title="Copy link"
                    >
                      <i className="fas fa-copy" />
                    </button>
                    <button
                      className="gim-icon-btn"
                      onClick={() => handleShare(inv.code)}
                      disabled={invalid}
                      title="Share"
                    >
                      <i className="fas fa-share-alt" />
                    </button>
                    <button
                      className="gim-icon-btn danger"
                      onClick={() => handleRevoke(inv.code)}
                      title="Revoke"
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirm.isOpen}
        onClose={() => setConfirm((p) => ({ ...p, isOpen: false }))}
        onConfirm={confirm.onConfirm}
        title={confirm.title}
        message={confirm.message}
        confirmText="Revoke"
        cancelText="Cancel"
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

export default GroupInviteModal;
