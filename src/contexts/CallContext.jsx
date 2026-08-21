// src/contexts/CallContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from './ProfileContext';
import { db } from '../services/firebase';
import { ref, onChildAdded, off, update, remove, onValue, get } from 'firebase/database';
import Avatar from '../components/common/Avatar';
import VideoCallModal from '../components/VideoChat/VideoCallModal';
import ringtoneSound from '../utils/assets/ringtone.mp3';
import '../components/VideoChat/IncomingCallBanner.css';

const CallContext = createContext(null);

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();

  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);

  const bannerAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const recentCallsRef = useRef(new Set());
  const activeCallRef = useRef(null);
  const profilesRef = useRef(profiles);
  const fetchProfileRef = useRef(fetchProfile);
  const ringingUidRef = useRef(null);

  useEffect(() => {
    activeCallRef.current = activeVideoCall;
  }, [activeVideoCall]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    fetchProfileRef.current = fetchProfile;
  }, [fetchProfile]);

  // Unlock audio on first gesture (autoplay policy)
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        if (!bannerAudioRef.current) {
          bannerAudioRef.current = new Audio(ringtoneSound);
          bannerAudioRef.current.loop = true;
          bannerAudioRef.current.preload = 'auto';
          bannerAudioRef.current.volume = 0.7;
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
    document.addEventListener('click', unlock, { once: true, capture: true });
    document.addEventListener('touchstart', unlock, { once: true, capture: true });
    document.addEventListener('keydown', unlock, { once: true, capture: true });
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
        bannerAudioRef.current.volume = 0.7;
      }
      const a = bannerAudioRef.current;
      a.loop = true;
      a.volume = 0.7;
      a.muted = false;
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.warn('[Call] Ringtone blocked by browser:', err?.message || err);
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

  // Stable listener – no profiles in deps (that was killing the ring)
  useEffect(() => {
    if (!user?.uid) return;

    const callsRef = ref(db, 'calls/' + user.uid);
    console.log('[Call] Listening for incoming on calls/' + user.uid);

    const unsub = onChildAdded(callsRef, async (snapshot) => {
      if (snapshot.key === 'signals') return;

      const callData = snapshot.val();
      if (!callData || typeof callData !== 'object') return;

      const callerUid = callData.callerId || snapshot.key;
      if (!callerUid || callerUid === user.uid || callerUid === 'signals') return;

      const status = callData.status || 'ringing';
      if (status !== 'ringing') {
        console.log('[Call] Ignore non-ringing:', status);
        return;
      }

      const ts = callData.timestamp || callData.updatedAt || 0;
      if (ts && Date.now() - ts > 120_000) {
        console.log('[Call] Ignore stale invite');
        return;
      }

      if (ringingUidRef.current === callerUid) return;

      if (activeCallRef.current) {
        console.log('[Call] Busy – reject', callerUid);
        const payload = { status: 'busy', updatedAt: Date.now(), by: user.uid };
        update(ref(db, `calls/${user.uid}/${callerUid}`), payload).catch(() => {});
        update(ref(db, `calls/${callerUid}/signals/${user.uid}`), payload).catch(() => {});
        return;
      }

      if (recentCallsRef.current.has(callerUid)) {
        console.log('[Call] Ghost guard – skip', callerUid);
        return;
      }

      console.log('[Call] Incoming ring from', callerUid);
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
      } catch (e) {
        console.warn('[Call] profile fetch failed', e);
      }

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

      setIncomingCallData({ uid: callerUid, name, avatar });
      playBannerRingtone();
    });

    return () => {
      off(callsRef);
      unsub();
    };
  }, [user?.uid, playBannerRingtone]);

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
          alert('This user is live right now. Join their stream from Home instead of calling.');
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
    const { uid, name, avatar } = incomingCallData;
    ringingUidRef.current = null;
    setIncomingCallData(null);
    setActiveVideoCall({ uid, name, avatar, role: 'receiver' });
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

      console.log('[Call] Declining – notifying caller', callerUid);
      Promise.all([
        update(ref(db, invitePath), payload),
        update(ref(db, `calls/${callerUid}/signals/${recipientUid}`), payload),
        update(ref(db, `calls/${recipientUid}/signals/${callerUid}`), payload),
      ]).catch((e) => console.warn('[Call] decline write failed', e));

      // Keep nodes so caller can read declined
      setTimeout(() => {
        remove(ref(db, invitePath)).catch(() => {});
        remove(ref(db, `calls/${callerUid}/signals/${recipientUid}`)).catch(() => {});
        remove(ref(db, `calls/${recipientUid}/signals/${callerUid}`)).catch(() => {});
      }, 5000);

      recentCallsRef.current.add(callerUid);
      setTimeout(() => recentCallsRef.current.delete(callerUid), 30_000);
    }
    ringingUidRef.current = null;
    setIncomingCallData(null);
  }, [incomingCallData, user, stopBannerRingtone]);

  const closeVideoCall = useCallback(() => {
    stopBannerRingtone();
    if (activeVideoCall?.uid) {
      recentCallsRef.current.add(activeVideoCall.uid);
      setTimeout(() => recentCallsRef.current.delete(activeVideoCall.uid), 30_000);
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
