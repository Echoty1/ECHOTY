// src/contexts/CallContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from './ProfileContext';
import { db } from '../services/firebase';
import { ref, onChildAdded, onChildChanged, off, update, remove, get, onValue } from 'firebase/database';
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
  const recentCallsRef = useRef(new Map()); // uid -> timestamp when we finished with them
  const activeCallRef = useRef(null);
  const profilesRef = useRef(profiles);
  const fetchProfileRef = useRef(fetchProfile);
  const ringingUidRef = useRef(null);
  const handledInviteAtRef = useRef(new Map()); // callerUid -> timestamp of invite we already showed

  useEffect(() => {
    activeCallRef.current = activeVideoCall;
  }, [activeVideoCall]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    fetchProfileRef.current = fetchProfile;
  }, [fetchProfile]);

  // Unlock audio on first user gesture
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
            console.log('[Call] Audio unlocked');
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

  // Core: process a ringing invite from any source
  const processIncomingInvite = useCallback(
    async (callerUid, callData) => {
      if (!user?.uid || !callerUid || callerUid === user.uid || callerUid === 'signals') return;

      const status = (callData && callData.status) || 'ringing';
      if (status !== 'ringing') return;

      const ts = callData.timestamp || callData.updatedAt || Date.now();
      // Ignore invites older than 2 minutes
      if (Date.now() - ts > 120_000) return;

      // Same invite (same timestamp) already shown
      const prevTs = handledInviteAtRef.current.get(callerUid);
      if (prevTs && prevTs === ts) return;

      // Already showing this caller on banner
      if (ringingUidRef.current === callerUid) return;

      // Ghost guard: only block for 20s after we ended/declined with them
      const recentAt = recentCallsRef.current.get(callerUid);
      if (recentAt && Date.now() - recentAt < 20_000) {
        // Allow if this invite is NEWER than when we closed
        if (ts <= recentAt) {
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

      console.log('[Call] Incoming ring from', callerUid, callData);
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
      });
      playBannerRingtone();
    },
    [user?.uid, playBannerRingtone]
  );

  // Listen with onChildAdded + onChildChanged so RE-calls on same path still ring
  useEffect(() => {
    if (!user?.uid) return;

    const callsRef = ref(db, 'calls/' + user.uid);
    console.log('[Call] Listening on calls/' + user.uid);

    const handleSnap = (snapshot) => {
      if (snapshot.key === 'signals') return;
      const callData = snapshot.val();
      if (!callData || typeof callData !== 'object') return;
      const callerUid = callData.callerId || snapshot.key;
      processIncomingInvite(callerUid, callData);
    };

    const unsubAdd = onChildAdded(callsRef, handleSnap);
    const unsubChange = onChildChanged(callsRef, handleSnap);

    return () => {
      off(callsRef);
      unsubAdd();
      unsubChange();
    };
  }, [user?.uid, processIncomingInvite]);

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
    if (!incomingCallData) return;
    stopBannerRingtone();
    const { uid, name, avatar, callerPeerId } = incomingCallData;
    ringingUidRef.current = null;
    setIncomingCallData(null);
    setActiveVideoCall({
      uid,
      name,
      avatar,
      role: 'receiver',
      callerPeerId: callerPeerId || null,
    });
  }, [incomingCallData, stopBannerRingtone]);

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
      console.log('[Call] Declining – notify', callerUid);
      Promise.all([
        update(ref(db, invitePath), payload),
        update(ref(db, `calls/${callerUid}/signals/${recipientUid}`), payload),
        update(ref(db, `calls/${recipientUid}/signals/${callerUid}`), payload),
      ]).catch((e) => console.warn('[Call] decline write failed', e));

      setTimeout(() => {
        remove(ref(db, invitePath)).catch(() => {});
        remove(ref(db, `calls/${callerUid}/signals/${recipientUid}`)).catch(() => {});
        remove(ref(db, `calls/${recipientUid}/signals/${callerUid}`)).catch(() => {});
      }, 5000);

      recentCallsRef.current.set(callerUid, Date.now());
    }
    ringingUidRef.current = null;
    setIncomingCallData(null);
  }, [incomingCallData, user, stopBannerRingtone]);

  const closeVideoCall = useCallback(() => {
    stopBannerRingtone();
    if (activeVideoCall?.uid) {
      recentCallsRef.current.set(activeVideoCall.uid, Date.now());
    }
    ringingUidRef.current = null;
    setIncomingCallData(null);
    setActiveVideoCall(null);
  }, [activeVideoCall, stopBannerRingtone]);

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
