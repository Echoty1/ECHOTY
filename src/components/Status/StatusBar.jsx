import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import { listenToStatusOwners } from '../../services/statusService';
import StatusCircle from './StatusCircle';
import StatusRecorder from './StatusRecorder';
import StatusViewer from './StatusViewer';
import './StatusBar.css';

const StatusBar = () => {
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  const [owners, setOwners] = useState({});
  const [showRecorder, setShowRecorder] = useState(false);
  const [viewerUserId, setViewerUserId] = useState(null);

  useEffect(() => {
    const unsub = listenToStatusOwners((data) => {
      setOwners(data || {});
      // fetch profiles for status owners
      Object.keys(data || {}).forEach((uid) => {
        if (!profiles[uid]) fetchProfile?.(uid);
      });
    });
    return unsub;
  }, [profiles, fetchProfile]);

  const myUid = user?.uid;
  const hasMyStatus = !!owners[myUid];

  return (
    <>
      <div className="echo-status-bar">
        {/* Your own status circle */}
        <StatusCircle
          isOwn
          hasStatus={hasMyStatus}
          avatar={profiles[myUid]?.avatar || user?.photoURL}
          name="Your Echo"
          onAdd={() => setShowRecorder(true)}
          onView={() => setViewerUserId(myUid)}
        />

        {/* Other users' statuses */}
        {Object.entries(owners)
          .filter(([uid]) => uid !== myUid)
          .sort((a, b) => (b[1].lastStatusAt || 0) - (a[1].lastStatusAt || 0))
          .map(([uid]) => (
            <StatusCircle
              key={uid}
              userId={uid}
              hasStatus
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
