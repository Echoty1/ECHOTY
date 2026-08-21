// src/components/pages/Home/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { useCall } from '../../../contexts/CallContext';
import { db } from '../../../services/firebase';
import { ref, set, onValue, onDisconnect, remove, off, get } from 'firebase/database';
import Peer from 'peerjs';
import Avatar from '../../common/Avatar';
import UserPreviewModal from '../../common/UserPreviewModal';
import LiveViewModal from '../../VideoChat/LiveViewModal';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Home.css';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

// ─── Home Skeleton ──────────────────────────────────────────────
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
  const { startVideoCall } = useCall();
  const [onlineUids, setOnlineUids] = useState([]);
  const [liveUids, setLiveUids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingLive, setViewingLive] = useState(null);

  const [isLive, setIsLive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const peerIdSet = useRef(false);

  const isDemoUser = user?.uid === DEMO_UID;
  const isSupportUser = user?.uid === SUPPORT_UID;

  // ─── 0. Request Push Notification Permissions ────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ─── 1. PeerJS Setup (with retry) ─────────────────────────────
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
        debug: 2,
      };

      const peer = new Peer(null, config);
      peerInstance = peer;

      peer.on('open', (id) => {
        peerIdSet.current = true;
        set(ref(db, `peerIds/${user.uid}`), id)
          .catch((err) => console.warn('Failed to store peer ID:', err));
        console.log('✅ PeerJS connected with ID:', id);
      });

      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        if (attempt < maxAttempts && peerInstance) {
          attempt++;
          console.log(`🔄 Retrying PeerJS connection (attempt ${attempt})...`);
          peerInstance.destroy();
          timeoutId = setTimeout(createPeer, 2000);
        } else {
          console.warn('⚠️ PeerJS connection failed after retries.');
        }
      });
    };

    createPeer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (peerInstance) {
        peerInstance.destroy();
      }
      remove(ref(db, `peerIds/${user.uid}`)).catch(() => {});
    };
  }, [user]);

  // ─── 2. Camera Logic ──────────────────────────────────────────
  const startCamera = async () => {
    try {
      const constraints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }
      setIsLive(true);
      setCameraError(null);

      if (user) {
        const peerId = peerRef.current ? peerRef.current.id : null;
        set(ref(db, 'live/' + user.uid), {
          name: user.displayName || 'User',
          avatar: user.photoURL || '',
          timestamp: Date.now(),
          peerId: peerId,
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
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsLive(false);
    if (user) {
      remove(ref(db, 'live/' + user.uid));
    }
  };

  const toggleLive = () => {
    if (isLive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Stop camera when component unmounts
  useEffect(() => {
    return () => {
      if (isLive) {
        stopCamera();
      }
    };
  }, [isLive]);

  // ─── 3. Firebase Presence Logic (FIXED) ──────────────────────
  useEffect(() => {
    if (!user) return;

    const presenceRef = ref(db, 'presence/online');
    const unsubscribePresence = onValue(
      presenceRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        console.log('🔴 Presence data:', data); // DEBUG

        let online = Object.keys(data).filter((uid) => data[uid] === true && uid !== user.uid);

        // Apply demo/support filters
        if (isDemoUser) {
          online = online.filter((uid) => uid === SUPPORT_UID);
        } else if (!isSupportUser) {
          online = online.filter((uid) => uid !== DEMO_UID);
        }

        console.log('👥 Online UIDs:', online); // DEBUG
        setOnlineUids(online);
        setLoading(false);

        // Fetch profiles for online users
        online.forEach((uid) => {
          if (!profiles[uid]) {
            fetchProfile(uid);
          }
        });
      },
      (error) => {
        console.error('❌ Presence listener error:', error);
        setLoading(false);
      }
    );

    // Safety timeout: if no data after 5 seconds, stop loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      unsubscribePresence();
      clearTimeout(timeout);
    };
  }, [user, isDemoUser, isSupportUser, profiles, fetchProfile]);

  // ─── 4. Listen for Live Users ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const liveRef = ref(db, 'live');
    const unsubLive = onValue(liveRef, (snapshot) => {
      const data = snapshot.val() || {};
      const live = Object.keys(data).filter((uid) => uid !== user.uid);
      setLiveUids(live);
    });
    return () => unsubLive();
  }, [user]);

  // ─── 6. Handlers ──────────────────────────────────────────────
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

  const startChat = (uid, name, avatar) => {
    closeUserPreview();
    navigate(`/chat/${uid}`, {
      state: { userName: name || 'User', userAvatar: avatar || '' },
    });
  };

  const handleJoinLive = (uid, name) => {
    closeUserPreview();
    setViewingLive({ uid, name });
  };

  const closeLiveView = () => {
    setViewingLive(null);
  };

  // ─── 7. Build Online Users List ──────────────────────────────
  const onlineUsers = onlineUids
    .map((uid) => {
      const profile = profiles[uid];
      if (!profile) {
        // If profile not loaded yet, return a placeholder with UID as name
        return {
          uid,
          name: uid.slice(0, 8),
          avatar: '',
          online: true,
          isLive: liveUids.includes(uid),
        };
      }
      return {
        uid,
        ...profile,
        online: true,
        isLive: liveUids.includes(uid),
      };
    })
    .filter(Boolean);

  // If still loading, show skeleton
  if (loading) {
    return <HomeSkeleton />;
  }

  // ─── 8. Render ──────────────────────────────────────────────────
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
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 0,
              background: '#000',
            }}
          >
            {cameraError ? (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                {cameraError}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
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
              background:
                'linear-gradient(180deg, rgba(10, 10, 15, 0.9) 0%, rgba(60, 30, 100, 0.3) 40%, rgba(10, 10, 15, 0.8) 100%)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '28px', color: 'var(--text-primary)' }}>
                <i className="fas fa-broadcast" />
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(24px, 4vw, 32px)',
                  fontWeight: 900,
                  letterSpacing: '-0.5px',
                  background: 'linear-gradient(135deg, var(--text-primary) 60%, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ECHO
              </h1>
            </div>
            <div
              style={{
                background: 'var(--bg-input)',
                padding: '8px 18px',
                borderRadius: '30px',
                fontSize: 'clamp(13px, 2vw, 15px)',
                border: '1px solid var(--border-color)',
                backdropFilter: 'blur(5px)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {user?.displayName || 'Demo User'}
            </div>
          </div>

          <div
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '25px',
              position: 'relative',
            }}
          >
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
              className="home-section live-section"
              style={{
                background: 'var(--bg-card)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '24px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 60px var(--shadow-color)',
              }}
            >
              <div
                className="section-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
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
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 'clamp(18px, 2.5vw, 20px)',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    LIVE NOW
                  </h3>
                </div>
                <span
                  className="live-count"
                  style={{
                    fontSize: 'clamp(13px, 1.5vw, 15px)',
                    opacity: 0.9,
                    background: 'rgba(74, 222, 128, 0.1)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    border: '1px solid rgba(74, 222, 128, 0.2)',
                    color: '#4ade80',
                  }}
                >
                  {onlineUsers.length} online
                </span>
              </div>

              <p
                className="live-hint"
                style={{
                  fontSize: 'clamp(13px, 1.5vw, 14px)',
                  opacity: 0.6,
                  marginBottom: '20px',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.3px',
                }}
              >
                Tap any profile to view and chat instantly
              </p>

              <div
                className="live-users-scroll"
                style={{
                  display: 'flex',
                  gap: '20px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  width: '100%',
                  scrollbarWidth: 'none',
                }}
              >
                {onlineUsers.length === 0 ? (
                  <p
                    className="live-empty"
                    style={{
                      color: 'var(--text-muted)',
                      padding: '20px 0',
                      width: '100%',
                      textAlign: 'center',
                      fontSize: 'clamp(15px, 2vw, 17px)',
                      fontStyle: 'italic',
                    }}
                  >
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
                        backgroundColor: 'rgba(255,255,255,0.03)',
                      }}
                      className="live-user-card-hover"
                    >
                      <div
                        className="live-avatar"
                        style={{ position: 'relative', transition: 'transform 0.2s' }}
                      >
                        <Avatar
                          src={profile.avatar}
                          name={profile.name}
                          size={window.innerWidth < 600 ? 64 : 80}
                        />
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
                        {profile.isLive && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-4px',
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              border: '2px solid var(--bg-primary)',
                              boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
                              animation: 'pulse-dot 1.5s infinite',
                            }}
                          >
                            LIVE
                          </span>
                        )}
                      </div>
                      <span
                        className="live-username"
                        style={{
                          fontSize: 'clamp(12px, 1.5vw, 14px)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          maxWidth: '70px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {profile.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              marginBottom: '20px',
              width: '100%',
            }}
          >
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

        {selectedUser && (
          <UserPreviewModal
            user={selectedUser}
            onClose={closeUserPreview}
            onChat={() =>
              startChat(selectedUser.uid, selectedUser.name, selectedUser.avatar)
            }
            onVideoCall={() =>
              startVideoCall(selectedUser.uid, selectedUser.name, selectedUser.avatar)
            }
            onJoinLive={() =>
              handleJoinLive(selectedUser.uid, selectedUser.name)
            }
          />
        )}

        {viewingLive && (
          <LiveViewModal
            broadcasterId={viewingLive.uid}
            broadcasterName={viewingLive.name}
            onClose={closeLiveView}
          />
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
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
          display: none;
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
        .decline-btn:hover {
          background: rgba(255, 68, 68, 0.4) !important;
        }
        .accept-btn:hover {
          transform: scale(1.03);
          box-shadow: 0 8px 30px rgba(74, 222, 128, 0.5) !important;
        }
      `}</style>
    </>
  );
};

export default Home;
