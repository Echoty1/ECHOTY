// src/utils/haptics.js

/**
 * Haptic feedback utility.
 * Uses Web Vibration API (supported on Chrome Android, Safari iOS 17.4+).
 * Silently no-ops on unsupported devices (desktop browsers).
 */

const canVibrate =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function';

// User preference (set in settings)
let hapticsEnabled = true;

export const setHapticsEnabled = (enabled) => {
  hapticsEnabled = !!enabled;
};

export const isHapticsEnabled = () => hapticsEnabled;

const vibrate = (pattern) => {
  if (!canVibrate || !hapticsEnabled) return;
  try {
    navigator.vibrate(pattern);
  } catch (_) {
    // Some browsers throw if the page is hidden
  }
};

/** Very light tap — for regular button presses */
export const hapticLight = () => vibrate(8);

/** Medium tap — for confirmed actions (sent message, saved) */
export const hapticMedium = () => vibrate(15);

/** Heavy tap — for important events (received message, new notification) */
export const hapticHeavy = () => vibrate([20, 40, 20]);

/** Double tap — for long press / destructive actions */
export const hapticDouble = () => vibrate([10, 60, 10]);

/** Success pattern */
export const hapticSuccess = () => vibrate([10, 40, 10, 40, 20]);

/** Error pattern */
export const hapticError = () => vibrate([40, 60, 40, 60, 40]);

/** Long press / hold */
export const hapticLongPress = () => vibrate(30);

/** Message send — subtle */
export const hapticSend = () => vibrate(6);

/** Message receive — a bit stronger */
export const hapticReceive = () => vibrate([12, 30, 12]);
