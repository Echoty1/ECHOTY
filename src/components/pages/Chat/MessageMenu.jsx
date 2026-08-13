// src/components/pages/Chat/MessageMenu.jsx
import React, { useState } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const MessageMenu = ({ children, isOwn, onDelete }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOwn) {
    return <>{children}</>;
  }

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowConfirm(false);
    onDelete();
  };

  return (
    <div className="message-wrapper">
      {children}
      <button className="message-delete-btn" onClick={handleDeleteClick}>
        <i className="fas fa-trash-alt" />
      </button>
      <DeleteConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default MessageMenu;