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
import './Home.css';
import { isRealDisplayName, filterVisibleUsers } from '../../../utils/userIntegrity';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const HomeSkeleton = () => (
  <div className="home-page">
    <div className="home-container">
      <div className="home-header-skeleton">
        <div className="skeleton-block" style={{ width: 28, height: 28, borderRadius: '50%' }} />
        <div className="skeleton-block" style={{ width: 90, height: 24, borderRadius: 8 }} />
      </div>

      <section className="home-section">
        <div className="section-header">
          <div className="skeleton-block" style={{ width: 110, height: 20, borderRadius: 8 }} />
          <div className="skeleton-block" style={{ width: 70, height: 22, borderRadius: 12 }} />
        </div>
        <div className="skeleton-block" style={{ width: 200, height: 13, borderRadius: 6, marginBottom: 18 }} />
        <div className="live-users-scroll">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="live-user-card" style={{ pointerEvents: 'none' }}>
              <div className="skeleton-block" style={{ width: 72, height: 72, borderRadius: '50%' }} />
              <div className="skeleton-block" style={{ width: 60, height: 12, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </section>

      <div className="skeleton-block" style={{ width: '100%', height: 52, borderRadius: 14 }} />
    </div>
  </div>
);

const Home = ({ onOpenRecorder, onOpenStory }) => {
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
  }, [user
