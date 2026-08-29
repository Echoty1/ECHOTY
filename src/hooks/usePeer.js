import { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';

export const usePeer = (userId) => {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const peerInstance = useRef(null);

  useEffect(() => {
    if (!userId) return undefined;

    // Let PeerJS assign the id. Reusing Firebase UID collides across tabs/devices.
    const newPeer = new Peer(undefined, {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      debug: 1,
    });

    newPeer.on('open', (id) => {
      setPeerId(id);
      setPeer(newPeer);
    });

    newPeer.on('disconnected', () => {
      if (!newPeer.destroyed) {
        newPeer.reconnect();
      }
    });

    newPeer.on('error', (err) => {
      console.warn('PeerJS non-fatal error:', err?.type || err);
    });

    peerInstance.current = newPeer;

    return () => {
      try {
        newPeer.destroy();
      } catch (_) {}
      peerInstance.current = null;
      setPeer(null);
      setPeerId(null);
    };
  }, [userId]);

  return { peer, peerId };
};
