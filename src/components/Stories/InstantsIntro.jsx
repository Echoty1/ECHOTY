import React from 'react';
import './StoriesBar.css';

const InstantsIntro = ({ onStart }) => {
  return (
    <div className="instants-intro-overlay">
      <div className="instants-intro-content">
        
        {/* Advanced Stacked Cards Graphic */}
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

        {/* Branded Title */}
        <h1 className="instants-intro-title">
          Introducing <span>Echus</span>
        </h1>

        {/* Feature List */}
        <div className="instants-feature-list">
          <div className="instants-feature">
            <div className="feature-icon-wrapper">
              <i className="fas fa-camera" />
            </div>
            <div>
              <h4>Share in the moment</h4>
              <p>Get straight to the camera to share with friends, fast.</p>
            </div>
          </div>
          
          <div className="instants-feature">
            <div className="feature-icon-wrapper">
              <i className="far fa-clock" />
            </div>
            <div>
              <h4>Photos disappear</h4>
              <p>Echus can't be viewed again once they're gone.</p>
            </div>
          </div>
          
          <div className="instants-feature">
            <div className="feature-icon-wrapper">
              <i className="fas fa-link" />
            </div>
            <div>
              <h4>Use either app</h4>
              <p>Share and view echus from here or from ECHO.</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="instants-disclaimer">
          Echus follow our Privacy Policy, including for personalized ads. Your echus must comply with our Community Guidelines.
        </p>

        {/* CTA Button */}
        <button className="instants-try-btn" onClick={onStart}>
          Try it
        </button>
      </div>
    </div>
  );
};

export default InstantsIntro;
