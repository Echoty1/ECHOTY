// src/services/notificationService.js
// Message sounds routed through the MEDIA channel (<audio> elements),
// so they play even when the phone is on silent — same trick
// Snapchat, WhatsApp, Instagram use.

// ─── Audio elements ────────────────────────────────────────────
let sentAudio = null;
let receivedAudio = null;
let soundsUnlocked = false;

const SENT_SRC = '/sounds/sent.mp3';
const RECEIVED_SRC = '/sounds/received.mp3';

const ensureAudioElements = () => {
  if (typeof window === 'undefined') return;
  if (!sentAudio) {
    sentAudio = new Audio(SENT_SRC);
    sentAudio.preload = 'auto';
    sentAudio.volume = 1.0;
    // Critical: this routes through the media channel
    sentAudio.setAttribute('playsinline', 'true');
    sentAudio.setAttribute('webkit-playsinline', 'true');
  }
  if (!receivedAudio) {
    receivedAudio = new Audio(RECEIVED_SRC);
    receivedAudio.preload = 'auto';
    receivedAudio.volume = 1.0;
    receivedAudio.setAttribute('playsinline', 'true');
    receivedAudio.setAttribute('webkit-playsinline', 'true');
  }
};

/**
 * Call this once on the very first user interaction. Mobile browsers
 * require a user-gesture before any audio can play. Playing then
 * immediately pausing "primes" the elements so subsequent plays work
 * without further gestures.
 */
export const unlockAudio = () => {
  if (soundsUnlocked) return;
  ensureAudioElements();
  try {
    // Silent play + immediate pause to satisfy the browser's
    // user-gesture requirement without actually making noise
    [sentAudio, receivedAudio].forEach((el) => {
      if (!el) return;
      el.muted = true;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
        }).catch(() => {
          el.muted = false;
        });
      } else {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
      }
    });
    soundsUnlocked = true;
  } catch (err) {
    console.warn('unlockAudio failed', err);
  }
};

// ─── Sound players ─────────────────────────────────────────────
export const playSentSound = () => {
  try {
    ensureAudioElements();
    if (!sentAudio) return;
    sentAudio.currentTime = 0;
    sentAudio.muted = false;
    sentAudio.play().catch((err) => {
      // If play() rejects, it usually means we haven't unlocked yet.
      // Try unlocking then replaying once.
      unlockAudio();
      setTimeout(() => {
        try {
          sentAudio.currentTime = 0;
          sentAudio.play().catch(() => {});
        } catch (_) {}
      }, 50);
    });
  } catch (err) {
    console.warn('playSentSound failed', err);
  }
};

export const playReceivedSound = () => {
  try {
    ensureAudioElements();
    if (!receivedAudio) return;
    receivedAudio.currentTime = 0;
    receivedAudio.muted = false;
    receivedAudio.play().catch(() => {
      unlockAudio();
      setTimeout(() => {
        try {
          receivedAudio.currentTime = 0;
          receivedAudio.play().catch(() => {});
        } catch (_) {}
      }, 50);
    });
  } catch (err) {
    console.warn('playReceivedSound failed', err);
  }
};

// ─── Preferences (localStorage backed) ─────────────────────────
const PREF_SOUND = 'echo_msg_sound_enabled';
const PREF_NOTIF = 'echo_msg_notif_enabled';

export const getSoundEnabled = () => {
  try {
    const v = localStorage.getItem(PREF_SOUND);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
};

export const setSoundEnabled = (enabled) => {
  try {
    localStorage.setItem(PREF_SOUND, enabled ? '1' : '0');
    window.dispatchEvent(new CustomEvent('echo-msg-prefs-changed'));
  } catch {}
};

export const getNotifEnabled = () => {
  try {
    const v = localStorage.getItem(PREF_NOTIF);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
};

export const setNotifEnabled = (enabled) => {
  try {
    localStorage.setItem(PREF_NOTIF, enabled ? '1' : '0');
    window.dispatchEvent(new CustomEvent('echo-msg-prefs-changed'));
  } catch {}
};

/**
 * Fire an in-app message notification across the app.
 * Any mounted <MessageNotifier /> will pick this up and show a banner.
 */
export const notifyMessage = (payload) => {
  try {
    window.dispatchEvent(new CustomEvent('echo-message-notify', { detail: payload }));
  } catch {}
};
