import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

const DEMO_EMAIL = 'demo@echoty.xyz';
const DEMO_PASSWORD = 'demodemo';

function friendlyError(err) {
  const code = String(err?.code || '');
  const map = {
    'auth/network-request-failed':
      'Network failed. Check Wi‑Fi / mobile data, then try again.',
    'auth/too-many-requests': 'Too many tries. Wait a minute, then retry.',
    'auth/user-disabled': 'This account is disabled.',
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Wrong password.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'That email looks invalid.',
    'auth/email-already-in-use': 'Email already registered. Log in instead.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/missing-password': 'Enter a password.',
    'auth/operation-not-allowed': 'This sign-in method is turned off in Firebase.',
  };
  if (map[code]) return map[code];
  return err?.message || 'Something went wrong.';
}

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [lastLog, setLastLog] = useState('');

  const log = (msg) => {
    const line = `${new Date().toLocaleTimeString()}  ${msg}`;
    console.log('[ECHO Login]', msg);
    setLastLog(line);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Fill in email and password.');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    log(isSignup ? `Sign up: ${email.trim()}` : `Login: ${email.trim()}`);

    try {
      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        log(`Created uid=${cred.user.uid}`);
        try {
          await sendEmailVerification(cred.user);
          log('Verification email sent');
        } catch (ve) {
          log(`Verify email failed: ${ve.message}`);
        }
        await signOut(auth);
        setAwaitingVerify(true);
        setLoading(false);
        return;
      }

      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      log(`Signed in uid=${cred.user.uid} verified=${cred.user.emailVerified}`);

      const isDemo =
        email.trim().toLowerCase() === DEMO_EMAIL ||
        cred.user.uid === 'k9Cs6QPfDRNTputzic7V3xRUof63';

      if (!isDemo && !cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user);
        } catch (_) {}
        await signOut(auth);
        setError(
          'Email not verified. We sent another link — open it, then log in.'
        );
        setLoading(false);
        return;
      }

      onLoggedIn?.(cred.user);
    } catch (err) {
      log(`Error: ${err.code || ''} ${err.message}`);
      setError(friendlyError(err));
    }
    setLoading(false);
  };

  const handleDemo = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    log('Demo login…');
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        DEMO_EMAIL,
        DEMO_PASSWORD
      );
      log(`Demo OK uid=${cred.user.uid}`);
      onLoggedIn?.(cred.user);
    } catch (err) {
      log(`Demo failed: ${err.code || ''} ${err.message}`);
      setError('Demo login failed: ' + friendlyError(err));
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Type your email above, then tap Forgot password.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Password reset email sent. Check inbox / spam.');
      log('Password reset sent');
    } catch (err) {
      setError(friendlyError(err));
      log(`Reset failed: ${err.message}`);
    }
    setLoading(false);
  };

  if (awaitingVerify) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.logo}>ECHO</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            We sent a verification link to{' '}
            <Text style={{ fontWeight: '700' }}>{email}</Text>. Open it, then
            come back and log in.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.submitButton]}
            onPress={() => {
              setAwaitingVerify(false);
              setIsSignup(false);
            }}
          >
            <Text style={styles.buttonText}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.logo}>ECHO</Text>
          <Text style={styles.tagline}>Login debug (Expo)</Text>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!info && <Text style={styles.infoText}>{info}</Text>}

          <TouchableOpacity
            style={[styles.button, styles.demoButton]}
            onPress={handleDemo}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Please wait…' : '🚀 Try Demo'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or email</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!isSignup && (
            <TouchableOpacity onPress={handleForgot} disabled={loading}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.submitButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignup ? 'Sign Up' : 'Login'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setIsSignup(!isSignup);
              setError('');
              setInfo('');
            }}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isSignup
                ? 'Already have an account? Login'
                : 'No account? Sign up'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            Google Sign-In needs a native build (Capacitor / dev client). Use
            Demo or email here to test Firebase Auth on phone.
          </Text>

          {!!lastLog && <Text style={styles.log}>{lastLog}</Text>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: '#12121A',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  body: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    color: '#f87171',
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13,
  },
  infoText: {
    color: '#4ade80',
    backgroundColor: 'rgba(34,197,94,0.12)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13,
  },
  input: {
    width: '100%',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  demoButton: {
    backgroundColor: '#10B981',
  },
  submitButton: {
    backgroundColor: '#6C3CE1',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dividerText: {
    color: '#888',
    paddingHorizontal: 12,
    fontSize: 12,
  },
  switchText: {
    color: '#8B5CF6',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  link: {
    color: '#8B5CF6',
    textAlign: 'right',
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    marginTop: 20,
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
    textAlign: 'center',
  },
  log: {
    marginTop: 12,
    fontSize: 10,
    color: '#555',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
