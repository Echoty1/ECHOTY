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

  // ─── Incoming calls (global – works on every page) ─────────────
  useEffect(() => {
    if (!user?.uid) return;

    const callsRef = ref(db, 'calls/' + user.uid);
    const unsub = onChildAdded(callsRef, async (snapshot) => {
      // Ignore the signals/ folder and non-invite nodes
      if (snapshot.key === 'signals') return;

      const callData = snapshot.val();
      if (!callData || typeof callData !== 'object') return;
      if (activeVideoCall) return;

      // Real invite has callerId or is under calls/{me}/{callerUid}
      const callerUid = callData.callerId || snapshot.key;
      if (!callerUid || callerUid === user.uid || callerUid === 'signals') return;
      // Skip non-ringing status updates
      if (callData.status && callData.status !== 'ringing') return;

      let name = (callData.name || '').trim();
      let avatar = callData.avatar || '';

      // Always load from profiles so banner is never "Someone"
      try {
        const snap = await get(ref(db, `profiles/${callerUid}`));
        if (snap.exists()) {
          const p = snap.val() || {};
          if (p.name) name = p.name;
          if (p.avatar) avatar = p.avatar;
        }
      } catch (e) {
        console.warn('[Call] Could not load caller profile', e);
      }

      if (!name) {
        const cached = profiles[callerUid];
        if (cached?.name) name = cached.name;
        if (cached?.avatar && !avatar) avatar = cached.avatar;
      }
      if (!name) name = 'Someone';

      fetchProfile?.(callerUid);

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`Incoming call from ${name}`, {
          body: 'Tap to answer',
          icon: avatar || undefined,
        });
      }

      setIncomingCallData({ uid: callerUid, name, avatar });
    });

    return () => {
      off(callsRef);
      unsub();
    };
  }, [user?.uid, activeVideoCall, profiles, fetchProfile]);

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

  // Ringtone while banner is up
  useEffect(() => {
    if (incomingCallData && !activeVideoCall) {
      if (!bannerAudioRef.current) {
        bannerAudioRef.current = new Audio(ringtoneSound);
        bannerAudioRef.current.loop = true;
        bannerAudioRef.current.volume = 0.4;
      }
      bannerAudioRef.current.play().catch(() => {});
    } else if (bannerAudioRef.current) {
      bannerAudioRef.current.pause();
      bannerAudioRef.current.currentTime = 0;
    }
    return () => {
      if (bannerAudioRef.current) {
        bannerAudioRef.current.pause();
        bannerAudioRef.current.currentTime = 0;
      }
    };
  }, [incomingCallData, activeVideoCall]);

  const startVideoCall = useCallback(
    (uid, name, avatar) => {
      if (!user) return alert('You must be logged in to call.');
      if (uid === user.uid) return alert('You cannot call yourself!');
      setIncomingCallData(null);
      setActiveVideoCall({
        uid,
        name: name || 'User',
        avatar: avatar || '',
        role: 'caller',
      });
    },
    [user]
  );

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCallData) return;
    setActiveVideoCall({
      uid: incomingCallData.uid,
      name: incomingCallData.name,
      avatar: incomingCallData.avatar,
      role: 'receiver',
    });
    setIncomingCallData(null);
  }, [incomingCallData]);

  const declineIncomingCall = useCallback(() => {
    if (incomingCallData && user) {
      const recipientUid = user.uid;
      const callerUid = incomingCallData.uid;
      const invitePath = `calls/${recipientUid}/${callerUid}`;
      const payload = { status: 'declined', updatedAt: Date.now(), by: recipientUid };

      // Write where BOTH can read (each under their own calls/{uid}/ tree)
      Promise.all([
        update(ref(db, invitePath), payload),
        update(ref(db, `calls/${callerUid}/signals/${recipientUid}`), payload),
        update(ref(db, `calls/${recipientUid}/signals/${callerUid}`), payload),
      ])
        .then(() => {
          setTimeout(() => {
            remove(ref(db, invitePath)).catch(() => {});
            remove(ref(db, `calls/${callerUid}/signals/${recipientUid}`)).catch(() => {});
            remove(ref(db, `calls/${recipientUid}/signals/${callerUid}`)).catch(() => {});
          }, 3000);
        })
        .catch(() => {});
    }
    setIncomingCallData(null);
  }, [incomingCallData, user]);

  const closeVideoCall = useCallback(() => {
    setActiveVideoCall(null);
  }, []);

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

      {/* Global incoming banner – every page */}
      {incomingCallData && !activeVideoCall && (
        <div className="echo-incoming-banner">
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

      {/* Active call modal */}
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
