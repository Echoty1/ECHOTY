// src/contexts/CallContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from './ProfileContext';
import { db } from '../services/firebase';
import {
  ref,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  off,
  update,
  remove,
  get,
} from 'firebase/database';
import Avatar from '../components/common/Avatar';
import VideoCallModal from '../components/VideoChat/VideoCallModal';
import ringtoneSound from '../utils/assets/ringtone.mp3';
import '../components/VideoChat/IncomingCallBanner.css';

const CallContext = createContext(null);

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) {
    console.error(
      '[Call] useCall used outside CallProvider. Wrap App with <CallProvider> in App.js'
    );
    return {
      activeVideoCall: null,
      incomingCallData: null,
      startVideoCall: () =>
        alert('Call system is not ready. Please refresh the page.'),
      acceptIncomingCall: () => {},
      declineIncomingCall: () => {},
      closeVideoCall: () => {},
    };
  }
  return ctx;
};

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();

  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);

  const bannerAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const recentCallsRef = useRef(new Map()); // callerUid -> endedAt
  const activeCallRef = useRef(null);
  const profilesRef = useRef(profiles);
  const fetchProfileRef = useRef(fetchProfile);
  const ringingUidRef = useRef(null);
  const handledInviteAtRef = useRef(new Map()); // callerUid -> invite timestamp already shown
  const incomingRef = useRef(null); // mirror of incomingCallData for listeners

  useEffect(() => {
    activeCallRef.current = activeVideoCall;
  }, [activeVideoCall]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    fetchProfileRef.current = fetchProfile;
  }, [fetchProfile]);

  useEffect(() => {
    incomingRef.current = incomingCallData;
  }, [incomingCallData]);

  // Unlock audio on first gesture
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        if (!bannerAudioRef.current) {
          bannerAudioRef.current = new Audio(ringtoneSound);
          bannerAudioRef.current.loop = true;
          bannerAudioRef.current.preload = 'auto';
          bannerAudioRef.current.volume = 0.85;
        }
        const a = bannerAudioRef.current;
        a.muted = true;
        const p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
            audioUnlockedRef.current = true;
          }).catch(() => {});
        }
      } catch (_) {}
    };
    document.addEventListener('click', unlock, { capture: true });
    document.addEventListener('touchstart', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    return () => {
      document.removeEventListener('click', unlock, { capture: true });
      document.removeEventListener('touchstart', unlock, { capture: true });
      document.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  const stopBannerRingtone = useCallback(() => {
    if (bannerAudioRef.current) {
      try {
        bannerAudioRef.current.pause();
        bannerAudioRef.current.currentTime = 0;
      } catch (_) {}
    }
  }, []);

  const playBannerRingtone = useCallback(() => {
    try {
      if (!bannerAudioRef.current) {
        bannerAudioRef.current = new Audio(ringtoneSound);
        bannerAudioRef.current.loop = true;
        bannerAudioRef.current.preload = 'auto';
        bannerAudioRef.current.volume = 0.85;
      }
      const a = bannerAudioRef.current;
      a.loop = true;
      a.volume = 0.85;
      a.muted = false;
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.warn('[Call] Ringtone blocked:', err?.message || err);
        });
      }
    } catch (e) {
      console.warn('[Call] Ringtone error', e);
    }
  }, []);

  useEffect(() => {
    if (incomingCallData && !activeVideoCall) {
      playBannerRingtone();
      if (navigator.vibrate) {
        try {
          navigator.vibrate([300, 150, 300, 150, 300]);
        } catch (_) {}
      }
    } else {
      stopBannerRingtone();
    }
    return () => stopBannerRingtone();
  }, [incomingCallData, activeVideoCall, playBannerRingtone, stopBannerRingtone]);

  /** Stop banner + ringtone for a specific caller (multi-device / status change) */
  const dismissIncoming = useCallback(
    (callerUid, reason = '') => {
      if (callerUid && ringingUidRef.current && ringingUidRef.current !== callerUid) {
        return; // different caller still ringing
      }
      console.log('[Call] Dismiss incoming', callerUid, reason);
      stopBannerRingtone();
      if (callerUid) {
        recentCallsRef.current.set(callerUid, Date.now());
      }
      ringingUidRef.current = null;
      setIncomingCallData((prev) => {
        if (!prev) return null;
        if (callerUid && prev.uid !== callerUid) return prev;
        return null;
      });
    },
    [stopBannerRingtone]
  );

  // Show banner only for true ringing invites
  const processIncomingInvite = useCallback(
    async (callerUid, callData) => {
      if (!user?.uid || !callerUid || callerUid === user.uid || callerUid === 'signals') return;

      const status = (callData && callData.status) || 'ringing';

      // ── Multi-device: if this invite is no longer ringing, stop banner on this device ──
      if (status !== 'ringing') {
        if (
          ringingUidRef.current === callerUid ||
          incomingRef.current?.uid === callerUid
        ) {
          dismissIncoming(callerUid, `status=${status}`);
        }
        return;
      }

      const ts = callData.timestamp || callData.updatedAt || Date.now();
      if (Date.now() - ts > 90_000) return; // stale

      // Same invite already shown
      const prevTs = handledInviteAtRef.current.get(callerUid);
      if (prevTs && prevTs === ts) return;

      // Already showing this caller
      if (ringingUidRef.current === callerUid) return;

      // Ghost guard after end/decline/accept on this or another device
      const recentAt = recentCallsRef.current.get(callerUid);
      if (recentAt && Date.now() - recentAt < 45_000) {
        // Only allow if invite is clearly NEWER than when we finished
        if (ts <= recentAt + 500) {
          console.log('[Call] Ghost guard skip', callerUid);
          return;
        }
      }

      if (activeCallRef.current) {
        console.log('[Call] Busy – reject', callerUid);
        const payload = { status: 'busy', updatedAt: Date.now(), by: user.uid };
        update(ref(db, `calls/${user.uid}/${callerUid}`), payload).catch(() => {});
        update(ref(db, `calls/${callerUid}/signals/${user.uid}`), payload).catch(() => {});
        return;
      }

      console.log('[Call] Incoming ring from', callerUid);
      handledInviteAtRef.current.set(callerUid, ts);
      ringingUidRef.current = callerUid;

      let name = (callData.name || '').trim();
      let avatar = callData.avatar || '';
      const cached = profilesRef.current?.[callerUid];
      if (cached?.name) name = cached.name;
      if (cached?.avatar) avatar = cached.avatar;

      try {
        const snap = await get(ref(db, `profiles/${callerUid}`));
        if (snap.exists()) {
          const p = snap.val() || {};
          if (p.name) name = p.name;
          if (p.avatar) avatar = p.avatar;
        }
      } catch (_) {}

      if (!name) name = 'Someone';
      fetchProfileRef.current?.(callerUid);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(`Incoming call from ${name}`, {
            body: 'Tap to answer',
            icon: avatar || undefined,
          });
        } catch (_) {}
      }

      setIncomingCallData({
        uid: callerUid,
        name,
        avatar,
        callerPeerId: callData.callerPeerId || null,
        inviteTs: ts,
      });
      playBannerRingtone();
    },
    [user?.uid, playBannerRingtone, dismissIncoming]
  );

  // Listen: added / changed / removed
  useEffect(() => {
    if (!user?.uid) return;

    const callsRef = ref(db, 'calls/' + user.uid);
    console.log('[Call] Listening on calls/' + user.uid);

    const onSnap = (snapshot) => {
      if (snapshot.key === 'signals') return;
      const callData = snapshot.val();
      if (!callData || typeof callData !== 'object') return;
      const callerUid = callData.callerId || snapshot.key;
      processIncomingInvite(callerUid, callData);
    };

    // When invite node is deleted (call ended / cleaned up) → stop ring on all devices
    const onRemoved = (snapshot) => {
      if (snapshot.key === 'signals') return;
      const callerUid = snapshot.key;
      console.log('[Call] Invite removed', callerUid);
      dismissIncoming(callerUid, 'removed');
      // Prevent immediate re-ring of same finished call
      recentCallsRef.current.set(callerUid, Date.now());
    };

    const unsubAdd = onChildAdded(callsRef, onSnap);
    const unsubChange = onChildChanged(callsRef, onSnap);
    const unsubRemove = onChildRemoved(callsRef, onRemoved);

    return () => {
      off(callsRef);
      unsubAdd();
      unsubChange();
      unsubRemove();
    };
  }, [user?.uid, processIncomingInvite, dismissIncoming]);

  // Enrich banner when profile loads
  useEffect(() => {
    if (!incomingCallData?.uid) return;
    const p = profiles[incomingCallData.uid];
    if (!p) return;
    setIncomingCallData((prev) => {
      if (!prev) return prev;
      const name = p.name || prev.name;
      const avatar = p.avatar || prev.avatar;
      if (name === prev.name && avatar === prev.avatar) return prev;
      return { ...prev, name, avatar };
    });
  }, [profiles, incomingCallData?.uid]);

  const startVideoCall = useCallback(
    async (uid, name, avatar) => {
      if (!user) return alert('You must be logged in to call.');
      if (uid === user.uid) return alert('You cannot call yourself!');

      try {
        const myLive = await get(ref(db, `live/${user.uid}`));
        if (myLive.exists()) {
          alert('End your live stream before starting a call.');
          return;
        }
      } catch (_) {}

      try {
        const theirLive = await get(ref(db, `live/${uid}`));
        if (theirLive.exists()) {
          alert('This user is live. Join their stream from Home instead.');
          return;
        }
      } catch (_) {}

      stopBannerRingtone();
      setIncomingCallData(null);
      ringingUidRef.current = null;
      setActiveVideoCall({
        uid,
        name: name || 'User',
        avatar: avatar || '',
        role: 'caller',
      });
    },
    [user, stopBannerRingtone]
  );

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCallData || !user) return;
    stopBannerRingtone();
    const { uid, name, avatar, callerPeerId, inviteTs } = incomingCallData;

    // Mark handled so this invite never re-rings (this device or after refresh)
    if (inviteTs) handledInviteAtRef.current.set(uid, inviteTs);
    recentCallsRef.current.set(uid, Date.now());

    // Tell OTHER devices (same account) to stop ringing
    const invitePath = `calls/${user.uid}/${uid}`;
    update(ref(db, invitePath), {
      status: 'accepted',
      updatedAt: Date.now(),
      by: user.uid,
    }).catch(() => {});

    ringingUidRef.current = null;
    setIncomingCallData(null);
    setActiveVideoCall({
      uid,
      name,
      avatar,
      role: 'receiver',
      callerPeerId: callerPeerId || null,
    });
  }, [incomingCallData, user, stopBannerRingtone]);

  const declineIncomingCall = useCallback(() => {
    stopBannerRingtone();
    if (incomingCallData && user) {
      const recipientUid = user.uid;
      const callerUid = incomingCallData.uid;
      const invitePath = `calls/${recipientUid}/${callerUid}`;
      const payload = {
        status: 'declined',
        updatedAt: Date.now(),
        by: recipientUid,
      };
      console.log('[Call] Declining – notify caller + other devices', callerUid);
      Promise.all([
        update(ref(db, invitePath), payload),
        update(ref(db, `calls/${callerUid}/signals/${recipientUid}`), payload),
        update(ref(db, `calls/${recipientUid}/signals/${callerUid}`), payload),
      ]).catch((e) => console.warn('[Call] decline write failed', e));

      // Keep declined status long enough for other devices + caller to see it
      setTimeout(() => {
        remove(ref(db, invitePath)).catch(() => {});
        remove(ref(db, `calls/${callerUid}/signals/${recipientUid}`)).catch(() => {});
        remove(ref(db, `calls/${recipientUid}/signals/${callerUid}`)).catch(() => {});
      }, 6000);

      if (incomingCallData.inviteTs) {
        handledInviteAtRef.current.set(callerUid, incomingCallData.inviteTs);
      }
      recentCallsRef.current.set(callerUid, Date.now());
    }
    ringingUidRef.current = null;
    setIncomingCallData(null);
  }, [incomingCallData, user, stopBannerRingtone]);

  const closeVideoCall = useCallback(() => {
    stopBannerRingtone();
    if (activeVideoCall?.uid) {
      const otherUid = activeVideoCall.uid;
      recentCallsRef.current.set(otherUid, Date.now());
      // Ensure invite is gone so other devices cannot keep ringing
      if (user?.uid) {
        const paths =
          activeVideoCall.role === 'caller'
            ? [
                `calls/${otherUid}/${user.uid}`,
                `calls/${user.uid}/signals/${otherUid}`,
                `calls/${otherUid}/signals/${user.uid}`,
              ]
            : [
                `calls/${user.uid}/${otherUid}`,
                `calls/${user.uid}/signals/${otherUid}`,
                `calls/${otherUid}/signals/${user.uid}`,
              ];
        paths.forEach((p) => remove(ref(db, p)).catch(() => {}));
      }
    }
    ringingUidRef.current = null;
    setIncomingCallData(null);
    setActiveVideoCall(null);
  }, [activeVideoCall, user, stopBannerRingtone]);

  const value = {
    activeVideoCall,
    incomingCallData,
    startVideoCall,
    acceptIncomingCall,
    declineIncomingCall,
    closeVideoCall,
  };

  return (
    <CallContext.Provider value={value}>
      {children}

      {incomingCallData && !activeVideoCall && (
        <div
          className="echo-incoming-banner"
          onClick={playBannerRingtone}
          onTouchStart={playBannerRingtone}
        >
          <div className="echo-incoming-left">
            <div className="echo-incoming-avatar">
              {incomingCallData.avatar ? (
                <Avatar
                  src={incomingCallData.avatar}
                  name={incomingCallData.name}
                  size={48}
                />
              ) : (
                <div className="echo-incoming-phone-icon">
                  <i className="fas fa-phone" />
                </div>
              )}
            </div>
            <div className="echo-incoming-text">
              <div className="echo-incoming-name">{incomingCallData.name || 'Someone'}</div>
              <div className="echo-incoming-sub">is calling you...</div>
            </div>
          </div>
          <div className="echo-incoming-actions">
            <button type="button" className="echo-incoming-decline" onClick={declineIncomingCall}>
              <i className="fas fa-phone-slash" />
              <span>Decline</span>
            </button>
            <button type="button" className="echo-incoming-accept" onClick={acceptIncomingCall}>
              <i className="fas fa-phone" />
              <span>Accept</span>
            </button>
          </div>
        </div>
      )}

      {activeVideoCall && user && (
        <VideoCallModal
          targetUser={{
            uid: activeVideoCall.uid,
            name: activeVideoCall.name,
            avatar: activeVideoCall.avatar,
            callerPeerId: activeVideoCall.callerPeerId || null,
          }}
          currentUser={{
            uid: user.uid,
            name:
              user.displayName ||
              user.name ||
              (profiles[user.uid] && profiles[user.uid].name) ||
              'User',
            avatar:
              user.photoURL ||
              user.avatar ||
              (profiles[user.uid] && profiles[user.uid].avatar) ||
              '',
          }}
          isCaller={activeVideoCall.role === 'caller'}
          isReceiver={activeVideoCall.role === 'receiver'}
          onClose={closeVideoCall}
        />
      )}
    </CallContext.Provider>
  );
};

export default CallContext;
