import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setBooting(false);
    });
    return unsub;
  }, []);

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C3CE1" />
        <Text style={styles.muted}>Connecting to Firebase…</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <Login onLoggedIn={(u) => setUser(u)} />
      </>
    );
  }

  return (
    <View style={styles.center}>
      <StatusBar style="light" />
      <Text style={styles.ok}>Logged in</Text>
      <Text style={styles.meta}>uid: {user.uid}</Text>
      <Text style={styles.meta}>email: {user.email || '—'}</Text>
      <Text style={styles.meta}>verified: {String(user.emailVerified)}</Text>
      <TouchableOpacity
        style={styles.logout}
        onPress={async () => {
          await signOut(auth);
          setUser(null);
        }}
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        If Demo / email works here but fails in the Capacitor APK, the issue is
        WebView / Google redirect / authorized domains — not Firebase credentials.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: {
    color: '#888',
    marginTop: 12,
  },
  ok: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 12,
  },
  meta: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logout: {
    marginTop: 28,
    backgroundColor: '#6C3CE1',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 50,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
  hint: {
    marginTop: 32,
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
});
