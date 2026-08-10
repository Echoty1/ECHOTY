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
import { getCache, setCache } from '../../../services/cacheService';

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
  const [ownedSkins, setOwnedSkins] = useState([]);
  const [activeSkin, setActiveSkin] = useState(null);
  const [coins, setCoins] = useState(null); // null indicates loading state
  const [currentMood, setCurrentMood] = useState(null); // null indicates loading state
  const [purchaseDataMap, setPurchaseDataMap] = useState({});
  const navigate = useNavigate();

  const cacheKey = useMemo(() => `echomoji_${user?.uid}`, [user?.uid]);

  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

  // Instant Hydration + Realtime Firebase Listeners
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;

    // 1. Instant Cache Load
    getCache(cacheKey).then((cached) => {
      if (cached && isMounted) {
        setOwnedSkins(cached.owned || []);
        setActiveSkin(cached.active || null);
        setCoins(cached.coins ?? 350);
      }
    });

    // 2. Real-time User Skins Listener
    const userSkinsRef = ref(db, `userSkins/${user.uid}`);
    const unsubSkins = onValue(
      userSkinsRef,
      (snap) => {
        if (!isMounted) return;
        const data = snap.val();
        let payload;
        if (data) {
          payload = {
            owned: data.owned || [],
            active: data.active || null,
            coins: typeof data.coins === 'number' ? data.coins : 350,
          };
          if (data.purchases) setPurchaseDataMap(data.purchases);
        } else {
          payload = { owned: [], active: null, coins: 350 };
          update(ref(db, `userSkins/${user.uid}`), payload);
        }
        setOwnedSkins(payload.owned);
        setActiveSkin(payload.active);
        setCoins(payload.coins);
        setCache(cacheKey, payload);
      },
      (err) => console.error('Error fetching skins:', err)
    );

    // 3. Real-time Profile Listener for Mood Changes
    const profileRef = ref(db, `profiles/${user.uid}`);
    const unsubProfile = onValue(
      profileRef,
      (snap) => {
        if (!isMounted) return;
        const data = snap.val();
        if (data?.mood) {
          setCurrentMood(data.mood);
        } else {
          setCurrentMood('neutral');
        }
      },
      (err) => console.error('Error fetching mood:', err)
    );

    return () => {
      isMounted = false;
      unsubSkins();
      unsubProfile();
    };
  }, [user?.uid, cacheKey]);

  const handleMoodChange = useCallback(
    (mood) => {
      if (!user) return;
      setCurrentMood(mood);
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

      update(ref(db, `userSkins/${user.uid}`), {
        owned: newOwned,
        coins: newCoins,
      });

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
      updates[`userSkins/${user.uid}/active`] = skinId;
      updates[`profiles/${user.uid}/activeSkin`] = skinId;
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
    <div style={{ padding: '16px', paddingTop: '70px', maxWidth: '480px', margin: '0 auto', minHeight: '100%' }}>
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
            {/* Targeted Skeleton for Coins */}
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