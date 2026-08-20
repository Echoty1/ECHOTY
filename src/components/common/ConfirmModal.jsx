// src/components/common/ConfirmModal.jsx
import React from 'react';
import ReactDOM from 'react-dom';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showInput = false,
  inputPlaceholder = 'Enter reason...',
  inputValue = '',
  onInputChange = () => {},
  inputType = 'text',
  loading = false,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!loading) {
      // ✅ Pass the input value to onConfirm if showInput is true
      onConfirm(showInput ? inputValue : undefined);
    }
  };

  return ReactDOM.createPortal(
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <h3>{title}</h3>
          <button className="confirm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="confirm-modal-body">
          <p className="confirm-modal-message">{message}</p>
          {showInput && (
            <input
              type={inputType}
              className="confirm-modal-input"
              placeholder={inputPlaceholder}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn cancel" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            className={`confirm-modal-btn confirm ${loading ? 'loading' : ''}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="confirm-modal-spinner" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>

      <style>{`
        .confirm-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          animation: confirmFadeIn 0.2s ease;
        }
        .confirm-modal-content {
          background: #1a1a24;
          border-radius: 20px;
          padding: 28px 24px 24px;
          max-width: 420px;
          width: 90%;
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);
          animation: confirmScaleIn 0.2s ease;
          position: relative;
          z-index: 1000000;
        }
        .confirm-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .confirm-modal-header h3 {
          color: #fff;
          font-size: 18px;
          margin: 0;
        }
        .confirm-modal-close {
          background: none;
          border: none;
          color: #888;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .confirm-modal-close:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .confirm-modal-body {
          margin-bottom: 20px;
        }
        .confirm-modal-message {
          color: #ccc;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 12px 0;
        }
        .confirm-modal-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .confirm-modal-input:focus {
          border-color: #6C3CE1;
        }
        .confirm-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .confirm-modal-btn {
          padding: 10px 24px;
          border-radius: 30px;
          border: none;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 80px;
        }
        .confirm-modal-btn.cancel {
          background: rgba(255, 255, 255, 0.08);
          color: #ccc;
        }
        .confirm-modal-btn.cancel:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }
        .confirm-modal-btn.confirm {
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
        }
        .confirm-modal-btn.confirm:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 4px 20px rgba(108, 60, 225, 0.3);
        }
        .confirm-modal-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .confirm-modal-btn.confirm.loading {
          background: #444;
        }
        .confirm-modal-spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: confirmSpin 0.8s linear infinite;
        }
        @keyframes confirmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmScaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes confirmSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default ConfirmModal;