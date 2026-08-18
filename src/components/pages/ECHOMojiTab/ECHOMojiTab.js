// src/components/pages/ECHOMojiTab/ECHOMojiTab.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { db } from '../../../services/firebase';
import { ref, onValue, update } from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import MoodPicker from '../../common/MoodPicker';
import Modal from '../../common/Modal';
import { SKINS, getSkinById } from '../../../constants/echomoji';
import { useNavigate } from 'react-router-dom';
import SkeletonLoader from '../../common/SkeletonLoader';

// Helper for sub-millisecond synchronous storage reads/writes
const STORAGE_PREFIX = 'echo_cache_';

const getFastLocal = (key) => {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

const setFastLocal = (key, val) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.error('FastCache write error', e);
  }
};

// Isolated countdown badge to avoid re-rendering parent component on ticks
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

  if (!timeLeft) return <div style={{ fontSize: '10px', color: '#EF4444' }}>⏳ Expired</div>;

  return (
    <div style={{ fontSize: '10px', color: '#F59E0B', marginTop: '2px' }}>
      ⏳ {timeLeft.d}d {timeLeft.h}h {timeLeft.m}m {timeLeft.s}s
    </div>
  );
});

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
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '12px',
        padding: '12px',
        border: isActive ? '2px solid #6C3CE1' : '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
        opacity: isExpired ? 0.4 : 1,
      }}
    >
      <ECHOMOJI mood="neutral" skin={skinObj} size={48} interactive={false} animated={false} />
      <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 600 }}>{skin.name}</div>
      {skin.isLimited && <div style={{ fontSize: '10px', color: '#F59E0B' }}>🔥 Limited</div>}
      {isOwned && skin.isLimited && <CountdownBadge purchase={purchase} />}
      <div style={{ marginTop: '6px' }}>
        {isOwned ? (
          <button
            onClick={() => onApply(skin.id)}
            disabled={isExpired}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              borderRadius: '50px',
              border: 'none',
              background: isActive ? '#10B981' : isExpired ? '#444' : '#6C3CE1',
              color: '#fff',
              cursor: isExpired ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isExpired ? 0.5 : 1,
            }}
          >
            {isActive ? '✔ Active' : isExpired ? 'Expired' : 'Apply'}
          </button>
        ) : (
          <button
            onClick={() => onPurchase(skin.id, skin.price)}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              borderRadius: '50px',
              border: 'none',
              background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Buy {skin.price}🪙
          </button>
        )}
      </div>
    </div>
  );
});

const ECHOMojiTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initialCache = useMemo(() => {
    if (!user?.uid) return null;
    return getFastLocal(`echomoji_${user.uid}`);
  }, [user?.uid]);

  const [ownedSkins, setOwnedSkins] = useState(() => initialCache?.owned || []);
  const [activeSkin, setActiveSkin] = useState(() => initialCache?.active || null);
  const [coins, setCoins] = useState(() => (typeof initialCache?.coins === 'number' ? initialCache.coins : null));
  const [currentMood, setCurrentMood] = useState(() => initialCache?.mood || null);
  const [purchaseDataMap, setPurchaseDataMap] = useState(() => initialCache?.purchases || {});

  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    const cacheKey = `echomoji_${user.uid}`;

    // 1. Real-time User Skins Listener
    const userSkinsRef = ref(db, `userSkins/${user.uid}`);
    const unsubSkins = onValue(userSkinsRef, (snap) => {
      if (!isMounted) return;
      const data = snap.val() || {};
      const newOwned = data.owned || [];
      const newActive = data.activeSkin || data.active || null;
      const newCoins = typeof data.coins === 'number' ? data.coins : 350;
      const newPurchases = data.purchases || {};

      setOwnedSkins(newOwned);
      setActiveSkin(newActive);
      setCoins(newCoins);
      setPurchaseDataMap(newPurchases);

      const updatedCache = {
        ...(getFastLocal(cacheKey) || {}),
        owned: newOwned,
        active: newActive,
        coins: newCoins,
        purchases: newPurchases,
      };
      setFastLocal(cacheKey, updatedCache);
    });

    // 2. Real-time Profile Mood Listener
    const profileRef = ref(db, `profiles/${user.uid}`);
    const unsubProfile = onValue(profileRef, (snap) => {
      if (!isMounted) return;
      const data = snap.val();
      const newMood = data?.mood || 'neutral';

      setCurrentMood(newMood);

      const updatedCache = {
        ...(getFastLocal(cacheKey) || {}),
        mood: newMood,
      };
      setFastLocal(cacheKey, updatedCache);
    });

    return () => {
      isMounted = false;
      unsubSkins();
      unsubProfile();
    };
  }, [user?.uid]);

  const handleMoodChange = useCallback(
    (mood) => {
      if (!user) return;
      setCurrentMood(mood);
      const cacheKey = `echomoji_${user.uid}`;
      const currentCache = getFastLocal(cacheKey) || {};
      setFastLocal(cacheKey, { ...currentCache, mood });

      update(ref(db, `profiles/${user.uid}`), { mood }).catch((err) =>
        console.error('Failed to update mood:', err)
      );
    },
    [user]
  );

  const purchaseSkin = useCallback(
    (skinId, price) => {
      if (!user || coins === null) return;
      if (coins < price) {
        showModal('Insufficient Coins', 'You need more coins to purchase this skin.', 'error');
        return;
      }
      const newOwned = [...ownedSkins, skinId];
      const newCoins = coins - price;

      setOwnedSkins(newOwned);
      setCoins(newCoins);

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

  const activeSkinObj = useMemo(() => (activeSkin ? getSkinById(activeSkin) : null), [activeSkin]);
  const skinForPreview = useMemo(
    () =>
      activeSkinObj
        ? {
            bgStart: activeSkinObj.bgStart,
            bgEnd: activeSkinObj.bgEnd,
            ledColor: activeSkinObj.ledColor,
            glowColor: activeSkinObj.glowColor,
          }
        : null,
    [activeSkinObj]
  );

  return (
    <div style={{ padding: '70px 16px 100px', maxWidth: '480px', margin: '0 auto', minHeight: '100%' }}>
      {/* EchoMoji Preview Header Card */}
      <div
        style={{
          background: 'rgba(18,18,26,0.6)',
          borderRadius: '20px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {currentMood === null ? (
          <SkeletonLoader type="echomoji" />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <ECHOMOJI mood={currentMood} skin={skinForPreview} size={80} interactive={false} animated={true} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              {user?.name || user?.username || user?.displayName || 'User'}
            </div>
            <div style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>
              Mood: <span style={{ textTransform: 'capitalize', color: '#fff' }}>{currentMood}</span>
            </div>
            {activeSkinObj && (
              <div style={{ fontSize: '12px', color: '#6C3CE1', marginTop: '4px' }}>
                ✦ {activeSkinObj.name} active
              </div>
            )}
          </>
        )}
      </div>

      {/* Mood Picker */}
      <div
        style={{
          background: 'rgba(18,18,26,0.6)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ fontSize: '14px', color: '#888', marginBottom: '12px', fontWeight: 500 }}>Choose your mood</div>
        <MoodPicker currentMood={currentMood || 'neutral'} onSelect={handleMoodChange} />
      </div>

      {/* Skin Shop Grid */}
      <div
        style={{
          background: 'rgba(18,18,26,0.6)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>🛍️ Skins</div>
          <div style={{ fontSize: '14px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {coins === null ? (
              <div
                style={{
                  width: '60px',
                  height: '20px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.08)',
                  animation: 'pulse 1.5s infinite',
                }}
              />
            ) : (
              <span>🪙 {coins}</span>
            )}
            <button
              onClick={() => navigate('/coins')}
              className="echomoji-coin-btn"  // <-- add this class
              style={{
                padding: '4px 12px',
                borderRadius: '50px',
                background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
                border: 'none',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Get More
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} message={modal.message} type={modal.type} />
    </div>
  );
};

export default React.memo(ECHOMojiTab);