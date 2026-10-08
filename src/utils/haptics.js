// src/utils/haptics.js

const canVibrate =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function';

let hapticsEnabled = true;

export const setHapticsEnabled = (enabled) => {
  hapticsEnabled = !!enabled;
  try { localStorage.setItem('echo_haptics', enabled ? '1' : '0'); } catch (_) {}
};

export const isHapticsEnabled = () => hapticsEnabled;

try {
  const saved = localStorage.getItem('echo_haptics');
  if (saved === '0') hapticsEnabled = false;
} catch (_) {}

const vibrate = (pattern) => {
  if (!canVibrate || !hapticsEnabled) return;
  try { navigator.vibrate(pattern); } catch (_) {}
};

export const hapticLight = () => vibrate(8);
export const hapticMedium = () => vibrate(15);
export const hapticHeavy = () => vibrate([20, 40, 20]);
export const hapticDouble = () => vibrate([10, 60, 10]);
export const hapticSuccess = () => vibrate([10, 40, 10, 40, 20]);
export const hapticError = () => vibrate([40, 60, 40, 60, 40]);
export const hapticLongPress = () => vibrate(30);
export const hapticSend = () => vibrate(6);
export const hapticReceive = () => vibrate([12, 30, 12]);
