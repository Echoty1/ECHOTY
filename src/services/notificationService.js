// src/services/notificationService.js
// Handles message sounds and cross-page notification events.
// Uses Web Audio API to synthesize the sounds — no asset files needed.

let audioCtx = null;

const getCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    } catch (err) {
      console.warn('AudioContext init failed', err);
      return null;
    }
  }
  return audioCtx;
};

// Ensure the context is resumed after user interaction (browsers block autoplay)
export const unlockAudio = () => {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
};

const playTone = ({ freq, duration, type = 'sine', gain = 0.15, when = 0 }) => {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  const startTime = ctx.currentTime + when;
  const endTime = startTime + duration;

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(endTime + 0.02);
};

/**
 * Snapchat-style "sent" sound — a short, upward double blip.
 */
export const playSentSound = () => {
  try {
    // Two-tone ascending
    playTone({ freq: 880, duration: 0.08, type: 'sine', gain: 0.14, when: 0 });
    playTone({ freq: 1320, duration: 0.10, type: 'sine', gain: 0.12, when: 0.07 });
  } catch (err) {
    console.warn('playSentSound failed', err);
  }
};

/**
 * Snapchat-style "received" sound — a warmer, descending double pop.
 */
export const playReceivedSound = () => {
  try {
    // Two-tone descending with a little triangle shimmer
    playTone({ freq: 1320, duration: 0.09, type: 'sine', gain: 0.15, when: 0 });
    playTone({ freq: 990, duration: 0.11, type: 'triangle', gain: 0.13, when: 0.08 });
    playTone({ freq: 660, duration: 0.13, type: 'sine', gain: 0.10, when: 0.16 });
  } catch (err) {
    console.warn('playReceivedSound failed', err);
  }
};

// ─── Preferences (localStorage backed) ─────────────────────
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