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

      <style>{`
        .delete-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          animation: fadeIn 0.2s ease;
        }
        .delete-modal-content {
          background: var(--bg-secondary);
          border-radius: 20px;
          padding: 32px 28px 24px;
          max-width: 380px;
          width: 90%;
          text-align: center;
          border: 1px solid var(--border-color);
          box-shadow: 0 20px 60px var(--shadow-color);
          animation: modalScale 0.2s ease;
        }
        .delete-modal-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          font-size: 24px;
          color: #ef4444;
        }
        .delete-modal-content h3 {
          color: var(--text-primary);
          font-size: 18px;
          margin: 0 0 8px;
        }
        .delete-modal-content p {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.5;
          margin: 0 0 20px;
        }
        .delete-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .delete-modal-btn {
          padding: 10px 24px;
          border-radius: 30px;
          border: none;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 100px;
        }
        .delete-modal-btn.cancel {
          background: var(--bg-input);
          color: var(--text-secondary);
        }
        .delete-modal-btn.cancel:hover {
          background: var(--border-color);
        }
        .delete-modal-btn.confirm {
          background: #ef4444;
          color: #fff;
        }
        .delete-modal-btn.confirm:hover {
          background: #dc2626;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScale {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default DeleteConfirmationModal;