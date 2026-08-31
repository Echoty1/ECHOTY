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
  purgeUserCompletely,
  banUser,
  unbanUser,
  getUserBanStatus,
  checkIsSupport,
} from '../../../services/adminService';
import { auth, db } from '../../../services/firebase';
import { ref, onValue, get, push, set, remove, update, runTransaction } from 'firebase/database';
import { getAdminUserList, setAdminUserList } from '../../../services/indexedDBService';
import Toast from '../../Toast/Toast';
import LoginAnalyticsChart from './LoginAnalyticsChart';
import ConfirmModal from '../../common/ConfirmModal';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { apiUrl } from '../../../utils/api';
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

  // ─── Transactions state ──────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // ─── Bulk selection ──────────────────────────────────────────
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // ─── Admin Message ───────────────────────────────────────────
  const [adminMessageTitle, setAdminMessageTitle] = useState('');
  const [adminMessageBody, setAdminMessageBody] = useState('');

  // ─── Confirm Modal ──────────────────────────────────────────
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

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
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

  // Status order: Online → Banned → Offline
  const statusRank = (u) => {
    if (u.isBanned) return 1;
    if (u.isOnline) return 0;
    return 2;
  };

  const sortUsers = (list) =>
    [...list].sort((a, b) => {
      const r = statusRank(a) - statusRank(b);
      if (r !== 0) return r;
      return (a.name || '').localeCompare(b.name || '');
    });

  // ─── Build user list from profiles and accounts ──────────────
  const buildUserList = (profilesData, accountsData) => {
    const list = [];
    for (const [uid, profile] of Object.entries(profilesData || {})) {
      const account = accountsData?.[uid] || {};
      const isBanned = account.banned === true;
      const rawOnline = presenceCache.current[uid] === true;
      list.push({
        uid,
        name: (profile.name && String(profile.name).trim()) || 'User',
        email: profile.email || '',
        avatar: profile.avatar || '',
        mood: profile.mood || 'neutral',
        isBanned,
        isOnline: rawOnline && !isBanned,
      });
    }
    return sortUsers(list);
  };

  // ─── Load users efficiently ──────────────────────────────────
  const loadUsers = async (forceRefresh = false) => {
    console.log('🔄 [loadUsers] Loading users, forceRefresh:', forceRefresh);
    setUsersLoading(true);

    if (!forceRefresh) {
      try {
        const cached = await getAdminUserList();
        if (cached && cached.length > 0) {
          setUsers(sortUsers(cached));
          setFilteredUsers(sortUsers(cached));
          console.log('✅ [loadUsers] Shell from cache, refreshing ban status…');
        }
      } catch (_) {}
    }

    try {
      const [profilesSnap, accountsSnap] = await Promise.all([
        get(ref(db, 'profiles')),
        get(ref(db, 'accounts')),
      ]);

      const profilesData = profilesSnap.exists() ? profilesSnap.val() : {};
      const accountsData = accountsSnap.exists() ? accountsSnap.val() : {};

      const usersList = [];
      for (const [uid, profile] of Object.entries(profilesData)) {
        const account = accountsData[uid] || {};
        const isBanned = account.banned === true;
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
          isBanned,
          isOnline: isOnline && !isBanned,
        });
        banStatusCache.current[uid] = isBanned;
        presenceCache.current[uid] = isOnline;
      }

      const sorted = sortUsers(usersList);
      setUsers(sorted);
      setFilteredUsers(sorted);
      await setAdminUserList(sortUsers(usersList));
      console.log('✅ [loadUsers] Loaded from Firebase with ban status');
    } catch (err) {
      console.error('❌ [loadUsers] Error:', err);
      showToast('Failed to load user list', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  // ─── Load transactions ────────────────────────────────────────
  const loadTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const snap = await get(ref(db, 'transactions'));
      if (!snap.exists()) {
        setTransactions([]);
        setTransactionsLoading(false);
        return;
      }
      const all = snap.val();
      const list = [];
      for (const [uid, transRefs] of Object.entries(all)) {
        const profileSnap = await get(ref(db, `profiles/${uid}/name`));
        const name = profileSnap.val() || 'Unknown';
        for (const [refKey, data] of Object.entries(transRefs)) {
          list.push({
            uid,
            name,
            ref: refKey,
            ...data,
          });
        }
      }
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setTransactions(list);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      showToast('Failed to load transactions', 'error');
    } finally {
      setTransactionsLoading(false);
    }
  };

  // ─── Listeners ────────────────────────────────────────────────
  useEffect(() => {
    loadUsers();
    loadTransactions();

    const profilesRef = ref(db, 'profiles');
    const unsubProfiles = onValue(profilesRef, (snapshot) => {
      const profilesData = snapshot.val() || {};
      const newUsers = [];
      for (const [uid, profile] of Object.entries(profilesData)) {
        const isBanned = banStatusCache.current[uid] === true;
        const isOnline = presenceCache.current[uid] === true && !isBanned;
        newUsers.push({
          uid,
          name: (profile.name && String(profile.name).trim()) || 'User',
          email: profile.email || '',
          avatar: profile.avatar || '',
          mood: profile.mood || 'neutral',
          isBanned,
          isOnline,
        });
      }
      const sorted = sortUsers(newUsers);
      setUsers(sorted);
      setFilteredUsers(sorted);
      setAdminUserList(sorted).catch(() => {});
      setUsersLoading(false);
    });

    const presenceRef = ref(db, 'presence/online');
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      const normalized = {};
      Object.keys(data).forEach((id) => {
        normalized[id] = data[id] === true;
      });
      presenceCache.current = normalized;
      setUsers((prev) =>
        sortUsers(
          prev.map((u) => {
            const banned = banStatusCache.current[u.uid] === true;
            return {
              ...u,
              isBanned: banned,
              isOnline: !banned && normalized[u.uid] === true,
            };
          })
        )
      );
    });

    const accountsRef = ref(db, 'accounts');
    const unsubAccounts = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const newBanStatus = {};
      for (const [id, acc] of Object.entries(data || {})) {
        if (acc && acc.banned === true) newBanStatus[id] = true;
      }
      banStatusCache.current = newBanStatus;
      setUsers((prev) =>
        sortUsers(
          prev.map((u) => {
            const banned = newBanStatus[u.uid] === true;
            return {
              ...u,
              isBanned: banned,
              isOnline: banned ? false : presenceCache.current[u.uid] === true,
            };
          })
        )
      );
    });

    return () => {
      unsubProfiles();
      unsubPresence();
      unsubAccounts();
    };
  }, []);

  // ─── Filter users ─────────────────────────────────────────────
  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      setFilteredUsers(users);
      return;
    }
    const filtered = users.filter((u) =>
      u.name.toLowerCase().includes(term) || u.uid.toLowerCase().includes(term)
    );
    setFilteredUsers(sortUsers(filtered));
  }, [searchTerm, users]);

  // ─── Fetch ban status for typed UID ──────────────────────────
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

  const copyUid = (userUid) => {
    navigator.clipboard.writeText(userUid)
      .then(() => showToast(`UID copied: ${userUid}`, 'success'))
      .catch(() => showToast('Failed to copy UID', 'error'));
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedUsers(new Set());
    } else {
      const ids = filteredUsers.map(u => u.uid);
      setSelectedUsers(new Set(ids));
      if (ids.length > 0) setUid(ids[0]);
    }
    setSelectAll(!selectAll);
  };

  const handleToggleUser = (userUid) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userUid)) {
      newSet.delete(userUid);
    } else {
      newSet.add(userUid);
      setUid(userUid);
    }
    setSelectedUsers(newSet);
    setSelectAll(newSet.size === filteredUsers.length && filteredUsers.length > 0);
  };

  const handleRowClick = (userUid) => {
    setUid(userUid);
    if (!selectedUsers.has(userUid)) {
      const newSet = new Set(selectedUsers);
      newSet.add(userUid);
      setSelectedUsers(newSet);
      setSelectAll(newSet.size === filteredUsers.length && filteredUsers.length > 0);
    }
  };

  const getActiveTargetUids = () => {
    if (selectedUsers.size > 0) return Array.from(selectedUsers);
    if (uid.trim() && !uidNotFound) return [uid.trim()];
    return [];
  };

  const getSelectedUserNames = () => {
    const targets = getActiveTargetUids();
    return users.filter(u => targets.includes(u.uid)).map(u => u.name || u.uid).join(', ');
  };

  const getSelectedUsersList = () => {
    const targets = getActiveTargetUids();
    return users.filter(u => targets.includes(u.uid));
  };

  // ─── Bulk Ban / Unban ────────────────────────────────────────
  const handleBulkToggleBan = () => {
    const uids = getActiveTargetUids();
    if (uids.length === 0) {
      showToast('Select at least one user or enter a valid UID.', 'error');
      return;
    }
    const names = getSelectedUserNames();
    const count = uids.length;

    const selectedList = getSelectedUsersList();
    const allBanned = selectedList.length > 0 && selectedList.every(u => u.isBanned);

    const action = allBanned ? 'Unban' : 'Ban';
    const actionLower = action.toLowerCase();

    openConfirmModal({
      title: `${action} ${count} User${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to ${actionLower} ${count} user${count > 1 ? 's' : ''}?\n\n${names}`,
      confirmText: action,
      cancelText: 'Cancel',
      showInput: !allBanned,
      inputPlaceholder: 'Enter ban reason...',
      onConfirm: async (reason) => {
        if (!allBanned && (!reason || !reason.trim())) {
          showToast('Please enter a reason for the ban.', 'error');
          return;
        }
        setConfirmModal(prev => ({ ...prev, loading: true }));
        console.log(`🔨 [handleBulkToggleBan] ${action}ning users:`, uids);

        setUsers(prevUsers => {
          const updated = sortUsers(
            prevUsers.map((row) => {
              if (uids.includes(row.uid)) {
                return {
                  ...row,
                  isBanned: !allBanned,
                  isOnline: allBanned ? false : false,
                };
              }
              return row;
            })
          );
          console.log('🔄 [handleBulkToggleBan] Optimistic update applied');
          return updated;
        });

        try {
          let success = 0;
          let failed = 0;
          for (const userUid of uids) {
            try {
              if (allBanned) {
                await unbanUser(userUid);
                console.log(`✅ [handleBulkToggleBan] Unbanned ${userUid}`);
              } else {
                await banUser(userUid, reason.trim());
                console.log(`✅ [handleBulkToggleBan] Banned ${userUid}`);
                await forceLogoutUser(userUid);
                console.log(`✅ [handleBulkToggleBan] Force logout ${userUid}`);
              }
              success++;
            } catch (err) {
              failed++;
              console.error(`❌ [handleBulkToggleBan] Failed for ${userUid}:`, err);
            }
          }
          showToast(
            `${action}ned ${success} user${success > 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
            'success'
          );
          closeConfirmModal();
          setSelectedUsers(new Set());
          setSelectAll(false);
          await loadUsers(true);
        } catch (err) {
          console.error('❌ [handleBulkToggleBan] Unexpected error:', err);
          showToast(err.message, 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
      onInputChange: (value) => {
        setConfirmModal(prev => ({ ...prev, inputValue: value }));
      },
    });
  };

  // ─── Bulk Force Logout ────────────────────────────────────────
  const handleBulkForceLogout = () => {
    const uids = getActiveTargetUids();
    if (uids.length === 0) return showToast('Select at least one user or enter a valid UID.', 'error');
    const names = getSelectedUserNames();
    const count = uids.length;
    openConfirmModal({
      title: `Force Logout ${count} User${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to force logout ${count} user${count > 1 ? 's' : ''}?\n\n${names}`,
      confirmText: 'Force Logout',
      cancelText: 'Cancel',
      showInput: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          let success = 0, failed = 0;
          for (const userUid of uids) {
            try { await forceLogoutUser(userUid); success++; } catch (err) { failed++; }
          }
          showToast(`Logged out ${success} user${success > 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`, 'success');
          closeConfirmModal();
          setSelectedUsers(new Set());
          setSelectAll(false);
        } catch (err) {
          showToast(err.message, 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  };

  // ─── Wipe Data (Backend-driven) ──────────────────────────────
  const handleBulkWipeData = () => {
    const uids = getActiveTargetUids();
    if (uids.length === 0) return showToast('Select at least one user or enter a valid UID.', 'error');
    const names = getSelectedUserNames();
    const count = uids.length;

    openConfirmModal({
      title: `⚠️ Wipe ALL Data for ${count} User${count > 1 ? 's' : ''}`,
      message: `
  This will PERMANENTLY delete EVERYTHING for ${count} user${count > 1 ? 's' : ''}:

  🔴 DELETE from Firebase Authentication (cannot be undone)
  📁 DELETE all profile data (name, avatar, bio, mood, etc.)
  💬 DELETE all chat messages (both sides)
  👥 DELETE all chat history from other users' lists
  🪙 DELETE all coins, skins, and purchases
  📊 DELETE all login history and activity logs
  📨 DELETE all admin notifications
  🔊 DELETE all call history and live streams
  👥 DELETE from communities and decrement member counts
  📝 DELETE all community posts by this user

  ⚠️ This action is IRREVERSIBLE and CANNOT BE UNDONE!

  Affected users:
  ${names}

  Type "WIPE ALL" to confirm.`,
      confirmText: '🗑️ Wipe All Data',
      cancelText: 'Cancel',
      showInput: true,
      inputPlaceholder: 'Type "WIPE ALL" to confirm',
      verificationText: 'WIPE ALL',
      onConfirm: async (inputValue) => {
        if (inputValue !== 'WIPE ALL') {
          showToast('Please type "WIPE ALL" to confirm.', 'error');
          return;
        }
        setConfirmModal(prev => ({ ...prev, loading: true }));

        try {
          // Get a fresh token from the Firebase Auth instance
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) {
            throw new Error('Not authenticated. Please sign in again.');
          }

          let successCount = 0;
          let failCount = 0;
          for (const targetUid of uids) {
            try {
              const response = await fetch(apiUrl('/api/admin/delete-user'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ targetUid }),
              });

              // Read response body even on error for better diagnostics
              const responseBody = await response.text();
              let result;
              try { result = JSON.parse(responseBody); } catch { result = { error: responseBody }; }

              if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}: ${responseBody}`);
              }

              successCount++;
              console.log(`✅ [Wipe] Successfully wiped user: ${targetUid}`);
            } catch (err) {
              failCount++;
              console.error(`❌ [Wipe] Failed for ${targetUid}:`, err);
              // Show a toast for each failure but continue with others
              showToast(`Failed to wipe ${targetUid}: ${err.message}`, 'error');
            }
          }

          let summary = `Wiped ${successCount} user${successCount > 1 ? 's' : ''} completely`;
          if (failCount > 0) summary += `, ${failCount} user${failCount > 1 ? 's' : ''} failed.`;
          showToast(summary, successCount > 0 ? 'success' : 'error');
          closeConfirmModal();
          setSelectedUsers(new Set());
          setSelectAll(false);
          setUid('');
          await loadUsers(true);
        } catch (err) {
          console.error('❌ [Wipe] Unexpected error:', err);
          showToast(err.message, 'error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        } finally {
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
      onInputChange: (value) => {
        setConfirmModal(prev => ({ ...prev, inputValue: value }));
      },
    });
  };

  // ─── Coin actions ─────────────────────────────────────────────
  const handleCheckCoins = async () => {
    const targetUid = uid.trim() || (selectedUsers.size > 0 ? Array.from(selectedUsers)[0] : '');
    if (!targetUid) return showToast('Please select or enter a UID.', 'error');
    setLoading(true);
    try {
      const coins = await getUserCoins(targetUid);
      showToast(`User (${targetUid}) has ${coins} coins.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  const handleAddCoins = async () => {
    const uids = getActiveTargetUids();
    if (uids.length === 0) return showToast('Please select or enter a UID.', 'error');
    const amount = parseInt(coinAmount);
    if (!amount || amount <= 0) return showToast('Enter a valid positive amount.', 'error');
    setLoading(true);
    try {
      for (const targetUid of uids) await addUserCoins(targetUid, amount);
      showToast(`Added ${amount} coins to ${uids.length} user${uids.length > 1 ? 's' : ''}.`, 'success');
      setCoinAmount('');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleSubtractCoins = async () => {
    const uids = getActiveTargetUids();
    if (uids.length === 0) return showToast('Please select or enter a UID.', 'error');
    const amount = parseInt(coinAmount);
    if (!amount || amount <= 0) return showToast('Enter a valid positive amount.', 'error');
    setLoading(true);
    try {
      for (const targetUid of uids) await subtractUserCoins(targetUid, amount);
      showToast(`Subtracted ${amount} coins from ${uids.length} user${uids.length > 1 ? 's' : ''}.`, 'success');
      setCoinAmount('');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  // ─── Admin Message ────────────────────────────────────────────
  const handleSendAdminMessage = async () => {
    const uids = getActiveTargetUids();
    if (uids.length === 0) return showToast('Select at least one valid user.', 'error');
    if (!adminMessageTitle.trim() || !adminMessageBody.trim()) {
      return showToast('Please fill in both title and body.', 'error');
    }
    setLoading(true);
    try {
      let count = 0;
      for (const targetUid of uids) {
        const notifRef = ref(db, `adminNotifications/${targetUid}/messages`);
        const newMsgRef = push(notifRef);
        await set(newMsgRef, {
          title: adminMessageTitle.trim(),
          body: adminMessageBody.trim(),
          timestamp: Date.now(),
          read: false,
        });
        count++;
      }
      showToast(`Message sent to ${count} user${count > 1 ? 's' : ''}!`, 'success');
      setAdminMessageTitle('');
      setAdminMessageBody('');
    } catch (err) { showToast(`Failed to send: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  };

  const activeCount = getActiveTargetUids().length;

  return (
    <>
      <SEO title="Control Panel" description="Admin dashboard" noindex />
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
                    title="Refresh user list from database"
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
                        <th style={{ width: '40px' }}>
                          <input type="checkbox" checked={selectAll} onChange={handleSelectAll} disabled={filteredUsers.length === 0} />
                        </th>
                        <th>Name</th>
                        <th>UID</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr
                          key={u.uid}
                          onClick={() => handleRowClick(u.uid)}
                          style={{
                            cursor: 'pointer',
                            background: selectedUsers.has(u.uid) || uid === u.uid ? 'rgba(108,60,225,0.08)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedUsers.has(u.uid)} onChange={() => handleToggleUser(u.uid)} />
                          </td>
                          <td>{u.name}</td>
                          <td className="uid-cell">
                            <code>{u.uid}</code>
                            <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyUid(u.uid); }} title="Copy UID">
                              <i className="fas fa-copy" />
                            </button>
                          </td>
                          <td>
                            <span
                              className={`status-badge ${
                                u.isBanned ? 'banned' : u.isOnline ? 'online' : 'offline'
                              }`}
                            >
                              {u.isBanned ? 'Banned' : u.isOnline ? 'Online' : 'Offline'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {filteredUsers.length > 0 && (
                <div className="table-footer">
                  <span>
                    {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                    {selectedUsers.size > 0 && ` · ${selectedUsers.size} selected`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="admin-col-right">
            <div className="admin-card">
              <h2><i className="fas fa-tools" /> User Management</h2>
              {activeCount > 0 && (
                <div style={{
                  background: 'rgba(108,60,225,0.08)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  border: '1px solid rgba(108,60,225,0.2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                      <strong>{activeCount}</strong> user{activeCount > 1 ? 's' : ''} targeted
                    </span>
                    <button
                      onClick={() => { setSelectedUsers(new Set()); setSelectAll(false); setUid(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getActiveTargetUids().slice(0, 5).map(targetUid => {
                      const u = users.find(x => x.uid === targetUid);
                      return u ? u.name : targetUid;
                    }).join(', ')}
                    {activeCount > 5 && ` +${activeCount - 5} more`}
                  </div>
                </div>
              )}
              <div className="admin-input-group">
                <label>User UID</label>
                <div className="uid-input-wrapper">
                  <input
                    type="text"
                    value={uid}
                    onChange={(e) => {
                      setUid(e.target.value);
                      if (selectedUsers.size > 0) { setSelectedUsers(new Set()); setSelectAll(false); }
                    }}
                    placeholder="Enter UID or click a row in the table"
                    disabled={loading}
                    style={{ borderColor: uidNotFound ? '#EF4444' : '' }}
                  />
                  {uid && <button className="clear-uid" onClick={() => setUid('')} disabled={loading}><i className="fas fa-times" /></button>}
                </div>
                {uidNotFound && <p style={{ color: '#EF4444', fontSize: '13px', marginTop: '4px' }}>⚠️ User not found. Please check the UID.</p>}
              </div>

              <div className="admin-actions-grid">
                <button onClick={handleCheckCoins} disabled={loading || activeCount === 0}>
                  <i className="fas fa-coins" /> Check Coins
                </button>
                <div className="add-coins-wrapper">
                  <input
                    type="number"
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(e.target.value)}
                    placeholder="Amount"
                    disabled={loading || activeCount === 0}
                    min="1"
                  />
                  <button onClick={handleAddCoins} disabled={loading || activeCount === 0 || !coinAmount}>
                    <i className="fas fa-plus-circle" /> Add
                  </button>
                  <button onClick={handleSubtractCoins} className="admin-danger" disabled={loading || activeCount === 0 || !coinAmount}>
                    <i className="fas fa-minus-circle" /> Subtract
                  </button>
                </div>

                <button className="admin-danger" onClick={handleBulkForceLogout} disabled={loading || activeCount === 0}>
                  <i className="fas fa-sign-out-alt" /> Force Logout{activeCount > 1 ? ' All' : ''}
                </button>
                <button className="admin-danger" onClick={handleBulkWipeData} disabled={loading || activeCount === 0}>
                  <i className="fas fa-trash-alt" /> Wipe Data (it won't work, because I am still working on it){activeCount > 1 ? ' All' : ''}
                </button>
                <button
                  className={activeCount > 0 && getSelectedUsersList().every(u => u.isBanned) ? 'admin-success' : 'admin-danger'}
                  onClick={handleBulkToggleBan}
                  disabled={loading || activeCount === 0}
                >
                  <i className={`fas ${activeCount > 0 && getSelectedUsersList().every(u => u.isBanned) ? 'fa-check-circle' : 'fa-ban'}`} />
                  {activeCount > 0 && getSelectedUsersList().every(u => u.isBanned) ? 'Unban' : 'Ban'}{activeCount > 1 ? ' All' : ''}
                </button>
              </div>
            </div>

            {/* ─── Coin Purchases Card ─────────────────────────────── */}
            <div className="admin-card">
              <h2><i className="fas fa-receipt" /> Coin Purchases</h2>
              {transactionsLoading ? (
                <div className="loading-placeholder">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="empty-placeholder">No completed purchases yet.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>UID</th>
                        <th>Coins</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 20).map((t, i) => (
                        <tr key={i}>
                          <td>{t.name}</td>
                          <td className="uid-cell"><code>{t.uid}</code></td>
                          <td>🪙 {t.amount}</td>
                          <td>{new Date(t.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="admin-card admin-message-card">
              <h2><i className="fas fa-bullhorn" /> Send Admin Message</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {activeCount === 0 ? '⚠️ Select users or enter a UID above.' : `✅ Ready to message ${activeCount} user${activeCount > 1 ? 's' : ''}.`}
              </p>
              <div className="admin-input-group">
                <label>Message Title</label>
                <input
                  type="text"
                  className="admin-message-input"
                  placeholder="e.g. Important Notice"
                  value={adminMessageTitle}
                  onChange={(e) => setAdminMessageTitle(e.target.value)}
                  disabled={loading || activeCount === 0}
                />
              </div>
              <div className="admin-input-group">
                <label>Message Body</label>
                <textarea
                  className="admin-message-textarea"
                  placeholder="Enter your message..."
                  value={adminMessageBody}
                  onChange={(e) => setAdminMessageBody(e.target.value)}
                  disabled={loading || activeCount === 0}
                  rows="4"
                />
              </div>
              <button
                className="admin-message-send-btn"
                onClick={handleSendAdminMessage}
                disabled={loading || activeCount === 0 || !adminMessageTitle.trim() || !adminMessageBody.trim()}
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
          onInputChange={confirmModal.onInputChange}
          loading={confirmModal.loading}
          verificationText={confirmModal.verificationText}
        />
      </div>
    </>
  );
};

export default AdminPanel;