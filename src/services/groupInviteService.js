// src/services/groupInviteService.js
import {
  ref, set, get, remove, serverTimestamp, runTransaction,
} from 'firebase/database';
import { db } from './firebase';

const INVITE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 10;
const DEFAULT_EXPIRY_DAYS = 7;
const DEFAULT_MAX_USES = 100;

/**
 * Generates a random invite code like "ab3k9x7p2m".
 */
export const generateInviteCode = () => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
};

/**
 * Creates a new invite link for a group.
 * Only admins can create invites.
 *
 * Returns { ok, code, error }.
 */
export const createInviteLink = async (groupId, actorUid, options = {}) => {
  if (!groupId || !actorUid) return { ok: false, error: 'Missing params' };

  const expiresInDays = options.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
  const maxUses = options.maxUses ?? DEFAULT_MAX_USES;
  const requiresApproval = !!options.requiresApproval;

  try {
    // Verify actor is admin
    const memberSnap = await get(ref(db, `groups/${groupId}/members/${actorUid}`));
    if (!memberSnap.exists()) return { ok: false, error: 'Not a member' };

    const role = memberSnap.val().role;
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Only admins can create invite links' };
    }

    // Generate a unique code
    let code = null;
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateInviteCode();
      const existingSnap = await get(ref(db, `invites/${candidate}`));
      if (!existingSnap.exists()) {
        code = candidate;
        break;
      }
      attempts++;
    }

    if (!code) return { ok: false, error: 'Could not generate code. Try again.' };

    const expiresAt = expiresInDays > 0
      ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000
      : null;

    const inviteData = {
      code,
      groupId,
      createdBy: actorUid,
      createdAt: Date.now(),
      expiresAt,
      maxUses,
      uses: 0,
      requiresApproval,
      revoked: false,
    };

    await set(ref(db, `invites/${code}`), inviteData);

    // Also add to group's invite list for management
    await set(ref(db, `groups/${groupId}/inviteCodes/${code}`), {
      createdBy: actorUid,
      createdAt: Date.now(),
      expiresAt,
      maxUses,
      uses: 0,
    });

    return { ok: true, code, invite: inviteData };
  } catch (err) {
    console.error('createInviteLink failed:', err);
    return { ok: false, error: err.message };
  }
};

/**
 * Fetches invite metadata by code.
 */
export const getInviteByCode = async (code) => {
  if (!code) return null;
  try {
    const snap = await get(ref(db, `invites/${code}`));
    if (!snap.exists()) return null;
    return { code, ...snap.val() };
  } catch (err) {
    console.error('getInviteByCode failed:', err);
    return null;
  }
};

/**
 * Validates an invite: not expired, not revoked, uses < maxUses.
 */
export const isInviteValid = (invite) => {
  if (!invite) return { valid: false, reason: 'not_found' };
  if (invite.revoked) return { valid: false, reason: 'revoked' };
  if (invite.expiresAt && Date.now() > invite.expiresAt) {
    return { valid: false, reason: 'expired' };
  }
  if (invite.uses >= invite.maxUses) {
    return { valid: false, reason: 'used_up' };
  }
  return { valid: true };
};

/**
 * Redeems an invite for a user. Adds them to the group.
 * Idempotent — if already a member, returns success without incrementing uses.
 */
export const redeemInvite = async (code, uid) => {
  if (!code || !uid) return { ok: false, error: 'Missing params' };

  try {
    const invite = await getInviteByCode(code);
    if (!invite) return { ok: false, error: 'Invite not found' };

    const validation = isInviteValid(invite);
    if (!validation.valid) {
      const msg = {
        not_found: 'Invite not found',
        revoked: 'This invite has been revoked',
        expired: 'This invite has expired',
        used_up: 'This invite has reached its maximum uses',
      }[validation.reason];
      return { ok: false, error: msg };
    }

    // Check if user is already a member
    const memberSnap = await get(ref(db, `groups/${invite.groupId}/members/${uid}`));
    if (memberSnap.exists()) {
      // Already a member — don't increment uses
      return { ok: true, groupId: invite.groupId, alreadyMember: true };
    }

    // If requires approval, add to pendingRequests
    if (invite.requiresApproval) {
      await set(ref(db, `groups/${invite.groupId}/pendingRequests/${uid}`), {
        requestedAt: Date.now(),
        inviteCode: code,
      });
      return { ok: true, groupId: invite.groupId, pendingApproval: true };
    }

    // Add member + increment usage atomically
    const groupSnap = await get(ref(db, `groups/${invite.groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group no longer exists' };

    const groupData = groupSnap.val();
    const memberCount = (groupData.memberCount || 0) + 1;

    await set(ref(db, `groups/${invite.groupId}/members/${uid}`), {
      role: 'member',
      joinedAt: Date.now(),
      joinedVia: code,
    });

    await set(ref(db, `groups/${invite.groupId}/memberCount`), memberCount);

    // Add to user's groups
    await set(ref(db, `userGroups/${uid}/${invite.groupId}`), {
      groupId: invite.groupId,
      joinedAt: Date.now(),
      role: 'member',
    });

    // Increment uses
    await runTransaction(ref(db, `invites/${code}/uses`), (n) => (n || 0) + 1);

    return { ok: true, groupId: invite.groupId };
  } catch (err) {
    console.error('redeemInvite failed:', err);
    return { ok: false, error: err.message };
  }
};

/**
 * Revokes an invite. Only admins can revoke.
 */
export const revokeInvite = async (code, actorUid) => {
  if (!code || !actorUid) return { ok: false, error: 'Missing params' };
  try {
    const invite = await getInviteByCode(code);
    if (!invite) return { ok: false, error: 'Invite not found' };

    const memberSnap = await get(ref(db, `groups/${invite.groupId}/members/${actorUid}`));
    if (!memberSnap.exists()) return { ok: false, error: 'Not a member' };
    const role = memberSnap.val().role;
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Only admins can revoke invites' };
    }

    await remove(ref(db, `groups/${invite.groupId}/inviteCodes/${code}`));
    await set(ref(db, `invites/${code}/revoked`), true);
    await set(ref(db, `invites/${code}/revokedBy`), actorUid);
    await set(ref(db, `invites/${code}/revokedAt`), Date.now());

    return { ok: true };
  } catch (err) {
    console.error('revokeInvite failed:', err);
    return { ok: false, error: err.message };
  }
};

/**
 * Lists active invites for a group. Admins only.
 */
export const listGroupInvites = async (groupId) => {
  if (!groupId) return [];
  try {
    const snap = await get(ref(db, `groups/${groupId}/inviteCodes`));
    if (!snap.exists()) return [];
    const invites = Object.entries(snap.val()).map(([code, data]) => ({
      code,
      ...data,
    }));
    return invites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error('listGroupInvites failed:', err);
    return [];
  }
};

/**
 * Approves a pending join request. Admins only.
 */
export const approvePendingRequest = async (groupId, actorUid, requesterUid) => {
  if (!groupId || !actorUid || !requesterUid) return { ok: false, error: 'Missing params' };
  try {
    const actorSnap = await get(ref(db, `groups/${groupId}/members/${actorUid}`));
    if (!actorSnap.exists()) return { ok: false, error: 'Not a member' };
    const role = actorSnap.val().role;
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Only admins can approve' };
    }

    // Move from pending to members
    await set(ref(db, `groups/${groupId}/members/${requesterUid}`), {
      role: 'member',
      joinedAt: Date.now(),
    });

    const groupSnap = await get(ref(db, `groups/${groupId}/memberCount`));
    const currentCount = groupSnap.exists() ? groupSnap.val() : 0;
    await set(ref(db, `groups/${groupId}/memberCount`), currentCount + 1);

    await set(ref(db, `userGroups/${requesterUid}/${groupId}`), {
      groupId,
      joinedAt: Date.now(),
      role: 'member',
    });

    await remove(ref(db, `groups/${groupId}/pendingRequests/${requesterUid}`));

    return { ok: true };
  } catch (err) {
    console.error('approvePendingRequest failed:', err);
    return { ok: false, error: err.message };
  }
};

/**
 * Rejects a pending join request. Admins only.
 */
export const rejectPendingRequest = async (groupId, actorUid, requesterUid) => {
  if (!groupId || !actorUid || !requesterUid) return { ok: false, error: 'Missing params' };
  try {
    const actorSnap = await get(ref(db, `groups/${groupId}/members/${actorUid}`));
    if (!actorSnap.exists()) return { ok: false, error: 'Not a member' };
    const role = actorSnap.val().role;
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Only admins can reject' };
    }

    await remove(ref(db, `groups/${groupId}/pendingRequests/${requesterUid}`));
    return { ok: true };
  } catch (err) {
    console.error('rejectPendingRequest failed:', err);
    return { ok: false, error: err.message };
  }
};
