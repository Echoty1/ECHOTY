// src/components/GifLibrary/GifLibraryModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { fetchGifLibrary } from '../../services/gifLibraryService';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, get, update, onValue } from 'firebase/database';
import { useCachedBlobUrl } from '../../hooks/useCachedBlobUrl';
import './GifLibraryModal.css';

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

  // ─── Load GIF library & user data ──────────────────────
  useEffect(() => {
    if (!isOpen || !user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchGifLibrary();
        setLibrary(data);
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

  const isGifUnlocked = (gifId) => {
    return Array.isArray(unlockedGifs) && unlockedGifs.includes(gifId);
  };

  // ─── Render cached GIF item ─────────────────────────────
  const GifItem = ({ gif }) => {
    const { blobUrl, isLoading, error } = useCachedBlobUrl(gif.url);
    const unlocked = isGifUnlocked(gif.id);
    const isLocked = gif.isPremium && !unlocked;

    return (
      <div
        className={`gif-item ${isLocked ? 'premium' : ''}`}
        onClick={() => handleSelect(gif)}
      >
        {isLoading ? (
          <div className="gif-loading-spinner"><i className="fas fa-spinner fa-spin" /></div>
        ) : error ? (
          <div className="gif-error">⚠️</div>
        ) : (
          <img src={blobUrl || gif.url} alt={gif.title} className="gif-thumb" loading="lazy" />
        )}
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
  };

  // ─── Selection & Purchase logic ──────────────────────────
  const handleSelect = async (gif) => {
    const unlocked = isGifUnlocked(gif.id);
    if (!gif.isPremium || unlocked) {
      onSelect(gif);
      return;
    }
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

      const newCoins = currentCoins - selectedGif.price;
      const updatedUnlocked = Array.from(new Set([...currentUnlocked, selectedGif.id]));

      await update(userSkinsRef, { 
        coins: newCoins,
        unlockedGifs: updatedUnlocked
      });

      const gifToUse = selectedGif;
      setSelectedGif(null);
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
          <div className="gif-modal-coins">🪙 {userCoins} coins</div>
          <button className="gif-modal-close" onClick={onClose}>✕</button>
        </div>

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
              {filteredGifs.map((gif) => (
                <GifItem key={gif.id} gif={gif} />
              ))}
            </div>
          )}
        </div>

        {selectedGif && (
          <div className="gif-purchase-modal">
            <div className="gif-purchase-content">
              <h3>Premium GIF</h3>
              <p>"{selectedGif.title}" costs 🪙 {selectedGif.price} coins.</p>
              <p>You have 🪙 {userCoins} coins.</p>
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