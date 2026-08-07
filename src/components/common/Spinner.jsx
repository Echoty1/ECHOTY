// src/components/common/Spinner.jsx
import React from 'react';
import './Spinner.css';

const Spinner = ({ size = 40 }) => {
  return (
    <div className="spinner-wrapper">
      <div className="spinner" style={{ width: size, height: size }} />
    </div>
  );
};

export default Spinner;