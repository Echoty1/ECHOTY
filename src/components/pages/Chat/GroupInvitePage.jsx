// src/components/pages/Chat/GroupInvitePage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get, update, remove } from 'firebase/database';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { chatIdToGroupId, groupIdToChatId } from '../../../utils/groupId';
import { joinGroupByCode } from '../../../services/groupInviteService';
import { hapticSuccess, hapticError, hapticLight } from '../../../utils/haptics';
import Avatar from '../../common/Avatar';
import Toast from '../../Toast/Toast';
import './GroupInvitePage.css';

const GroupInvitePage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profiles } = useProfile();

  const [status, setStatus] = useState('loading'); // loading | ready | joining | joined | error | already-member
  const [group, setGroup] = useState(null);
  const [inviteMeta, setInviteMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [memberPreviews, setMemberPreviews] = useState([]);

  const joinedRef = useRef(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ─── Load invite + group metadata ────────────────────────
  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMessage('Invalid invite link.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 1. Look up the code → groupId
        const codeSnap = await get(ref(db, `groupInviteCodes/${code}`));
        if (!codeSnap.exists()) {
          if (!cancelled) {
            setStatus('error');
            setErrorMessage('This invite link is invalid or has expired.');
          }
          return;
        }

        const codeData = codeSnap.val();

        // 2. Check if revoked
        if (codeData.revoked === true) {
          if (!cancelled) {
            setStatus('error');
            setErrorMessage('This invite link has been revoked.');
          }
          return;
        }

        // 3. Check if expired
        if (codeData.expiresAt && Date.now() > codeData.expiresAt) {
          if (!cancelled) {
            setStatus('error');
            setErrorMessage('This invite link has expired.');
          }
          return;
        }

        // 4. Check max uses
        if (codeData.maxUses && (codeData.uses || 0) >= codeData.maxUses) {
          if (!cancelled) {
            setStatus('error');
            setErrorMessage('This invite link has reached its usage limit.');
          }
          return;
        }

        const groupId = codeData.groupId;
        if (!groupId) {
          if (!cancelled) {
            setStatus('error');
            setErrorMessage('Invite is not linked to a group.');
          }
          return;
        }

        // 5. Load group metadata
        const groupSnap = await get(ref(db, `groups/${groupId}`));
        if (!groupSnap.exists()) {
          if (!cancelled) {
            setStatus('error');
            setErrorMessage('The group this invite points to no longer exists.');
          }
          return;
        }

        const groupData = { id: groupId, ...groupSnap.val() };

        if (!cancelled) {
          setGroup(groupData);
          setInviteMeta({ ...codeData, code });
        }

        // 6. Load creator profile
        const creatorUid = groupData.createdBy;
        if (creatorUid) {
          const cached = profiles[creatorUid];
          if (cached?.name) {
            if (!cancelled) setCreatorProfile(cached);
          } else {
            try {
              const creatorSnap = await get(ref(db, `profiles/${creatorUid}`));
              if (creatorSnap.exists() && !cancelled) {
                setCreatorProfile(creatorSnap.val());
              }
            } catch (_) {}
          }
        }

        // 7. Load a few member previews
        const memberUids = Object.keys(groupData.members || {}).slice(0, 3);
        const previews = [];
        for (const uid of memberUids) {
          const cached = profiles[uid];
          if (cached?.name) {
            previews.push({ uid, ...cached });
          } else {
            try {
              const snap = await get(ref(db, `profiles/${uid}`));
              if (snap.exists()) previews.push({ uid, ...snap.val() });
            } catch (_) {}
          }
        }
        if (!cancelled) setMemberPreviews(previews);

        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.error('GroupInvitePage load error:', err);
        if (!cancelled) {
          setStatus('error');
          setErrorMessage('Something went wrong loading this invite.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, profiles]);

  // ─── Auto-check if user is already a member ──────────────
  useEffect(() => {
    if (!user?.uid || !group?.members) return;
    if (group.members[user.uid]) {
      setStatus('already-member');
    }
  }, [user?.uid, group?.members]);

  // ─── Join handler ────────────────────────────────────────
  const handleJoin = async () => {
    if (!user?.uid || !group?.id || !inviteMeta?.code) return;
    if (joinedRef.current) return;
    joinedRef.current = true;

    hapticLight();
    setStatus('joining');

    try {
      const res = await joinGroupByCode(user.uid, inviteMeta.code);
      if (res.ok) {
        hapticSuccess();
        setStatus('joined');
        // Short delay so user sees the success state
        setTimeout(() => {
          const chatId = groupIdToChatId(group.id);
          navigate(`/chat/${chatId}`, { replace: true });
        }, 900);
      } else {
        joinedRef.current = false;
        hapticError();
        setStatus('ready');
        showToast(res.error || 'Could not join the group', 'error');
      }
    } catch (err) {
      console.error('Join failed:', err);
      joinedRef.current = false;
      hapticError();
      setStatus('ready');
      showToast('Something went wrong. Please try again.', 'error');
    }
  };

  const handleGoToChat = () => {
    if (!group?.id) return;
    hapticLight();
    const chatId = groupIdToChatId(group.id);
    navigate(`/chat/${chatId}`, { replace: true });
  };

  // ─── Auth loading state ──────────────────────────────────
  if (authLoading) {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-spinner" />
          <p className="gip-text">Loading…</p>
        </div>
      </div>
    );
  }

  // ─── Not logged in ───────────────────────────────────────
  if (!user) {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-icon-wrap">
            <i className="fas fa-lock gip-icon" />
          </div>
          <h1 className="gip-title">Sign in to join</h1>
          <p className="gip-text">
            You need an ECHO account to join this group.
          </p>
          <button
            type="button"
            className="gip-primary-btn"
            onClick={() =>
              navigate('/login', {
                state: { redirectAfterLogin: `/join/${code}` },
              })
            }
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading state ───────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-spinner" />
          <p className="gip-text">Checking invite…</p>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-icon-wrap error">
            <i className="fas fa-exclamation-triangle gip-icon" />
          </div>
          <h1 className="gip-title">Invite unavailable</h1>
          <p className="gip-text">{errorMessage || 'This invite is no longer valid.'}</p>
          <button
            type="button"
            className="gip-primary-btn"
            onClick={() => navigate('/chats', { replace: true })}
          >
            Back to chats
          </button>
        </div>
      </div>
    );
  }

  // ─── Already a member ────────────────────────────────────
  if (status === 'already-member') {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-group-avatar">
            {group?.avatar ? (
              <img src={group.avatar} alt={group?.name || 'Group'} />
            ) : (
              <span className="gip-emoji">{group?.emoji || '👥'}</span>
            )}
          </div>
          <h1 className="gip-title">{group?.name || 'Group'}</h1>
          <p className="gip-text">You're already a member of this group.</p>
          <button
            type="button"
            className="gip-primary-btn"
            onClick={handleGoToChat}
          >
            Open chat
          </button>
        </div>
      </div>
    );
  }

  // ─── Joined (success animation) ──────────────────────────
  if (status === 'joined') {
    return (
      <div className="gip-page">
        <div className="gip-card">
          <div className="gip-success-check">
            <i className="fas fa-check" />
          </div>
          <h1 className="gip-title">Joined!</h1>
          <p className="gip-text">
            Welcome to {group?.name || 'the group'}. Taking you to the chat…
          </p>
        </div>
      </div>
    );
  }

  // ─── Ready / joining state (main view) ───────────────────
  const memberCount = group?.members ? Object.keys(group.members).length : 0;
  const isJoining = status === 'joining';

  return (
    <div className="gip-page">
      <div className="gip-card">
        <div className="gip-group-avatar">
          {group?.avatar ? (
            <img src={group.avatar} alt={group?.name || 'Group'} />
          ) : (
            <span className="gip-emoji">{group?.emoji || '👥'}</span>
          )}
        </div>

        <h1 className="gip-title">{group?.name || 'Group'}</h1>

        <p className="gip-subtitle">
          {memberCount} member{memberCount !== 1 ? 's' : ''}
          {creatorProfile?.name && (
            <>
              {' · '}
              Created by{' '}
              <strong>{creatorProfile.name}</strong>
            </>
          )}
        </p>

        {memberPreviews.length > 0 && (
          <div className="gip-member-previews">
            <div className="gip-avatar-stack">
              {memberPreviews.map((m) => (
                <div key={m.uid} className="gip-avatar-stack-item">
                  <Avatar src={m.avatar} name={m.name || 'User'} size={36} />
                </div>
              ))}
              {memberCount > memberPreviews.length && (
                <div className="gip-avatar-stack-item gip-avatar-stack-more">
                  +{memberCount - memberPreviews.length}
                </div>
              )}
            </div>
            <span className="gip-members-label">
              {memberCount === 1
                ? 'You’ll be the second member'
                : `${memberCount} in the group`}
            </span>
          </div>
        )}

        {group?.description && (
          <div className="gip-description">
            <p>{group.description}</p>
          </div>
        )}

        <button
          type="button"
          className="gip-primary-btn"
          onClick={handleJoin}
          disabled={isJoining}
        >
          {isJoining ? (
            <>
              <span className="gip-btn-spinner" />
              Joining…
            </>
          ) : (
            'Join group'
          )}
        </button>

        <button
          type="button"
          className="gip-secondary-btn"
          onClick={() => navigate('/chats', { replace: true })}
          disabled={isJoining}
        >
          Not now
        </button>
      </div>

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

export default GroupInvitePage;
