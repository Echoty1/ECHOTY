import React, { useRef, useEffect, useState } from 'react';
import StoryCircle from './StoryCircle';
import { listenToUserStatuses, listenToViewedStatuses } from '../../services/statusService';
import './StoriesBar.css';

const StoriesBar = ({ currentUserId, users, ownStory, onAddStory, onViewStories }) => {
  const scrollRef = useRef(null);
  const [viewedKeys, setViewedKeys] = useState({});
  const [statusesMap, setStatusesMap] = useState({});

  useEffect(() => {
    if (!currentUserId) return;
    const unsubViewed = listenToViewedStatuses(currentUserId, setViewedKeys);
    
    // Fetch stories for all users
    const unsubs = (users || []).map(user => {
      return listenToUserStatuses(user.uid, (statuses) => {
        setStatusesMap(prev => ({ ...prev, [user.uid]: statuses }));
      });
    });

    return () => {
      unsubViewed();
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, [currentUserId, users]);

  // Filter out users who have no unseen stories
  const visibleUsers = (users || []).filter(user => {
    const statuses = statusesMap[user.uid] || [];
    const unseen = statuses.filter(s => !viewedKeys[`${user.uid}_${s.id}`]);
    return unseen.length > 0;
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (event) => {
      if (event.deltaY !== 0) {
        event.preventDefault();
        el.scrollLeft += event.deltaY;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div className="stories-bar-container">
      <div ref={scrollRef} className="stories-bar-scroll">
        <StoryCircle
          isOwn={true}
          hasStory={!!ownStory}
          avatar={ownStory?.avatar || 'https://via.placeholder.com/70'}
          name="Your Story"
          onAdd={onAddStory}
          onView={() => onViewStories([ownStory].filter(Boolean))}
        />
        
        {visibleUsers.map((user) => {
          const statuses = statusesMap[user.uid] || [];
          const unseen = statuses.filter(s => !viewedKeys[`${user.uid}_${s.id}`]);
          
          return (
            <StoryCircle
              key={user.uid}
              isOwn={false}
              hasStory={true}
              avatar={user.avatar}
              name={user.name}
              onView={() => onViewStories(unseen)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default StoriesBar;
