import React, { useRef, useEffect } from 'react';
import StoryCircle from './StoryCircle';
import './StoriesBar.css';

const StoriesBar = ({ users, ownStory, onAddStory, onViewStory }) => {
  const scrollRef = useRef(null);

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
          onView={() => onViewStory(ownStory)}
        />
        
        {users?.map((user) => (
          <StoryCircle
            key={user.id}
            isOwn={false}
            hasStory={user.hasStory}
            avatar={user.avatar}
            name={user.name}
            onView={() => onViewStory(user.story)}
          />
        ))}
      </div>
    </div>
  );
};

export default StoriesBar;
