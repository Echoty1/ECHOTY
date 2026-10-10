// src/utils/groupRoles.js

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

/**
 * Returns true if userRole can perform an action on targetRole.
 * Higher hierarchy = more powers.
 */
export const canActOn = (userRole, targetRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return userLevel > targetLevel;
};

export const isAtLeast = (userRole, minRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const minLevel = ROLE_HIERARCHY[minRole] || 0;
  return userLevel >= minLevel;
};

export const can = {
  editInfo: (role) => isAtLeast(role, ROLES.ADMIN),
  addMembers: (role) => isAtLeast(role, ROLES.ADMIN),
  removeMembers: (role) => isAtLeast(role, ROLES.ADMIN),
  promote: (role) => isAtLeast(role, ROLES.ADMIN),
  deleteGroup: (role) => role === ROLES.OWNER,
  deleteMessages: (role) => isAtLeast(role, ROLES.MODERATOR),
  mute: (role) => isAtLeast(role, ROLES.MODERATOR),
  pinMessages: (role) => isAtLeast(role, ROLES.ADMIN),
  createInviteLink: (role) => isAtLeast(role, ROLES.ADMIN),
  announce: (role) => isAtLeast(role, ROLES.ADMIN),
};
