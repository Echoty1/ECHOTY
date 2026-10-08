// src/components/pages/Profile/UsernameEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { hapticLight, hapticSuccess, hapticError } from '../../../utils/haptics';
import { useClaimUsername, useUsernameAvailability } from '../../../hooks/useUsername';
import { suggestAlternates } from '../../../utils/usernameValidation';
import './UsernameEditor.css';

const UsernameEditor = ({ uid, currentUsername, isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  const { status, loading: checking, error: checkError } = useUsernameAvailability(input);
  const { claim, claiming, result } = useClaimUsername(uid);

  useEffect(() => {
    if (isOpen) {
      setInput(currentUsername || '');
      setSuggestions([]);
      hapticLight();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, currentUsername]);

  useEffect(() => {
    if (status === 'taken' && input) {
      setSuggestions(suggestAlternates(input));
    } else {
      setSuggestions([]);
    }
  }, [status, input]);

  if (!isOpen) return null;

  const isUnchanged = input.trim().toLowerCase() === (currentUsername || '').toLowerCase();
  const canSubmit =
    !claiming &&
    !checking &&
    status === 'available' &&
    input.trim().length >= 3 &&
    !isUnchanged;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    hapticLight();
    const res = await claim(input);
    if (res.ok) {
      hapticSuccess();
      onClose?.();
    } else {
      hapticError();
    }
  };

  const handleSuggestion = (sug) => {
    hapticLight();
    setInput(sug);
  };

  const getStatusMessage = () => {
    if (checking) return { text: 'Checking...', className: 'checking' };
    if (!input.trim()) return null;
    if (isUnchanged) return { text: 'This is your current username', className: 'idle' };
    if (status === 'available') return { text: '✓ Available', className: 'available' };
    if (status === 'taken') return { text: '✗ Already taken', className: 'taken' };
    if (status === 'invalid' && checkError) return { text: `✗ ${checkError}`, className: 'invalid' };
    return null;
  };

  const statusMsg = getStatusMessage();

  return (
    <div
      className="username-editor-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="username-editor-sheet">
        <div className="username-editor-handle" aria-hidden="true" />

        <div className="username-editor-header">
          <h2>Choose your @username</h2>
          <p>This is how people will find and mention you on ECHO.</p>
        </div>

        <div className="username-editor-input-wrap">
          <span className="username-editor-prefix">@</span>
          <input
            ref={inputRef}
            type="text"
            className="username-editor-input"
            value={input}
            onChange={(e) => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="yourhandle"
            maxLength={20}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) handleSubmit();
              if (e.key === 'Escape') onClose?.();
            }}
          />
          <span className="username-editor-length">{input.length}/20</span>
        </div>

        {statusMsg && (
          <div className={`username-editor-status ${statusMsg.className}`}>
            {statusMsg.text}
          </div>
        )}

        {result && !result.ok && (
          <div className="username-editor-status invalid">{result.error}</div>
        )}

        {suggestions.length > 0 && (
          <div className="username-editor-suggestions">
            <div className="username-editor-suggestions-label">Try one of these:</div>
            <div className="username-editor-suggestions-list">
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  className="username-editor-suggestion"
                  onClick={() => handleSuggestion(sug)}
                >
                  @{sug}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="username-editor-rules">
          <span>3–20 characters</span>
          <span>•</span>
          <span>Letters, numbers, _</span>
          <span>•</span>
          <span>Must start with a letter</span>
        </div>

        <div className="username-editor-actions">
          <button
            type="button"
            className="username-editor-btn cancel"
            onClick={onClose}
            disabled={claiming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="username-editor-btn primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {claiming ? 'Saving...' : isUnchanged ? 'No change' : 'Save username'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsernameEditor;
