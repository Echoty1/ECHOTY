// src/components/pages/Chat/DeleteConfirmationModal.jsx
import React from 'react';
import ReactDOM from 'react-dom';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-icon">
          <i className="fas fa-trash-alt" />
        </div>
        <h3>Delete Message</h3>
        <p>Are you sure you want to permanently delete this message?</p>
        <div className="delete-modal-actions">
          <button className="delete-modal-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="delete-modal-btn confirm" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteConfirmationModal;