// src/utils/groupRoles.js

/**
 * Group role definitions.
 * Order of powers: owner > admin > moderator > member
 */

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
};

export const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

export const ROLE_COLORS = {
  owner: '#FFD700',
  admin: '#A78BFA',
  moderator: '#60A5FA',
  member: '#9CA3AF',
};

export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  moderator: 'Mod',
  member: 'Member',
};

export const ROLE_EMOJI = {
  owner: '👑',
  admin: '🛡',
  moderator: '⚔️',
  member: '',
};

/**
 * Returns true if `userRole` outranks `targetRole`.
 */
export const canActOn = (userRole, targetRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return userLevel > targetLevel;
};

/**
 * Returns true if `userRole` is at least `minRole`.
 */
export const isAtLeast = (userRole, minRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const minLevel = ROLE_HIERARCHY[minRole] || 0;
  return userLevel >= minLevel;
};

/**
 * Convenience permission checks keyed by action.
 */
export const can = {
  editInfo: (role) => isAtLeast(role, ROLES.ADMIN),
  addMembers: (role) => isAtLeast(role, ROLES.ADMIN),
  removeMembers: (role) => isAtLeast(role, ROLES.ADMIN),
  promote: (role) => isAtLeast(role, ROLES.ADMIN),
  deleteGroup: (role) => role === ROLES.OWNER,
  transferOwnership: (role) => role === ROLES.OWNER,
  deleteMessages: (role) => isAtLeast(role, ROLES.MODERATOR),
  mute: (role) => isAtLeast(role, ROLES.MODERATOR),
  pinMessages: (role) => isAtLeast(role, ROLES.ADMIN),
  createInviteLink: (role) => isAtLeast(role, ROLES.ADMIN),
  revokeInviteLink: (role) => isAtLeast(role, ROLES.ADMIN),
  approveRequests: (role) => isAtLeast(role, ROLES.ADMIN),
  announce: (role) => isAtLeast(role, ROLES.ADMIN),
};

/**
 * Returns the next higher role, or null if already owner.
 * Used for "promote" menus.
 */
export const nextRoleUp = (role) => {
  switch (role) {
    case ROLES.MEMBER: return ROLES.MODERATOR;
    case ROLES.MODERATOR: return ROLES.ADMIN;
    case ROLES.ADMIN: return ROLES.OWNER;
    default: return null;
  }
};

/**
 * Returns the next lower role, or null if already member.
 * Used for "demote" menus.
 */
export const nextRoleDown = (role) => {
  switch (role) {
    case ROLES.OWNER: return ROLES.ADMIN;
    case ROLES.ADMIN: return ROLES.MODERATOR;
    case ROLES.MODERATOR: return ROLES.MEMBER;
    default: return null;
  }
};

/**
 * Human-readable list of what a role can do.
 * Used in confirmation modals.
 */
export const ROLE_DESCRIPTIONS = {
  owner: 'Full control: delete the group, transfer ownership, manage everyone.',
  admin: 'Manage members, approve requests, change group info, create invites.',
  moderator: 'Delete messages, mute members, keep the chat clean.',
  member: 'Send messages and participate in the group.',
};
