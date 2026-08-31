// src/components/pages/Other/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../services/firebase';
import { ref, onValue, remove, update, get, set } from 'firebase/database';
import {
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
} from 'firebase/auth';
import { removeAllReferencesToUser } from '../../../services/accountCleanup';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { useTheme } from '../../../contexts/ThemeContext';
import ConfirmModal from '../../common/ConfirmModal';
import Toast from '../../Toast/Toast';
import Avatar from '../../common/Avatar';
import { clearChatList } from '../../../services/indexedDBService';
import { clearMessagesCache } from '../../../services/messageStorage';
import { clearMessageCache } from '../../../services/messageCache';
import './Settings.css';
import { listEchoArchive, removeEchoArchive } from '../../../services/echoArchive';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { themePreference, setTheme } = useTheme();

  // ─── Account deletion states ──────────────────────────────────
  const [step, setStep] = useState('idle');
  const [typedName, setTypedName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isReauthing, setIsReauthing] = useState(false);

  // ─── Chat management states ──────────────────────────────────
  const [chats, setChats] = useState([]);
  const [selectedChats, setSelectedChats] = useState(new Set());
  const [loadingChats, setLoadingChats] = useState(true);
  const [bookmarks, setBookmarks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    showCancel: true,
    showInput: false,
    inputPlaceholder: '',
    inputValue: '',
    onInputChange: null,
    verificationText: '',
  });
  const [toast, setToast] = useState(null);
  const [chatBgEnabled, setChatBgEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('echo_chat_bg');
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });

  const toggleChatBg = () => {
    setChatBgEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('echo_chat_bg', next ? '1' : '0');
      } catch (_) {}
      window.dispatchEvent(
        new CustomEvent('echo-chat-bg-changed', { detail: { enabled: next } })
      );
      return next;
    });
  };

  const userName = user?.name || user?.displayName || user?.email?.split('@')[0] || '';
  const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');
  const isDemoUser = user?.uid === DEMO_UID;

  // ─── Load user's chats ────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    listEchoArchive(user.uid).then(setBookmarks).catch(() => {});

    const userChatsRef = ref(db, `userChats/${user.uid}`);
    const unsubscribe = onValue(userChatsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setChats([]);
        setLoadingChats(false);
        return;
      }
      const chatList = Object.entries(data)
        .map(([partnerId, chat]) => ({
          id: partnerId,
          ...chat,
          partnerName: chat.partnerName || chat.name || 'User',
          partnerAvatar: chat.partnerAvatar || '',
          lastMessage: chat.lastMessage || 'Start chatting...',
          timestamp: chat.lastUpdated || Date.now(),
          clearedAt: chat.clearedAt || null,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
      setChats(chatList);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ─── Helper: compute composite chat ID ──────────────────────
  const getChatId = (partnerId) => {
    return [user?.uid, partnerId].sort().join('_');
  };

  // ─── Local‑only wipe for this user's device ──────────────────
  const wipeLocalChatData = async (partnerId) => {
    if (!user?.uid || !partnerId) return;
    const cId = getChatId(partnerId);
    try { await clearMessagesCache(cId); } catch (_) {}
    try { await clearMessageCache(cId); } catch (_) {}
    await clearChatList(user.uid).catch(() => {});
    window.dispatchEvent(new CustomEvent('chat-history-cleared', { detail: { partnerId, chatId: cId } }));
    window.dispatchEvent(new CustomEvent('chats-refresh'));
  };

  const clearConversationForBoth = async (partnerId) => {
    const chatId = getChatId(partnerId);
    const now = Date.now();
    const updates = {
      [`chats/${chatId}`]: null,
      [`userChats/${user.uid}/${partnerId}/clearedAt`]: now,
      [`userChats/${partnerId}/${user.uid}/clearedAt`]: now,
      [`userChats/${user.uid}/${partnerId}/lastMessage`]: '',
      [`userChats/${partnerId}/${user.uid}/lastMessage`]: '',
      [`userChats/${user.uid}/${partnerId}/unreadCount`]: 0,
      [`userChats/${partnerId}/${user.uid}/unreadCount`]: 0,
    };
    await update(ref(db), updates);
    await wipeLocalChatData(partnerId);
  };

  const deleteConversationForBoth = async (partnerId) => {
    const chatId = getChatId(partnerId);
    const updates = {
      [`chats/${chatId}`]: null,
      [`userChats/${user.uid}/${partnerId}`]: null,
      [`userChats/${partnerId}/${user.uid}`]: null,
    };
    await update(ref(db), updates);
    await wipeLocalChatData(partnerId);
  };

  // ─── Helper: show toast ──────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Close confirm modal ─────────────────────────────────────
  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // ─── Open confirm modal with verification ────────────────────
  const openConfirmModal = (config) => {
    setConfirmModal({
      isOpen: true,
      showCancel: true,
      showInput: false,
      inputPlaceholder: '',
      inputValue: '',
      onInputChange: null,
      verificationText: '',
      ...config,
    });
  };

  // ─── 1. Clear History (selected chats) – permanently deletes messages ──
  const handleClearSelectedHistory = () => {
    if (selectedChats.size === 0) {
      showToast('No chats selected.', 'error');
      return;
    }
    const count = selectedChats.size;
    openConfirmModal({
      title: `Clear conversation history`,
      message: `Messages in the selected conversations will be removed for you and the other person. The chats will stay in Recent, with an empty history. This cannot be undone.`,
      confirmText: 'Clear History',
      showInput: true,
      inputPlaceholder: 'Type CLEAR to confirm',
      verificationText: 'CLEAR',
      onConfirm: async () => {
        try {
          const updates = {};
          const now = Date.now();
          for (const partnerId of selectedChats) {
            const chatId = getChatId(partnerId);
            // Delete the shared messages node
            updates[`chats/${chatId}`] = null;
            // Set clearedAt for both users (optional, but we also set lastMessage to 'Start chatting...')
            updates[`userChats/${user.uid}/${partnerId}/clearedAt`] = now;
            updates[`userChats/${partnerId}/${user.uid}/clearedAt`] = now;
            // Reset lastMessage for both
            updates[`userChats/${user.uid}/${partnerId}/lastMessage`] = 'Start chatting...';
            updates[`userChats/${partnerId}/${user.uid}/lastMessage`] = 'Start chatting...';
            // Wipe local cache for current user
            await wipeLocalChatData(partnerId);
          }
          await update(ref(db), updates);
          await clearChatList(user.uid).catch(() => {});
          setSelectedChats(new Set());
          showToast(`Cleared history for ${count} chat${count > 1 ? 's' : ''} (messages permanently deleted).`);
          window.dispatchEvent(new CustomEvent('chats-refresh'));
        } catch (err) {
          console.error('Clear history error:', err);
          showToast('Failed to clear history.', 'error');
        }
      },
    });
  };

  // ─── 1.1 Clear History (single chat) ──────────────────────────
  const handleClearSingleHistory = (chatId, partnerName) => {
    openConfirmModal({
      title: 'Clear History',
      message: `All messages with ${partnerName} will be removed for both of you. The conversation will stay in Recent, with an empty history. This cannot be undone.`,
      confirmText: 'Clear History',
      showInput: true,
      inputPlaceholder: 'Type CLEAR to confirm',
      verificationText: 'CLEAR',
      onConfirm: async () => {
        try {
          const cId = getChatId(chatId);
          const updates = {};
          const now = Date.now();
          updates[`chats/${cId}`] = null;
          updates[`userChats/${user.uid}/${chatId}/clearedAt`] = now;
          updates[`userChats/${chatId}/${user.uid}/clearedAt`] = now;
          updates[`userChats/${user.uid}/${chatId}/lastMessage`] = 'Start chatting...';
          updates[`userChats/${chatId}/${user.uid}/lastMessage`] = 'Start chatting...';
          await update(ref(db), updates);
          await wipeLocalChatData(chatId);
          await clearChatList(user.uid).catch(() => {});
          showToast(`History cleared with ${partnerName} (messages permanently deleted).`);
          window.dispatchEvent(new CustomEvent('chats-refresh'));
        } catch (err) {
          console.error('Clear history error:', err);
          showToast('Failed to clear history.', 'error');
        }
      },
    });
  };

  // ─── 2. Delete Chat (selected chats) – permanently deletes messages & removes chat ──
  const handleDeleteSelectedChats = () => {
    if (selectedChats.size === 0) {
      showToast('No chats selected.', 'error');
      return;
    }
    const count = selectedChats.size;
    openConfirmModal({
      title: `Delete ${count} Chat${count > 1 ? 's' : ''}`,
      message: `⚠️ This will permanently delete ALL messages and remove the conversation for both you and the other user${count > 1 ? 's' : ''}. The chat will disappear from Recent lists. This action is irreversible.`,
      confirmText: 'Delete',
      showInput: true,
      inputPlaceholder: 'Type DELETE to confirm',
      verificationText: 'DELETE',
      onConfirm: async () => {
        try {
          const updates = {};
          for (const partnerId of selectedChats) {
            const chatId = getChatId(partnerId);
            updates[`userChats/${user.uid}/${partnerId}`] = null;
            updates[`userChats/${partnerId}/${user.uid}`] = null;
            updates[`chats/${chatId}`] = null;
            await wipeLocalChatData(partnerId);
          }
          await update(ref(db), updates);
          await clearChatList(user.uid).catch(() => {});
          setSelectedChats(new Set());
          showToast(`Deleted ${count} chat${count > 1 ? 's' : ''} permanently.`);
          window.dispatchEvent(new CustomEvent('chats-refresh'));
        } catch (err) {
          console.error('Delete chats error:', err);
          showToast('Failed to delete chats.', 'error');
        }
      },
    });
  };

  // ─── 2.1 Delete Chat (single) ──────────────────────────────────
  const handleDeleteSingleChat = (chatId, partnerName) => {
    openConfirmModal({
      title: 'Delete Chat',
      message: `The conversation with ${partnerName} will be removed for both of you, including messages and Recent list entries. This cannot be undone.`,
      confirmText: 'Delete',
      showInput: true,
      inputPlaceholder: 'Type DELETE to confirm',
      verificationText: 'DELETE',
      onConfirm: async () => {
        try {
          const cId = getChatId(chatId);
          const updates = {};
          updates[`userChats/${user.uid}/${chatId}`] = null;
          updates[`userChats/${chatId}/${user.uid}`] = null;
          updates[`chats/${cId}`] = null;
          await update(ref(db), updates);
          await wipeLocalChatData(chatId);
          await clearChatList(user.uid).catch(() => {});
          setSelectedChats(prev => {
            const newSet = new Set(prev);
            newSet.delete(chatId);
            return newSet;
          });
          showToast(`Chat with ${partnerName} deleted permanently.`);
          window.dispatchEvent(new CustomEvent('chats-refresh'));
        } catch (err) {
          console.error('Delete chat error:', err);
          showToast('Failed to delete chat.', 'error');
        }
      },
    });
  };

  // ─── 3. Delete All Chats – permanently deletes all ─────────────
  const handleDeleteAllChats = () => {
    if (chats.length === 0) {
      showToast('No chats to delete.', 'error');
      return;
    }
    openConfirmModal({
      title: 'Delete All Chats',
      message: `Every conversation will be removed for you and each person you have chatted with, including messages and Recent list entries. This cannot be undone.`,
      confirmText: 'Delete All',
      showInput: true,
      inputPlaceholder: 'Type DELETE ALL to confirm',
      verificationText: 'DELETE ALL',
      onConfirm: async () => {
        try {
          const updates = {};
          updates[`userChats/${user.uid}`] = null;
          for (const chat of chats) {
            const partnerId = chat.id;
            const chatId = getChatId(partnerId);
            updates[`userChats/${partnerId}/${user.uid}`] = null;
            updates[`chats/${chatId}`] = null;
            await wipeLocalChatData(partnerId);
          }
          await update(ref(db), updates);
          await clearChatList(user.uid).catch(() => {});
          setSelectedChats(new Set());
          showToast('All chats deleted permanently.');
          window.dispatchEvent(new CustomEvent('chats-refresh'));
        } catch (err) {
          console.error('Delete all chats error:', err);
          showToast('Failed to delete all chats.', 'error');
        }
      },
    });
  };

  // ─── Toggle chat selection ────────────────────────────────────
  const toggleSelectChat = (chatId) => {
    setSelectedChats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  // ─── Select / Deselect all ────────────────────────────────────
  const toggleSelectAll = () => {
    const filtered = getFilteredChats();
    if (selectedChats.size === filtered.length) {
      setSelectedChats(new Set());
    } else {
      setSelectedChats(new Set(filtered.map(c => c.id)));
    }
  };

  // ─── Get filtered chats based on search term ─────────────────
  const getFilteredChats = () => {
    if (!searchTerm.trim()) return chats;
    return chats.filter(chat =>
      chat.partnerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // ─── Account deletion handlers ────────────────────────────────
  const handleDeleteRequest = () => {
    if (isDemoUser) {
      setError('Demo accounts cannot be deleted.');
      return;
    }
    setStep('verify');
    setError('');
  };

  const handleVerify = () => {
    if (typedName.trim() === userName) {
      setStep('reauth');
      setError('');
    } else {
      setError('Name does not match. Please type your exact name.');
    }
  };

  const handleReauth = async () => {
    const currentUser = user;
    if (!currentUser || !currentUser.email) {
      setError('No user found. Please sign in again.');
      return;
    }

    setIsReauthing(true);
    setError('');

    try {
      if (isGoogleUser) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(currentUser, provider);
      } else {
        if (!password.trim()) {
          setError('Please enter your password.');
          setIsReauthing(false);
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }
      setStep('confirm');
    } catch (err) {
      console.error('Re-auth error:', err);
      if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Re-authentication cancelled. Please try again.');
      } else {
        setError(`Re-authentication failed: ${err.message}`);
      }
    } finally {
      setIsReauthing(false);
    }
  };

  const handleConfirmDelete = async () => {
    const currentUser = user;
    if (!currentUser) {
      setError('No user found. Please sign in again.');
      return;
    }

    setStep('deleting');

    try {
      const uid = currentUser.uid;
      const nodesToDelete = ['profiles', 'userChats', 'userSkins'];
      const deletePromises = nodesToDelete.map(node => {
        const nodeRef = ref(db, `${node}/${uid}`);
        return remove(nodeRef).catch(err => {
          console.warn(`Failed to delete ${node}:`, err);
        });
      });
      await Promise.all(deletePromises);
      await removeAllReferencesToUser(uid);
      await deleteUser(currentUser);
      setStep('done');
    } catch (err) {
      console.error('Error deleting account:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Please re-authenticate again and try.');
        setStep('reauth');
      } else {
        setError(`Failed to delete account: ${err.message}`);
        setStep('idle');
      }
    }
  };

  const handleCancel = () => {
    setStep('idle');
    setTypedName('');
    setPassword('');
    setError('');
  };

  // ─── Render ────────────────────────────────────────────────────
  const filteredChats = getFilteredChats();

  return (
    <>
      <SEO title="Settings" description="Manage your ECHO account settings." />
      <StructuredData />
      <div className="settings-page">

        <div className="settings-content">
          {/* ─── THEME CARD ─────────────────────────────────────── */}
          <div className="settings-card">
            <h2><i className="fas fa-palette" /> Theme</h2>
            <p>Choose your preferred app appearance.</p>
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '12px',
              flexWrap: 'wrap',
            }}>
              {['dark', 'light', 'system'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '30px',
                    border: themePreference === mode ? '2px solid #6C3CE1' : '1px solid var(--border-color)',
                    background: themePreference === mode ? 'rgba(108,60,225,0.15)' : 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: themePreference === mode ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    flex: '0 1 auto',
                  }}
                >
                  {mode === 'dark' && '🌙 Dark'}
                  {mode === 'light' && '☀️ Light'}
                  {mode === 'system' && '⚙️ System'}
                </button>
              ))}
            </div>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginTop: '8px',
            }}>
              {themePreference === 'system'
                ? 'Auto-detects from your device settings.'
                : `Currently using ${themePreference} mode.`}
            </p>
          </div>

          {/* ─── CHAT BACKGROUND TOGGLE ─────────────────────────── */}
          <div className="settings-card">
            <h2><i className="fas fa-circle-notch" style={{ color: '#a78bfa' }} /> Chat background</h2>
            <p>
              Show the animated ECHO rings behind your conversations.
              Preference is saved on this device only.
            </p>
            <button
              type="button"
              className={`echo-toggle-btn ${chatBgEnabled ? 'on' : 'off'}`}
              onClick={toggleChatBg}
              aria-pressed={chatBgEnabled}
            >
              <span className="echo-toggle-track">
                <span className="echo-toggle-thumb" />
              </span>
              <span className="echo-toggle-label">
                {chatBgEnabled ? 'Background on' : 'Background off'}
              </span>
            </button>
          </div>

          {/* ─── CHAT MANAGEMENT CARD ───────────────────────────── */}
          <div className="settings-card">
            <h2><i className="fas fa-bookmark" /> Bookmarks</h2>
            <p>Messages you saved on this device. Maximum 10. They stay even after ECHO Tides removes the chat copy.</p>
            {bookmarks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>No bookmarks yet. Hover a message and tap the bookmark.</p>
            ) : (
              <ul className="echo-bookmark-list">
                {bookmarks.map((row) => (
                  <li key={row.archiveId} className="echo-bookmark-item">
                    <div>
                      <strong>{row.message?.senderId === user.uid ? 'You' : (row.message?.senderName || 'User')}</strong>
                      <span className="echo-bookmark-source"> · {row.source === 'community' ? 'Community' : 'Chat'}</span>
                      <p>{row.message?.text || (row.message?.mediaType ? 'Media' : 'Saved message')}</p>
                    </div>
                    <button type="button" onClick={async () => {
                      await removeEchoArchive(row.archiveId);
                      setBookmarks(await listEchoArchive(user.uid));
                    }}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="settings-card chat-management">
            <h2><i className="fas fa-comment-slash" /> Chat Management</h2>
            <p>Manage your conversations. Actions affect both you and the other person.</p>

            {loadingChats ? (
              <div className="chat-loading">Loading your chats...</div>
            ) : chats.length === 0 ? (
              <div className="no-chats-message">No chats found.</div>
            ) : (
              <>
                {/* ─── Search bar ─────────────────────────────────── */}
                <div className="chat-search-wrapper">
                  <i className="fas fa-search search-icon" />
                  <input
                    type="text"
                    placeholder="Search your chats..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="chat-search-input"
                  />
                  {searchTerm && (
                    <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>
                  )}
                </div>

                <div className="chat-list-header">
                  <div className="chat-select-all">
                    <input
                      type="checkbox"
                      checked={selectedChats.size === filteredChats.length && filteredChats.length > 0}
                      onChange={toggleSelectAll}
                    />
                    <span>Select All</span>
                  </div>
                  <div className="chat-actions">
                    <button
                      className="btn-clear-history"
                      onClick={handleClearSelectedHistory}
                      disabled={selectedChats.size === 0}
                    >
                      <i className="fas fa-eraser" /> Clear History
                    </button>
                    <button
                      className="btn-delete-chat"
                      onClick={handleDeleteSelectedChats}
                      disabled={selectedChats.size === 0}
                    >
                      <i className="fas fa-trash-alt" /> Delete Chat
                    </button>
                    <button
                      className="btn-delete-all"
                      onClick={handleDeleteAllChats}
                    >
                      <i className="fas fa-trash-alt" /> Delete All
                    </button>
                  </div>
                </div>

                <div className="chat-list">
                  {filteredChats.length === 0 ? (
                    <div className="no-chats-message">No chats match your search.</div>
                  ) : (
                    filteredChats.map((chat) => (
                      <div key={chat.id} className={`chat-list-item ${chat.clearedAt ? 'is-cleared' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedChats.has(chat.id)}
                          onChange={() => toggleSelectChat(chat.id)}
                          className="chat-checkbox"
                        />
                        <div className="chat-avatar">
                          <Avatar src={chat.partnerAvatar} name={chat.partnerName} size={40} />
                        </div>
                        <div className="chat-info">
                          <div className="chat-name">
                            {chat.partnerName}
                            {chat.clearedAt && <span className="cleared-badge"> (cleared)</span>}
                          </div>
                          <div className="chat-last-message">{chat.lastMessage}</div>
                        </div>
                        <div className="chat-actions-single">
                          <button
                            className="btn-clear-single"
                            onClick={() => handleClearSingleHistory(chat.id, chat.partnerName)}
                            title="Clear History (permanently delete messages)"
                          >
                            <i className="fas fa-eraser" />
                          </button>
                          <button
                            className="btn-delete-single"
                            onClick={() => handleDeleteSingleChat(chat.id, chat.partnerName)}
                            title="Delete Chat (permanently remove conversation)"
                          >
                            <i className="fas fa-trash-alt" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* ─── DANGER ZONE CARD ────────────────────────────────── */}
          <div className="settings-card danger-zone">
            <h2><i className="fas fa-exclamation-triangle" /> Danger Zone</h2>
            <p>This action is irreversible. Deleting your account will permanently remove all your data, including messages, profile, and Echoes.</p>

            {isDemoUser && (
              <p style={{ color: '#f59e0b', marginBottom: '12px' }}>
                <i className="fas fa-info-circle" /> Demo accounts cannot be deleted.
              </p>
            )}

            {step === 'idle' && (
              <button
                className="btn-danger"
                onClick={handleDeleteRequest}
                disabled={isDemoUser}
                style={{ opacity: isDemoUser ? 0.5 : 1, cursor: isDemoUser ? 'not-allowed' : 'pointer' }}
              >
                <i className="fas fa-trash-alt" /> Delete Account
              </button>
            )}

            {step === 'verify' && (
              <div className="verify-section">
                <p>Please type your name <strong>"{userName}"</strong> to confirm:</p>
                <input
                  type="text"
                  className="verify-input"
                  placeholder="Type your name..."
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  autoFocus
                />
                {error && <p className="error-text">{error}</p>}
                <div className="verify-actions">
                  <button className="btn-verify" onClick={handleVerify}>Verify</button>
                  <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
                </div>
              </div>
            )}

            {step === 'reauth' && (
              <div className="reauth-section">
                <p>
                  For security, please re-authenticate your account.
                  {isGoogleUser ? (
                    ' Click the button below to re-authenticate with Google.'
                  ) : (
                    ' Enter your password to continue.'
                  )}
                </p>
                {!isGoogleUser && (
                  <input
                    type="password"
                    className="verify-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
                {error && <p className="error-text">{error}</p>}
                <div className="verify-actions">
                  <button className="btn-verify" onClick={handleReauth} disabled={isReauthing}>
                    {isReauthing ? 'Authenticating...' : 'Continue'}
                  </button>
                  <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <div className="confirm-section">
                <p><i className="fas fa-exclamation-circle" /> This action <strong>cannot be undone</strong>. All your data will be permanently deleted.</p>
                <div className="confirm-actions">
                  <button className="btn-danger" onClick={handleConfirmDelete}>
                    Yes, Delete My Account
                  </button>
                  <button className="btn-cancel" onClick={handleCancel}>No, Keep It</button>
                </div>
              </div>
            )}

            {step === 'deleting' && (
              <div className="deleting-section">
                <div className="spinner"></div>
                <p>Deleting your account...</p>
              </div>
            )}

            {step === 'done' && (
              <div className="done-section">
                <div className="echo-animation">
                  <div className="ripple"></div>
                  <div className="ripple"></div>
                  <div className="ripple"></div>
                </div>
                <p>Account deleted successfully. Goodbye! 👋</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Confirm Modal ───────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={() => {
          // Check verification if needed (fallback)
          if (confirmModal.showInput && confirmModal.verificationText) {
            if (confirmModal.inputValue !== confirmModal.verificationText) {
              showToast(`Please type "${confirmModal.verificationText}" to confirm.`, 'error');
              return;
            }
          }
          if (confirmModal.onConfirm) {
            confirmModal.onConfirm();
          }
          closeConfirmModal();
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
        showCancel={confirmModal.showCancel !== false}
        showInput={confirmModal.showInput}
        inputPlaceholder={confirmModal.inputPlaceholder}
        inputValue={confirmModal.inputValue}
        onInputChange={(value) => {
          setConfirmModal(prev => ({ ...prev, inputValue: value }));
        }}
        verificationText={confirmModal.verificationText}
        loading={false}
      />

      {/* ─── Toast ───────────────────────────────────────────────── */}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
};

export default Settings;
