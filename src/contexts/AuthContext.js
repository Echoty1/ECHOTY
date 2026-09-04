// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, set, update, onDisconnect, onValue, remove, get, runTransaction } from 'firebase/database';
import { initPresence } from '../services/presenceService';
import { isUnverifiedPasswordUser } from '../utils/emailGate';

const getDeviceId = () => {
  try {
    let id = localStorage.getItem('echo_device_id');
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem('echo_device_id', id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
};

const parseOs = (platform, ua) => {
  const p = String(platform || '');
  const u = String(ua || '');
  if (/Win/i.test(p) && !/Windows Phone/i.test(p + u)) return 'Windows';
  if (/Mac/i.test(p) && !/iPhone|iPad/i.test(p + u)) return 'macOS';
  if (/CrOS|Chrome OS/i.test(p) || /CrOS/i.test(u)) return 'ChromeOS';
  if (/Android/i.test(p)) return 'Android';
  if (/iPhone/i.test(p)) return 'iOS';
  if (/iPad/i.test(p)) return 'iPadOS';
  if (/Linux/i.test(p)) return 'Linux';
  if (/Win/i.test(p)) return 'Windows';
  if (/Android/i.test(u) && !/Win|MacIntel|Linux x86|CrOS/i.test(p)) return 'Android';
  if (/iPhone/i.test(u) && !/Win|MacIntel|Linux x86/i.test(p)) return 'iOS';
  if (/iPad/i.test(u) && !/Win|MacIntel|Linux x86/i.test(p)) return 'iPadOS';
  if (/Windows Phone|WPDesktop/i.test(u)) return 'Windows';
  if (/Win/i.test(u)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(u) && !/iPhone|iPad/i.test(u)) return 'macOS';
  if (/Ubuntu/i.test(u)) return 'Linux';
  if (/Linux/i.test(u) && !/Android/i.test(u)) return 'Linux';
  return 'Unknown';
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent || '';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const os = parseOs(platform, ua);
  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  return { os, browser, screen: `${window.screen.width}×${window.screen.height}` };
};

const refineDeviceOs = async (fallback) => {
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      const high = await navigator.userAgentData.getHighEntropyValues(['platform']);
      if (high?.platform) return parseOs(high.platform, navigator.userAgent || '');
    }
  } catch (_) {}
  return fallback;
};

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banInfo, setBanInfo] = useState({ isBanned: false, reason: '', bannedAt: null });
  const presenceCleanupRef = useRef(null);
  const accountCleanupRef = useRef(null);
  const profileUnsubRef = useRef(null);
  const sessionCleanupRef = useRef(null);
  const loggingOutRef = useRef(false);

  const updateDailyLogin = async (uid) => {
    if (!uid) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const userLoginRef = ref(db, `userDailyLogins/${uid}/${today}`);
      const snap = await get(userLoginRef);
      if (snap.exists()) return;
      await set(userLoginRef, true);
      await update(ref(db, `profiles/${uid}`), { lastLoginDate: today });
    } catch (_) {}
  };

  const cleanupAll = () => {
    if (presenceCleanupRef.current) {
      presenceCleanupRef.current();
      presenceCleanupRef.current = null;
    }
    if (accountCleanupRef.current) {
      accountCleanupRef.current();
      accountCleanupRef.current = null;
    }
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
    if (sessionCleanupRef.current) {
      sessionCleanupRef.current();
      sessionCleanupRef.current = null;
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      cleanupAll();

      if (firebaseUser) {
        try {
          const uid = firebaseUser.uid;
          if (isUnverifiedPasswordUser(firebaseUser, 'k9Cs6QPfDRNTputzic7V3xRUof63')) {
            setUser(null);
            setLoading(false);
            return;
          }

          const deviceId = getDeviceId();
          const info = getDeviceInfo();
          const fingerprint = `${info.os}|${info.browser}|${info.screen}`;
          const sessionRef = ref(db, `sessions/${uid}/${deviceId}`);
          let sessionLive = false;
          get(sessionRef).then((snap) => {
            const prev = snap.exists() ? snap.val() : {};
            return set(sessionRef, {
              deviceId,
              os: info.os,
              browser: info.browser,
              screen: info.screen,
              fingerprint,
              lastActive: Date.now(),
              createdAt: prev.createdAt || Date.now(),
              isCurrent: true,
            });
          }).then(async () => {
            sessionLive = true;
            onDisconnect(sessionRef).update({ lastActive: Date.now(), isCurrent: false }).catch(() => {});
            const realOs = await refineDeviceOs(info.os);
            if (realOs && realOs !== info.os) {
              await update(sessionRef, { os: realOs, fingerprint: `${realOs}|${info.browser}|${info.screen}` }).catch(() => {});
            }
            return get(ref(db, `sessions/${uid}`));
          }).then((all) => {
            const rows = all && all.exists() ? all.val() : {};
            Object.entries(rows).forEach(([id, row]) => {
              if (id === deviceId) return;
              const same =
                row &&
                (row.fingerprint === fingerprint ||
                  (row.os === info.os && row.browser === info.browser && row.screen === info.screen));
              if (same) remove(ref(db, `sessions/${uid}/${id}`)).catch(() => {});
            });
          }).catch(() => {});
          sessionCleanupRef.current = onValue(sessionRef, (snap) => {
            if (loggingOutRef.current) return;
            if (sessionLive && !snap.exists() && auth.currentUser) {
              signOut(auth).catch(() => {});
            }
          });

          presenceCleanupRef.current = initPresence(uid);

          const baseUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            avatar: '',
            mood: 'neutral',
            activeSkin: null,
            bio: '',
            interests: [],
            skills: [],
            country: '',
            city: '',
            status: '🟢 Active',
            lastActive: Date.now(),
          };
          setUser(baseUser);

          const profileRef = ref(db, `profiles/${uid}`);

          const unsubscribeProfile = onValue(
            profileRef,
            async (snapshot) => {
              if (snapshot.exists()) {
                const profileData = snapshot.val();

                const googleName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                const currentName = profileData.name || profileData.displayName || profileData.username || '';
                const isUid = currentName.length >= 28;
                const isDefault = !currentName || currentName === 'User' || isUid;

                let needsUpdate = false;
                const updatedData = {};

                if (isDefault) {
                  updatedData.name = googleName;
                  updatedData.searchName = googleName.toLowerCase();
                  needsUpdate = true;
                } else {
                  const expectedSearch = (currentName || 'User').toLowerCase();
                  if (profileData.searchName !== expectedSearch) {
                    updatedData.searchName = expectedSearch;
                    needsUpdate = true;
                  }
                }

                if (profileData.avatar && profileData.avatar.startsWith('https://lh3.googleusercontent.com')) {
                  updatedData.avatar = '';
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  update(profileRef, updatedData).catch(() => {});
                  Object.assign(profileData, updatedData);
                }

                setUser((prev) => ({
                  ...prev,
                  ...profileData,
                  displayName: firebaseUser.displayName || profileData.name || prev?.name || 'User',
                  photoURL: firebaseUser.photoURL || profileData.avatar || '',
                }));

                await updateDailyLogin(uid);
                setLoading(false);
              } else {
                const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                const newProfile = {
                  name,
                  searchName: name.toLowerCase(),
                  avatar: '',
                  mood: 'neutral',
                  activeSkin: null,
                  bio: 'New to ECHO!',
                  interests: [],
                  skills: [],
                  country: '',
                  city: '',
                  status: '🟢 Active',
                  lastActive: Date.now(),
                  createdAt: Date.now(),
                };

                setUser((prev) => ({ ...prev, ...newProfile }));

                try {
                  await set(profileRef, newProfile);
                  await Promise.all([
                    set(ref(db, `accounts/${uid}`), {
                      email: firebaseUser.email,
                      joined: Date.now(),
                      banned: false,
                    }),
                    set(ref(db, `userSkins/${uid}`), {
                      owned: [],
                      active: null,
                      coins: 350,
                      purchases: {},
                    }),
                  ]);
                  await updateDailyLogin(uid);
                } catch (_) {
                } finally {
                  setLoading(false);
                }
              }
            },
            () => setLoading(false)
          );
          profileUnsubRef.current = unsubscribeProfile;

          const accountRef = ref(db, `accounts/${uid}`);
          const unsubAccount = onValue(accountRef, (snap) => {
            const data = snap.val();
            if (data?.forceLogout === true) {
              signOut(auth).catch(() => {});
              remove(ref(db, `accounts/${uid}/forceLogout`)).catch(() => {});
            }
            if (data?.banned === true) {
              setBanInfo({
                isBanned: true,
                reason: data.banReason || 'Banned by admin',
                bannedAt: data.bannedAt || Date.now(),
              });
            } else {
              setBanInfo({ isBanned: false, reason: '', bannedAt: null });
            }
          });
          accountCleanupRef.current = unsubAccount;
        } catch (_) {
          setLoading(false);
        }
      } else {
        cleanupAll();
        setUser(null);
        setBanInfo({ isBanned: false, reason: '', bannedAt: null });
        setLoading(false);
      }
    });

    return () => {
      unsub();
      cleanupAll();
    };
  }, []);

  const handleLogout = async () => {
    loggingOutRef.current = true;
    const uid = user?.uid || auth.currentUser?.uid;
    const deviceId = localStorage.getItem('echo_device_id');
    cleanupAll();
    try {
      if (uid && deviceId) {
        onDisconnect(ref(db, `sessions/${uid}/${deviceId}`)).cancel().catch(() => {});
      }
    } catch (_) {}
    try {
      await signOut(auth);
    } catch (_) {}
    if (uid && deviceId) remove(ref(db, `sessions/${uid}/${deviceId}`)).catch(() => {});
    loggingOutRef.current = false;
  };

  const value = { user, loading, logout: handleLogout, banInfo };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
