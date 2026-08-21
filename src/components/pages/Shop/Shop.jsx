// src/components/pages/Shop/Shop.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../services/firebase';
import { ref, onValue, update, push, set, remove, get } from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { SKINS, getSkinById } from '../../../constants/echomoji';
import { fetchGifLibrary } from '../../../services/gifLibraryService';
import Modal from '../../common/Modal';
import Toast from '../../Toast/Toast';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Shop.css';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

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

// ─── Admin GIF Upload Panel ──────────────────────────────────────
const AdminGifPanel = ({ onGifAdded }) => {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [coinPrice, setCoinPrice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreview(url);
    }
    e.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter a name for the GIF.', 'error');
      return;
    }
    if (!file) {
      showToast('Please select a GIF file to upload.', 'error');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      const downloadUrl = data.secure_url;
      const isPremium = coinPrice && parseInt(coinPrice) > 0;
      const price = isPremium ? parseInt(coinPrice) : 0;

      const gifRef = push(ref(db, 'gifLibrary'));
      await set(gifRef, {
        title: name.trim(),
        url: downloadUrl,
        isPremium,
        price,
        category: 'General',
        duration: 0,
      });

      showToast(`GIF "${name.trim()}" added successfully!`, 'success');
      setName('');
      setFile(null);
      setPreview(null);
      setCoinPrice('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onGifAdded) onGifAdded();
    } catch (err) {
      console.error('Failed to add GIF:', err);
      showToast(`Failed to add GIF: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-gif-panel">
      <h3><i className="fas fa-plus-circle" /> Add GIF to Library</h3>
      <form onSubmit={handleSubmit}>
        <div className="admin-gif-form-group">
          <label>GIF Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Funny Cat GIF"
            disabled={uploading}
            required
          />
        </div>

        <div className="admin-gif-form-group">
          <label>GIF File *</label>
          <div className="admin-gif-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/gif,video/mp4,video/webm"
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            {!preview ? (
              <div
                className="admin-gif-drop-zone"
                onClick={handleUploadClick}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files[0];
                  if (dropped && (dropped.type === 'image/gif' || dropped.type.startsWith('video/'))) {
                    setFile(dropped);
                    const url = URL.createObjectURL(dropped);
                    setPreview(url);
                  }
                }}
              >
                <i className="fas fa-cloud-upload-alt" />
                <span>Drop your GIF here or click to browse</span>
                <small>Supports GIF, MP4, WebM</small>
              </div>
            ) : (
              <div className="admin-gif-preview-wrapper">
                <div className="admin-gif-preview-circle">
                  <img src={preview} alt="Preview" />
                </div>
                <div className="admin-gif-preview-actions">
                  <button
                    type="button"
                    className="admin-gif-change-btn"
                    onClick={handleUploadClick}
                    disabled={uploading}
                  >
                    <i className="fas fa-exchange-alt" /> Change
                  </button>
                  <button
                    type="button"
                    className="admin-gif-remove-btn"
                    onClick={handleRemoveFile}
                    disabled={uploading}
                  >
                    <i className="fas fa-times" /> Remove
                  </button>
                </div>
                <div className="admin-gif-filename">
                  <i className="fas fa-file-image" /> {file?.name || 'No file'}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="admin-gif-form-group">
          <label>Coin Price (optional)</label>
          <input
            type="number"
            value={coinPrice}
            onChange={(e) => setCoinPrice(e.target.value)}
            placeholder="Leave empty for free GIF"
            disabled={uploading}
            min="0"
          />
          <small>If empty, GIF will be free (isPremium: false)</small>
        </div>

        <button type="submit" className="admin-gif-submit" disabled={uploading}>
          {uploading ? (
            <>
              <span className="admin-gif-spinner" />
              Uploading...
            </>
          ) : (
            'Add GIF'
          )}
        </button>
      </form>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

// ─── Admin Manage GIFs Panel ─────────────────────────────────────
const AdminManageGifs = ({ gifs, onGifUpdated, onGifDeleted }) => {
  const [editingGif, setEditingGif] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editIsPremium, setEditIsPremium] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditClick = (gif) => {
    setEditingGif(gif);
    setEditTitle(gif.title || '');
    setEditPrice(gif.price?.toString() || '');
    setEditIsPremium(gif.isPremium || false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingGif) return;
    if (!editTitle.trim()) {
      showToast('Title is required.', 'error');
      return;
    }

    const price = editPrice && parseInt(editPrice) > 0 ? parseInt(editPrice) : 0;
    const isPremium = price > 0 || editIsPremium;

    try {
      const gifRef = ref(db, `gifLibrary/${editingGif.id}`);
      await update(gifRef, {
        title: editTitle.trim(),
        price: price,
        isPremium: isPremium,
      });
      showToast(`GIF "${editTitle.trim()}" updated!`, 'success');
      setShowEditModal(false);
      setEditingGif(null);
      if (onGifUpdated) onGifUpdated();
    } catch (err) {
      console.error('Failed to update GIF:', err);
      showToast(`Failed to update GIF: ${err.message}`, 'error');
    }
  };

  const handleDeleteGif = async (gif) => {
    if (!window.confirm(`Delete "${gif.title}"? This will remove it from all users who have it.`)) return;
    setDeleting(true);

    try {
      const gifUrl = gif.url;
      const gifId = gif.id;

      await remove(ref(db, `gifLibrary/${gifId}`));

      const profilesSnap = await get(ref(db, 'profiles'));
      if (profilesSnap.exists()) {
        const profiles = profilesSnap.val();
        const updates = {};
        for (const [uid, profile] of Object.entries(profiles)) {
          if (profile.avatar === gifUrl || profile.videoUrl === gifUrl) {
            updates[`profiles/${uid}/avatar`] = '';
            updates[`profiles/${uid}/videoUrl`] = '';
          }
        }
        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }

      const userSkinsSnap = await get(ref(db, 'userSkins'));
      if (userSkinsSnap.exists()) {
        const allSkins = userSkinsSnap.val();
        const skinUpdates = {};
        for (const [uid, data] of Object.entries(allSkins)) {
          if (data.unlockedGifs && Array.isArray(data.unlockedGifs) && data.unlockedGifs.includes(gifId)) {
            const newUnlocked = data.unlockedGifs.filter(id => id !== gifId);
            skinUpdates[`userSkins/${uid}/unlockedGifs`] = newUnlocked;
          }
        }
        if (Object.keys(skinUpdates).length > 0) {
          await update(ref(db), skinUpdates);
        }
      }

      showToast(`GIF "${gif.title}" deleted and removed from all users.`, 'success');
      setDeleting(false);
      if (onGifDeleted) onGifDeleted();
    } catch (err) {
      console.error('Failed to delete GIF:', err);
      if (err.message.includes('Permission denied')) {
        showToast('Permission denied to delete GIF. Check Firebase rules for gifLibrary.', 'error');
      } else {
        showToast(`Failed to delete GIF: ${err.message}`, 'error');
      }
      setDeleting(false);
    }
  };

  return (
    <div className="admin-gif-panel admin-manage-gifs">
      <h3><i className="fas fa-edit" /> Manage GIFs</h3>
      {deleting && (
        <div style={{ textAlign: 'center', padding: '8px', color: '#F59E0B' }}>
          <span className="admin-gif-spinner" /> Deleting...
        </div>
      )}
      {gifs.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '16px 0' }}>
          No GIFs in library yet.
        </p>
      ) : (
        <div className="admin-gif-list">
          {gifs.map((gif) => (
            <div key={gif.id} className="admin-gif-list-item">
              <div className="admin-gif-list-preview">
                <img src={gif.url} alt={gif.title} />
              </div>
              <div className="admin-gif-list-info">
                <div className="admin-gif-list-title">{gif.title}</div>
                <div className="admin-gif-list-meta">
                  {gif.isPremium ? `🪙 ${gif.price} coins` : 'Free'}
                </div>
              </div>
              <div className="admin-gif-list-actions">
                <button
                  className="admin-gif-edit-btn"
                  onClick={() => handleEditClick(gif)}
                  disabled={deleting}
                >
                  <i className="fas fa-pen" />
                </button>
                <button
                  className="admin-gif-delete-btn"
                  onClick={() => handleDeleteGif(gif)}
                  disabled={deleting}
                >
                  <i className="fas fa-trash-alt" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditModal && editingGif && (
        <div className="admin-edit-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="admin-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-edit-modal-header">
              <h4>Edit GIF</h4>
              <button className="admin-edit-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="admin-edit-modal-body">
              <div className="admin-gif-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="GIF title"
                />
              </div>
              <div className="admin-gif-form-group">
                <label>Price (coins)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="0 for free"
                  min="0"
                />
              </div>
              <div className="admin-gif-form-group">
                <label className="admin-gif-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editIsPremium}
                    onChange={(e) => setEditIsPremium(e.target.checked)}
                  />
                  Premium (requires coins)
                </label>
                <small>If checked, GIF will appear in shop. If unchecked, it will be free in library.</small>
              </div>
            </div>
            <div className="admin-edit-modal-actions">
              <button className="admin-edit-modal-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="admin-edit-modal-save" onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

// ─── Main Shop Component ──────────────────────────────────────
const Shop = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ownedSkins, setOwnedSkins] = useState([]);
  const [activeSkin, setActiveSkin] = useState(null);
  const [coins, setCoins] = useState(null);
  const [purchaseDataMap, setPurchaseDataMap] = useState({});
  const [ownedGifs, setOwnedGifs] = useState([]);
  const [gifLibrary, setGifLibrary] = useState([]);
  const [allGifs, setAllGifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const isAdmin = user?.uid === SUPPORT_UID;

  const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (!user) return;

    const userSkinsRef = ref(db, `userSkins/${user.uid}`);
    const unsub = onValue(userSkinsRef, (snap) => {
      const data = snap.val() || {};
      setOwnedSkins(data.owned || []);
      setActiveSkin(data.active || data.activeSkin || null);
      setCoins(data.coins || 0);
      setPurchaseDataMap(data.purchases || {});
      setOwnedGifs(data.unlockedGifs || []);
    });

    loadAllData();

    return () => unsub();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const allGifs = await fetchGifLibrary(true);
      setAllGifs(allGifs);
      const premiumGifs = allGifs.filter(g => g.isPremium);
      setGifLibrary(premiumGifs);
    } catch (err) {
      console.error('Failed to load GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = useCallback(async () => {
    await loadAllData();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  const renderShopContent = () => (
    <>
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
          <button className="shop-get-more" onClick={() => navigate('/coins')}>
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
    </>
  );

  return (
    <>
      <SEO
        title="Shop – Skins & GIFs"
        description="Customize your ECHOMOJI with exclusive skins and unlock premium GIFs. Express yourself with unique styles."
      />
      <StructuredData />
      <div className="shop-page">
        {/* ─── Sticky Back Header (only for admin) ─────────────── */}
        {isAdmin && (
          <div className="page-back-header">
            <button className="page-back-btn" onClick={() => navigate('/other')}>
              <i className="fas fa-arrow-left" /> Back
            </button>
            <span className="page-back-title">Shop</span>
          </div>
        )}

        {isAdmin ? (
          <div className="shop-admin-layout">
            <div className="shop-admin-left">
              {renderShopContent()}
            </div>
            <div className="shop-admin-right">
              <AdminGifPanel onGifAdded={refreshData} />
              <AdminManageGifs
                gifs={allGifs}
                onGifUpdated={refreshData}
                onGifDeleted={refreshData}
              />
            </div>
          </div>
        ) : (
          renderShopContent()
        )}
        <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} message={modal.message} type={modal.type} />
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </div>
    </>
  );
};

export default React.memo(Shop);