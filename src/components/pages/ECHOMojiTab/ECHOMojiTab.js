// src/components/pages/ECHOMojiTab/ECHOMojiTab.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { db } from '../../../services/firebase';
import { ref, onValue, update, get } from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import MoodPicker from '../../common/MoodPicker';
import Modal from '../../common/Modal';
import { SKINS, getSkinById } from '../../../constants/echomoji';
import { useNavigate } from 'react-router-dom';
import Spinner from '../../common/Spinner';

// ─── Sub-component for a single skin item (memoized) ──────────────
const SkinItem = React.memo(({ 
  skin, 
  isOwned, 
  isActive, 
  timeLeft, 
  isExpired, 
  onApply, 
  onPurchase 
}) => {
  const skinObj = {
    bgStart: skin.bgStart,
    bgEnd: skin.bgEnd,
    ledColor: skin.ledColor,
    glowColor: skin.glowColor,
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '12px',
        padding: '12px',
        border: isActive ? '2px solid #6C3CE1' : '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
        transition: 'border 0.2s ease',
        opacity: isExpired ? 0.4 : 1,
      }}
    >
      <ECHOMOJI
        mood="neutral"
        skin={skinObj}
        size={48}
        interactive={false}
      />
      <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 600 }}>{skin.name}</div>
      {skin.isLimited && <div style={{ fontSize: '10px', color: '#F59E0B' }}>🔥 Limited</div>}
      {isOwned && skin.isLimited && (
        <div style={{ fontSize: '10px', color: '#F59E0B', marginTop: '2px' }}>
          {isExpired ? (
            '⏳ Expired'
          ) : (
            `⏳ ${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
          )}
        </div>
      )}
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
              background: isActive ? '#10B981' : (isExpired ? '#444' : '#6C3CE1'),
              color: '#fff',
              cursor: isExpired ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isExpired ? 0.5 : 1,
            }}
          >
            {isActive ? '✔ Active' : (isExpired ? 'Expired' : 'Apply')}
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

// ─── Main Component ──────────────────────────────────────────────
const ECHOMojiTab = () => {
  const { user } = useAuth();
  const [ownedSkins, setOwnedSkins] = useState([]);
  const [activeSkin, setActiveSkin] = useState(null);
  const [coins, setCoins] = useState(0);
  const [currentMood, setCurrentMood] = useState('neutral');
  const [purchaseDataMap, setPurchaseDataMap] = useState({});
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // ─── Modal State ──────────────────────────────────────────────
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  // Timer to update `now` every second
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ─── Load user's data (coins, skins, mood) ──────────────────────
  useEffect(() => {
    if (!user) return;
    console.log('🟢 Loading user data for', user.uid);
    setLoading(true);

    const userSkinsRef = ref(db, `userSkins/${user.uid}`);

    // 1. Real‑time listener for coins, owned skins, active skin
    const unsubSkins = onValue(userSkinsRef, (snap) => {
      const data = snap.val();
      console.log('📦 [onValue] userSkins data:', data);
      if (data) {
        setOwnedSkins(data.owned || []);
        setActiveSkin(data.active || null);
        const coinsVal = data.coins !== undefined ? data.coins : 350;
        setCoins(coinsVal);
        console.log(`💰 [onValue] Coins set to: ${coinsVal}`);
      } else {
        console.log('⚠️ No userSkins – creating with 350');
        update(ref(db, `userSkins/${user.uid}`), {
          owned: [],
          active: null,
          coins: 350,
        });
        setOwnedSkins([]);
        setActiveSkin(null);
        setCoins(350);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error in userSkins listener:', error);
      setLoading(false);
    });

    // 2. One‑time safety net read (in case listener fails)
    get(userSkinsRef)
      .then((snap) => {
        const data = snap.val();
        console.log('📦 [get] userSkins data:', data);
        if (data && data.coins !== undefined) {
          setCoins(data.coins);
          console.log(`💰 [get] Coins set to: ${data.coins}`);
        }
        // Don't set loading false here, the listener will
      })
      .catch((err) => console.error('Error reading userSkins:', err));

    // 3. Mood (from profiles)
    const profileRef = ref(db, `profiles/${user.uid}`);
    const unsubProfile = onValue(profileRef, (snap) => {
      const data = snap.val();
      if (data && data.mood) setCurrentMood(data.mood);
    });

    // 4. Purchases (for limited skins)
    const purchasesRef = ref(db, `userSkins/${user.uid}/purchases`);
    const unsubPurchases = onValue(purchasesRef, (snap) => {
      const data = snap.val();
      if (data) setPurchaseDataMap(data);
      else setPurchaseDataMap({});
    });

    return () => {
      unsubSkins();
      unsubProfile();
      unsubPurchases();
    };
  }, [user]);

  // ─── Time remaining helper ──────────────────────────────────────
  const getTimeRemaining = useCallback((purchase) => {
    if (!purchase) return null;
    const purchasedAt = purchase.purchasedAt;
    const expiresInDays = purchase.expiresInDays || 3;
    const expiryTime = purchasedAt + expiresInDays * 24 * 60 * 60 * 1000;
    const remaining = expiryTime - now;
    if (remaining <= 0) return null;
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    return { days, hours, minutes, seconds };
  }, [now]);

  const handleMoodChange = (mood) => {
    if (!user) return;
    setCurrentMood(mood);
    update(ref(db, `profiles/${user.uid}`), { mood })
      .then(() => console.log('✅ Mood saved to Firebase'))
      .catch((err) => console.error('❌ Failed to save mood:', err));
  };

  // ─── Purchase Skin ──────────────────────────────────────────────
  const purchaseSkin = (skinId, price) => {
    if (!user) return;
    if (coins < price) {
      showModal('Insufficient Coins', 'You need more coins to purchase this skin.', 'error');
      return;
    }
    const newOwned = [...ownedSkins, skinId];
    const newCoins = coins - price;
    update(ref(db, `userSkins/${user.uid}`), {
      owned: newOwned,
      coins: newCoins,
    });
    setOwnedSkins(newOwned);
    setCoins(newCoins);

    const skin = SKINS.find(s => s.id === skinId);
    if (skin && skin.isLimited) {
      const purchaseData = {
        purchasedAt: Date.now(),
        expiresInDays: skin.expiresInDays || 3,
      };
      update(ref(db, `userSkins/${user.uid}/purchases/${skinId}`), purchaseData);
      showModal(
        'Purchase Successful! 🎉',
        `You bought ${skin.name}! It will expire in ${skin.expiresInDays} days.`,
        'success'
      );
    } else {
      showModal('Purchase Successful! 🎉', `You bought ${skin.name}!`, 'success');
    }
  };

  // ─── Apply Skin ──────────────────────────────────────────────────
  const applySkin = (skinId) => {
    if (!user) return;
    const purchase = purchaseDataMap[skinId];
    if (purchase && getTimeRemaining(purchase) === null) {
      showModal('Skin Expired', 'This skin has expired and cannot be applied.', 'error');
      return;
    }
    const updates = {};
    updates[`userSkins/${user.uid}/active`] = skinId;
    updates[`profiles/${user.uid}/activeSkin`] = skinId;
    update(ref(db), updates);
    setActiveSkin(skinId);
  };

  const handleGetMoreCoins = () => {
    navigate('/coins');
  };

  const activeSkinObj = activeSkin ? getSkinById(activeSkin) : null;
  const skinForPreview = activeSkinObj ? {
    bgStart: activeSkinObj.bgStart,
    bgEnd: activeSkinObj.bgEnd,
    ledColor: activeSkinObj.ledColor,
    glowColor: activeSkinObj.glowColor,
  } : null;

  const validOwnedSkins = useMemo(() => {
    return ownedSkins.filter(skinId => {
      const purchase = purchaseDataMap[skinId];
      if (!purchase) return true;
      return getTimeRemaining(purchase) !== null;
    });
  }, [ownedSkins, purchaseDataMap, getTimeRemaining]);

  const skinItems = useMemo(() => {
    return SKINS.map((skin) => {
      const isOwned = validOwnedSkins.includes(skin.id);
      const isActive = activeSkin === skin.id;
      const purchase = purchaseDataMap[skin.id];
      const timeLeft = purchase ? getTimeRemaining(purchase) : null;
      const isExpired = purchase && timeLeft === null;

      return (
        <SkinItem
          key={skin.id}
          skin={skin}
          isOwned={isOwned}
          isActive={isActive}
          timeLeft={timeLeft || { days: 0, hours: 0, minutes: 0, seconds: 0 }}
          isExpired={isExpired}
          onApply={applySkin}
          onPurchase={purchaseSkin}
        />
      );
    });
  }, [validOwnedSkins, activeSkin, purchaseDataMap, getTimeRemaining]);

  console.log('🟣 Rendering JSX with', { ownedSkins: ownedSkins.length, coins, activeSkin });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner size={48} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', paddingTop: '70px', maxWidth: '480px', margin: '0 auto', minHeight: '100%' }}>
      {/* ECHOMOJI Preview */}
      <div style={{
        background: 'rgba(18,18,26,0.6)',
        borderRadius: '20px',
        padding: '24px',
        textAlign: 'center',
        marginBottom: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
          <ECHOMOJI
            mood={currentMood}
            skin={skinForPreview}
            size={80}
            interactive={false}
          />
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
      </div>

      {/* Mood Picker */}
      <div style={{
        background: 'rgba(18,18,26,0.6)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: '14px', color: '#888', marginBottom: '12px', fontWeight: 500 }}>
          Choose your mood
        </div>
        <MoodPicker currentMood={currentMood} onSelect={handleMoodChange} />
      </div>

      {/* Skin Shop */}
      <div style={{
        background: 'rgba(18,18,26,0.6)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>🛍️ Skins</div>
          <div style={{ fontSize: '14px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🪙 {coins}</span>
            <button
              onClick={handleGetMoreCoins}
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
          {skinItems}
        </div>
      </div>

      {/* ─── Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
};

export default ECHOMojiTab;