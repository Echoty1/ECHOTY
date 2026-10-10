// src/components/pages/Chat/GroupInvitePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { getInviteByCode, isInviteValid, redeemInvite } from '../../../services/groupInviteService';
import { hapticSuccess, hapticError } from '../../../utils/haptics';
import './GroupInvitePage.css';

const GroupInvitePage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const inv = await getInviteByCode(code);
        if (cancelled) return;
        if (!inv) {
          setError('This invite link is invalid or has been deleted.');
          setLoading(false);
          return;
        }
        setInvite(inv);

        const validation = isInviteValid(inv);
        if (!validation.valid) {
          const msg = {
            revoked: 'This invite has been revoked.',
            expired: 'This invite link has expired.',
            used_up: 'This invite has reached its maximum uses.',
          }[validation.reason] || 'This invite is no longer valid.';
          setError(msg);
        }

        // Fetch group info
        const groupSnap = await get(ref(db, `groups/${inv.groupId}`));
        if (groupSnap.exists()) {
          setGroup({ id: inv.groupId, ...groupSnap.val() });
        } else {
          setError('The group this invite pointed to no longer exists.');
        }
      } catch (err) {
        console.error(err);
        setError('Could not load invite. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const handleJoin = async () => {
    if (!user?.uid || !invite) return;
    setRedeeming(true);
    try {
      const res = await redeemInvite(code, user.uid);
      if (res.ok) {
        hapticSuccess();
        if (res.pendingApproval) {
          setSuccess({ pending: true });
        } else if (res.alreadyMember) {
          navigate(`/chat/group_${res.groupId}`);
        } else {
          setSuccess({ pending: false });
          setTimeout(() => {
            navigate(`/chat/group_${res.groupId}`);
          }, 1200);
        }
      } else {
        hapticError();
        setError(res.error || 'Failed to join group');
      }
    } catch (err) {
      hapticError();
      setError(err.message);
    } finally {
      setRedeeming(false);
    }
  };

  const handleGoBack = () => {
    if (user) navigate('/chats');
    else navigate('/');
  };

  if (loading) {
    return (
      <div className="gip-page">
        <div className="gip-loading">
          <div className="gip-spinner" />
          <p>Loading invite...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-icon gip-icon-success">
            {success.pending ? '⏳' : '🎉'}
          </div>
          <h1>{success.pending ? 'Request Sent' : "You're in!"}</h1>
          <p>
            {success.pending
              ? 'The group admins will review your request shortly.'
              : `Welcome to ${group?.name || 'the group'}!`}
          </p>
          <button className="gip-btn primary" onClick={handleGoBack}>
            {success.pending ? 'Back to Chats' : 'Open Chat'}
          </button>
        </div>
      </div>
    );
  }

  if (error || !invite || !group) {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-icon gip-icon-error">⚠️</div>
          <h1>Invite Unavailable</h1>
          <p>{error || 'This invite is no longer valid.'}</p>
          <button className="gip-btn primary" onClick={handleGoBack}>
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gip-page">
      <div className="gip-card">
        <div className="gip-invite-label">You're invited to join</div>

        <div className="gip-group-preview">
          <div className="gip-group-emoji">
            {group.avatar ? (
              <img src={group.avatar} alt={group.name} />
            ) : (
              group.emoji || '👥'
            )}
          </div>
          <h1 className="gip-group-name">{group.name || 'Group'}</h1>
          {group.description && (
            <p className="gip-group-desc">{group.description}</p>
          )}
          <div className="gip-group-meta">
            {group.memberCount || 0} member{(group.memberCount || 0) !== 1 ? 's' : ''}
          </div>
        </div>

        {invite.requiresApproval && (
          <div className="gip-notice">
            <i className="fas fa-lock" />
            <span>This group requires admin approval to join.</span>
          </div>
        )}

        {!user ? (
          <div className="gip-actions">
            <button
              className="gip-btn primary"
              onClick={() => navigate(`/login?redirect=/join/${code}`)}
            >
              Log in to Join
            </button>
          </div>
        ) : (
          <div className="gip-actions">
            <button
              className="gip-btn primary"
              onClick={handleJoin}
              disabled={redeeming}
            >
              {redeeming
                ? 'Joining...'
                : invite.requiresApproval
                ? 'Request to Join'
                : 'Join Group'}
            </button>
            <button className="gip-btn ghost" onClick={handleGoBack}>
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupInvitePage;
