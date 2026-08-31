// src/components/GifLibrary/GifLibraryModal.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// ─── Individual GIF item ──────────────────────────────────────
const GifItem = ({ gif, isUnlocked, onSelect, mode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef(null);

  useEffect(() => {
    if (!itemRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, []);

  const { blobUrl, isLoading, error } = useCachedBlobUrl(isVisible ? gif.url : null);
  const isLocked = gif.isPremium && !isUnlocked;
  const imageSrc = blobUrl || (isVisible ? gif.url : null);

  const handleClick = () => {
    onSelect(gif);
  };

  // Determine if we should show circular preview (profile mode)
  const isProfileMode = mode === 'profile';

  return (
    <div 
      className={`gif-item ${isLocked ? 'premium' : ''} ${isProfileMode ? 'profile-mode' : 'shop-mode'}`} 
      onClick={handleClick} 
      ref={itemRef}
    >
      {isVisible ? (
        <>
          {isLoading && !error && <div className="gif-loading-spinner"><i className="fas fa-spinner fa-spin" /></div>}
          {error ? <div className="gif-error">⚠️</div> : (
            <img src={imageSrc} alt={gif.title} className="gif-thumb" loading="lazy" style={{ display: isLoading ? 'none' : 'block' }} />
          )}
          {isLoading && <div className="gif-skeleton" />}
        </>
      ) : <div className="gif-skeleton" />}
      <div className="gif-overlay">
        <span className="gif-title">{gif.title}</span>
        {isLocked ? <span className="gif-price">🪙 {gif.price}</span> : gif.isPremium ? <span className="gif-unlocked">✓ Unlocked</span> : null}
      </div>
    </div>
  );
};

// ─── Main Modal ──────────────────────────────────────────────
const GifLibraryModal = ({ isOpen, onClose, onSelect, ownedGifs = [], mode = 'profile' }) => {
  const { user } = useAuth();
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGif, setSelectedGif] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [userCoins, setUserCoins] = useState(0);
  const [unlockedGifs, setUnlockedGifs] = useState(ownedGifs || []);

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
  }, [isOpen, user]);

  // ─── Filter based on mode ──────────────────────────────────
  const filteredGifs = useMemo(() => {
    let filtered = library;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(term) ||
        (item.tags || []).some(tag => tag.toLowerCase().includes(term))
      );
    }

    if (mode === 'profile') {
      // Show free GIFs + owned premium GIFs
      filtered = filtered.filter(item => !item.isPremium || unlockedGifs.includes(item.id));
    } else if (mode === 'shop') {
      // Show premium GIFs that are NOT owned
      filtered = filtered.filter(item => item.isPremium && !unlockedGifs.includes(item.id));
    }
    return filtered;
  }, [library, searchTerm, unlockedGifs, mode]);

  const isGifUnlocked = (gifId) => {
    return Array.isArray(unlockedGifs) && unlockedGifs.includes(gifId);
  };

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
        unlockedGifs: updatedUnlocked,
      });

      setUserCoins(newCoins);
      setUnlockedGifs(updatedUnlocked);
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
      <div className={`gif-modal-content ${mode === 'profile' ? 'profile-mode' : ''}`}>
        <div className="gif-modal-header">
          <h2>{mode === 'profile' ? 'Choose Profile GIF' : 'Premium GIFs'}</h2>
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
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className="gif-grid-container">
          {loading ? (
            <div className="gif-loading">Loading...</div>
          ) : filteredGifs.length === 0 ? (
            <div className="gif-empty">
              {mode === 'profile' ? 'No free GIFs found. Check out the shop to unlock more!' : 'No premium GIFs available.'}
            </div>
          ) : (
            <div className={`gif-grid ${mode === 'profile' ? 'profile-grid' : 'shop-grid'}`}>
              {filteredGifs.map((gif) => (
                <GifItem
                  key={gif.id}
                  gif={gif}
                  isUnlocked={isGifUnlocked(gif.id)}
                  onSelect={handleSelect}
                  mode={mode}
                />
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
              {userCoins < selectedGif.price && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 8 }}>Not enough coins – visit the Shop to get more!</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GifLibraryModal;