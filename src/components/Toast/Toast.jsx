// src/components/Toast/Toast.jsx
import React, { useEffect } from 'react';

const Toast = ({ message, type = 'success', duration = 2000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <span>{message}</span>
    </div>
  );
};

export default Toast;