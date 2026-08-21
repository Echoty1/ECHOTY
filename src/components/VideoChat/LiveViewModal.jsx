// src/components/VideoChat/LiveViewModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

const LiveViewModal = ({ broadcasterId, broadcasterName, onClose }) => {
  const remoteVideoRef = useRef(null);
  const peerInstanceRef = useRef(null);
  const [status, setStatus] = useState('Connecting...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const peer = new Peer(null, { debug: 2 });
    peerInstanceRef.current = peer;

    peer.on('open', (id) => {
      console.log('Viewer Peer ID:', id);
      // Call the broadcaster using their stored peer ID
      // We need to get the broadcaster's peer ID from Firebase live node
      const liveRef = ref(db, `live/${broadcasterId}/peerId`);
      get(liveRef).then((snapshot) => {
        const peerId = snapshot.val();
        if (!peerId) {
          setError('Broadcaster is not available.');
          setStatus('Offline');
          return;
        }
        const call = peer.call(peerId, null); // no local stream – viewer only
        call.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            setStatus('Watching Live');
          }
        });
        call.on('close', () => {
          setStatus('Stream ended');
          setTimeout(onClose, 2000);
        });
        call.on('error', (err) => {
          setError('Cannot connect to stream.');
          setStatus('Error');
        });
      });
    });

    peer.on('error', (err) => {
      setError('Peer connection error.');
      setStatus('Error');
    });

    return () => {
      if (peerInstanceRef.current) peerInstanceRef.current.destroy();
    };
  }, [broadcasterId, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.95)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}
    >
      {error ? (
        <div>
          <h2 style={{ color: '#ef4444' }}>❌ {error}</h2>
          <button
            onClick={onClose}
            style={{
              marginTop: '20px',
              padding: '12px 32px',
              background: '#6C3CE1',
              border: 'none',
              borderRadius: '30px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              width: '90%',
              maxWidth: '800px',
              height: '70vh',
              background: '#000',
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'rgba(0,0,0,0.6)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ color: '#4ade80' }}>●</span>
              <span>{status}</span>
              <span style={{ fontWeight: 'bold' }}>{broadcasterName}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              marginTop: '20px',
              padding: '14px 40px',
              background: '#ff4444',
              border: 'none',
              borderRadius: '30px',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            End View
          </button>
        </>
      )}
    </div>
  );
};

export default LiveViewModal;