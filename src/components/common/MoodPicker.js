import React from 'react';
import ECHOMOJI from '../UI/ECHOMOJI';

const moods = ['neutral', 'happy', 'excited', 'angry', 'sad'];

const MoodPicker = ({ currentMood, onSelect }) => {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {moods.map((mood) => (
        <button
          key={mood}
          onClick={() => onSelect(mood)}
          style={{
            background: 'none',
            border: currentMood === mood ? '2px solid #6C3CE1' : '2px solid transparent',
            borderRadius: '16px',
            padding: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            transform: currentMood === mood ? 'scale(1.05)' : 'scale(1)',
            boxShadow: currentMood === mood ? '0 0 20px rgba(108,60,225,0.3)' : 'none',
          }}
        >
          <ECHOMOJI mood={mood} size={40} interactive={false} />
        </button>
      ))}
    </div>
  );
};

export default MoodPicker;