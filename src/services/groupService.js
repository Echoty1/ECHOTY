// src/services/groupService.js
import {
  ref, get, set, update, remove, push, onValue, query,
  orderByChild, equalTo, serverTimestamp, runTransaction,
} from 'firebase/database';
import { db } from './firebase';
import {
  generateGroupId,
  groupIdToChatId,
  validateGroupName,
  MAX_GROUP_MEMBERS,
} from '../utils/groupId';

// ─── Create a new group ──────────────────────────────────────
/**
 * Creates a group with the given name and initial members.
 * The creator is automatically added as admin.
 *
 * @param {string} creatorUid   - UID of the creator
 * @param {string} name         - Group name (1-40 chars)
 * @param {string} emoji        - Group emoji (optional, default '👥')
 * @param {string[]} memberUids - Array of other member UIDs (must include at least 1 other)
 * @returns {Promise<{ ok: boolean, groupId?: string, error?: string }>}
 */
export const createGroup = async (creatorUid, name, emoji, memberUids) => {
  if (!creatorUid) return { ok: false, error: 'Not logged in' };

  const validation = validateGroupName(name);
  if (!validation.valid) return { ok: false, error: validation.error };

  const others = Array.from(new Set((memberUids || []).filter((uid) => uid && uid !== creatorUid)));
  if (others.length < 1) {
    return { ok: false, error: 'Add at least 1 other member' };
  }

  const allMembers = [creatorUid, ...others];
  if (allMembers.length > MAX_GROUP_MEMBERS) {
    return { ok: false, error: `Groups can have at most ${MAX_GROUP_MEMBERS} members` };
  }

  const groupId = generateGroupId();
  const now = Date.now();

  try {
    // Fetch creator profile for default name/avatar
    const creatorSnap = await get(ref(db, `profiles/${creatorUid}`));
    const creatorData = creatorSnap.exists() ? creatorSnap.val() : {};

    // Build members map
    const membersMap = {};
    allMembers.forEach((uid) => {
      membersMap[uid] = {
        role: uid === creatorUid ? 'admin' : 'member',
        joinedAt: now,
      };
    });

    // Group metadata
    const groupData = {
      name: validation.normalized,
      emoji: emoji || '👥',
      createdBy: creatorUid,
      createdAt: now,
      members: membersMap,
      memberCount: allMembers.length,
      lastMessage: '',
      lastSenderId: '',
      lastUpdated: now,
    };

    // Write group
    await set(ref(db, `groups/${groupId}`), groupData);

    // Initialize empty messages node (so listeners attach cleanly)
    await set(ref(db, `groups/${groupId}/messages`), null);

    // Add to each member's groups list
    const updates = {};
    allMembers.forEach((uid) => {
      updates[`userGroups/${uid}/${groupId}`] = {
        groupId,
        joinedAt: now,
        role: uid === creatorUid ? 'admin' : 'member',
      };
    });
    await update(ref(db), updates);

    // Write a system message
    const sysMsgRef = push(ref(db, `groups/${groupId}/messages`));
    await set(sysMsgRef, {
      senderId: 'system',
      type: 'system',
      text: `${creatorData.name || 'Someone'} created this group`,
      timestamp: now,
      clientTs: now,
    });

    // Also create the chat node used by ChatView (uses same shape as 1-1 chats)
    const chatId = groupIdToChatId(groupId);
    await set(ref(db, `chats/${chatId}`), {
      isGroup: true,
      groupId,
      createdAt: now,
    });

    return { ok: true, groupId, chatId };
  } catch (err) {
    console.error('createGroup failed:', err);
    return { ok: false, error: err.message || 'Failed to create group' };
  }
};

// ─── Fetch group metadata ────────────────────────────────────
/**
 * Fetches group data once (no live updates).
 */
export const getGroup = async (groupId) => {
  if (!groupId) return null;
  try {
    const snap = await get(ref(db, `groups/${groupId}`));
    return snap.exists() ? { id: groupId, ...snap.val() } : null;
  } catch (err) {
    console.error('getGroup failed:', err);
    return null;
  }
};

// ─── Add members ────────────────────────────────────────────
/**
 * Adds new members to a group. Only admins can add.
 */
export const addGroupMembers = async (groupId, actorUid, uidsToAdd) => {
  if (!groupId || !actorUid) return { ok: false, error: 'Missing params' };

  const toAdd = Array.from(new Set((uidsToAdd || []).filter(Boolean)));
  if (toAdd.length === 0) return { ok: false, error: 'No members to add' };

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    const members = group.members || {};

    if (!members[actorUid]) {
      return { ok: false, error: 'You are not a member of this group' };
    }
    if (members[actorUid].role !== 'admin') {
      return { ok: false, error: 'Only admins can add members' };
    }

    const existing = new Set(Object.keys(members));
    const fresh = toAdd.filter((uid) => !existing.has(uid));

    if (existing.size + fresh.length > MAX_GROUP_MEMBERS) {
      return { ok: false, error: `Group limit is ${MAX_GROUP_MEMBERS} members` };
    }

    if (fresh.length === 0) return { ok: true, added: 0 };

    const now = Date.now();
    const updates = {};

    // Update group members
    fresh.forEach((uid) => {
      updates[`groups/${groupId}/members/${uid}`] = {
        role: 'member',
        joinedAt: now,
        addedBy: actorUid,
      };
    });

    updates[`groups/${groupId}/memberCount`] = existing.size + fresh.length;
    updates[`groups/${groupId}/lastUpdated`] = now;

    // Update each new member's userGroups list
    fresh.forEach((uid) => {
      updates[`userGroups/${uid}/${groupId}`] = {
        groupId,
        joinedAt: now,
        role: 'member',
      };
    });

    await update(ref(db), updates);

    // System message
    const actorSnap = await get(ref(db, `profiles/${actorUid}`));
    const actorName = actorSnap.exists() ? (actorSnap.val().name || 'Someone') : 'Someone';
    const sysRef = push(ref(db, `groups/${groupId}/messages`));
    await set(sysRef, {
      senderId: 'system',
      type: 'system',
      text: `${actorName} added ${fresh.length} member${fresh.length > 1 ? 's' : ''}`,
      timestamp: now,
      clientTs: now,
    });

    return { ok: true, added: fresh.length };
  } catch (err) {
    console.error('addGroupMembers failed:', err);
    return { ok: false, error: err.message || 'Failed to add members' };
  }
};

// ─── Remove a member ────────────────────────────────────────
/**
 * Removes a member from the group. Admins can remove others.
 * Members can remove themselves (leave group).
 */
export const removeGroupMember = async (groupId, actorUid, targetUid) => {
  if (!groupId || !actorUid || !targetUid) return { ok: false, error: 'Missing params' };

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    const members = group.members || {};

    if (!members[actorUid]) return { ok: false, error: 'You are not a member' };
    if (!members[targetUid]) return { ok: false, error: 'User is not in this group' };

    const isSelf = actorUid === targetUid;
    const isAdmin = members[actorUid].role === 'admin';

    if (!isSelf && !isAdmin) {
      return { ok: false, error: 'Only admins can remove members' };
    }

    const now = Date.now();
    const updates = {};

    updates[`groups/${groupId}/members/${targetUid}`] = null;
    updates[`groups/${groupId}/memberCount`] = Math.max(0, (group.memberCount || 1) - 1);
    updates[`groups/${groupId}/lastUpdated`] = now;

    // Remove from their userGroups list
    updates[`userGroups/${targetUid}/${groupId}`] = null;

    await update(ref(db), updates);

    // System message
    const actorSnap = await get(ref(db, `profiles/${actorUid}`));
    const targetSnap = await get(ref(db, `profiles/${targetUid}`));
    const actorName = actorSnap.exists() ? (actorSnap.val().name || 'Someone') : 'Someone';
    const targetName = targetSnap.exists() ? (targetSnap.val().name || 'Someone') : 'Someone';

    const sysRef = push(ref(db, `groups/${groupId}/messages`));
    await set(sysRef, {
      senderId: 'system',
      type: 'system',
      text: isSelf ? `${actorName} left the group` : `${actorName} removed ${targetName}`,
      timestamp: now,
      clientTs: now,
    });

    return { ok: true };
  } catch (err) {
    console.error('removeGroupMember failed:', err);
    return { ok: false, error: err.message || 'Failed to remove member' };
  }
};

// ─── Leave group (convenience) ──────────────────────────────
export const leaveGroup = (groupId, uid) => removeGroupMember(groupId, uid, uid);

// ─── Update group name/emoji ────────────────────────────────
export const updateGroupInfo = async (groupId, actorUid, patch) => {
  if (!groupId || !actorUid) return { ok: false, error: 'Missing params' };

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    if (group.members?.[actorUid]?.role !== 'admin') {
      return { ok: false, error: 'Only admins can change group info' };
    }

    const updates = {};
    if (patch.name !== undefined) {
      const v = validateGroupName(patch.name);
      if (!v.valid) return { ok: false, error: v.error };
      updates.name = v.normalized;
    }
    if (patch.emoji !== undefined) {
      updates.emoji = patch.emoji;
    }
    updates.lastUpdated = Date.now();

    await update(ref(db, `groups/${groupId}`), updates);
    return { ok: true };
  } catch (err) {
    console.error('updateGroupInfo failed:', err);
    return { ok: false, error: err.message || 'Failed to update group' };
  }
};

// ─── Promote / demote admin ─────────────────────────────────
export const setMemberRole = async (groupId, actorUid, targetUid, role) => {
  if (!groupId || !actorUid || !targetUid) return { ok: false, error: 'Missing params' };
  if (role !== 'admin' && role !== 'member') return { ok: false, error: 'Invalid role' };

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    if (group.members?.[actorUid]?.role !== 'admin') {
      return { ok: false, error: 'Only admins can change roles' };
    }
    if (!group.members?.[targetUid]) {
      return { ok: false, error: 'User is not in this group' };
    }

    await update(ref(db, `groups/${groupId}/members/${targetUid}`), { role });
    await update(ref(db, `userGroups/${targetUid}/${groupId}`), { role });

    return { ok: true };
  } catch (err) {
    console.error('setMemberRole failed:', err);
    return { ok: false, error: err.message || 'Failed to change role' };
  }
};

// ─── Delete group (admin only) ──────────────────────────────
export const deleteGroup = async (groupId, actorUid) => {
  if (!groupId || !actorUid) return { ok: false, error: 'Missing params' };

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    if (group.createdBy !== actorUid) {
      return { ok: false, error: 'Only the group creator can delete it' };
    }

    const memberUids = Object.keys(group.members || {});
    const chatId = groupIdToChatId(groupId);

    const updates = {};
    updates[`groups/${groupId}`] = null;
    updates[`chats/${chatId}`] = null;
    memberUids.forEach((uid) => {
      updates[`userGroups/${uid}/${groupId}`] = null;
    });

    await update(ref(db), updates);
    return { ok: true };
  } catch (err) {
    console.error('deleteGroup failed:', err);
    return { ok: false, error: err.message || 'Failed to delete group' };
  }
};

// ─── Live subscriptions ─────────────────────────────────────
/**
 * Subscribes to a group's metadata. Returns unsubscribe fn.
 */
export const subscribeToGroup = (groupId, callback) => {
  if (!groupId) return () => {};
  const groupRef = ref(db, `groups/${groupId}`);
  return onValue(groupRef, (snap) => {
    callback(snap.exists() ? { id: groupId, ...snap.val() } : null);
  });
};

/**
 * Subscribes to a user's group list. Returns unsubscribe fn.
 */
export const subscribeToMyGroups = (uid, callback) => {
  if (!uid) return () => {};
  const listRef = ref(db, `userGroups/${uid}`);
  return onValue(listRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const raw = snap.val();
    const list = Object.entries(raw).map(([groupId, data]) => ({
      groupId,
      ...data,
    }));
    callback(list);
  });
};

/**
 * Fetch all groups a user is a member of (once).
 */
export const getMyGroups = async (uid) => {
  if (!uid) return [];
  try {
    const snap = await get(ref(db, `userGroups/${uid}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([groupId, data]) => ({
      groupId,
      ...data,
    }));
  } catch (err) {
    console.error('getMyGroups failed:', err);
    return [];
  }
};
