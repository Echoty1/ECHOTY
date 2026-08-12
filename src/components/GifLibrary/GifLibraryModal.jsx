// src/components/GifLibrary/GifLibraryModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { fetchGifLibrary } from '../../services/gifLibraryService';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, get, update, onValue } from 'firebase/database';
import './GifLibraryModal.css';

// Helper to safely convert any Firebase data structure into an Array
const parseUnlockedGifs = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return Object.keys(data);
  return [];
};

const GifLibraryModal = ({ isOpen, onClose, onSelect }) => {
  const { user } = useAuth();
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGif, setSelectedGif] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [userCoins, setUserCoins] = useState(0);
  const [unlockedGifs, setUnlockedGifs] = useState([]);
  const [failedUrls, setFailedUrls] = useState(new Set());

  // ─── Load GIF library & user data ──────────────────────
  useEffect(() => {
    if (!isOpen || !user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Load GIF library
        const data = await fetchGifLibrary();
        setLibrary(data);
        setFailedUrls(new Set());

        // 2. Load user skins & unlocked GIFs
        const userSkinsRef = ref(db, `userSkins/${user.uid}`);
        const snap = await get(userSkinsRef);
        if (snap.exists()) {
          const val = snap.val();
          setUserCoins(val.coins || 0);
          setUnlockedGifs(parseUnlockedGifs(val.unlockedGifs));
        } else {
          setUserCoins(0);
          setUnlockedGifs([]);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
      setLoading(false);
    };

    loadData();

    // 3. Listen for coin & unlocked GIF updates
    const userSkinsRef = ref(db, `userSkins/${user.uid}`);
    const unsubscribe = onValue(userSkinsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setUserCoins(val.coins || 0);
        setUnlockedGifs(parseUnlockedGifs(val.unlockedGifs));
      }
    });

    return () => unsubscribe();
  }, [isOpen, user]);

  // ─── Direct Search Filtering ────────────────────────────
  const filteredGifs = useMemo(() => {
    if (!searchTerm.trim()) return library;
    const term = searchTerm.toLowerCase();
    return library.filter((item) =>
      item.title?.toLowerCase().includes(term) ||
      (item.tags || []).some((tag) => tag.toLowerCase().includes(term))
    );
  }, [library, searchTerm]);

  // Safe helper to check unlocked state
  const isGifUnlocked = (gifId) => {
    return Array.isArray(unlockedGifs) && unlockedGifs.includes(gifId);
  };

  // ─── Media rendering helpers ────────────────────────────
  const isVideo = (url) => url?.endsWith('.mp4') || url?.endsWith('.webm') || url?.includes('.mp4');

  const handleMediaError = (gifId, url) => {
    console.warn(`❌ Failed to load media for ${gifId}: ${url}`);
    setFailedUrls((prev) => new Set(prev).add(gifId));
  };

  const renderMedia = (gif) => {
    const url = gif.url;
    if (!url) return <div className="gif-placeholder">No URL</div>;
    if (failedUrls.has(gif.id)) {
      return <div className="gif-placeholder">⚠️ Preview unavailable</div>;
    }

    if (isVideo(url)) {
      return (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          className="gif-thumb"
          onError={(e) => {
            e.target.style.display = 'none';
            handleMediaError(gif.id, url);
          }}
        />
      );
    } else {
      return (
        <img
          src={url}
          alt={gif.title}
          className="gif-thumb"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
            handleMediaError(gif.id, url);
          }}
        />
      );
    }
  };

  // ─── Selection & Purchase logic ──────────────────────────
  const handleSelect = async (gif) => {
    const unlocked = isGifUnlocked(gif.id);

    // If free or already unlocked, select directly
    if (!gif.isPremium || unlocked) {
      onSelect(gif);
      return;
    }

    // Require purchase modal for locked premium GIFs
    setSelectedGif(gif);
  };

  const handlePurchase = async () => {
    if (!selectedGif || !user) return;
    setPurchasing(true);

    try {
      const userSkinsRef = ref(db, `userSkins/${user.uid}`);
      const snap = await get(userSkinsRef);
      const data = snap.val() || {};
      const currentCoins = data.coins || 0;
      const currentUnlocked = parseUnlockedGifs(data.unlockedGifs);

      if (currentCoins < selectedGif.price) {
        alert(`You need ${selectedGif.price} coins. You have ${currentCoins}.`);
        setPurchasing(false);
        return;
      }

      // Deduct coins & save to unlocked items
      const newCoins = currentCoins - selectedGif.price;
      const updatedUnlocked = Array.from(new Set([...currentUnlocked, selectedGif.id]));

      await update(userSkinsRef, { 
        coins: newCoins,
        unlockedGifs: updatedUnlocked
      });

      // Close popup FIRST to prevent state flashes
      const gifToUse = selectedGif;
      setSelectedGif(null);

      // Trigger selection
      onSelect(gifToUse);
    } catch (err) {
      console.error('Purchase failed:', err);
      alert('Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="gif-modal-overlay">
      <div className="gif-modal-content">
        <div className="gif-modal-header">
          <h2>Choose a Profile GIF</h2>
          <div className="gif-modal-coins">
            🪙 {userCoins} coins
          </div>
          <button className="gif-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Fixed Clean Search Input ── */}
        <div className="gif-modal-controls" style={{ marginBottom: '16px' }}>
          <input
            type="text"
            className="gif-search-input"
            placeholder="Search GIFs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 16px',
              fontSize: '14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              color: '#FFF',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div className="gif-grid-container">
          {loading ? (
            <div className="gif-loading">Loading...</div>
          ) : filteredGifs.length === 0 ? (
            <div className="gif-empty">No GIFs found</div>
          ) : (
            <div className="gif-grid">
              {filteredGifs.map((gif) => {
                const unlocked = isGifUnlocked(gif.id);
                const isLocked = gif.isPremium && !unlocked;

                return (
                  <div
                    key={gif.id}
                    className={`gif-item ${isLocked ? 'premium' : ''}`}
                    onClick={() => handleSelect(gif)}
                  >
                    {renderMedia(gif)}
                    <div className="gif-overlay">
                      <span className="gif-title">{gif.title}</span>
                      {isLocked ? (
                        <span className="gif-price">🪙 {gif.price}</span>
                      ) : gif.isPremium ? (
                        <span className="gif-unlocked" style={{ fontSize: '11px', color: '#10B981' }}>✓ Unlocked</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedGif && (
          <div className="gif-purchase-modal">
            <div className="gif-purchase-content">
              <h3>Premium GIF</h3>
              <p>"{selectedGif.title}" costs 🪙 {selectedGif.price} coins.</p>
              <p>You currently have 🪙 {userCoins} coins.</p>
              <div className="gif-purchase-actions">
                <button onClick={handlePurchase} disabled={purchasing || userCoins < selectedGif.price}>
                  {purchasing ? 'Processing...' : 'Buy & Use'}
                </button>
                <button onClick={() => setSelectedGif(null)}>Cancel</button>
              </div>
              {userCoins < selectedGif.price && (
                <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 8 }}>
                  Not enough coins – earn more by using ECHO!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GifLibraryModal;