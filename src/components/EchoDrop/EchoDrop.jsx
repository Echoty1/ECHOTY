// src/components/EchoDrop/EchoDrop.jsx
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
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const peer = new Peer({
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      debug: 1,
    });

    peer.on('open', (id) => {
      console.log('Peer ready:', id);
      peerRef.current = peer;
    });

    peer.on('connection', (conn) => {
      console.log('Incoming connection');
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setError('Connection error. Please try again.');
    });

    return () => {
      if (code) endDropSession(code);
      if (peer && !peer.destroyed) peer.destroy();
    };
  }, []);

  const handleConnection = (conn) => {
    connRef.current = conn;
    setMode('connected');
    setStatus('Connected! Select photos to share');
    setError('');
    setIsJoining(false);

    conn.on('data', (data) => {
      if (data?.type === 'photo') {
        setReceivedPhoto({
          url: data.url,
          from: data.fromName || 'Someone',
        });
        setMode('receiving');
      }
    });

    conn.on('open', () => {
      console.log('Connection opened');
    });

    conn.on('close', () => {
      setStatus('Disconnected');
      setMode('home');
      setError('Connection closed');
    });

    conn.on('error', (err) => {
      console.error('Conn error:', err);
      setError('Connection failed');
    });
  };

  const startHosting = async () => {
    if (!peerRef.current || !peerRef.current.id) {
      setError('Still connecting to server... please wait a second');
      return;
    }

    const newCode = generateDropCode();
    setCode(newCode);
    setMode('host');
    setStatus('Waiting for someone to join...');
    setError('');

    try {
      await createDropSession(user.uid, newCode, peerRef.current.id);
    } catch (err) {
      console.error(err);
      setError('Failed to create session');
      setMode('home');
    }
  };

  const joinSession = async () => {
    if (isJoining) return;
    if (!inputCode || inputCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    if (!peerRef.current || !peerRef.current.id) {
      setError('Still connecting... try again in a moment');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const session = await joinDropSession(inputCode);
      
      if (!session?.hostPeerId) {
        throw new Error('Invalid session');
      }

      const conn = peerRef.current.connect(session.hostPeerId, {
        reliable: true,
      });

      handleConnection(conn);
      setCode(inputCode);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Invalid or expired code');
      setIsJoining(false);
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
        if (connRef.current && connRef.current.open) {
          connRef.current.send({
            type: 'photo',
            url: reader.result,
            fromName: profiles[user.uid]?.name || 'User',
          });
        }
      };
      reader.readAsDataURL(file);
    });

    setTimeout(() => {
      setIsSending(false);
      setStatus('Photo sent!');
    }, 600);
  };

  const saveToGallery = () => {
    if (!receivedPhoto) return;
    const link = document.createElement('a');
    link.href = receivedPhoto.url;
    link.download = `echo-drop-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

            {error && <div className="drop-error">{error}</div>}

            <button className="drop-btn primary" onClick={startHosting}>
              Create Drop
            </button>

            <div className="drop-divider">or join with code</div>

            <div className="join-section">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button
                className="drop-btn secondary"
                onClick={joinSession}
                disabled={isJoining || inputCode.length !== 6}
              >
                {isJoining ? '...' : 'Join'}
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
            {error && <div className="drop-error">{error}</div>}
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
            {error && <div className="drop-error">{error}</div>}

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
