// src/hooks/useUserPrivacy.js
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';

const PUBLIC_DEFAULTS = {
  lastSeen: 'everyone',      // 'everyone' | 'contacts' | 'nobody'
  profilePhoto: 'everyone',  // 'everyone' | 'contacts' | 'nobody'
  readReceipts: true,
  whoCanAddToGroups: 'everyone',
};

/**
 * Read ANOTHER user's PUBLIC privacy flags from userPrivacy/{uid}.
 * Safe for any signed-in user to read.
 * Always returns a fully-populated object (defaults for missing keys).
 */
export const useUserPrivacy = (uid) => {
  const [privacy, setPrivacy] = useState(PUBLIC_DEFAULTS);

  useEffect(() => {
    if (!uid) {
      setPrivacy(PUBLIC_DEFAULTS);
      return undefined;
    }

    const r = ref(db, `userPrivacy/${uid}`);
    return onValue(r, (snap) => {
      setPrivacy({ ...PUBLIC_DEFAULTS, ...(snap.val() || {}) });
    });
  }, [uid]);

  return privacy;
};

/**
 * Convenience helpers — read these directly in components.
 * They handle the "contacts" case by requiring a contacts list to be passed in.
 * (Right now 'contacts' behaves like 'everyone' since we don't have a contacts
 *  graph yet — hook this up to your follower list later.)
 */
export const canSeeLastSeen = (privacy, viewerUid, ownerUid, isContact = false) => {
  if (viewerUid && viewerUid === ownerUid) return true; // always see your own
  const v = privacy?.lastSeen || 'everyone';
  if (v === 'everyone') return true;
  if (v === 'contacts') return isContact;
  return false; // 'nobody'
};

export const canSeeProfilePhoto = (privacy, viewerUid, ownerUid, isContact = false) => {
  if (viewerUid && viewerUid === ownerUid) return true;
  const v = privacy?.profilePhoto || 'everyone';
  if (v === 'everyone') return true;
  if (v === 'contacts') return isContact;
  return false;
};

export const shouldSendReadReceipts = (privacy) => {
  return privacy?.readReceipts !== false;
};

export { PUBLIC_DEFAULTS as USER_PRIVACY_DEFAULTS };