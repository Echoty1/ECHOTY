// src/components/pages/Home/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { useCall } from '../../../contexts/CallContext';
import { db } from '../../../services/firebase';
import { ref, set, onValue, onDisconnect, remove, off, get, update } from 'firebase/database';
import Peer from 'peerjs';
import Avatar from '../../common/Avatar';
import UserPreviewModal from '../../common/UserPreviewModal';
import LiveViewModal from '../../VideoChat/LiveViewModal';
import BroadcastView from '../../VideoChat/BroadcastView';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import StoriesBar from '../../Stories/StoriesBar';
import StoryRecorder from '../../Stories/StoryRecorder';
import StoryViewer from '../../Stories/StoryViewer';
import './Home.css';
import { isRealDisplayName, filterVisibleUsers } from '../../../utils/userIntegrity';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const HomeSkeleton = () => {
  return (
    <div className="home-page" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="home-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-input)' }} />
            <div style={{ width: '80px', height: '28px', borderRadius: '4px', background: 'var(--bg-input)' }} />
          </div>
          <div style={{ width: '100px', height: '36px', borderRadius: '30px', background: 'var(--bg-input)' }} />
        </div>
        <div style={{ width: '100%', boxSizing: 'border-box', marginBottom: '25px', position: 'relative' }}>
          <section className="home-section live-section" style={{ background: 'var(--bg-card)', backdropFilter: 'blur(20px)', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--bg-input)' }} />
                <div style={{ width: '100px', height: '20px', borderRadius: '4px', background: 'var(--bg-input)' }} />
              </div>
              <div style={{ width: '80px', height: '28px', borderRadius: '20px', background: 'var(--bg-input)' }} />
            </div>
            <div style={{ width: '200px', height: '14px', borderRadius: '4px', background: 'var(--bg-input)', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '8px', width: '100%' }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: 'clamp(70px, 15vw, 85px)', padding: '12px 8px', borderRadius: '16px' }}>
                  <div style={{ width: window.innerWidth < 600 ? '64px' : '80px', height: window.innerWidth < 600 ? '64px' : '80px', borderRadius: '50%', background: 'var(--bg-input)', animation: 'pulse-skeleton 1.5s infinite' }} />
                  <div style={{ width: '60px', height: '14px', borderRadius: '4px', background: 'var(--bg-input)', animation: 'pulse-skeleton 1.5s infinite' }} />
                </div>
              ))}
            </div>
          </section>
        </div>
        <div style={{ width: '100%', height: '56px', borderRadius: '18px', background: 'var(--bg-input)' }} />
      </div>
    </div>
  );
};

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profiles, fetchProfile } = useProfile();
  const { startVideoCall, activeVideoCall } = useCall();
  const [onlineUids, setOnlineUids] = useState([]);
  const [bannedUids, setBannedUids] = useState(new Set());
  const [liveUids, setLiveUids] = useState([]);
  const [liveMeta, setLiveMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingLive, setViewingLive] = useState(null);

  const [showRecorder, setShowRecorder] = useState(false);
  const [viewingStories, setViewingStories] = useState(null);
  const [currentStoryOwnerId, setCurrentStoryOwnerId] = useState(null);

  const [isLive, setIsLive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [peerError, setPeerError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const peerIdSet = useRef(false);
  const [broadcastStream, setBroadcastStream] = useState(null);

  const isDemoUser = user?.uid === DEMO_UID;
  const isSupportUser = user?.uid === SUPPORT_UID;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let peerInstance = null;
    let attempt = 0;
    const maxAttempts = 3;
    let timeoutId = null;

    const createPeer = () => {
      const config = {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          ],
        },
      };
      const peer = new Peer(undefined, config);
      peerInstance = peer;
      peerRef.current = peer;

      peer.on('open', (id) => {
        peerIdSet.current = true;
        set(ref(db, `peerIds/${user.uid}`), id).catch((err) => console.warn('Failed to store peer ID:', err));
        if (streamRef.current) {
          update(ref(db, 'live/' + user.uid), { peerId: id }).catch(() => {});
        }
        setPeerError(null);
      });

      peer.on('call', (call) => {
        if (streamRef.current) {
          call.answer(streamRef.current);
        } else {
          const wait = setInterval(() => {
            if (streamRef.current) {
              clearInterval(wait);
              try { call.answer(streamRef.current); } catch (_) {}
            }
          }, 250);
          setTimeout(() => clearInterval(wait), 12000);
        }
      });

      peer.on('error', (err) => {
        const code = err?.type || err?.message || '';
        if (attempt < maxAttempts && peerInstance) {
          attempt++;
          try { peerInstance.destroy(); } catch (_) {}
          timeoutId = setTimeout(createPeer, 2000);
        } else {
          let msg = 'Connection problem. Please try again.';
          if (/network|fetch|server-error|socket-error|unavailable/i.test(String(code))) {
            msg = 'Network issue reaching the call server. Check your connection and try again.';
          } else if (/peer-unavailable/i.test(String(code))) {
            msg = 'The other person is unavailable. Try again in a moment.';
          } else if (/Could not get an ID|Failed to fetch|Aborting/i.test(String(err?.message || code))) {
            msg = 'Could not connect to the call server. Please try again.';
          }
          setPeerError(msg);
        }
      });
    };

    createPeer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (peerInstance) peerInstance.destroy();
      peerRef.current = null;
      remove(ref(db, `peerIds/${user.uid}`)).catch(() => {});
    };
  }, [user]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (audioErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }
      streamRef.current = stream;
      setBroadcastStream(stream);
      setIsLive(true);
      setCameraError(null);

      if (user) {
        let name = user.displayName || profiles[user.uid]?.name || 'User';
        let avatar = user.photoURL || profiles[user.uid]?.avatar || '';
        try {
          const snap = await get(ref(db, `profiles/${user.uid}`));
          if (snap.exists()) {
            const p = snap.val() || {};
            if (p.name) name = p.name;
            if (p.avatar) avatar = p.avatar;
          }
        } catch (_) {}

        let peerId = peerRef.current?.id || null;
        for (let i = 0; i < 20 && !peerId; i += 1) {
          await new Promise((r) => setTimeout(r, 250));
          peerId = peerRef.current?.id || null;
        }

        sessionStorage.setItem('echo_live_active', user.uid);
        await set(ref(db, 'live/' + user.uid), {
          name,
          avatar,
          timestamp: Date.now(),
          peerId,
          viewers: 0,
        });
        onDisconnect(ref(db, 'live/' + user.uid)).remove();
      }
    } catch (err) {
      setCameraError('Allow camera access to go live.');
      setIsLive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setBroadcastStream(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsLive(false);
    if (user) {
      remove(ref(db, 'live/' + user.uid)).catch(() => {});
      remove(ref(db, 'liveChat/' + user.uid)).catch(() => {});
      sessionStorage.removeItem('echo_live_active');
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    if (sessionStorage.getItem('echo_live_active') !== user.uid) return;
    const done = window.confirm('You refreshed while live. Are you done with this live stream?');
    if (done) {
      remove(ref(db, 'live/' + user.uid)).catch(() => {});
      remove(ref(db, 'liveChat/' + user.uid)).catch(() => {});
    }
    sessionStorage.removeItem('echo_live_active');
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const endLiveNow = () => {
      if (sessionStorage.getItem('echo_live_active') !== user.uid) return;
      remove(ref(db, 'live/' + user.uid)).catch(() => {});
      remove(ref(db, 'liveChat/' + user.uid)).catch(() => {});
      sessionStorage.removeItem('echo_live_active');
    };
    const onLeave = (e) => {
      if (!isLive) return;
      e.preventDefault();
      e.returnValue = 'You are live. Leave this page to end the stream for viewers.';
    };
    const onHide = () => {
      if (isLive) endLiveNow();
    };
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      window.removeEventListener('pagehide', onHide);
    };
  }, [isLive, user?.uid]);

  const toggleLive = () => {
    if (isLive) stopCamera();
    else startCamera();
  };

  useEffect(() => {
    if (!user) return;
    const presenceRef = ref(db, 'presence/online');
    const unsubscribePresence = onValue(
      presenceRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        let online = Object.keys(data).filter(
          (uid) => uid !== user.uid && data[uid] !== false && data[uid] != null && data[uid] !== 0
        );
        if (isDemoUser) {
          online = online.filter((uid) => uid === SUPPORT_UID);
        } else if (!isSupportUser) {
          online = online.filter((uid) => uid !== DEMO_UID);
        }
        setOnlineUids(online);
        setLoading(false);
        online.forEach((uid) => {
          if (!profiles[uid]) fetchProfile(uid);
        });
      },
      () => setLoading(false)
    );

    const timeout = setTimeout(() => setLoading(false), 5000);

    const accountsRef = ref(db, 'accounts');
    const unsubAccounts = onValue(accountsRef, (snap) => {
      const data = snap.val() || {};
      const banned = new Set();
      Object.keys(data).forEach((id) => {
        if (data[id] && data[id].banned === true) banned.add(id);
      });
      setBannedUids(banned);
    });

    return () => {
      unsubscribePresence();
      unsubAccounts();
      clearTimeout(timeout);
    };
  }, [user, isDemoUser, isSupportUser, profiles, fetchProfile]);

  useEffect(() => {
    if (!user) return;
    const liveRef = ref(db, 'live');
    const unsubLive = onValue(liveRef, (snapshot) => {
      const data = snapshot.val() || {};
      const live = Object.keys(data).filter((uid) => uid !== user.uid);
      setLiveUids(live);
      const meta = {};
      live.forEach((uid) => {
        const entry = data[uid] || {};
        meta[uid] = {
          name: entry.name || '',
          avatar: entry.avatar || '',
        };
        fetchProfile?.(uid);
      });
      setLiveMeta(meta);
    });
    return () => unsubLive();
  }, [user, fetchProfile]);

  const openUserPreview = (uid) => {
    const profile = profiles[uid];
    if (profile) {
      setSelectedUser({
        uid,
        ...profile,
        isLive: liveUids.includes(uid),
      });
    }
  };

  const closeUserPreview = () => setSelectedUser(null);

  useEffect(() => {
    if (activeVideoCall) setSelectedUser(null);
  }, [activeVideoCall]);

  const startChat = (uid, name, avatar) => {
    closeUserPreview();
    navigate(`/chat/${uid}`, {
      state: { userName: name || 'User', userAvatar: avatar || '' },
    });
  };

  const handleJoinLive = (uid, name) => {
    closeUserPreview();
    setViewingLive({ uid, name, avatar: profiles[uid]?.avatar || '' });
  };

  const closeLiveView = () => setViewingLive(null);

  const combinedUids = Array.from(new Set([...onlineUids, ...liveUids])).filter((id) => !bannedUids.has(id));
  const onlineUsers = filterVisibleUsers(
    combinedUids
      .map((uid) => {
        const profile = profiles[uid];
        const isLiveUser = liveUids.includes(uid);
        const fromLive = liveMeta[uid] || {};
        if (!profile) return null;
        const name = (profile.name || fromLive.name || '').trim();
        if (!isRealDisplayName(name)) return null;
        return {
          uid,
          ...profile,
          name,
          avatar: profile.avatar || fromLive.avatar || '',
          online: onlineUids.includes(uid),
          isLive: isLiveUser,
        };
      })
      .filter(Boolean)
  ).sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));

  if (isLive && broadcastStream) {
    return <BroadcastView onEnd={stopCamera} stream={broadcastStream} />;
  }

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <>
      <SEO
        title="Live Now – Chat with Friends"
        description="See who's online and start a conversation instantly on ECHO."
      />
      <StructuredData />

      <div
        className="home-page"
        style={{
          position: 'relative',
          minHeight: '100vh',
          width: '100vw',
          overflow: 'hidden',
          background: 'var(--bg-primary)',
        }}
      >
        {isLive && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, background: '#000' }}>
            {cameraError ? (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', textAlign: 'center', padding: '20px' }}>
                {cameraError}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            )}
          </div>
        )}

        {isLive && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 75%, transparent) 0%, color-mix(in srgb, var(--bg-primary) 25%, transparent) 45%, color-mix(in srgb, var(--bg-primary) 70%, transparent) 100%)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        )}

        {isLive && (
          <div
            style={{
              position: 'fixed',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 24,
              background: 'rgba(239, 68, 68, 0.92)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.5px',
              boxShadow: '0 8px 28px rgba(239, 68, 68, 0.45)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'liveRingPulse 1s ease-in-out infinite' }} />
            YOU ARE LIVE
          </div>
        )}

        <div
          className="home-container"
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100%',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          <div style={{ width: '100%', boxSizing: 'border-box', marginBottom: '25px', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '-20px',
                right: '-20px',
                bottom: '-20px',
                background: 'radial-gradient(circle at 30% 50%, rgba(139, 92, 246, 0.15), transparent 70%)',
                zIndex: -1,
                borderRadius: '30px',
              }}
            />
            <section
              className={`home-section live-section ${isLive ? 'is-broadcasting' : ''}`}
              style={{
                background: isLive ? 'color-mix(in srgb, var(--bg-card) 55%, transparent)' : 'var(--bg-card)',
                backdropFilter: isLive ? 'blur(28px) saturate(1.2)' : 'blur(20px)',
                WebkitBackdropFilter: isLive ? 'blur(28px) saturate(1.2)' : 'blur(20px)',
                borderRadius: '24px',
                padding: '24px',
                border: isLive ? '1px solid color-mix(in srgb, #ef4444 40%, var(--border-color))' : '1px solid var(--border-color)',
                boxShadow: isLive ? '0 20px 60px color-mix(in srgb, #ef4444 15%, transparent)' : '0 20px 60px var(--shadow-color)',
                transition: 'background 0.35s ease, border 0.35s ease, box-shadow 0.35s ease',
              }}
            >
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span
                      className="live-dot"
                      style={{
                        height: '12px',
                        width: '12px',
                        background: '#4ade80',
                        borderRadius: '50%',
                        display: 'inline-block',
                        boxShadow: '0 0 20px rgba(74, 222, 128, 0.6)',
                        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      }}
                    />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(18px, 2.5vw, 20px)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    LIVE NOW
                  </h3>
                </div>
                <span
                  className="live-count"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    opacity: 0.95,
                    background: 'rgba(74, 222, 128, 0.12)',
                    padding: '6px 10px',
                    borderRadius: '14px',
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                    color: '#4ade80',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {liveUids.length > 0
                    ? `${liveUids.length} live · ${onlineUsers.length} online`
                    : `${onlineUsers.length} online`}
                </span>
              </div>

              <p className="live-hint" style={{ fontSize: 'clamp(13px, 1.5vw, 14px)', opacity: 0.6, marginBottom: '20px', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
                {liveUids.length > 0 ? 'Tap a live user to view their stream' : 'Tap any profile to view and chat instantly'}
              </p>

              <div
                className="live-users-scroll"
                style={{
                  display: 'flex',
                  gap: '20px',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  paddingBottom: '14px',
                  width: '100%',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#6C3CE1 transparent',
                }}
              >
                {onlineUsers.length === 0 ? (
                  <p className="live-empty" style={{ color: 'var(--text-muted)', padding: '20px 0', width: '100%', textAlign: 'center', fontSize: 'clamp(15px, 2vw, 17px)', fontStyle: 'italic' }}>
                    🌙 No one online right now
                  </p>
                ) : (
                  onlineUsers.map((profile) => (
                    <div
                      key={profile.uid}
                      onClick={() => openUserPreview(profile.uid)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        minWidth: 'clamp(70px, 15vw, 85px)',
                        transition: 'all 0.2s ease',
                        padding: '12px 8px',
                        borderRadius: '16px',
                        backgroundColor: profile.isLive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.03)',
                        boxShadow: profile.isLive ? '0 0 0 1px rgba(239, 68, 68, 0.35)' : 'none',
                      }}
                      className="live-user-card-hover"
                    >
                      <div
                        className="live-avatar"
                        style={{
                          position: 'relative',
                          transition: 'transform 0.2s',
                          borderRadius: '50%',
                          padding: profile.isLive ? '4px' : '0',
                          background: profile.isLive ? 'linear-gradient(135deg, #6C3CE1, #a78bfa)' : 'transparent',
                          boxShadow: profile.isLive ? '0 0 24px rgba(108,60,225,0.7), 0 0 48px rgba(108,60,225,0.3)' : 'none',
                          animation: profile.isLive ? 'liveRingPulse 1.6s ease-in-out infinite' : 'none',
                        }}
                      >
                        <Avatar
                          src={profile.avatar}
                          name={profile.name}
                          size={window.innerWidth < 600 ? 64 : 80}
                        />
                        {!profile.isLive && (
                          <span
                            className="online-indicator"
                            style={{
                              position: 'absolute',
                              bottom: '2px',
                              right: '2px',
                              width: '14px',
                              height: '14px',
                              background: '#4ade80',
                              borderRadius: '50%',
                              border: '3px solid var(--bg-primary)',
                              boxShadow: '0 0 15px rgba(74, 222, 128, 0.5)',
                            }}
                          />
                        )}
                      </div>
                      <span
                        className="live-username"
                        style={{
                          fontSize: 'clamp(12px, 1.5vw, 14px)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          maxWidth: '80px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {profile.name}
                      </span>
                      {profile.isLive && (
                        <span
                          style={{
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.6px',
                            padding: '3px 10px',
                            borderRadius: '10px',
                            boxShadow: '0 0 12px rgba(239, 68, 68, 0.5)',
                          }}
                        >
                          ● LIVE
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px', width: '100%' }}>
            <button
              onClick={toggleLive}
              style={{
                flex: 1,
                padding: 'clamp(14px, 2.5vh, 20px)',
                borderRadius: '18px',
                border: 'none',
                fontWeight: 700,
                fontSize: 'clamp(15px, 2vw, 18px)',
                cursor: 'pointer',
                color: '#fff',
                background: isLive
                  ? 'linear-gradient(135deg, #f87171, #dc2626)'
                  : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                boxShadow: isLive
                  ? '0 8px 30px rgba(220, 38, 38, 0.3)'
                  : '0 8px 30px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.3s ease',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
              className="go-live-btn"
            >
              <span style={{ fontSize: 'clamp(18px, 2vw, 22px)' }}>
                <i className={`fas ${isLive ? 'fa-stop-circle' : 'fa-video'}`} />
              </span>
              {isLive ? 'End Live Stream' : 'Go Live Now'}
            </button>
          </div>
        </div>

        {/* STORIES BAR – Bottom Left */}
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            left: '0',
            zIndex: 9999,
            width: '100%',
            maxWidth: '450px',
            pointerEvents: 'auto',
          }}
        >
          <StoriesBar 
            currentUserId={user?.uid} 
            users={onlineUsers} 
            ownStory={null} 
            onAddStory={() => setShowRecorder(true)} 
            onViewStories={(stories, ownerId) => {
              setViewingStories(stories);
              setCurrentStoryOwnerId(ownerId);
            }} 
          />
        </div>

        {selectedUser && (
          <UserPreviewModal
            user={selectedUser}
            onClose={closeUserPreview}
            onChat={() => startChat(selectedUser.uid, selectedUser.name, selectedUser.avatar)}
            onVideoCall={() => {
              const u = selectedUser;
              setSelectedUser(null);
              startVideoCall(u.uid, u.name, u.avatar);
            }}
            callerIsLive={isLive}
            onJoinLive={() => handleJoinLive(selectedUser.uid, selectedUser.name)}
          />
        )}

        {viewingLive && (
          <LiveViewModal
            broadcasterId={viewingLive.uid}
            broadcasterName={viewingLive.name}
            broadcasterAvatar={viewingLive.avatar || profiles[viewingLive.uid]?.avatar || ''}
            onClose={closeLiveView}
          />
        )}

        {showRecorder && (
          <StoryRecorder 
            userId={user?.uid} 
            onClose={() => setShowRecorder(false)} 
          />
        )}

        {viewingStories && (
          <StoryViewer 
            stories={viewingStories} 
            ownerName={viewingStories[0]?.userName || 'User'} 
            ownerAvatar={viewingStories[0]?.avatar || ''} 
            viewerId={user?.uid} 
            onClose={() => setViewingStories(null)} 
            onFinished={() => {
              // 🚨 THE FIX: Instantly remove the user from the online list
              if (currentStoryOwnerId) {
                setOnlineUids(prev => prev.filter(uid => uid !== currentStoryOwnerId));
              }
              setViewingStories(null);
            }} 
          />
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes liveRingPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-30px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pulse-skeleton {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .live-users-scroll::-webkit-scrollbar {
          height: 8px;
          display: block;
        }
        .live-users-scroll::-webkit-scrollbar-track {
          background: rgba(108,60,225,0.08);
          border-radius: 99px;
        }
        .live-users-scroll::-webkit-scrollbar-thumb {
          background: #6C3CE1;
          border-radius: 99px;
        }
        .live-user-card-hover:hover {
          transform: translateY(-4px) scale(1.02);
          background-color: rgba(255,255,255,0.08) !important;
        }
        .live-user-card-hover:hover .live-avatar {
          transform: scale(1.05);
        }
        .go-live-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.4) !important;
        }
        .go-live-btn:active {
          transform: translateY(0px) scale(0.98);
        }
      `}</style>

      {peerError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: 'min(420px, calc(100vw - 32px))',
            padding: '12px 16px',
            borderRadius: '14px',
            background: 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ flex: 1 }}>{peerError}</span>
          <button
            type="button"
            onClick={() => {
              setPeerError(null);
              window.location.reload();
            }}
            style={{
              background: '#fff',
              color: '#EF4444',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '13px',
              whiteSpace: 'nowrap',
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => setPeerError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

export default Home;
