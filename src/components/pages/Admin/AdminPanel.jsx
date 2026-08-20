// src/components/pages/Admin/AdminPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  getUserCoins,
  addUserCoins,
  subtractUserCoins,
  wipeUserData,
  forceLogoutUser,
  deleteUserAccount,
  banUser,
  unbanUser,
  getUserBanStatus,
  checkIsSupport,
} from '../../../services/adminService';
import { db } from '../../../services/firebase';
import { ref, onValue, get, push, set } from 'firebase/database';
import { getAdminUserList, setAdminUserList } from '../../../services/indexedDBService';
import Toast from '../../Toast/Toast';
import LoginAnalyticsChart from './LoginAnalyticsChart';
import ConfirmModal from '../../common/ConfirmModal';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user } = useAuth();
  const [uid, setUid] = useState('');
  const [coinAmount, setCoinAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [uidNotFound, setUidNotFound] = useState(false);

  // ─── Admin Message State ──────────────────────────────────────
  const [adminMessageTitle, setAdminMessageTitle] = useState('');
  const [adminMessageBody, setAdminMessageBody] = useState('');

  // ─── Confirm Modal State ─────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    showInput: false,
    inputPlaceholder: '',
    inputValue: '',
    onConfirm: null,
    onInputChange: null,
    loading: false,
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const openConfirmModal = (config) => {
    setConfirmModal({
      isOpen: true,
      loading: false,
      inputValue: '',
      onInputChange: null,
      ...config,
    });
  };

  const banStatusCache = useRef({});
  const presenceCache = useRef({});

  if (!user || !checkIsSupport(user.uid)) {
    return (
      <>
        <SEO title="Access Denied" description="You do not have permission to view this page." noindex />
        <div className="admin-panel">
          <h1>Access Denied</h1>
          <p>You do not have permission to view this page.</p>
        </div>
      </>
    );
  }

  const buildUserList = (profilesData) => {
    const list = [];
    for (const [uid, profile] of Object.entries(profilesData || {})) {
      list.push({
        uid,
        name: profile.name || 'Unknown',
        email: profile.email || '',
        avatar: profile.avatar || '',
        mood: profile.mood || 'neutral',
        isBanned: banStatusCache.current[uid] || false,
        isOnline: presenceCache.current[uid] || false,
      });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  };

  const loadUsers = async (forceRefresh = false) => {
    setUsersLoading(true);
    if (!forceRefresh) {
      try {
        const cached = await getAdminUserList();
        if (cached && cached.length > 0) {
          setUsers(cached);
          setFilteredUsers(cached);
          setUsersLoading(false);
          return;
        }
      } catch (_) {}
    }
    try {
      const profilesSnap = await get(ref(db, 'profiles'));
      const usersList = [];
      if (profilesSnap.exists()) {
        const data = profilesSnap.val();
        for (const [uid, profile] of Object.entries(data)) {
          const banStatus = await getUserBanStatus(uid);
          let isOnline = false;
          try {
            const presenceSnap = await get(ref(db, `presence/online/${uid}`));
            isOnline = presenceSnap.val() === true;
          } catch (_) {}
          usersList.push({
            uid,
            name: profile.name || 'Unknown',
            email: profile.email || '',
            avatar: profile.avatar || '',
            mood: profile.mood || 'neutral',
            isBanned: banStatus.isBanned,
            isOnline: isOnline,
          });
        }
        usersList.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(usersList);
        setFilteredUsers(usersList);
        try {
          await setAdminUserList(usersList);
        } catch (_) {}
      } else {
        setUsers([]);
        setFilteredUsers([]);
        try {
          await setAdminUserList([]);
        } catch (_) {}
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      showToast('Failed to load user list', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    const profilesRef = ref(db, 'profiles');
    const unsubProfiles = onValue(profilesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const newUsers = buildUserList(data);
      setUsers(newUsers);
      setUsersLoading(false);
      setAdminUserList(newUsers).catch(() => {});
    });

    const presenceRef = ref(db, 'presence/online');
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      presenceCache.current = data;
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          isOnline: data[u.uid] === true,
        }))
      );
    });

    const accountsRef = ref(db, 'accounts');
    const unsubAccounts = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const newBanStatus = {};
      for (const [uid, acc] of Object.entries(data)) {
        if (acc.banned === true) newBanStatus[uid] = true;
      }
      banStatusCache.current = newBanStatus;
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          isBanned: newBanStatus[u.uid] || false,
        }))
      );
    });

    const loadCached = async () => {
      try {
        const cached = await getAdminUserList();
        if (cached && cached.length > 0) {
          setUsers(cached);
          setUsersLoading(false);
        }
      } catch (_) {}
    };
    loadCached();

    return () => {
      unsubProfiles();
      unsubPresence();
      unsubAccounts();
    };
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      setFilteredUsers(users);
      return;
    }
    const filtered = users.filter((u) =>
      u.name.toLowerCase().includes(term) || u.uid.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  useEffect(() => {
    const fetchBanStatus = async () => {
      if (!uid.trim()) {
        setIsBanned(false);
        setBanReason('');
        setUidNotFound(false);
        return;
      }
      try {
        const status = await getUserBanStatus(uid.trim());
        if (status.notFound) {
          setUidNotFound(true);
          setIsBanned(false);
          setBanReason('');
          showToast('User not found. Please check the UID.', 'error');
        } else {
          setUidNotFound(false);
          setIsBanned(status.isBanned);
          setBanReason(status.reason);
        }
      } catch (err) {
        console.warn('Failed to fetch ban status:', err);
        setUidNotFound(true);
        showToast('Error checking user', 'error');
      }
    };
    fetchBanStatus();
  }, [uid]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyUid = (uid) => {
    navigator.clipboard.writeText(uid)
      .then(() => showToast(`UID copied: ${uid}`, 'success'))
      .catch(() => showToast('Failed to copy UID', 'error'));
  };

  // ─── Send Admin Message ──────────────────────────────────────
  const handleSendAdminMessage = async () => {
    if (!uid.trim() || uidNotFound) return showToast('Select a valid user.', 'error');
    if (!adminMessageTitle.trim() || !adminMessageBody.trim()) {
      return showToast('Please fill in both title and body.', 'error');
    }
    setLoading(true);
    try {
      const notifRef = ref(db, `adminNotifications/${uid.trim()}/messages`);
      const newMsgRef = push(notifRef);
      await set(newMsgRef, {
        title: adminMessageTitle.trim(),
        body: adminMessageBody.trim(),
        timestamp: Date.now(),
        read: false,
      });
      showToast(`Message sent to ${uid.trim()}!`, 'success');
      setAdminMessageTitle('');
      setAdminMessageBody('');
    } catch (err) {
      showToast(`Failed to send: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Admin actions ────────────────────────────────────────────
  const handleCheckCoins = async () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    setLoading(true);
    try {
      const coins = await getUserCoins(uid.trim());
      showToast(`User has ${coins} coins.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoins = async () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    const amount = parseInt(coinAmount);
    if (!amount || amount <= 0) return showToast('Enter a valid positive amount.', 'error');
    setLoading(true);
    try {
      const newCoins = await addUserCoins(uid.trim(), amount);
      showToast(`Added ${amount} coins. New balance: ${newCoins}`, 'success');
      setCoinAmount('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubtractCoins = async () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    const amount = parseInt(coinAmount);
    if (!amount || amount <= 0) return showToast('Enter a valid positive amount.', 'error');
    setLoading(true);
    try {
      const newCoins = await subtractUserCoins(uid.trim(), amount);
      showToast(`Subtracted ${amount} coins. New balance: ${newCoins}`, 'success');
      setCoinAmount('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWipeData = () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    openConfirmModal({
      title: 'Wipe User Data',
      message: `Are you sure you want to permanently wipe all data for UID ${uid.trim()}? This cannot be undone.`,
      confirmText: 'Wipe Data',
      cancelText: 'Cancel',
      showInput: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await wipeUserData(uid.trim());
          showToast(`User data for ${uid.trim()} wiped successfully.`, 'success');
          closeConfirmModal();
          loadUsers(true);
        } catch (err) {
          showToast(err.message, 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const handleForceLogout = () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    openConfirmModal({
      title: 'Force Logout',
      message: `Force logout user ${uid.trim()}? They will be signed out immediately.`,
      confirmText: 'Force Logout',
      cancelText: 'Cancel',
      showInput: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await forceLogoutUser(uid.trim());
          showToast(`User ${uid.trim()} logged out.`, 'success');
          closeConfirmModal();
        } catch (err) {
          showToast(err.message, 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const handleDeleteAccount = () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    openConfirmModal({
      title: 'Delete Account',
      message: `Are you sure you want to permanently delete the account of UID ${uid.trim()}? This will delete all data and the authentication account. This cannot be undone.`,
      confirmText: 'Delete Account',
      cancelText: 'Cancel',
      showInput: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await deleteUserAccount(uid.trim());
          showToast(`User ${uid.trim()} deleted successfully.`, 'success');
          setUid('');
          closeConfirmModal();
          loadUsers(true);
        } catch (err) {
          showToast(err.message, 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const handleToggleBan = () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    if (isBanned) {
      openConfirmModal({
        title: 'Unban User',
        message: `Unban user ${uid.trim()}? They will be able to log in again.`,
        confirmText: 'Unban',
        cancelText: 'Cancel',
        showInput: false,
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          try {
            await unbanUser(uid.trim());
            setIsBanned(false);
            setBanReason('');
            showToast(`User ${uid.trim()} unbanned.`, 'success');
            closeConfirmModal();
            loadUsers(true);
          } catch (err) {
            showToast(err.message, 'error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        },
      });
    } else {
      setConfirmModal(prev => ({
        ...prev,
        isOpen: true,
        title: 'Ban User',
        message: `Enter a reason for banning ${uid.trim()}:`,
        confirmText: 'Ban',
        cancelText: 'Cancel',
        showInput: true,
        inputPlaceholder: 'Enter ban reason...',
        inputValue: '',
        loading: false,
        onConfirm: async (reason) => {
          if (!reason || !reason.trim()) {
            showToast('Please enter a reason for the ban.', 'error');
            return;
          }
          setConfirmModal(prev => ({ ...prev, loading: true }));
          try {
            await banUser(uid.trim(), reason.trim());
            setIsBanned(true);
            setBanReason(reason.trim());
            showToast(`User ${uid.trim()} banned.`, 'success');
            closeConfirmModal();
            loadUsers(true);
          } catch (err) {
            showToast(err.message, 'error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        },
        onInputChange: (value) => {
          setConfirmModal(prev => ({ ...prev, inputValue: value }));
        },
      }));
    }
  };

  return (
    <>
      <SEO
        title="Control Panel"
        description="Admin dashboard for managing users, coins, and system settings."
        noindex
      />
      <div className="admin-panel">
        <div className="admin-header">
          <h1>🛡️ Control Panel</h1>
          <p className="admin-subtitle">Manage users, coins, and system settings.</p>
        </div>

        <LoginAnalyticsChart />

        <div className="admin-two-col">
          <div className="admin-col-left">
            <div className="admin-card user-list-card">
              <div className="card-header">
                <h2><i className="fas fa-users" /> All Users</h2>
                <div className="search-wrapper">
                  <i className="fas fa-search search-icon" />
                  <input
                    type="text"
                    placeholder="Search by name or UID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={usersLoading}
                  />
                  <button
                    className="refresh-btn"
                    onClick={() => loadUsers(true)}
                    disabled={usersLoading}
                  >
                    <i className={`fas fa-sync-alt ${usersLoading ? 'fa-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="table-wrapper">
                {usersLoading ? (
                  <div className="loading-placeholder">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="empty-placeholder">No users found.</div>
                ) : (
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>UID</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        let statusText, statusClass;
                        if (u.isBanned) {
                          statusText = 'Banned';
                          statusClass = 'banned';
                        } else if (u.isOnline) {
                          statusText = 'Online';
                          statusClass = 'online';
                        } else {
                          statusText = 'Offline';
                          statusClass = 'offline';
                        }
                        return (
                          <tr key={u.uid}>
                            <td>{u.name}</td>
                            <td className="uid-cell">
                              <code>{u.uid}</code>
                              <button
                                className="copy-btn"
                                onClick={() => copyUid(u.uid)}
                                title="Copy UID"
                              >
                                <i className="fas fa-copy" />
                              </button>
                            </td>
                            <td>
                              <span className={`status-badge ${statusClass}`}>{statusText}</span>
                            </td>
                            <td>
                              <button
                                className="action-btn select-btn"
                                onClick={() => setUid(u.uid)}
                                title="Select this user for actions"
                              >
                                <i className="fas fa-chevron-right" /> Select
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {filteredUsers.length > 0 && (
                <div className="table-footer">
                  <span>{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          <div className="admin-col-right">
            <div className="admin-card">
              <h2><i className="fas fa-tools" /> User Management</h2>
              <div className="admin-input-group">
                <label>User UID</label>
                <div className="uid-input-wrapper">
                  <input
                    type="text"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    placeholder="Enter user UID or select from list"
                    disabled={loading}
                    style={{ borderColor: uidNotFound ? '#EF4444' : '' }}
                  />
                  {uid && (
                    <button className="clear-uid" onClick={() => setUid('')} disabled={loading}>
                      <i className="fas fa-times" />
                    </button>
                  )}
                </div>
                {uidNotFound && (
                  <p style={{ color: '#EF4444', fontSize: '13px', marginTop: '4px' }}>
                    ⚠️ User not found. Please check the UID.
                  </p>
                )}
              </div>

              <div className="admin-actions-grid">
                <button onClick={handleCheckCoins} disabled={loading || !uid.trim() || uidNotFound}>
                  <i className="fas fa-coins" /> Check Coins
                </button>
                <div className="add-coins-wrapper">
                  <input
                    type="number"
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(e.target.value)}
                    placeholder="Amount"
                    disabled={loading || !uid.trim() || uidNotFound}
                    min="1"
                  />
                  <button onClick={handleAddCoins} disabled={loading || !uid.trim() || !coinAmount || uidNotFound}>
                    <i className="fas fa-plus-circle" /> Add
                  </button>
                  <button
                    onClick={handleSubtractCoins}
                    className="admin-danger"
                    disabled={loading || !uid.trim() || !coinAmount || uidNotFound}
                  >
                    <i className="fas fa-minus-circle" /> Subtract
                  </button>
                </div>
                <button className="admin-danger" onClick={handleForceLogout} disabled={loading || !uid.trim() || uidNotFound}>
                  <i className="fas fa-sign-out-alt" /> Force Logout
                </button>
                <button className="admin-danger" onClick={handleWipeData} disabled={loading || !uid.trim() || uidNotFound}>
                  <i className="fas fa-trash-alt" /> Wipe Data
                </button>
                <button className="admin-danger" onClick={handleDeleteAccount} disabled={loading || !uid.trim() || uidNotFound}>
                  <i className="fas fa-user-minus" /> Delete Account
                </button>
                <button
                  className={isBanned ? 'admin-success' : 'admin-danger'}
                  onClick={handleToggleBan}
                  disabled={loading || !uid.trim() || uidNotFound}
                >
                  <i className={`fas ${isBanned ? 'fa-check-circle' : 'fa-ban'}`} />
                  {isBanned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>

            {/* ─── Send Admin Message Card (Styled) ────────────────── */}
            <div className="admin-card admin-message-card">
              <h2><i className="fas fa-bullhorn" /> Send Admin Message</h2>
              <div className="admin-input-group">
                <label>Message Title</label>
                <input
                  type="text"
                  className="admin-message-input"
                  placeholder="e.g. Important Notice"
                  value={adminMessageTitle}
                  onChange={(e) => setAdminMessageTitle(e.target.value)}
                  disabled={loading || !uid.trim() || uidNotFound}
                />
              </div>
              <div className="admin-input-group">
                <label>Message Body</label>
                <textarea
                  className="admin-message-textarea"
                  placeholder="Enter your message..."
                  value={adminMessageBody}
                  onChange={(e) => setAdminMessageBody(e.target.value)}
                  disabled={loading || !uid.trim() || uidNotFound}
                  rows="4"
                />
              </div>
              <button
                className="admin-message-send-btn"
                onClick={handleSendAdminMessage}
                disabled={loading || !uid.trim() || uidNotFound || !adminMessageTitle.trim() || !adminMessageBody.trim()}
              >
                <i className="fas fa-paper-plane" /> Send Message
              </button>
            </div>
          </div>
        </div>

        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={closeConfirmModal}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          showInput={confirmModal.showInput}
          inputPlaceholder={confirmModal.inputPlaceholder}
          inputValue={confirmModal.inputValue}
          onInputChange={confirmModal.onInputChange || (() => {})}
          loading={confirmModal.loading}
        />
      </div>
    </>
  );
};

export default AdminPanel;