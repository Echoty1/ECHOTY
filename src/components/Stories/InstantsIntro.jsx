import React from 'react';
import './StoriesBar.css';

const InstantsIntro = ({ onStart }) => {
  return (
    <div className="instants-intro-overlay">
      <div className="instants-intro-content">
        
        {/* Stacked Cards */}
        <div className="instants-intro-stack">
          <div className="intro-card-layer layer-1">
            <img src="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800" alt="" />
          </div>
          <div className="intro-card-layer layer-2">
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800" alt="" />
          </div>
          <div className="intro-card-layer layer-3">
            <img src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800" alt="" />
          </div>
        </div>

        <h1 className="instants-intro-title">Introducing Instants</h1>

        <div className="instants-feature-list">
          <div className="instants-feature">
            <i className="fas fa-camera" />
            <div>
              <h4>Share in the moment</h4>
              <p>Get straight to the camera to share with friends, fast.</p>
            </div>
          </div>
          <div className="instants-feature">
            <i className="far fa-clock" />
            <div>
              <h4>Photos disappear</h4>
              <p>Instants can't be viewed again once they're gone.</p>
            </div>
          </div>
          <div className="instants-feature">
            <i className="fas fa-link" />
            <div>
              <h4>Use either app</h4>
              <p>Share and view instants from here or from Instagram.</p>
            </div>
          </div>
        </div>

        <p className="instants-disclaimer">
          Instants follow our Privacy Policy, including for personalized ads. Your instants meet comply with our Community Guidelines.
        </p>

        <button className="instants-try-btn" onClick={onStart}>
          Try it
        </button>
      </div>
    </div>
  );
};

export default InstantsIntro;
