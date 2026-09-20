// src/components/pages/Profile/AvatarCustomizer.jsx
import React, { useState } from 'react';
import ECHOMOJI from '../../UI/ECHOMOJI'; // FIXED: Changed from '../UI/ECHOMOJI'
import { SKINS, HAIR_STYLES } from '../../../constants/echomoji'; // FIXED: Changed from '../../constants/echomoji'

const AvatarCustomizer = ({ currentSkin, currentHair, currentMood, onSave, onCancel }) => {
  const [selectedSkinId, setSelectedSkinId] = useState(currentSkin?.id || 'light');
  const [selectedHairId, setSelectedHairId] = useState(currentHair || 'short');

  const activeSkin = SKINS.find(s => s.id === selectedSkinId) || SKINS[0];

  const handleSave = () => {
    onSave({
      activeSkin: selectedSkinId,
      hairStyle: selectedHairId,
    });
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '16px',
      padding: '20px',
      marginTop: '16px',
      border: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
    }}>
      {/* Live Preview */}
      <div style={{
        background: 'var(--bg-input)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        minHeight: '180px',
      }}>
        <ECHOMOJI
          mood={currentMood || 'happy'}
          skin={activeSkin}
          hairStyle={selectedHairId}
          size={100}
          interactive={false}
          animated={true}
        />
      </div>

      {/* Hair Style Picker */}
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
          HAIR STYLE
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {HAIR_STYLES.map((hair) => (
            <button
              key={hair.id}
              onClick={() => setSelectedHairId(hair.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: selectedHairId === hair.id ? '2px solid #6C3CE1' : '1px solid var(--border-color)',
                background: selectedHairId === hair.id ? 'rgba(108, 60, 225, 0.1)' : 'var(--bg-input)',
                color: selectedHairId === hair.id ? '#6C3CE1' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {hair.name}
            </button>
          ))}
        </div>
      </div>

      {/* Skin Tone Picker */}
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
          SKIN TONE
        </div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {SKINS.map((skin) => (
            <button
              key={skin.id}
              onClick={() => setSelectedSkinId(skin.id)}
              title={skin.name}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: selectedSkinId === skin.id ? '3px solid #6C3CE1' : '2px solid var(--border-color)',
                background: `linear-gradient(135deg, ${skin.skinLight}, ${skin.skinBase}, ${skin.skinShadow})`,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                boxShadow: selectedSkinId === skin.id ? '0 0 12px rgba(108, 60, 225, 0.4)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Save / Cancel Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', width: '100%' }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            color: '#fff',
            border: 'none',
            padding: '12px',
            borderRadius: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save Avatar
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            padding: '12px',
            borderRadius: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AvatarCustomizer;