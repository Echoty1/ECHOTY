import { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';

export const usePeer = (userId) => {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const peerInstance = useRef(null);

  useEffect(() => {
    if (!userId || peerInstance.current) return;

    // Create a single Peer instance attached to the user ID
    const newPeer = new Peer(userId, {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      debug: 1
    });

    newPeer.on('open', (id) => {
      setPeerId(id);
      setPeer(newPeer);
    });

    newPeer.on('disconnected', () => {
      // Reconnect existing peer instead of destroying/recreating
      if (!newPeer.destroyed) {
        newPeer.reconnect();
      }
    });

    newPeer.on('error', (err) => {
      console.warn('PeerJS non-fatal error:', err.type);
    });

    peerInstance.current = newPeer;

    return () => {
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
    };
  }, [userId]);

  return { peer, peerId };
};