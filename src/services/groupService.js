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

// ─── Role helpers ────────────────────────────────────────────
const isOwnerRole = (role) => role === 'owner';
const isAdminRole = (role) => role === 'admin' || role === 'owner';
const hasAdminPowers = (group, uid) => {
  if (!group || !uid) return false;
  const role = group.members?.[uid]?.role;
  if (isAdminRole(role)) return true;
  // Fallback: creator always has admin powers, even if role is missing/stale
  if (group.createdBy === uid) return true;
  return false;
};

// ─── Create a new group ──────────────────────────────────────
/**
 * Creates a group with the given name and initial members.
 * The creator is automatically added as owner.
 *
 * @param {string} creatorUid   - UID of the creator
 * @param {string} name         - Group name (1-40 chars)
 * @param {string} emoji        - Group emoji (optional, default '👥')
 * @param {string[]} memberUids - Array of other member UIDs (must include at least 1 other)
 * @returns {Promise<{ ok: boolean, groupId?: string, chatId?: string, error?: string }>}
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
    const creatorSnap = await get(ref(db, `profiles/${creatorUid}`));
    const creatorData = creatorSnap.exists() ? creatorSnap.val() : {};

    const membersMap = {};
    allMembers.forEach((uid) => {
      membersMap[uid] = {
        role: uid === creatorUid ? 'owner' : 'member',
        joinedAt: now,
      };
    });

    const groupData = {
      name: validation.normalized,
      emoji: emoji || '👥',
      createdBy: creatorUid,
      ownerId: creatorUid,
      createdAt: now,
      members: membersMap,
      memberCount: allMembers.length,
      lastMessage: '',
      lastSenderId: '',
      lastUpdated: now,
    };

    await set(ref(db, `groups/${groupId}`), groupData);
    await set(ref(db, `groups/${groupId}/messages`), null);

    const updates = {};
    allMembers.forEach((uid) => {
      updates[`userGroups/${uid}/${groupId}`] = {
        groupId,
        joinedAt: now,
        role: uid === creatorUid ? 'owner' : 'member',
      };
    });
    await update(ref(db), updates);

    const sysMsgRef = push(ref(db, `groups/${groupId}/messages`));
    await set(sysMsgRef, {
      senderId: 'system',
      type: 'system',
      text: `${creatorData.name || 'Someone'} created this group`,
      timestamp: now,
      clientTs: now,
    });

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
    if (!hasAdminPowers(group, actorUid)) {
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

    fresh.forEach((uid) => {
      updates[`groups/${groupId}/members/${uid}`] = {
        role: 'member',
        joinedAt: now,
        addedBy: actorUid,
      };
    });

    updates[`groups/${groupId}/memberCount`] = existing.size + fresh.length;
    updates[`groups/${groupId}/lastUpdated`] = now;

    fresh.forEach((uid) => {
      updates[`userGroups/${uid}/${groupId}`] = {
        groupId,
        joinedAt: now,
        role: 'member',
      };
    });

    await update(ref(db), updates);

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
    const actorCanRemove = hasAdminPowers(group, actorUid);
    const targetIsOwner = isOwnerRole(members[targetUid]?.role) || group.createdBy === targetUid;

    if (!isSelf && !actorCanRemove) {
      return { ok: false, error: 'Only admins can remove members' };
    }
    if (!isSelf && targetIsOwner) {
      return { ok: false, error: 'Cannot remove the group owner' };
    }

    const now = Date.now();
    const updates = {};

    updates[`groups/${groupId}/members/${targetUid}`] = null;
    updates[`groups/${groupId}/memberCount`] = Math.max(0, (group.memberCount || 1) - 1);
    updates[`groups/${groupId}/lastUpdated`] = now;
    updates[`userGroups/${targetUid}/${groupId}`] = null;

    await update(ref(db), updates);

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

// ─── Update group name / emoji / description / avatar ───────
export const updateGroupInfo = async (groupId, actorUid, patch) => {
  if (!groupId || !actorUid) return { ok: false, error: 'Missing params' };

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    if (!hasAdminPowers(group, actorUid)) {
      return { ok: false, error: 'Only admins can change group info' };
    }

    const updates = {};

    if (patch.name !== undefined) {
      const v = validateGroupName(patch.name);
      if (!v.valid) return { ok: false, error: v.error };
      updates.name = v.normalized;
    }

    if (patch.emoji !== undefined) {
      updates.emoji = String(patch.emoji).slice(0, 8);
    }

    if (patch.description !== undefined) {
      const desc = String(patch.description || '').trim().slice(0, 200);
      updates.description = desc;
    }

    if (patch.avatar !== undefined) {
      if (patch.avatar === null || patch.avatar === '') {
        updates.avatar = null;
      } else {
        updates.avatar = String(patch.avatar).slice(0, 500);
      }
    }

    if (Object.keys(updates).length === 0) {
      return { ok: true };
    }

    updates.lastUpdated = Date.now();
    await update(ref(db, `groups/${groupId}`), updates);
    return { ok: true };
  } catch (err) {
    console.error('updateGroupInfo failed:', err);
    return { ok: false, error: err.message || 'Failed to update group' };
  }
};

// ─── Promote / demote / transfer ownership ──────────────────
export const setMemberRole = async (groupId, actorUid, targetUid, role) => {
  if (!groupId || !actorUid || !targetUid) return { ok: false, error: 'Missing params' };
  if (!['owner', 'admin', 'moderator', 'member'].includes(role)) {
    return { ok: false, error: 'Invalid role' };
  }

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    const actorRole = group.members?.[actorUid]?.role;
    const actorIsCreator = group.createdBy === actorUid;

    if (!isAdminRole(actorRole) && !actorIsCreator) {
      return { ok: false, error: 'Only admins can change roles' };
    }
    if (!group.members?.[targetUid]) {
      return { ok: false, error: 'User is not in this group' };
    }
    if (role === 'owner' && !actorIsCreator) {
      return { ok: false, error: 'Only the owner can transfer ownership' };
    }

    const updates = {
      [`groups/${groupId}/members/${targetUid}/role`]: role,
      [`userGroups/${targetUid}/${groupId}/role`]: role,
    };

    // If transferring ownership, demote the previous owner to admin
    if (role === 'owner') {
      const previousOwner = Object.entries(group.members).find(
        ([uid, m]) => isOwnerRole(m?.role) && uid !== targetUid
      );
      if (previousOwner) {
        updates[`groups/${groupId}/members/${previousOwner[0]}/role`] = 'admin';
        updates[`userGroups/${previousOwner[0]}/${groupId}/role`] = 'admin';
      }
      updates[`groups/${groupId}/ownerId`] = targetUid;
    }

    await update(ref(db), updates);
    return { ok: true };
  } catch (err) {
    console.error('setMemberRole failed:', err);
    return { ok: false, error: err.message || 'Failed to change role' };
  }
};

// ─── Delete group (owner or creator only) ───────────────────
export const deleteGroup = async (groupId, actorUid) => {
  if (!groupId || !actorUid) return { ok: false, error: 'Missing params' };

  try {
    const groupSnap = await get(ref(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return { ok: false, error: 'Group not found' };

    const group = groupSnap.val();
    const isCreator = group.createdBy === actorUid;
    const actorRole = group.members?.[actorUid]?.role;

    if (!isCreator && !isOwnerRole(actorRole)) {
      return { ok: false, error: 'Only the group owner can delete it' };
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
export const subscribeToGroup = (groupId, callback) => {
  if (!groupId) return () => {};
  const groupRef = ref(db, `groups/${groupId}`);
  return onValue(groupRef, (snap) => {
    callback(snap.exists() ? { id: groupId, ...snap.val() } : null);
  });
};

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
