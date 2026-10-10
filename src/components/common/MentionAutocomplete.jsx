// src/components/common/MentionAutocomplete.jsx
import React, { useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { hapticLight } from '../../utils/haptics';
import './MentionAutocomplete.css';

const MentionAutocomplete = ({
  visible,
  suggestions,
  activeIndex,
  onSelect,
  onHover,
  position = 'above',
}) => {
  const listRef = useRef(null);

  useEffect(() => {
    if (!visible || !listRef.current) return;
    const active = listRef.current.children[activeIndex];
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, visible]);

  if (!visible || !suggestions || suggestions.length === 0) return null;

  return (
    <div className={`mention-ac mention-ac-${position}`}>
      <div className="mention-ac-header">Mentions</div>
      <div className="mention-ac-list" ref={listRef}>
        {suggestions.map((s, idx) => (
          <button
            key={s.uid || s.handle}
            type="button"
            className={`mention-ac-item ${idx === activeIndex ? 'active' : ''}`}
            onMouseEnter={() => onHover(idx)}
            onMouseDown={(e) => {
              e.preventDefault();
              hapticLight();
              onSelect(s);
            }}
          >
            {s.isEveryone ? (
              <div className="mention-ac-everyone">@</div>
            ) : (
              <Avatar src={s.avatar} name={s.name} size={32} />
            )}
            <div className="mention-ac-info">
              <strong>{s.isEveryone ? 'everyone' : s.name}</strong>
              <span>
                {s.isEveryone ? 'Notify all members' : `@${s.username || s.handle}`}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MentionAutocomplete;
