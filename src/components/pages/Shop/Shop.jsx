// src/components/pages/Shop/Shop.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../services/firebase';
import { ref, onValue, update } from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { SKINS, getSkinById } from '../../../constants/echomoji';
import { fetchGifLibrary } from '../../../services/gifLibraryService';
import Modal from '../../common/Modal';
import Toast from '../../Toast/Toast';
import './Shop.css';

// ─── LocalStorage helpers for coins ──────────────────────────
const getCachedCoins = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`echo_coins_${uid}`);
    return raw !== null ? parseInt(raw, 10) : null;
  } catch { return null; }
};

const setCachedCoins = (uid, coins) => {
  if (!uid) return;
  try {
    localStorage.setItem(`echo_coins_${uid}`, String(coins));
  } catch {}
};

// ─── Skin item ────────────────────────────────────────────────────
const SkinItem = React.memo(({ skin, isOwned, isActive, purchase, onApply, onPurchase }) => {
  const skinObj = useMemo(
    () => ({
      bgStart: skin.bgStart,
      bgEnd: skin.bgEnd,
      ledColor: skin.ledColor,
      glowColor: skin.glowColor,
    }),
    [skin]
  );

  const isExpired = useMemo(() => {
    if (!purchase) return false;
    const expiryTime = purchase.purchasedAt + (purchase.expiresInDays || 3) * 86400000;
    return Date.now() >= expiryTime;
  }, [purchase]);

  return (
    <div
      className="shop-item skin-item"
      style={{
        opacity: isExpired ? 0.4 : 1,
        border: isActive ? '2px solid #EC4899' : '1px solid rgba(236,72,153,0.25)',
        boxShadow: isActive ? '0 0 20px rgba(236,72,153,0.2)' : 'none',
      }}
    >
      <ECHOMOJI mood="neutral" skin={skinObj} size={48} interactive={false} animated={false} />
      <div className="shop-item-name">{skin.name}</div>
      {skin.isLimited && <div className="shop-item-limited">🔥 Limited</div>}
      {isOwned && skin.isLimited && <CountdownBadge purchase={purchase} />}
      <div className="shop-item-actions">
        {isOwned ? (
          <button
            className={`shop-btn ${isActive ? 'active' : ''}`}
            onClick={() => onApply(skin.id)}
            disabled={isExpired}
          >
            {isActive ? '✔ Active' : isExpired ? 'Expired' : 'Apply'}
          </button>
        ) : (
          <button className="shop-btn buy" onClick={() => onPurchase(skin.id, skin.price)}>
            Buy {skin.price}🪙
          </button>
        )}
      </div>
    </div>
  );
});

// ─── GIF item ────────────────────────────────────────────────────
const GifItem = React.memo(({ gif, isOwned, onPurchase }) => {
  const price = gif.price || 50;

  return (
    <div
      className="shop-item gif-item"
      style={{
        border: isOwned ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(59,130,246,0.3)',
      }}
    >
      <div className="gif-preview">
        <img src={gif.url} alt={gif.title} />
      </div>
      <div className="shop-item-name">{gif.title}</div>
      <div className="shop-item-price">🪙 {price}</div>
      <div className="shop-item-actions">
        {isOwned ? (
          <span className="owned-badge">✅ Owned</span>
        ) : (
          <button className="shop-btn buy" onClick={() => onPurchase(gif.id, price)}>
            Buy
          </button>
        )}
      </div>
    </div>
  );
});

// ─── Countdown badge ──────────────────────────────────────────────
const CountdownBadge = React.memo(({ purchase }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!purchase) return;
    const calculateTime = () => {
      const expiryTime = purchase.purchasedAt + (purchase.expiresInDays || 3) * 86400000;
      const remaining = expiryTime - Date.now();
      if (remaining <= 0) {
        setTimeLeft(null);
        return;
      }
      setTimeLeft({
        d: Math.floor(remaining / 86400000),
        h: Math.floor((remaining % 86400000) / 3600000),
        m: Math.floor((remaining % 3600000) / 60000),
        s: Math.floor((remaining % 60000) / 1000),
      });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [purchase]);

  if (!timeLeft) return <div className="countdown expired">⏳ Expired</div>;

  return (
    <div className="countdown">
      ⏳ {timeLeft.d}d {timeLeft.h}h {timeLeft.m}m {timeLeft.s}s
    </div>
  );
});

// ─── Main Shop Component ──────────────────────────────────────
const Shop = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ownedSkins, setOwnedSkins] = useState([]);
  const [activeSkin, setActiveSkin] = useState(null);
  const [coins, setCoins] = useState(() => getCachedCoins(user?.uid)); // from localStorage
  const [purchaseDataMap, setPurchaseDataMap] = useState({});
  const [ownedGifs, setOwnedGifs] = useState([]);
  const [gifLibrary, setGifLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

  // ─── Listen to Firebase and sync coins to localStorage ──────
  useEffect(() => {
    if (!user?.uid) {
      setCoins(null);
      return;
    }

    // First, read from localStorage (already done in initial state)
    // But we also want to listen to Firebase for updates
    const userSkinsRef = ref(db, `userSkins/${user.uid}`);
    const unsub = onValue(userSkinsRef, (snap) => {
      const data = snap.val() || {};
      const newCoins = data.coins ?? 0;
      setCoins(newCoins);
      setCachedCoins(user.uid, newCoins);
      setOwnedSkins(data.owned || []);
      setActiveSkin(data.active || data.activeSkin || null);
      setPurchaseDataMap(data.purchases || {});
      setOwnedGifs(data.unlockedGifs || []);
    });

    return () => unsub();
  }, [user?.uid]);

  // ─── Load GIF library ────────────────────────────────────────
  useEffect(() => {
    const loadGifs = async () => {
      const allGifs = await fetchGifLibrary();
      const premiumGifs = allGifs.filter(g => g.isPremium);
      setGifLibrary(premiumGifs);
      setLoading(false);
    };
    loadGifs();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Purchase skin ──────────────────────────────────────────────
  const purchaseSkin = useCallback(
    (skinId, price) => {
      if (!user || coins === null || coins < price) {
        showModal('Insufficient Coins', 'You need more coins to purchase this skin.', 'error');
        return;
      }
      if (ownedSkins.includes(skinId)) {
        showToast('You already own this skin.', 'info');
        return;
      }

      const newOwned = [...ownedSkins, skinId];
      const newCoins = coins - price;

      setOwnedSkins(newOwned);
      setCoins(newCoins);
      setCachedCoins(user.uid, newCoins);

      const updates = {
        owned: newOwned,
        coins: newCoins,
        activeSkin: skinId,
      };

      update(ref(db, `userSkins/${user.uid}`), updates);

      const skin = SKINS.find((s) => s.id === skinId);
      if (skin?.isLimited) {
        const purchaseData = {
          purchasedAt: Date.now(),
          expiresInDays: skin.expiresInDays || 3,
        };
        update(ref(db, `userSkins/${user.uid}/purchases/${skinId}`), purchaseData);
        showModal('Purchase Successful! 🎉', `You bought ${skin.name}!`, 'success');
      } else {
        showModal('Purchase Successful! 🎉', `You bought ${skin?.name || 'skin'}!`, 'success');
      }
    },
    [user, coins, ownedSkins]
  );

  // ─── Apply skin ──────────────────────────────────────────────────
  const applySkin = useCallback(
    (skinId) => {
      if (!user) return;
      const updates = {};
      updates[`userSkins/${user.uid}/activeSkin`] = skinId;
      update(ref(db), updates);
      setActiveSkin(skinId);
    },
    [user]
  );

  // ─── Purchase GIF ──────────────────────────────────────────────────
  const purchaseGif = useCallback(
    (gifId, price) => {
      if (!user || coins === null || coins < price) {
        showModal('Insufficient Coins', 'You need more coins to unlock this GIF.', 'error');
        return;
      }
      if (ownedGifs.includes(gifId)) {
        showToast('You already own this GIF.', 'info');
        return;
      }

      const newOwned = [...ownedGifs, gifId];
      const newCoins = coins - price;

      setOwnedGifs(newOwned);
      setCoins(newCoins);
      setCachedCoins(user.uid, newCoins);

      update(ref(db, `userSkins/${user.uid}`), {
        coins: newCoins,
        unlockedGifs: newOwned,
      });

      showModal('GIF Unlocked! 🎉', `You unlocked "${gifLibrary.find(g => g.id === gifId)?.title || 'GIF'}"!`, 'success');
    },
    [user, coins, ownedGifs, gifLibrary]
  );

  if (loading) {
    return (
      <div className="shop-loading">
        <div className="shop-loading-spinner" />
        <p>Loading shop...</p>
      </div>
    );
  }

  const availableGifs = gifLibrary.filter(gif => !ownedGifs.includes(gif.id));

  return (
    <div className="shop-page">
      <div className="shop-header">
        <div className="shop-header-left">
          {coins === null ? (
            <div className="shop-coins-skeleton">
              <div className="skeleton-line" />
            </div>
          ) : (
            <div className="shop-coins">🪙 {coins} coins</div>
          )}
        </div>
        <div className="shop-header-center">
          <h1>🛍️ Shop</h1>
        </div>
        <div className="shop-header-right">
          <button
            className="shop-get-more"
            onClick={() => navigate('/coins')}
          >
            Get More
          </button>
        </div>
      </div>

      <div className="shop-section skins-section">
        <h2>Skins</h2>
        <div className="shop-grid">
          {SKINS.map((skin) => (
            <SkinItem
              key={skin.id}
              skin={skin}
              isOwned={ownedSkins.includes(skin.id)}
              isActive={activeSkin === skin.id}
              purchase={purchaseDataMap[skin.id]}
              onApply={applySkin}
              onPurchase={purchaseSkin}
            />
          ))}
        </div>
      </div>

      <div className="shop-section gifs-section">
        <h2>Premium GIFs</h2>
        <div className="shop-grid">
          {availableGifs.length === 0 ? (
            <p style={{ color: '#888', gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0' }}>
              You already own all premium GIFs! 🎉
            </p>
          ) : (
            availableGifs.map((gif) => (
              <GifItem
                key={gif.id}
                gif={gif}
                isOwned={ownedGifs.includes(gif.id)}
                onPurchase={purchaseGif}
              />
            ))
          )}
        </div>
      </div>

      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} message={modal.message} type={modal.type} />
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default React.memo(Shop);