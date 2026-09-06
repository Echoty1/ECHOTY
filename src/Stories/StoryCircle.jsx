import React from 'react';
import './StoriesBar.css';

const StoryCircle = ({ isOwn, hasStory, avatar, name, onAdd, onView }) => {
  return (
    <div 
      className="story-circle-wrapper" 
      onClick={isOwn && !hasStory ? onAdd : onView}
    >
      <div className={`story-ring ${hasStory ? 'has-story' : ''} ${isOwn ? 'own' : ''}`}>
        <div className="story-avatar-inner">
          {isOwn ? (
            <div className="own-avatar-content">
              <img src={avatar} alt="Your Profile" className="story-img" />
              <div className="add-badge">+</div>
            </div>
          ) : (
            <img src={avatar} alt={name} className="story-img" />
          )}
        </div>
      </div>
      <span className="story-name">{name}</span>
    </div>
  );
};

export default StoryCircle;
