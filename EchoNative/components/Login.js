// EchoNative/components/Login.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { FontAwesome } from '@expo/vector-icons';

// ─── Constants ──────────────────────────────────────────────────
const DEMO_EMAIL = 'demo@echoty.xyz';
const DEMO_PASSWORD = 'demodemo';

export default function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Configure Google Sign-In ────────────────────────────────
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '506340369217-pqibe643qj110b2irc6m7vfp5fmt16he.apps.googleusercontent.com',
    });
  }, []);

  // ─── Handle Email/Password ──────────────────────────────────
  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await auth().createUserWithEmailAndPassword(email, password);
      } else {
        await auth().signInWithEmailAndPassword(email, password);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // ─── Handle Google Sign-In ───────────────────────────────────
  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const { idToken } = await GoogleSignin.signIn();
      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);
    } catch (err) {
      if (err.code !== 'CANCELLED') {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  // ─── Handle Demo Login ────────────────────────────────────────
  const handleDemo = async () => {
    setError('');
    setLoading(true);
    try {
      await auth().signInWithEmailAndPassword(DEMO_EMAIL, DEMO_PASSWORD);
    } catch (err) {
      setError('Demo login failed: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>ECHO</Text>
          <Text style={styles.tagline}>The future of conversations</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, styles.demoButton]}
          onPress={handleDemo}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🚀 Try Demo</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogle}
          disabled={loading}
        >
          <FontAwesome name="google" size={20} color="#1a1a2e" style={styles.googleIcon} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
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
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isSignup ? 'Sign Up' : 'Login'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsSignup(!isSignup)}
          disabled={loading}
        >
          <Text style={styles.switchText}>
            {isSignup ? 'Already have an account? Login' : "No account? Sign up"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#12121A',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    elevation: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  errorText: {
    color: '#f87171',
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13,
  },
  input: {
    width: '100%',
    padding: 12,
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
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    flexDirection: 'row',
  },
  demoButton: {
    backgroundColor: '#10B981',
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  googleButtonText: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 16,
  },
  googleIcon: {
    marginRight: 12,
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
    marginVertical: 16,
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
});
