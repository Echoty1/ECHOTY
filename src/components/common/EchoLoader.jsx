// src/components/common/EchoLoader.jsx
import React from 'react';
import './EchoLoader.css';

const EchoLoader = ({ size = 'md', label = '' }) => {
  return (
    <div className={`echo-loader echo-loader-${size}`} role="status" aria-live="polite">
      <div className="echo-loader-rings" aria-hidden="true">
        <span className="echo-loader-ring r1" />
        <span className="echo-loader-ring r2" />
        <span className="echo-loader-ring r3" />
      </div>
      <div className="echo-loader-mark" aria-hidden="true">
        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" rx="96" fill="transparent" />
          <path d="M 120 120 H 280 V 176 H 180 V 228 H 260 V 284 H 180 V 336 H 280 V 392 H 120 Z" fill="url(#echoLoaderGrad)" />
          <path d="M 320 160 A 140 140 0 0 1 320 352" stroke="url(#echoLoaderGrad)" strokeWidth="36" fill="none" strokeLinecap="round" />
          <defs>
            <linearGradient id="echoLoaderGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6C3CE1" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {label && <div className="echo-loader-label">{label}</div>}
    </div>
  );
};

export default EchoLoader;
