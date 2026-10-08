// src/hooks/useGroups.js
import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToGroup,
  subscribeToMyGroups,
  createGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  updateGroupInfo,
  setMemberRole,
  deleteGroup,
  getGroup,
} from '../services/groupService';

/**
 * Live group metadata.
 * Returns { group, loading }.
 */
export const useGroup = (groupId) => {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeToGroup(groupId, (data) => {
      setGroup(data);
      setLoading(false);
    });
    return () => unsub();
  }, [groupId]);

  return { group, loading };
};

/**
 * Live list of the current user's groups.
 * Returns { groups, loading }.
 */
export const useMyGroups = (uid) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }
    const unsub = subscribeToMyGroups(uid, (list) => {
      setGroups(list);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { groups, loading };
};

/**
 * Actions hook for groups.
 * Usage: const { create, addMembers, remove, leave, update, promote, destroy, loading, error } = useGroupActions(uid);
 */
export const useGroupActions = (uid) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    const res = await fn();
    setLoading(false);
    if (!res.ok) setError(res.error);
    return res;
  }, []);

  const create = useCallback(
    (name, emoji, memberUids) => wrap(() => createGroup(uid, name, emoji, memberUids)),
    [uid, wrap]
  );

  const addMembers = useCallback(
    (groupId, uids) => wrap(() => addGroupMembers(groupId, uid, uids)),
    [uid, wrap]
  );

  const removeMember = useCallback(
    (groupId, targetUid) => wrap(() => removeGroupMember(groupId, uid, targetUid)),
    [uid, wrap]
  );

  const leave = useCallback(
    (groupId) => wrap(() => leaveGroup(groupId, uid)),
    [uid, wrap]
  );

  const update = useCallback(
    (groupId, patch) => wrap(() => updateGroupInfo(groupId, uid, patch)),
    [uid, wrap]
  );

  const promote = useCallback(
    (groupId, targetUid, role) => wrap(() => setMemberRole(groupId, uid, targetUid, role)),
    [uid, wrap]
  );

  const destroy = useCallback(
    (groupId) => wrap(() => deleteGroup(groupId, uid)),
    [uid, wrap]
  );

  const fetch = useCallback((groupId) => getGroup(groupId), []);

  return {
    create,
    addMembers,
    removeMember,
    leave,
    update,
    promote,
    destroy,
    fetch,
    loading,
    error,
  };
};
