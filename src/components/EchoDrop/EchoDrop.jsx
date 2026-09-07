import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Peer from 'peerjs';
import {
  generateDropCode,
  createDropSession,
  joinDropSession,
  endDropSession,
} from '../../services/echoDropService';
import './EchoDrop.css';

const EchoDrop = ({ onClose }) => {
  const { user } = useAuth();
  const { profiles } = useProfile();
  const [mode, setMode] = useState('home'); // home | host | connected | receiving
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [status, setStatus] = useState('');
  const [receivedPhoto, setReceivedPhoto] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const peer = new Peer({
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
    });

    peer.on('open', () => {
      peerRef.current = peer;
    });

    peer.on('connection', (conn) => {
      handleConnection(conn);
    });

    return () => {
      if (code) endDropSession(code);
      peer.destroy();
    };
  }, []);

  const handleConnection = (conn) => {
    connRef.current = conn;
    setMode('connected');
    setStatus('Connected! Select photos to share');

    conn.on('data', (data) => {
      if (data?.type === 'photo') {
        setReceivedPhoto({
          url: data.url,
          from: data.fromName || 'Someone',
        });
        setMode('receiving');
      }
    });

    conn.on('close', () => {
      setStatus('Disconnected');
      setMode('home');
    });
  };

  const startHosting = async () => {
    if (!peerRef.current) return alert('Still connecting... try again');
    const newCode = generateDropCode();
    setCode(newCode);
    setMode('host');
    setStatus('Waiting for someone to join...');

    try {
      await createDropSession(user.uid, newCode, peerRef.current.id);
    } catch (err) {
      console.error(err);
      alert('Failed to create session');
      setMode('home');
    }
  };

  const joinSession = async () => {
    if (inputCode.length !== 6) return alert('Enter a valid 6-digit code');

    try {
      const session = await joinDropSession(inputCode);
      const conn = peerRef.current.connect(session.hostPeerId);
      handleConnection(conn);
      setCode(inputCode);
    } catch (err) {
      alert(err.message || 'Invalid code');
    }
  };

  const openGallery = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !connRef.current) return;

    setIsSending(true);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        connRef.current.send({
          type: 'photo',
          url: reader.result,
          fromName: profiles[user.uid]?.name || 'User',
        });
      };
      reader.readAsDataURL(file);
    });

    setTimeout(() => {
      setIsSending(false);
      setStatus('Photo sent!');
    }, 800);
  };

  const saveToGallery = () => {
    if (!receivedPhoto) return;
    const link = document.createElement('a');
    link.href = receivedPhoto.url;
    link.download = `echo-drop-${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="echo-drop-overlay">
      <div className="echo-drop-container">
        <button className="drop-close" onClick={onClose}>
          ✕
        </button>

        {/* HOME */}
        {mode === 'home' && (
          <div className="drop-home">
            <div className="drop-icon">⚡</div>
            <h1>Echo Drop</h1>
            <p>Share photos instantly with nearby friends</p>

            <button className="drop-btn primary" onClick={startHosting}>
              Create Drop
            </button>

            <div className="drop-divider">or join with code</div>

            <div className="join-section">
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
              />
              <button className="drop-btn secondary" onClick={joinSession}>
                Join
              </button>
            </div>
          </div>
        )}

        {/* HOSTING */}
        {mode === 'host' && (
          <div className="drop-hosting">
            <div className="pulse-circle">
              <div className="pulse-ring"></div>
              <div className="pulse-ring delay"></div>
              <span className="code-display">{code}</span>
            </div>
            <h2>Waiting for connection</h2>
            <p>Share this code with the other person</p>
            <button className="drop-btn ghost" onClick={() => setMode('home')}>
              Cancel
            </button>
          </div>
        )}

        {/* CONNECTED */}
        {mode === 'connected' && (
          <div className="drop-connected">
            <div className="connected-icon">✨</div>
            <h2>Connected!</h2>
            <p>{status}</p>

            <button
              className="drop-btn primary big"
              onClick={openGallery}
              disabled={isSending}
            >
              {isSending ? 'Sending...' : 'Select Photos'}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              hidden
              onChange={handleFiles}
            />
          </div>
        )}

        {/* RECEIVING */}
        {mode === 'receiving' && receivedPhoto && (
          <div className="drop-receiving">
            <h2>Photo Received</h2>
            <div className="received-preview">
              <img src={receivedPhoto.url} alt="Received" />
            </div>
            <p>From {receivedPhoto.from}</p>

            <div className="receive-actions">
              <button className="drop-btn primary" onClick={saveToGallery}>
                Save to Gallery
              </button>
              <button
                className="drop-btn secondary"
                onClick={() => setMode('connected')}
              >
                Keep Sharing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EchoDrop;
