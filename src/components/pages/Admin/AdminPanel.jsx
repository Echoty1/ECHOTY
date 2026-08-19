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
import { ref, onValue, get } from 'firebase/database';
import { getAdminUserList, setAdminUserList } from '../../../services/indexedDBService';
import Toast from '../../Toast/Toast';
import LoginAnalyticsChart from './LoginAnalyticsChart';
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

  const banStatusCache = useRef({});
  const presenceCache = useRef({});

  if (!user || !checkIsSupport(user.uid)) {
    return (
      <div className="admin-panel">
        <h1>Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  // ─── Build user list from profile data, ban status, and presence ──
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

  // ─── Real‑time listeners ──────────────────────────────────────
  useEffect(() => {
    setUsersLoading(true);

    // 1. Listen to profiles (new users, name changes)
    const profilesRef = ref(db, 'profiles');
    const unsubProfiles = onValue(profilesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const newUsers = buildUserList(data);
      setUsers(newUsers);
      setUsersLoading(false);
      // Cache for offline
      setAdminUserList(newUsers).catch(() => {});
    });

    // 2. Listen to presence/online
    const presenceRef = ref(db, 'presence/online');
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      presenceCache.current = data;
      // Update existing users' online status
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          isOnline: data[u.uid] === true,
        }))
      );
    });

    // 3. Listen to accounts for ban status
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

    // Also load initial cache from IndexedDB for faster first paint
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

  // ─── Filter users by search ──────────────────────────────────
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

  // ─── Fetch ban status for the selected UID ───────────────────
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

  // ─── Admin actions ──────────────────────────────────────────
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

  const handleWipeData = async () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    if (!window.confirm(`Are you sure you want to permanently wipe all data for UID ${uid.trim()}?`)) return;
    setLoading(true);
    try {
      await wipeUserData(uid.trim());
      showToast(`User data for ${uid.trim()} wiped successfully.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogout = async () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    if (!window.confirm(`Force logout user ${uid.trim()}?`)) return;
    setLoading(true);
    try {
      await forceLogoutUser(uid.trim());
      showToast(`User ${uid.trim()} logged out.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    if (!window.confirm(`Are you sure you want to permanently delete the account of UID ${uid.trim()}? This will delete all data and the authentication account.`)) return;
    setLoading(true);
    try {
      await deleteUserAccount(uid.trim());
      showToast(`User ${uid.trim()} deleted successfully.`, 'success');
      setUid('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async () => {
    if (!uid.trim()) return showToast('Please enter a UID.', 'error');
    if (uidNotFound) return showToast('User not found. Please check the UID.', 'error');
    const action = isBanned ? 'Unban' : 'Ban';
    if (!window.confirm(`${action} user ${uid.trim()}?`)) return;
    setLoading(true);
    try {
      if (isBanned) {
        await unbanUser(uid.trim());
        showToast(`User ${uid.trim()} unbanned.`, 'success');
      } else {
        await banUser(uid.trim());
        showToast(`User ${uid.trim()} banned.`, 'success');
      }
      setIsBanned(!isBanned);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🛡️ Control Panel</h1>
        <p className="admin-subtitle">Manage users, coins, and system settings.</p>
      </div>

      {/* ─── Chart ────────────────────────────────────────────── */}
      <LoginAnalyticsChart />

      {/* ─── Two‑column layout ─────────────────────────────────── */}
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
                  onClick={() => {
                    // Force re-fetch by clearing cache and reloading
                    banStatusCache.current = {};
                    presenceCache.current = {};
                    setUsersLoading(true);
                    // The listeners will automatically update
                  }}
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
        </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AdminPanel;