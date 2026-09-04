export const EMAIL_GATE_KEY = 'echo_awaiting_email_verify';

export function armEmailGate() {
  try { sessionStorage.setItem(EMAIL_GATE_KEY, '1'); } catch (_) {}
}

export function clearEmailGate() {
  try { sessionStorage.removeItem(EMAIL_GATE_KEY); } catch (_) {}
}

export function isUnverifiedPasswordUser(firebaseUser, demoUid) {
  if (!firebaseUser) return false;
  if (firebaseUser.uid === demoUid) return false;
  if (firebaseUser.emailVerified) return false;
  const providers = firebaseUser.providerData || [];
  if (providers.some((p) => p.providerId && p.providerId !== 'password')) return false;
  return true;
}
