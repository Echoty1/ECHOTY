// src/components/Status/StatusBar.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import {
  listenToStatusOwners,
  listenToViewedStatuses,
} from '../../services/statusService';
import StatusCircle from './StatusCircle';
import StatusRecorder from './StatusRecorder';
import StatusViewer from './StatusViewer';
import './StatusBar.css';

const StatusBar = () => {
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  const [owners, setOwners] = useState({});
  const [viewed, setViewed] = useState({});
  const [showRecorder, setShowRecorder] = useState(false);
  const [viewerUserId, setViewerUserId] = useState(null);

  useEffect(() => {
    const unsubOwners = listenToStatusOwners((data) => {
      setOwners(data || {});
      Object.keys(data || {}).forEach((uid) => {
        if (!profiles[uid]) fetchProfile?.(uid);
      });
    });

    let unsubViewed = () => {};
    if (user?.uid) {
      unsubViewed = listenToViewedStatuses(user.uid, setViewed);
    }

    return () => {
      unsubOwners();
      unsubViewed();
    };
  }, [user?.uid, profiles, fetchProfile]);

  const myUid = user?.uid;

  // Filter: only show statuses the current user has NOT viewed yet
  const visibleOwners = Object.entries(owners).filter(([uid, data]) => {
    if (uid === myUid) return false; // owner circle handled separately
    const statusId = data?.lastStatusId;
    if (!statusId) return false;
    const key = `${uid}_${statusId}`;
    return !viewed[key]; // only show if not viewed
  });

  return (
    <>
      <div className="echo-status-bar">
        {/* Your own circle - always shows as empty "+" ready to post */}
        <StatusCircle
          isOwn
          hasStatus={false}
          avatar={profiles[myUid]?.avatar || user?.photoURL}
          name="Your Echo"
          onAdd={() => setShowRecorder(true)}
        />

        {/* Other users - only unviewed ones */}
        {visibleOwners.map(([uid]) => (
          <StatusCircle
            key={uid}
            userId={uid}
            hasStatus={true}
            avatar={profiles[uid]?.avatar}
            name={profiles[uid]?.name || 'User'}
            onView={() => setViewerUserId(uid)}
          />
        ))}
      </div>

      {showRecorder && (
        <StatusRecorder onClose={() => setShowRecorder(false)} />
      )}

      {viewerUserId && (
        <StatusViewer
          userId={viewerUserId}
          onClose={() => setViewerUserId(null)}
        />
      )}
    </>
  );
};

export default StatusBar;
